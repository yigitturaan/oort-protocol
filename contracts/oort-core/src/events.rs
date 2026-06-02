use soroban_sdk::{contractevent, Address, BytesN};

use crate::types::VerificationResult;

#[contractevent]
pub struct VaultLocked {
    #[topic]
    pub intent_id: BytesN<16>,
    pub owner: Address,
    pub agent: Address,
    pub amount: i128,
}

#[contractevent]
pub struct AgentCommitted {
    #[topic]
    pub intent_id: BytesN<16>,
    pub agent: Address,
    pub commit_hash: BytesN<32>,
}

#[contractevent]
pub struct Verified {
    #[topic]
    pub intent_id: BytesN<16>,
    pub agent: Address,
    pub amount: i128,
    pub oracle_result: VerificationResult,
    pub deviation_bps: u32,
}

#[contractevent]
pub struct Rejected {
    #[topic]
    pub intent_id: BytesN<16>,
    pub agent: Address,
    pub amount: i128,
    pub oracle_result: VerificationResult,
    pub slash_amount: i128,
}

#[contractevent]
pub struct Refunded {
    #[topic]
    pub intent_id: BytesN<16>,
    pub owner: Address,
    pub amount: i128,
}

#[contractevent]
pub struct ReputationUpdated {
    #[topic]
    pub agent: Address,
    pub old_score: u32,
    pub new_score: u32,
    pub is_banned: bool,
}
