#![no_std]
use soroban_sdk::{contract, contractimpl, Env};

#[contract]
pub struct OortPriceVerifier;

#[contractimpl]
impl OortPriceVerifier {
    pub fn version(env: Env) -> u32 {
        env.storage().instance().extend_ttl(100, 100);
        1
    }
}
