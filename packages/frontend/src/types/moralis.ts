/**
 * TypeScript interfaces for Moralis transaction response structures
 */

export interface DecodedEventParam {
  name: string;
  type: string;
  value: string;
}

export interface DecodedEvent {
  label: string;
  signature: string;
  type: string;
  params: DecodedEventParam[];
}

export interface MoralisTransactionLog {
  address: string;
  block_number: string;
  block_hash: string;
  block_timestamp: string;
  data: string;
  log_index: string;
  transaction_hash: string;
  transaction_index: string;
  transaction_value: string;
  topic0: string;
  topic1: string | null;
  topic2: string | null;
  topic3: string | null;
  decoded_event: DecodedEvent | null;
}

export interface TokenTransfer {
  from: string;
  to: string;
  tokenAddress: string;
  tokenName: string;
  tokenSymbol: string;
  tokenLogo: string | null;
  amount: string;
  decimals: number;
  logIndex: number;
}

export type FlowItem =
  | { kind: 'transfer'; data: TokenTransfer }
  | { kind: 'operation'; data: DeFiOperation };

export interface TransactionResult {
  txHash: string;
  flow: FlowItem[];
}

export interface DecodedCall {
  label: string;
  signature: string;
  params: DecodedEventParam[];
}

export interface DeFiOperation {
  type: string;
  logIndex: number;
}

export interface AaveSupplyOperation extends DeFiOperation {
  type: 'aave-supply';
  asset: string;
  assetName: string;
  assetSymbol: string;
  assetLogo: string | null;
  amount: string;
  decimals: number;
  onBehalfOf: string | null;
}

export interface TokenMetadata {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logo: string | null;
}
