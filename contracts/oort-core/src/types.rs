#![allow(dead_code)]
use soroban_sdk::{contracttype, contracterror, Address, BytesN, String, Symbol, Vec};

// ── Escrow (Temporary storage: intent_id → Escrow) ──

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct Escrow {
    pub intent_id: BytesN<16>,
    pub owner: Address,
    pub agent: Address,
    pub token: Address,
    pub amount: i128,
    pub created_at: u64,
    pub expiry_ledger: u32,
    pub status: EscrowStatus,
    pub commit_hash: BytesN<32>,
    pub verified: bool,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum EscrowStatus {
    Locked,
    Committed,
    Executed,
    Refunded,
    Expired,
}

// ── Reputation (Persistent storage: DataKey::Reputation(agent) → Reputation) ──

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct Reputation {
    pub agent: Address,
    pub score: u32,
    pub total_verifications: u32,
    pub passed: u32,
    pub failed: u32,
    pub total_volume: i128,
    pub stake: i128,
    pub registered_at: u64,
    pub last_verified: u64,
    pub is_banned: bool,
}

// ── AgentClaim (serialization source of truth for Katman-1 hash) ──
// TS SDK serializes this struct to Bytes via soroban_sdk ScVal encoding.
// Contract receives it as opaque Bytes, hashes with sha256.
// claimed_price is also passed as a separate param for Katman-2 oracle check.

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct AgentClaim {
    pub price_feed: Symbol,
    pub claimed_price: i128,
    pub reasoning: String,
    pub action: Symbol,
    pub protocol: Address,
    pub expected_output_min: i128,
    pub footprint_hash: BytesN<32>,
    pub footprint_contracts: Vec<Address>,
    pub timestamp: u64,
    pub expiry_ledger: u32,
}

// ── Verification result (price oracle layer) ──

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum VerificationResult {
    Passed(u32),
    SoftReject(u32),
    HardReject(u32),
}

// ── Policy result (spending limit / whitelist / slippage) ──

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum PolicyResult {
    Allowed,
    Denied(String),
}

// ── Spending tracker (Persistent: DataKey::SpendingLimit(agent)) ──

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct SpendingTracker {
    pub spent: i128,
    pub window_start: u64,
    pub daily_limit: i128,
}

// ── Errors ──

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum OortError {
    NotInitialized = 1,
    AgentBanned = 2,
    InvalidExpiry = 3,
    InvalidState = 4,
    Expired = 5,
    HashMismatch = 6,
    OracleRejected = 7,
    PolicyDenied = 8,
    InsufficientStake = 9,
    Unauthorized = 10,
    NotExpired = 11,
    FootprintRejected = 12,
    AlreadyRegistered = 13,
}

// ── Storage keys (DataKey) ──

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    XlmToken,
    UsdcToken,
    OracleAddresses,
    Config,
    Whitelist,
    SpendingLimit(Address),
    Reputation(Address),
    Escrow(BytesN<16>),
}
