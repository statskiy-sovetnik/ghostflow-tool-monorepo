import { describe, it, expect } from 'vitest';
import { keccak256, solidityPacked, AbiCoder, getAddress } from 'ethers';
import { detectUniswapLiquidity } from './uniswapLiquidityParser';
import {
  UNISWAP_V3_NPM,
  V3_INCREASE_LIQUIDITY_TOPIC0,
  V3_DECREASE_LIQUIDITY_TOPIC0,
  V3_NPM_COLLECT_TOPIC0,
  V3_POOL_MINT_TOPIC0,
  V3_POOL_BURN_TOPIC0,
  V2_MINT_TOPIC0,
  V2_BURN_TOPIC0,
  UNISWAP_V2_FACTORY,
  UNISWAP_V2_INIT_CODE_HASH,
  UNISWAP_V3_FACTORY,
  UNISWAP_V3_INIT_CODE_HASH,
  WETH_ADDRESS,
} from './uniswapConstants';
import type { MoralisTransactionLog, TokenTransfer, NativeTransfer } from '../types/moralis';

const USER = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const DAI = '0x6b175474e89094c44da98b954eedeac495271d0f';
const TOKEN_ID_1 = '0x0000000000000000000000000000000000000000000000000000000000000001';
const TOKEN_ID_2 = '0x0000000000000000000000000000000000000000000000000000000000000002';

function padAddress(addr: string): string {
  return '0x' + addr.slice(2).padStart(64, '0');
}

function sortTokens(a: string, b: string): [string, string] {
  const addrA = getAddress(a);
  const addrB = getAddress(b);
  return BigInt(addrA) < BigInt(addrB) ? [addrA, addrB] : [addrB, addrA];
}

function computeV2PairAddress(tokenA: string, tokenB: string): string {
  const [token0, token1] = sortTokens(tokenA, tokenB);
  const salt = keccak256(solidityPacked(['address', 'address'], [token0, token1]));
  const packed = solidityPacked(
    ['bytes1', 'address', 'bytes32', 'bytes32'],
    ['0xff', UNISWAP_V2_FACTORY, salt, UNISWAP_V2_INIT_CODE_HASH],
  );
  return '0x' + keccak256(packed).slice(-40);
}

function computeV3PoolAddress(tokenA: string, tokenB: string, fee: number): string {
  const [token0, token1] = sortTokens(tokenA, tokenB);
  const abiCoder = AbiCoder.defaultAbiCoder();
  const salt = keccak256(abiCoder.encode(['address', 'address', 'uint24'], [token0, token1, fee]));
  const packed = solidityPacked(
    ['bytes1', 'address', 'bytes32', 'bytes32'],
    ['0xff', UNISWAP_V3_FACTORY, salt, UNISWAP_V3_INIT_CODE_HASH],
  );
  return '0x' + keccak256(packed).slice(-40);
}

function makeLog(overrides: Partial<MoralisTransactionLog> = {}): MoralisTransactionLog {
  return {
    address: '0x0000000000000000000000000000000000000000',
    topic0: '0x0',
    topic1: null,
    topic2: null,
    topic3: null,
    data: '0x',
    block_number: '1',
    block_hash: '0x0',
    block_timestamp: '2024-01-01T00:00:00Z',
    log_index: '0',
    transaction_hash: '0x0',
    transaction_index: '0',
    transaction_value: '0',
    decoded_event: null,
    ...overrides,
  };
}

function makeTransfer(overrides: Partial<TokenTransfer> = {}): TokenTransfer {
  return {
    from: USER,
    to: '0x0000000000000000000000000000000000000000',
    tokenAddress: USDC,
    tokenName: 'USD Coin',
    tokenSymbol: 'USDC',
    tokenLogo: 'https://example.com/usdc.png',
    amount: '1000000',
    decimals: 6,
    logIndex: 0,
    ...overrides,
  };
}

describe('detectUniswapLiquidity', () => {
  it('returns empty result when no liquidity events found', () => {
    const result = detectUniswapLiquidity([], [], [], USER);
    expect(result.operations).toHaveLength(0);
    expect(result.transferIndicesToRemove).toHaveLength(0);
    expect(result.nativeTransfersToConsume).toHaveLength(0);
  });

  describe('V3 Add Liquidity', () => {
    it('detects V3 add liquidity with two tokens', () => {
      const poolAddress = computeV3PoolAddress(USDC, DAI, 500);

      const logs: MoralisTransactionLog[] = [
        // Transfer USDC user → pool
        makeLog({ log_index: '10' }),
        // Transfer DAI user → pool
        makeLog({ log_index: '11' }),
        // Pool Mint
        makeLog({
          address: poolAddress,
          topic0: V3_POOL_MINT_TOPIC0,
          log_index: '12',
        }),
        // IncreaseLiquidity from NPM
        makeLog({
          address: UNISWAP_V3_NPM,
          topic0: V3_INCREASE_LIQUIDITY_TOPIC0,
          topic1: TOKEN_ID_1,
          data: '0x' + '0'.repeat(64 * 3),
          log_index: '13',
        }),
      ];

      const transfers: TokenTransfer[] = [
        makeTransfer({
          from: USER,
          to: poolAddress,
          tokenAddress: USDC,
          tokenName: 'USD Coin',
          tokenSymbol: 'USDC',
          amount: '1000000',
          decimals: 6,
          logIndex: 10,
        }),
        makeTransfer({
          from: USER,
          to: poolAddress,
          tokenAddress: DAI,
          tokenName: 'Dai',
          tokenSymbol: 'DAI',
          amount: '999000000000000000000',
          decimals: 18,
          logIndex: 11,
        }),
      ];

      const result = detectUniswapLiquidity(logs, transfers, [], USER);

      expect(result.operations).toHaveLength(1);
      const op = result.operations[0];
      expect(op.type).toBe('uniswap-add-liquidity');
      expect(op.version).toBe('v3');
      if (op.type === 'uniswap-add-liquidity') {
        expect(op.provider).toBe(USER);
        // Both tokens should be consumed
        expect([op.token0.symbol, op.token1.symbol].sort()).toEqual(['DAI', 'USDC']);
      }
      expect(result.transferIndicesToRemove).toHaveLength(2);
      expect(result.transferIndicesToRemove).toContain(0);
      expect(result.transferIndicesToRemove).toContain(1);
    });

    it('detects V3 add liquidity one-sided (amount0=0)', () => {
      const poolAddress = computeV3PoolAddress(USDC, DAI, 500);

      const logs: MoralisTransactionLog[] = [
        makeLog({
          address: poolAddress,
          topic0: V3_POOL_MINT_TOPIC0,
          log_index: '10',
        }),
        makeLog({
          address: UNISWAP_V3_NPM,
          topic0: V3_INCREASE_LIQUIDITY_TOPIC0,
          topic1: TOKEN_ID_1,
          data: '0x' + '0'.repeat(64 * 3),
          log_index: '11',
        }),
      ];

      const transfers: TokenTransfer[] = [
        makeTransfer({
          from: USER,
          to: poolAddress,
          tokenAddress: DAI,
          tokenName: 'Dai',
          tokenSymbol: 'DAI',
          amount: '500000000000000000000',
          decimals: 18,
          logIndex: 9,
        }),
      ];

      const result = detectUniswapLiquidity(logs, transfers, [], USER);

      expect(result.operations).toHaveLength(1);
      const op = result.operations[0];
      expect(op.type).toBe('uniswap-add-liquidity');
      if (op.type === 'uniswap-add-liquidity') {
        expect(op.token0.symbol).toBe('DAI');
        expect(op.token1.amount).toBe('0'); // zero token
      }
      expect(result.transferIndicesToRemove).toHaveLength(1);
    });
  });

  describe('V3 Remove Liquidity', () => {
    it('detects V3 remove liquidity with two tokens', () => {
      const poolAddress = computeV3PoolAddress(USDC, DAI, 500);

      const logs: MoralisTransactionLog[] = [
        // Pool Burn
        makeLog({
          address: poolAddress,
          topic0: V3_POOL_BURN_TOPIC0,
          log_index: '20',
        }),
        // DecreaseLiquidity from NPM
        makeLog({
          address: UNISWAP_V3_NPM,
          topic0: V3_DECREASE_LIQUIDITY_TOPIC0,
          topic1: TOKEN_ID_1,
          data: '0x' + '0'.repeat(64 * 3),
          log_index: '21',
        }),
        // Pool Collect (pool-level, not NPM)
        makeLog({
          address: poolAddress,
          topic0: '0x70935338e69775456a85ddef226c395fb668b63fa0115f5f20610b388e6ca9c0',
          log_index: '23',
        }),
        // NPM Collect
        makeLog({
          address: UNISWAP_V3_NPM,
          topic0: V3_NPM_COLLECT_TOPIC0,
          topic1: TOKEN_ID_1,
          log_index: '24',
        }),
      ];

      const transfers: TokenTransfer[] = [
        // pool → NPM (USDC)
        makeTransfer({
          from: poolAddress,
          to: UNISWAP_V3_NPM,
          tokenAddress: USDC,
          tokenName: 'USD Coin',
          tokenSymbol: 'USDC',
          amount: '500000',
          decimals: 6,
          logIndex: 22,
        }),
        // pool → NPM (DAI)
        makeTransfer({
          from: poolAddress,
          to: UNISWAP_V3_NPM,
          tokenAddress: DAI,
          tokenName: 'Dai',
          tokenSymbol: 'DAI',
          amount: '500000000000000000000',
          decimals: 18,
          logIndex: 22,
        }),
        // NPM → user (USDC)
        makeTransfer({
          from: UNISWAP_V3_NPM,
          to: USER,
          tokenAddress: USDC,
          tokenName: 'USD Coin',
          tokenSymbol: 'USDC',
          amount: '500000',
          decimals: 6,
          logIndex: 25,
        }),
        // NPM → user (DAI)
        makeTransfer({
          from: UNISWAP_V3_NPM,
          to: USER,
          tokenAddress: DAI,
          tokenName: 'Dai',
          tokenSymbol: 'DAI',
          amount: '500000000000000000000',
          decimals: 18,
          logIndex: 26,
        }),
      ];

      const result = detectUniswapLiquidity(logs, transfers, [], USER);

      expect(result.operations).toHaveLength(1);
      const op = result.operations[0];
      expect(op.type).toBe('uniswap-remove-liquidity');
      expect(op.version).toBe('v3');
      if (op.type === 'uniswap-remove-liquidity') {
        expect(op.recipient).toBe(USER);
        expect([op.token0.symbol, op.token1.symbol].sort()).toEqual(['DAI', 'USDC']);
      }
      // All 4 transfers consumed (pool→NPM + NPM→user for each token)
      expect(result.transferIndicesToRemove).toHaveLength(4);
    });
  });

  describe('V3 Collect Fees', () => {
    it('detects standalone V3 collect fees (no DecreaseLiquidity)', () => {
      const logs: MoralisTransactionLog[] = [
        // NPM Collect (standalone — no DecreaseLiquidity with this tokenId)
        makeLog({
          address: UNISWAP_V3_NPM,
          topic0: V3_NPM_COLLECT_TOPIC0,
          topic1: TOKEN_ID_2,
          log_index: '30',
        }),
      ];

      const transfers: TokenTransfer[] = [
        // NPM → user (USDC)
        makeTransfer({
          from: UNISWAP_V3_NPM,
          to: USER,
          tokenAddress: USDC,
          tokenName: 'USD Coin',
          tokenSymbol: 'USDC',
          amount: '1234',
          decimals: 6,
          logIndex: 31,
        }),
        // NPM → user (DAI)
        makeTransfer({
          from: UNISWAP_V3_NPM,
          to: USER,
          tokenAddress: DAI,
          tokenName: 'Dai',
          tokenSymbol: 'DAI',
          amount: '5678000000000000000',
          decimals: 18,
          logIndex: 32,
        }),
      ];

      const result = detectUniswapLiquidity(logs, transfers, [], USER);

      expect(result.operations).toHaveLength(1);
      const op = result.operations[0];
      expect(op.type).toBe('uniswap-collect-fees');
      if (op.type === 'uniswap-collect-fees') {
        expect(op.version).toBe('v3');
        expect(op.collector).toBe(USER);
      }
      expect(result.transferIndicesToRemove).toHaveLength(2);
    });

    it('detects V3 collect fees with WETH unwrap (USDC + ETH)', () => {
      const poolAddress = computeV3PoolAddress(USDC, WETH_ADDRESS, 500);
      const WETH9 = WETH_ADDRESS;

      const logs: MoralisTransactionLog[] = [
        // Pool Collect (pool-level)
        makeLog({
          address: poolAddress,
          topic0: '0x70935338e69775456a85ddef226c395fb668b63fa0115f5f20610b388e6ca9c0',
          log_index: '699',
        }),
        // NPM Collect (anchor)
        makeLog({
          address: UNISWAP_V3_NPM,
          topic0: V3_NPM_COLLECT_TOPIC0,
          topic1: TOKEN_ID_2,
          log_index: '700',
        }),
      ];

      const transfers: TokenTransfer[] = [
        // pool → NPM (USDC)
        makeTransfer({
          from: poolAddress,
          to: UNISWAP_V3_NPM,
          tokenAddress: USDC,
          tokenName: 'USD Coin',
          tokenSymbol: 'USDC',
          amount: '59839',
          decimals: 6,
          logIndex: 697,
        }),
        // pool → NPM (WETH) — ERC-20 transfer
        makeTransfer({
          from: poolAddress,
          to: UNISWAP_V3_NPM,
          tokenAddress: WETH9,
          tokenName: 'Wrapped Ether',
          tokenSymbol: 'WETH',
          amount: '30000000000000',
          decimals: 18,
          logIndex: 698,
        }),
        // NPM → user (USDC) — ERC-20 transfer
        makeTransfer({
          from: UNISWAP_V3_NPM,
          to: USER,
          tokenAddress: USDC,
          tokenName: 'USD Coin',
          tokenSymbol: 'USDC',
          amount: '59839',
          decimals: 6,
          logIndex: 702,
        }),
        // NOTE: No NPM → user WETH ERC-20 transfer — it was unwrapped
      ];

      const nativeTransfers: NativeTransfer[] = [
        // WETH9 → NPM (unwrap)
        { from: WETH9, to: UNISWAP_V3_NPM, amount: '30000000000000' },
        // NPM → user (native ETH)
        { from: UNISWAP_V3_NPM, to: USER, amount: '30000000000000' },
      ];

      const result = detectUniswapLiquidity(logs, transfers, nativeTransfers, USER);

      expect(result.operations).toHaveLength(1);
      const op = result.operations[0];
      expect(op.type).toBe('uniswap-collect-fees');
      if (op.type === 'uniswap-collect-fees') {
        expect(op.version).toBe('v3');
        expect(op.collector).toBe(USER);
        // Should have both USDC and ETH (native)
        const symbols = [op.token0.symbol, op.token1.symbol].sort();
        expect(symbols).toEqual(['ETH', 'USDC']);
        // The ETH token should be marked native
        const ethToken = op.token0.symbol === 'ETH' ? op.token0 : op.token1;
        expect(ethToken.isNative).toBe(true);
        expect(ethToken.amount).toBe('30000000000000');
      }
      // All 3 ERC-20 transfers consumed (pool→NPM USDC, pool→NPM WETH, NPM→user USDC)
      expect(result.transferIndicesToRemove).toHaveLength(3);
      // Both native transfers consumed
      expect(result.nativeTransfersToConsume).toHaveLength(2);
    });

    it('does NOT detect collect fees when paired with DecreaseLiquidity (same tokenId)', () => {
      const poolAddress = computeV3PoolAddress(USDC, DAI, 500);

      const logs: MoralisTransactionLog[] = [
        makeLog({
          address: poolAddress,
          topic0: V3_POOL_BURN_TOPIC0,
          log_index: '20',
        }),
        // DecreaseLiquidity with tokenId 1
        makeLog({
          address: UNISWAP_V3_NPM,
          topic0: V3_DECREASE_LIQUIDITY_TOPIC0,
          topic1: TOKEN_ID_1,
          data: '0x' + '0'.repeat(64 * 3),
          log_index: '21',
        }),
        // Collect with same tokenId 1 — should NOT produce a separate collect operation
        makeLog({
          address: UNISWAP_V3_NPM,
          topic0: V3_NPM_COLLECT_TOPIC0,
          topic1: TOKEN_ID_1,
          log_index: '24',
        }),
      ];

      const transfers: TokenTransfer[] = [
        makeTransfer({ from: poolAddress, to: UNISWAP_V3_NPM, tokenAddress: USDC, logIndex: 22 }),
        makeTransfer({ from: poolAddress, to: UNISWAP_V3_NPM, tokenAddress: DAI, tokenName: 'Dai', tokenSymbol: 'DAI', decimals: 18, logIndex: 22 }),
        makeTransfer({ from: UNISWAP_V3_NPM, to: USER, tokenAddress: USDC, logIndex: 25 }),
        makeTransfer({ from: UNISWAP_V3_NPM, to: USER, tokenAddress: DAI, tokenName: 'Dai', tokenSymbol: 'DAI', decimals: 18, logIndex: 26 }),
      ];

      const result = detectUniswapLiquidity(logs, transfers, [], USER);

      // Should only have 1 operation (remove), not a separate collect
      const collectOps = result.operations.filter((o) => o.type === 'uniswap-collect-fees');
      expect(collectOps).toHaveLength(0);
    });
  });

  describe('V2 Add Liquidity', () => {
    it('detects V2 add liquidity via CREATE2-verified pair', () => {
      const pairAddress = computeV2PairAddress(USDC, DAI);

      const logs: MoralisTransactionLog[] = [
        // V2 Pair Mint event
        makeLog({
          address: pairAddress,
          topic0: V2_MINT_TOPIC0,
          topic1: padAddress(USER),
          data: '0x' + '0'.repeat(64 * 2),
          log_index: '12',
        }),
      ];

      const transfers: TokenTransfer[] = [
        // user → pair (USDC)
        makeTransfer({
          from: USER,
          to: pairAddress,
          tokenAddress: USDC,
          tokenName: 'USD Coin',
          tokenSymbol: 'USDC',
          amount: '1000000',
          decimals: 6,
          logIndex: 10,
        }),
        // user → pair (DAI)
        makeTransfer({
          from: USER,
          to: pairAddress,
          tokenAddress: DAI,
          tokenName: 'Dai',
          tokenSymbol: 'DAI',
          amount: '999000000000000000000',
          decimals: 18,
          logIndex: 11,
        }),
        // LP mint (0x0 → user)
        makeTransfer({
          from: '0x0000000000000000000000000000000000000000',
          to: USER,
          tokenAddress: pairAddress,
          tokenName: 'Uniswap V2',
          tokenSymbol: 'UNI-V2',
          amount: '31622776601',
          decimals: 18,
          logIndex: 13,
        }),
      ];

      const result = detectUniswapLiquidity(logs, transfers, [], USER);

      expect(result.operations).toHaveLength(1);
      const op = result.operations[0];
      expect(op.type).toBe('uniswap-add-liquidity');
      expect(op.version).toBe('v2');
      if (op.type === 'uniswap-add-liquidity') {
        expect(op.provider).toBe(USER);
      }
      // 2 token transfers + 1 LP mint consumed
      expect(result.transferIndicesToRemove).toHaveLength(3);
    });
  });

  describe('V2 Remove Liquidity', () => {
    it('detects V2 remove liquidity via CREATE2-verified pair', () => {
      const pairAddress = computeV2PairAddress(USDC, DAI);

      const logs: MoralisTransactionLog[] = [
        // V2 Pair Burn event
        makeLog({
          address: pairAddress,
          topic0: V2_BURN_TOPIC0,
          topic1: padAddress(USER),
          topic2: padAddress(USER),
          data: '0x' + '0'.repeat(64 * 2),
          log_index: '12',
        }),
      ];

      const transfers: TokenTransfer[] = [
        // LP burn (user → 0x0)
        makeTransfer({
          from: USER,
          to: pairAddress,
          tokenAddress: pairAddress,
          tokenName: 'Uniswap V2',
          tokenSymbol: 'UNI-V2',
          amount: '31622776601',
          decimals: 18,
          logIndex: 10,
        }),
        // pair → user (USDC)
        makeTransfer({
          from: pairAddress,
          to: USER,
          tokenAddress: USDC,
          tokenName: 'USD Coin',
          tokenSymbol: 'USDC',
          amount: '1000000',
          decimals: 6,
          logIndex: 13,
        }),
        // pair → user (DAI)
        makeTransfer({
          from: pairAddress,
          to: USER,
          tokenAddress: DAI,
          tokenName: 'Dai',
          tokenSymbol: 'DAI',
          amount: '999000000000000000000',
          decimals: 18,
          logIndex: 14,
        }),
      ];

      const result = detectUniswapLiquidity(logs, transfers, [], USER);

      expect(result.operations).toHaveLength(1);
      const op = result.operations[0];
      expect(op.type).toBe('uniswap-remove-liquidity');
      expect(op.version).toBe('v2');
      if (op.type === 'uniswap-remove-liquidity') {
        expect(op.recipient).toBe(USER);
      }
      // 2 token transfers + 1 LP burn consumed
      expect(result.transferIndicesToRemove).toHaveLength(3);
    });
  });

  describe('CREATE2 verification', () => {
    it('rejects V2 Mint from unverified pair address (fork)', () => {
      const fakePair = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

      const logs: MoralisTransactionLog[] = [
        makeLog({
          address: fakePair,
          topic0: V2_MINT_TOPIC0,
          topic1: padAddress(USER),
          data: '0x' + '0'.repeat(64 * 2),
          log_index: '12',
        }),
      ];

      const transfers: TokenTransfer[] = [
        makeTransfer({ from: USER, to: fakePair, tokenAddress: USDC, logIndex: 10 }),
        makeTransfer({ from: USER, to: fakePair, tokenAddress: DAI, tokenName: 'Dai', tokenSymbol: 'DAI', decimals: 18, logIndex: 11 }),
      ];

      const result = detectUniswapLiquidity(logs, transfers, [], USER);
      expect(result.operations).toHaveLength(0);
    });

    it('rejects V2 Burn from unverified pair address (fork)', () => {
      const fakePair = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

      const logs: MoralisTransactionLog[] = [
        makeLog({
          address: fakePair,
          topic0: V2_BURN_TOPIC0,
          topic1: padAddress(USER),
          topic2: padAddress(USER),
          data: '0x' + '0'.repeat(64 * 2),
          log_index: '12',
        }),
      ];

      const transfers: TokenTransfer[] = [
        makeTransfer({ from: fakePair, to: USER, tokenAddress: USDC, logIndex: 13 }),
        makeTransfer({ from: fakePair, to: USER, tokenAddress: DAI, tokenName: 'Dai', tokenSymbol: 'DAI', decimals: 18, logIndex: 14 }),
      ];

      const result = detectUniswapLiquidity(logs, transfers, [], USER);
      expect(result.operations).toHaveLength(0);
    });

    it('rejects V3 Pool Mint from unverified pool address', () => {
      const fakePool = '0xcccccccccccccccccccccccccccccccccccccccc';

      const logs: MoralisTransactionLog[] = [
        makeLog({
          address: fakePool,
          topic0: V3_POOL_MINT_TOPIC0,
          log_index: '10',
        }),
        makeLog({
          address: UNISWAP_V3_NPM,
          topic0: V3_INCREASE_LIQUIDITY_TOPIC0,
          topic1: TOKEN_ID_1,
          data: '0x' + '0'.repeat(64 * 3),
          log_index: '11',
        }),
      ];

      const transfers: TokenTransfer[] = [
        makeTransfer({ from: USER, to: fakePool, tokenAddress: USDC, logIndex: 8 }),
        makeTransfer({ from: USER, to: fakePool, tokenAddress: DAI, tokenName: 'Dai', tokenSymbol: 'DAI', decimals: 18, logIndex: 9 }),
      ];

      const result = detectUniswapLiquidity(logs, transfers, [], USER);
      expect(result.operations).toHaveLength(0);
    });
  });

  describe('NPM address verification', () => {
    it('rejects IncreaseLiquidity from non-NPM address', () => {
      const fakeNPM = '0xdddddddddddddddddddddddddddddddddddddd';
      const poolAddress = computeV3PoolAddress(USDC, DAI, 500);

      const logs: MoralisTransactionLog[] = [
        makeLog({
          address: poolAddress,
          topic0: V3_POOL_MINT_TOPIC0,
          log_index: '10',
        }),
        makeLog({
          address: fakeNPM,
          topic0: V3_INCREASE_LIQUIDITY_TOPIC0,
          topic1: TOKEN_ID_1,
          data: '0x' + '0'.repeat(64 * 3),
          log_index: '11',
        }),
      ];

      const transfers: TokenTransfer[] = [
        makeTransfer({ from: USER, to: poolAddress, tokenAddress: USDC, logIndex: 8 }),
        makeTransfer({ from: USER, to: poolAddress, tokenAddress: DAI, tokenName: 'Dai', tokenSymbol: 'DAI', decimals: 18, logIndex: 9 }),
      ];

      const result = detectUniswapLiquidity(logs, transfers, [], USER);
      expect(result.operations).toHaveLength(0);
    });

    it('rejects DecreaseLiquidity from non-NPM address', () => {
      const fakeNPM = '0xdddddddddddddddddddddddddddddddddddddd';
      const poolAddress = computeV3PoolAddress(USDC, DAI, 500);

      const logs: MoralisTransactionLog[] = [
        makeLog({
          address: poolAddress,
          topic0: V3_POOL_BURN_TOPIC0,
          log_index: '20',
        }),
        makeLog({
          address: fakeNPM,
          topic0: V3_DECREASE_LIQUIDITY_TOPIC0,
          topic1: TOKEN_ID_1,
          data: '0x' + '0'.repeat(64 * 3),
          log_index: '21',
        }),
      ];

      const transfers: TokenTransfer[] = [
        makeTransfer({ from: poolAddress, to: fakeNPM, tokenAddress: USDC, logIndex: 22 }),
        makeTransfer({ from: fakeNPM, to: USER, tokenAddress: USDC, logIndex: 25 }),
      ];

      const result = detectUniswapLiquidity(logs, transfers, [], USER);
      // No remove operations from fake NPM
      const removeOps = result.operations.filter((o) => o.type === 'uniswap-remove-liquidity');
      expect(removeOps).toHaveLength(0);
    });
  });
});
