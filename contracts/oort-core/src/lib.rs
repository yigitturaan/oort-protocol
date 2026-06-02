#![no_std]
use soroban_sdk::{contract, contractimpl, Address, Bytes, BytesN, Env, Symbol, Vec};

pub mod types;
pub mod events;
pub mod vault;
pub mod guard;
pub mod reputation;
pub mod price_verifier;
pub mod policies;
#[cfg(test)]
mod test;

use types::{DataKey, OortError, Reputation};

// ── Protocol Constants (spec-exact) ──

// Stake
pub const MIN_STAKE: i128 = 1_000_0000000; // 1000 XLM (7 decimals)
pub const SLASH_BPS: i128 = 1000; // 10% slash on HardReject

// Oracle tolerance (basis points)
pub const SOFT_TOLERANCE_BPS: i128 = 150; // 1.5%
pub const HARD_TOLERANCE_BPS: i128 = 500; // 5.0%

// Reputation
pub const REP_INITIAL: u32 = 1000;
pub const REP_PASS: u32 = 20; // +20 on successful verification
pub const REP_HARD_REJECT: u32 = 50; // -50 on hard reject
pub const REP_SOFT_REJECT: u32 = 5; // -5 on soft reject
pub const REP_TIMEOUT: u32 = 10; // -10 on timeout/expiry
pub const REP_BAN_THRESHOLD: u32 = 100;
pub const REP_MAX: u32 = 2000;

// K-factor (ELO-inspired)
pub const K_NEW: u32 = 40; // <50 verifications
pub const K_MID: u32 = 20; // 50-200 verifications
pub const K_EXP: u32 = 10; // 200+ verifications
pub const K_NEW_LIMIT: u32 = 50;
pub const K_MID_LIMIT: u32 = 200;

// TTL (ledgers)
pub const INTENT_TTL: u32 = 300; // ~25 minutes
pub const PERSISTENT_MIN_TTL: u32 = 1000;
pub const PERSISTENT_EXTEND_TO: u32 = 518_400; // ~30 days
pub const INSTANCE_MIN_TTL: u32 = 100;
pub const INSTANCE_EXTEND_TO: u32 = 518_400;

// Slippage guard
pub const MAX_SLIPPAGE_BPS: i128 = 200; // 2% max slippage

// Oracle heartbeat
pub const ORACLE_STALENESS_SECS: u64 = 600; // 10 min max age
pub const MIN_ORACLE_SOURCES: u32 = 2;

#[contract]
pub struct OortProtocol;

#[contractimpl]
impl OortProtocol {
    pub fn __constructor(
        env: Env,
        admin: Address,
        xlm_token: Address,
        usdc_token: Address,
        oracle_addresses: Vec<Address>,
        whitelist: Vec<Address>,
    ) {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::XlmToken, &xlm_token);
        env.storage().instance().set(&DataKey::UsdcToken, &usdc_token);
        env.storage().instance().set(&DataKey::OracleAddresses, &oracle_addresses);
        env.storage().instance().set(&DataKey::Whitelist, &whitelist);
        env.storage().instance().extend_ttl(INSTANCE_MIN_TTL, INSTANCE_EXTEND_TO);
    }

    pub fn version(_env: Env) -> u32 {
        1
    }

    pub fn register_agent(env: Env, agent: Address, stake_amount: i128) -> Result<(), OortError> {
        vault::register_agent(&env, agent, stake_amount)
    }

    pub fn lock_vault(
        env: Env,
        intent_id: BytesN<16>,
        owner: Address,
        agent: Address,
        token_addr: Address,
        amount: i128,
        expiry_ledger: u32,
    ) -> Result<(), OortError> {
        vault::lock_vault(&env, intent_id, owner, agent, token_addr, amount, expiry_ledger)
    }

    pub fn refund(env: Env, intent_id: BytesN<16>) -> Result<(), OortError> {
        vault::refund(&env, intent_id)
    }

    pub fn commit(env: Env, intent_id: BytesN<16>, claim_hash: BytesN<32>) -> Result<(), OortError> {
        guard::commit(&env, intent_id, claim_hash)
    }

    pub fn verify_and_execute(
        env: Env,
        intent_id: BytesN<16>,
        claim_data: Bytes,
        claimed_price: i128,
        asset_symbol: Symbol,
    ) -> Result<bool, OortError> {
        // F2 fix: Read oracle addresses from Instance storage, not from caller
        let oracle_addresses: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::OracleAddresses)
            .ok_or(OortError::NotInitialized)?;
        guard::verify_and_execute(&env, intent_id, claim_data, claimed_price, asset_symbol, oracle_addresses)
    }

    pub fn get_reputation(env: Env, agent: Address) -> Result<Reputation, OortError> {
        reputation::get_reputation(&env, &agent)
    }

    pub fn set_spending_limit(env: Env, agent: Address, daily_limit: i128) -> Result<(), OortError> {
        policies::set_spending_limit(&env, &agent, daily_limit)
    }

    pub fn set_whitelist(env: Env, whitelist: Vec<Address>) -> Result<(), OortError> {
        policies::set_whitelist(&env, whitelist)
    }
}
