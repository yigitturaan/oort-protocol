#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, Address, Env, Symbol, Vec,
};

// ── SEP-40 types (birebir Reflector uyumlu) ──

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum Asset {
    Stellar(Address),
    Other(Symbol),
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct PriceData {
    pub price: i128,
    pub timestamp: u64,
}

// ── Storage keys ──

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Price(Asset),
}

#[contract]
pub struct OortMockOracle;

#[contractimpl]
impl OortMockOracle {
    // ── Admin init (constructor) ──

    pub fn __constructor(env: Env, admin: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().extend_ttl(100, 518_400);
    }

    // ── Test helper: set price for an asset ──

    pub fn set_price(env: Env, asset: Asset, price: i128, timestamp: u64) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let pd = PriceData { price, timestamp };
        env.storage().instance().set(&DataKey::Price(asset), &pd);
        env.storage().instance().extend_ttl(100, 518_400);
    }

    // ── SEP-40 PriceFeedTrait ──

    pub fn lastprice(env: Env, asset: Asset) -> Option<PriceData> {
        env.storage().instance().get(&DataKey::Price(asset))
    }

    pub fn price(env: Env, asset: Asset, timestamp: u64) -> Option<PriceData> {
        let pd: Option<PriceData> = env.storage().instance().get(&DataKey::Price(asset));
        match pd {
            Some(p) if p.timestamp == timestamp => Some(p),
            _ => None,
        }
    }

    pub fn prices(env: Env, asset: Asset, records: u32) -> Option<Vec<PriceData>> {
        let pd: Option<PriceData> = env.storage().instance().get(&DataKey::Price(asset));
        match pd {
            Some(p) => {
                let mut v = Vec::new(&env);
                let count = if records > 0 { 1u32.min(records) } else { 0 };
                for _ in 0..count {
                    v.push_back(p.clone());
                }
                Some(v)
            }
            None => None,
        }
    }

    pub fn lastprices(env: Env, assets: Vec<Asset>) -> Vec<Option<PriceData>> {
        let mut result = Vec::new(&env);
        for asset in assets.iter() {
            let pd: Option<PriceData> = env.storage().instance().get(&DataKey::Price(asset));
            result.push_back(pd);
        }
        result
    }

    pub fn base(env: Env) -> Asset {
        Asset::Other(Symbol::new(&env, "USD"))
    }

    pub fn assets(env: Env) -> Vec<Asset> {
        let mut v = Vec::new(&env);
        v.push_back(Asset::Other(Symbol::new(&env, "XLM")));
        v.push_back(Asset::Other(Symbol::new(&env, "USDC")));
        v
    }

    pub fn decimals(_env: Env) -> u32 {
        14
    }

    pub fn resolution(_env: Env) -> u32 {
        300
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::Env;

    #[test]
    fn test_set_and_get_price() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let contract_id = env.register(OortMockOracle, (&admin,));
        let client = OortMockOracleClient::new(&env, &contract_id);

        let xlm = Asset::Other(Symbol::new(&env, "XLM"));
        let price: i128 = 12_100_000_000_000; // $0.121 at 14 decimals
        let ts: u64 = 1_700_000_000;

        client.set_price(&xlm, &price, &ts);

        let result = client.lastprice(&xlm);
        assert!(result.is_some());
        let pd = result.unwrap();
        assert_eq!(pd.price, price);
        assert_eq!(pd.timestamp, ts);
    }

    #[test]
    fn test_price_by_timestamp() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let contract_id = env.register(OortMockOracle, (&admin,));
        let client = OortMockOracleClient::new(&env, &contract_id);

        let xlm = Asset::Other(Symbol::new(&env, "XLM"));
        let price: i128 = 12_100_000_000_000;
        let ts: u64 = 1_700_000_000;

        client.set_price(&xlm, &price, &ts);

        let exact = client.price(&xlm, &ts);
        assert!(exact.is_some());

        let wrong_ts = client.price(&xlm, &(ts + 1));
        assert!(wrong_ts.is_none());
    }

    #[test]
    fn test_no_price_returns_none() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let contract_id = env.register(OortMockOracle, (&admin,));
        let client = OortMockOracleClient::new(&env, &contract_id);

        let usdc = Asset::Other(Symbol::new(&env, "USDC"));
        let result = client.lastprice(&usdc);
        assert!(result.is_none());
    }

    #[test]
    fn test_decimals_and_resolution() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let contract_id = env.register(OortMockOracle, (&admin,));
        let client = OortMockOracleClient::new(&env, &contract_id);

        assert_eq!(client.decimals(), 14);
        assert_eq!(client.resolution(), 300);
    }

    #[test]
    fn test_base_and_assets() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let contract_id = env.register(OortMockOracle, (&admin,));
        let client = OortMockOracleClient::new(&env, &contract_id);

        let base = client.base();
        assert_eq!(base, Asset::Other(Symbol::new(&env, "USD")));

        let assets = client.assets();
        assert_eq!(assets.len(), 2);
    }
}
