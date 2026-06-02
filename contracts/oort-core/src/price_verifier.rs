use soroban_sdk::{Address, Env, Symbol, Vec};

use crate::types::VerificationResult;
use crate::{HARD_TOLERANCE_BPS, MIN_ORACLE_SOURCES, ORACLE_STALENESS_SECS, SOFT_TOLERANCE_BPS};

mod oracle {
    soroban_sdk::contractimport!(
        file = "../../target/wasm32v1-none/release/oort_mock_oracle.wasm"
    );
}

pub use oracle::Asset;
pub use oracle::PriceData;

pub fn verify_price(
    env: &Env,
    claimed_price: i128,
    asset_symbol: Symbol,
    oracle_addresses: &Vec<Address>,
) -> VerificationResult {
    let now = env.ledger().timestamp();
    let asset = Asset::Other(asset_symbol);

    let mut valid_prices: Vec<i128> = Vec::new(env);

    for oracle_addr in oracle_addresses.iter() {
        let client = oracle::Client::new(env, &oracle_addr);
        let pd: Option<PriceData> = client.lastprice(&asset);

        if let Some(data) = pd {
            if now >= data.timestamp && (now - data.timestamp) <= ORACLE_STALENESS_SECS {
                valid_prices.push_back(data.price);
            }
        }
    }

    if valid_prices.len() < MIN_ORACLE_SOURCES {
        return VerificationResult::HardReject(10000);
    }

    let median = calculate_median(env, &valid_prices);

    if median <= 0 {
        return VerificationResult::HardReject(10000);
    }

    let diff = if claimed_price > median {
        claimed_price - median
    } else {
        median - claimed_price
    };

    let deviation_bps = (diff * 10000) / median;

    if deviation_bps <= SOFT_TOLERANCE_BPS {
        VerificationResult::Passed(deviation_bps as u32)
    } else if deviation_bps <= HARD_TOLERANCE_BPS {
        VerificationResult::SoftReject(deviation_bps as u32)
    } else {
        VerificationResult::HardReject(deviation_bps as u32)
    }
}

fn calculate_median(env: &Env, prices: &Vec<i128>) -> i128 {
    let len = prices.len();
    if len == 0 {
        return 0;
    }

    let mut sorted: Vec<i128> = Vec::new(env);
    for p in prices.iter() {
        sorted.push_back(p);
    }

    for i in 1..len {
        let val = sorted.get(i).unwrap();
        let mut j = i;
        while j > 0 {
            let prev = sorted.get(j - 1).unwrap();
            if prev <= val {
                break;
            }
            sorted.set(j, prev);
            j -= 1;
        }
        sorted.set(j, val);
    }

    if len % 2 == 1 {
        sorted.get(len / 2).unwrap()
    } else {
        let a = sorted.get(len / 2 - 1).unwrap();
        let b = sorted.get(len / 2).unwrap();
        (a + b) / 2
    }
}
