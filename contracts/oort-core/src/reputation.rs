use soroban_sdk::{Address, Env, token};

use crate::events;
use crate::types::{DataKey, OortError, Reputation};
use crate::{
    PERSISTENT_EXTEND_TO, PERSISTENT_MIN_TTL,
    REP_BAN_THRESHOLD, REP_HARD_REJECT, REP_MAX, REP_PASS,
    REP_SOFT_REJECT, REP_TIMEOUT, SLASH_BPS,
    K_EXP, K_MID, K_MID_LIMIT, K_NEW, K_NEW_LIMIT,
};

pub fn update_reputation(
    env: &Env,
    agent: &Address,
    passed: bool,
    is_hard_reject: bool,
    volume: i128,
) {
    let key = DataKey::Reputation(agent.clone());
    let mut rep: Reputation = match env.storage().persistent().get(&key) {
        Some(r) => r,
        None => return,
    };

    let old_score = rep.score;
    rep.total_verifications += 1;

    let k = if rep.total_verifications < K_NEW_LIMIT {
        K_NEW
    } else if rep.total_verifications < K_MID_LIMIT {
        K_MID
    } else {
        K_EXP
    };

    if passed {
        rep.passed += 1;
        let delta = (REP_PASS * k) / K_NEW;
        rep.score = rep.score.saturating_add(delta).min(REP_MAX);
    } else {
        rep.failed += 1;
        let penalty = if is_hard_reject {
            REP_HARD_REJECT
        } else {
            REP_SOFT_REJECT
        };
        let delta = (penalty * k) / K_NEW;
        rep.score = rep.score.saturating_sub(delta);
    }

    if rep.score < REP_BAN_THRESHOLD {
        rep.is_banned = true;
    }

    rep.total_volume = rep.total_volume.saturating_add(volume);
    rep.last_verified = env.ledger().timestamp();

    env.storage().persistent().set(&key, &rep);
    env.storage()
        .persistent()
        .extend_ttl(&key, PERSISTENT_MIN_TTL, PERSISTENT_EXTEND_TO);

    events::ReputationUpdated {
        agent: agent.clone(),
        old_score,
        new_score: rep.score,
        is_banned: rep.is_banned,
    }
    .publish(env);
}

pub fn update_reputation_timeout(env: &Env, agent: &Address) {
    let key = DataKey::Reputation(agent.clone());
    let mut rep: Reputation = match env.storage().persistent().get(&key) {
        Some(r) => r,
        None => return,
    };

    let old_score = rep.score;
    rep.score = rep.score.saturating_sub(REP_TIMEOUT);

    if rep.score < REP_BAN_THRESHOLD {
        rep.is_banned = true;
    }

    rep.last_verified = env.ledger().timestamp();

    env.storage().persistent().set(&key, &rep);
    env.storage()
        .persistent()
        .extend_ttl(&key, PERSISTENT_MIN_TTL, PERSISTENT_EXTEND_TO);

    events::ReputationUpdated {
        agent: agent.clone(),
        old_score,
        new_score: rep.score,
        is_banned: rep.is_banned,
    }
    .publish(env);
}

pub fn slash_agent(env: &Env, agent: &Address) -> i128 {
    let key = DataKey::Reputation(agent.clone());
    let mut rep: Reputation = match env.storage().persistent().get(&key) {
        Some(r) => r,
        None => return 0,
    };

    let slash_amount = (rep.stake * SLASH_BPS) / 10_000;
    rep.stake = rep.stake.saturating_sub(slash_amount);

    env.storage().persistent().set(&key, &rep);
    env.storage()
        .persistent()
        .extend_ttl(&key, PERSISTENT_MIN_TTL, PERSISTENT_EXTEND_TO);

    // Transfer slashed XLM to admin (treasury)
    if slash_amount > 0 {
        if let Some(admin) = env.storage().instance().get::<DataKey, Address>(&DataKey::Admin) {
            if let Some(xlm_token) = env.storage().instance().get::<DataKey, Address>(&DataKey::XlmToken) {
                token::TokenClient::new(env, &xlm_token)
                    .transfer(&env.current_contract_address(), &admin, &slash_amount);
            }
        }
    }

    slash_amount
}

pub fn get_reputation(env: &Env, agent: &Address) -> Result<Reputation, OortError> {
    let key = DataKey::Reputation(agent.clone());
    env.storage()
        .persistent()
        .get(&key)
        .ok_or(OortError::InvalidState)
}
