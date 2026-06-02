use soroban_sdk::{Address, Bytes, BytesN, Env, Symbol, Vec, token};

use crate::events;
use crate::price_verifier;
use crate::reputation;
use crate::policies;
use crate::types::{AgentClaim, DataKey, Escrow, EscrowStatus, OortError, PolicyResult, VerificationResult};

pub fn compute_claim_hash(env: &Env, claim_data: &Bytes) -> BytesN<32> {
    env.crypto().sha256(claim_data).into()
}

pub fn commit(
    env: &Env,
    intent_id: BytesN<16>,
    claim_hash: BytesN<32>,
) -> Result<(), OortError> {
    let esc_key = DataKey::Escrow(intent_id.clone());
    let mut escrow: Escrow = env
        .storage()
        .temporary()
        .get(&esc_key)
        .ok_or(OortError::InvalidState)?;

    escrow.agent.require_auth();

    if escrow.status != EscrowStatus::Locked {
        return Err(OortError::InvalidState);
    }

    if env.ledger().sequence() >= escrow.expiry_ledger {
        return Err(OortError::Expired);
    }

    escrow.commit_hash = claim_hash.clone();
    escrow.status = EscrowStatus::Committed;
    env.storage().temporary().set(&esc_key, &escrow);

    events::AgentCommitted {
        intent_id,
        agent: escrow.agent,
        commit_hash: claim_hash,
    }
    .publish(env);

    Ok(())
}

pub fn verify_and_execute(
    env: &Env,
    intent_id: BytesN<16>,
    claim_data: Bytes,
    claimed_price: i128,
    asset_symbol: Symbol,
    oracle_addresses: Vec<Address>,
) -> Result<bool, OortError> {
    let esc_key = DataKey::Escrow(intent_id.clone());
    let mut escrow: Escrow = env
        .storage()
        .temporary()
        .get(&esc_key)
        .ok_or(OortError::InvalidState)?;

    escrow.agent.require_auth();

    if escrow.status != EscrowStatus::Committed {
        return Err(OortError::InvalidState);
    }

    if env.ledger().sequence() >= escrow.expiry_ledger {
        return Err(OortError::Expired);
    }

    // ── KATMAN 1: Hash eşleşmesi ──
    let computed_hash = compute_claim_hash(env, &claim_data);
    let hash_matched = computed_hash == escrow.commit_hash;

    // ── KATMAN 2: Multi-source oracle doğrulama ──
    let mut oracle_result = VerificationResult::HardReject(10000);
    if hash_matched {
        oracle_result =
            price_verifier::verify_price(env, claimed_price, asset_symbol, &oracle_addresses);
    }

    let oracle_passed = matches!(oracle_result, VerificationResult::Passed(_));
    let is_hard_reject = matches!(oracle_result, VerificationResult::HardReject(_));

    // Parse claim once for Katman 3 + 4
    let parsed_claim = if hash_matched && oracle_passed {
        use soroban_sdk::xdr::FromXdr;
        AgentClaim::from_xdr(env, &claim_data).ok()
    } else {
        None
    };

    // ── KATMAN 3: Footprint whitelist ──
    let footprint_passed = match &parsed_claim {
        Some(claim) => check_footprint_whitelist(env, &claim.footprint_contracts),
        None => false,
    };

    // ── KATMAN 4: Politika (spending limit + whitelist + slippage) ──
    let policy_passed = match &parsed_claim {
        Some(claim) if footprint_passed => matches!(
            policies::check_all_policies(env, claim, &escrow),
            PolicyResult::Allowed
        ),
        _ => false,
    };

    // ── KARAR ──
    if hash_matched && oracle_passed && footprint_passed && policy_passed {
        // ✅ TÜM KONTROLLER GEÇTİ
        escrow.verified = true;
        escrow.status = EscrowStatus::Executed;
        env.storage().temporary().set(&esc_key, &escrow);

        // MVP: fonu owner'a geri gönder (gerçek swap Faz 9+'da)
        token::TokenClient::new(env, &escrow.token)
            .transfer(&env.current_contract_address(), &escrow.owner, &escrow.amount);

        // F3 fix: Record spend only after successful execution
        policies::record_spend(env, &escrow.agent, escrow.amount);

        let deviation_bps = match oracle_result {
            VerificationResult::Passed(bps) => bps,
            _ => 0,
        };

        events::Verified {
            intent_id,
            agent: escrow.agent.clone(),
            amount: escrow.amount,
            oracle_result,
            deviation_bps,
        }
        .publish(env);

        reputation::update_reputation(env, &escrow.agent, true, false, escrow.amount);

        Ok(true)
    } else {
        // ❌ DOĞRULAMA BAŞARISIZ
        escrow.status = EscrowStatus::Refunded;
        env.storage().temporary().set(&esc_key, &escrow);

        // Fonu owner'a iade
        token::TokenClient::new(env, &escrow.token)
            .transfer(&env.current_contract_address(), &escrow.owner, &escrow.amount);

        // HardReject → slash
        let slash_amount = if is_hard_reject {
            reputation::slash_agent(env, &escrow.agent)
        } else {
            0
        };

        events::Rejected {
            intent_id,
            agent: escrow.agent.clone(),
            amount: escrow.amount,
            oracle_result,
            slash_amount,
        }
        .publish(env);

        reputation::update_reputation(env, &escrow.agent, false, is_hard_reject, escrow.amount);

        Ok(false)
    }
}

fn check_footprint_whitelist(env: &Env, footprint_contracts: &Vec<Address>) -> bool {
    let whitelist: Vec<Address> = env
        .storage()
        .instance()
        .get(&DataKey::Whitelist)
        .unwrap_or(Vec::new(env));

    // Empty whitelist = permissive (MVP default)
    if whitelist.is_empty() {
        return true;
    }

    // Empty footprint = no external contracts touched → OK
    if footprint_contracts.is_empty() {
        return true;
    }

    for contract in footprint_contracts.iter() {
        let mut found = false;
        for allowed in whitelist.iter() {
            if contract == allowed {
                found = true;
                break;
            }
        }
        if !found {
            return false;
        }
    }

    true
}

