export interface AgentClaim {
  priceFeed: string;
  claimedPrice: bigint;
  reasoning: string;
  action: string;
  protocol: string;
  expectedOutputMin: bigint;
  footprintHash: Buffer;
  footprintContracts: string[];
  timestamp: bigint;
  expiryLedger: number;
}

export interface OortConfig {
  rpcUrl: string;
  networkPassphrase: string;
  contractId: string;
  oracleIds: string[];
}

export interface VaultUpdate {
  intentId: Buffer;
  status: "Locked" | "Committed" | "Executed" | "Refunded" | "Expired";
  agent: string;
  owner: string;
  amount: bigint;
}

export interface VerifyResult {
  executed: boolean;
  txHash?: string;
}

export interface ReputationInfo {
  agent: string;
  score: number;
  totalVerifications: number;
  passed: number;
  failed: number;
  totalVolume: bigint;
  stake: bigint;
  isBanned: boolean;
}
