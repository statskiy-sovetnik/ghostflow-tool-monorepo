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
  | { kind: 'operation'; data: DeFiOperation }
  | { kind: 'native-transfer'; data: NativeTransfer };

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
  supplier: string;
  onBehalfOf: string | null;
}

export interface AaveBorrowOperation extends DeFiOperation {
  type: 'aave-borrow';
  asset: string;
  assetName: string;
  assetSymbol: string;
  assetLogo: string | null;
  amount: string;
  decimals: number;
  borrower: string;
}

export interface AaveRepayOperation extends DeFiOperation {
  type: 'aave-repay';
  asset: string;
  assetName: string;
  assetSymbol: string;
  assetLogo: string | null;
  amount: string;
  decimals: number;
  repayer: string;
  onBehalfOf: string | null;
}

export interface AaveWithdrawOperation extends DeFiOperation {
  type: 'aave-withdraw';
  asset: string;
  assetName: string;
  assetSymbol: string;
  assetLogo: string | null;
  amount: string;
  decimals: number;
  withdrawer: string;
  to: string | null;
}

export interface UniswapSwapToken {
  address: string;
  symbol: string;
  name: string;
  logo: string | null;
  decimals: number;
  amount: string;
  isNative?: boolean;
}

export interface UniswapSwapOperation extends DeFiOperation {
  type: 'uniswap-swap';
  version: 'v2' | 'v3' | 'v4';
  tokenIn: UniswapSwapToken;
  tokenOut: UniswapSwapToken;
  sender: string;
  recipient: string;
  hops: number;
}

export interface UniswapSwapResult {
  operations: UniswapSwapOperation[];
  transferIndicesToRemove: number[];
  nativeTransfersToConsume: Array<{ from: string; to: string; value: string }>;
}

export interface UniswapLiquidityToken {
  address: string;
  symbol: string;
  name: string;
  logo: string | null;
  decimals: number;
  amount: string;
  isNative?: boolean;
}

export interface UniswapAddLiquidityOperation extends DeFiOperation {
  type: 'uniswap-add-liquidity';
  version: 'v2' | 'v3';
  token0: UniswapLiquidityToken;
  token1: UniswapLiquidityToken;
  provider: string;
}

export interface UniswapRemoveLiquidityOperation extends DeFiOperation {
  type: 'uniswap-remove-liquidity';
  version: 'v2' | 'v3';
  token0: UniswapLiquidityToken;
  token1: UniswapLiquidityToken;
  recipient: string;
}

export interface UniswapCollectFeesOperation extends DeFiOperation {
  type: 'uniswap-collect-fees';
  version: 'v3';
  token0: UniswapLiquidityToken;
  token1: UniswapLiquidityToken;
  collector: string;
}

export interface UniswapLiquidityResult {
  operations: (UniswapAddLiquidityOperation | UniswapRemoveLiquidityOperation | UniswapCollectFeesOperation)[];
  transferIndicesToRemove: number[];
  nativeTransfersToConsume: Array<{ from: string; to: string; value: string }>;
}

export interface TokenMetadata {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logo: string | null;
}

export interface MoralisInternalTransaction {
  transaction_hash: string;
  block_number: number;
  block_hash: string;
  type: string;
  from: string;
  to: string;
  value: string;
  gas: string;
  gas_used: string;
  input: string;
  output: string;
  error: string | null;
}

export interface NativeTransfer {
  from: string;
  to: string;
  amount: string;
  logIndex: number;
}
