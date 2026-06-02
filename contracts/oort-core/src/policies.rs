use soroban_sdk::{Address, Env, String, Vec};

use crate::types::{AgentClaim, DataKey, Escrow, OortError, PolicyResult, SpendingTracker};
use crate::{INSTANCE_MIN_TTL, INSTANCE_EXTEND_TO, MAX_SLIPPAGE_BPS, PERSISTENT_MIN_TTL, PERSISTENT_EXTEND_TO};

const DAY_SECS: u64 = 86_400;
const DEFAULT_DAILY_LIMIT: i128 = 500_000000; // 500 USDC (6 decimals)

// ── SpendingLimitPolicy ──

pub fn check_spending_limit(
    env: &Env,
    agent: &Address,
    amount: i128,
) -> PolicyResult {
    let key = DataKey::SpendingLimit(agent.clone());
    let now = env.ledger().timestamp();

    let mut tracker: SpendingTracker = env
        .storage()
        .persistent()
        .get(&key)
        .unwrap_or(SpendingTracker {
            spent: 0,
            window_start: now,
            daily_limit: DEFAULT_DAILY_LIMIT,
        });

    // Reset window if a new day started
    if now >= tracker.window_start + DAY_SECS {
        tracker.spent = 0;
        tracker.window_start = now;
    }

    if tracker.spent + amount > tracker.daily_limit {
        return PolicyResult::Denied(String::from_str(env, "daily spending limit exceeded"));
    }

    // F3 fix: Do NOT record spend here — call record_spend() after successful execution
    PolicyResult::Allowed
}

pub fn record_spend(env: &Env, agent: &Address, amount: i128) {
    let key = DataKey::SpendingLimit(agent.clone());
    let now = env.ledger().timestamp();

    let mut tracker: SpendingTracker = env
        .storage()
        .persistent()
        .get(&key)
        .unwrap_or(SpendingTracker {
            spent: 0,
            window_start: now,
            daily_limit: DEFAULT_DAILY_LIMIT,
        });

    if now >= tracker.window_start + DAY_SECS {
        tracker.spent = 0;
        tracker.window_start = now;
    }

    tracker.spent += amount;
    env.storage().persistent().set(&key, &tracker);
    env.storage()
        .persistent()
        .extend_ttl(&key, PERSISTENT_MIN_TTL, PERSISTENT_EXTEND_TO);
}

pub fn set_spending_limit(
    env: &Env,
    agent: &Address,
    daily_limit: i128,
) -> Result<(), OortError> {
    let admin: Address = env
        .storage()
        .instance()
        .get(&DataKey::Admin)
        .ok_or(OortError::NotInitialized)?;
    admin.require_auth();

    let key = DataKey::SpendingLimit(agent.clone());
    let now = env.ledger().timestamp();

    let mut tracker: SpendingTracker = env
        .storage()
        .persistent()
        .get(&key)
        .unwrap_or(SpendingTracker {
            spent: 0,
            window_start: now,
            daily_limit,
        });

    tracker.daily_limit = daily_limit;
    env.storage().persistent().set(&key, &tracker);
    env.storage()
        .persistent()
        .extend_ttl(&key, PERSISTENT_MIN_TTL, PERSISTENT_EXTEND_TO);

    env.storage()
        .instance()
        .extend_ttl(INSTANCE_MIN_TTL, INSTANCE_EXTEND_TO);

    Ok(())
}

// ── ContractWhitelistPolicy ──

pub fn check_whitelist(
    env: &Env,
    protocol: &Address,
) -> PolicyResult {
    let whitelist: Vec<Address> = env
        .storage()
        .instance()
        .get(&DataKey::Whitelist)
        .unwrap_or(Vec::new(env));

    // Empty whitelist = all allowed (permissive default for MVP)
    if whitelist.is_empty() {
        return PolicyResult::Allowed;
    }

    for addr in whitelist.iter() {
        if addr == *protocol {
            return PolicyResult::Allowed;
        }
    }

    PolicyResult::Denied(String::from_str(env, "contract not in whitelist"))
}

pub fn set_whitelist(
    env: &Env,
    whitelist: Vec<Address>,
) -> Result<(), OortError> {
    let admin: Address = env
        .storage()
        .instance()
        .get(&DataKey::Admin)
        .ok_or(OortError::NotInitialized)?;
    admin.require_auth();

    env.storage().instance().set(&DataKey::Whitelist, &whitelist);
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_MIN_TTL, INSTANCE_EXTEND_TO);

    Ok(())
}

// ── SlippageGuardPolicy ──
// Checks if expected_output_min is within max_slippage_bps of the fair value.
// fair_value = amount * claimed_price / price_scale (approximate — MVP uses claimed_price
// because oracle median was already validated in Katman 2).

pub fn check_slippage(
    env: &Env,
    expected_output_min: i128,
    amount: i128,
    claimed_price: i128,
) -> PolicyResult {
    if claimed_price <= 0 || amount <= 0 {
        return PolicyResult::Denied(String::from_str(env, "invalid price or amount"));
    }

    // Fair output at claimed price (14-decimal oracle price):
    // If buying XLM with USDC: fair_output = amount(6dec) * 10^14 / claimed_price(14dec)
    //   → result in base units of output token
    // This is a simplified MVP calculation.
    let d14: i128 = 100_000_000_000_000;
    let fair_output = (amount * d14) / claimed_price;

    if fair_output <= 0 {
        return PolicyResult::Denied(String::from_str(env, "fair output is zero"));
    }

    // min_acceptable = fair_output * (10000 - max_slippage_bps) / 10000
    let min_acceptable = (fair_output * (10000 - MAX_SLIPPAGE_BPS)) / 10000;

    if expected_output_min < min_acceptable {
        return PolicyResult::Denied(String::from_str(env, "slippage too high"));
    }

    PolicyResult::Allowed
}

// ── check_all_policies: run all three, short-circuit on first Denied ──

pub fn check_all_policies(
    env: &Env,
    claim: &AgentClaim,
    escrow: &Escrow,
) -> PolicyResult {
    // 1. Spending limit
    let r1 = check_spending_limit(env, &escrow.agent, escrow.amount);
    if let PolicyResult::Denied(_) = &r1 {
        return r1;
    }

    // 2. Contract whitelist
    let r2 = check_whitelist(env, &claim.protocol);
    if let PolicyResult::Denied(_) = &r2 {
        return r2;
    }

    // 3. Slippage guard
    let r3 = check_slippage(
        env,
        claim.expected_output_min,
        escrow.amount,
        claim.claimed_price,
    );
    if let PolicyResult::Denied(_) = &r3 {
        return r3;
    }

    PolicyResult::Allowed
}
