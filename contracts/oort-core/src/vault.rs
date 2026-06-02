use soroban_sdk::{Address, BytesN, Env, token};

use crate::events;
use crate::reputation;
use crate::types::{DataKey, Escrow, EscrowStatus, OortError, Reputation};
use crate::{
    MIN_STAKE, REP_INITIAL, PERSISTENT_MIN_TTL, PERSISTENT_EXTEND_TO,
    INSTANCE_MIN_TTL, INSTANCE_EXTEND_TO,
};

pub fn register_agent(env: &Env, agent: Address, stake_amount: i128) -> Result<(), OortError> {
    agent.require_auth();

    // F1 fix: Prevent re-registration (ban bypass)
    let key = DataKey::Reputation(agent.clone());
    if env.storage().persistent().has(&key) {
        return Err(OortError::AlreadyRegistered);
    }

    if stake_amount < MIN_STAKE {
        return Err(OortError::InsufficientStake);
    }

    let xlm_token: Address = env
        .storage()
        .instance()
        .get(&DataKey::XlmToken)
        .ok_or(OortError::NotInitialized)?;

    token::TokenClient::new(env, &xlm_token)
        .transfer(&agent, &env.current_contract_address(), &stake_amount);

    let reputation = Reputation {
        agent: agent.clone(),
        score: REP_INITIAL,
        total_verifications: 0,
        passed: 0,
        failed: 0,
        total_volume: 0,
        stake: stake_amount,
        registered_at: env.ledger().timestamp(),
        last_verified: 0,
        is_banned: false,
    };

    env.storage().persistent().set(&key, &reputation);
    env.storage()
        .persistent()
        .extend_ttl(&key, PERSISTENT_MIN_TTL, PERSISTENT_EXTEND_TO);

    env.storage()
        .instance()
        .extend_ttl(INSTANCE_MIN_TTL, INSTANCE_EXTEND_TO);

    Ok(())
}

pub fn lock_vault(
    env: &Env,
    intent_id: BytesN<16>,
    owner: Address,
    agent: Address,
    token_addr: Address,
    amount: i128,
    expiry_ledger: u32,
) -> Result<(), OortError> {
    owner.require_auth();

    if amount <= 0 {
        return Err(OortError::InvalidState);
    }

    let rep_key = DataKey::Reputation(agent.clone());
    let rep: Reputation = env
        .storage()
        .persistent()
        .get(&rep_key)
        .ok_or(OortError::InvalidState)?;

    env.storage()
        .persistent()
        .extend_ttl(&rep_key, PERSISTENT_MIN_TTL, PERSISTENT_EXTEND_TO);

    if rep.is_banned {
        return Err(OortError::AgentBanned);
    }

    if expiry_ledger <= env.ledger().sequence() {
        return Err(OortError::InvalidExpiry);
    }

    token::TokenClient::new(env, &token_addr)
        .transfer(&owner, &env.current_contract_address(), &amount);

    let escrow = Escrow {
        intent_id: intent_id.clone(),
        owner: owner.clone(),
        agent: agent.clone(),
        token: token_addr,
        amount,
        created_at: env.ledger().timestamp(),
        expiry_ledger,
        status: EscrowStatus::Locked,
        commit_hash: BytesN::from_array(env, &[0u8; 32]),
        verified: false,
    };

    let esc_key = DataKey::Escrow(intent_id.clone());
    let ttl = expiry_ledger - env.ledger().sequence();
    env.storage().temporary().set(&esc_key, &escrow);
    env.storage().temporary().extend_ttl(&esc_key, ttl, ttl);

    events::VaultLocked {
        intent_id,
        owner,
        agent,
        amount,
    }
    .publish(env);

    Ok(())
}

pub fn refund(env: &Env, intent_id: BytesN<16>) -> Result<(), OortError> {
    let esc_key = DataKey::Escrow(intent_id.clone());
    let mut escrow: Escrow = env
        .storage()
        .temporary()
        .get(&esc_key)
        .ok_or(OortError::InvalidState)?;

    match escrow.status {
        EscrowStatus::Locked | EscrowStatus::Committed => {}
        _ => return Err(OortError::InvalidState),
    }

    if env.ledger().sequence() < escrow.expiry_ledger {
        return Err(OortError::NotExpired);
    }

    escrow.status = EscrowStatus::Expired;
    env.storage().temporary().set(&esc_key, &escrow);

    token::TokenClient::new(env, &escrow.token)
        .transfer(&env.current_contract_address(), &escrow.owner, &escrow.amount);

    reputation::update_reputation_timeout(env, &escrow.agent);

    events::Refunded {
        intent_id,
        owner: escrow.owner,
        amount: escrow.amount,
    }
    .publish(env);

    Ok(())
}
