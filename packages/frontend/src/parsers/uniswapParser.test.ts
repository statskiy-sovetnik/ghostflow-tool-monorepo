import { describe, it, expect } from 'vitest';
import { keccak256, solidityPacked, AbiCoder, getAddress } from 'ethers';
import { detectUniswapSwaps } from './uniswapParser';
import {
  UNISWAP_V2_SWAP_TOPIC0,
  UNISWAP_V3_SWAP_TOPIC0,
  UNISWAP_V4_SWAP_TOPIC0,
  UNISWAP_V4_POOL_MANAGER,
  UNISWAP_V2_FACTORY,
  UNISWAP_V2_INIT_CODE_HASH,
  UNISWAP_V3_FACTORY,
  UNISWAP_V3_INIT_CODE_HASH,
  UNISWAP_V3_SWAP_ROUTER_02,
  UNISWAP_V2_ROUTER02,
  UNISWAP_UNIVERSAL_ROUTER,
  WETH_ADDRESS,
} from './uniswapConstants';
import type { MoralisTransactionLog, TokenTransfer, NativeTransfer, MoralisInternalTransaction } from '../types/moralis';
import { parseERC20Transfers, type RawERC20Transfer } from './erc20TransferParser';
import { parseNativeTransfers } from './nativeTransferParser';
import * as ethToWlfiFixture from './__fixtures__/tx-eth-to-wlfi-v3-universal-router';
import * as ethToTokenV4Fixture from './__fixtures__/tx-eth-to-token-v4-universal-router';
import * as mtkToEthV2Fixture from './__fixtures__/tx-mtk-to-eth-v2-router02';

const USER = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const DAI = '0x6b175474e89094c44da98b954eedeac495271d0f';

function padAddress(addr: string): string {
  return '0x' + addr.slice(2).padStart(64, '0');
}

function encodeUint256(value: bigint): string {
  return value.toString(16).padStart(64, '0');
}

function sortTokens(a: string, b: string): [string, string] {
  const addrA = getAddress(a);
  const addrB = getAddress(b);
  return BigInt(addrA) < BigInt(addrB) ? [addrA, addrB] : [addrB, addrA];
}

/** Compute real Uniswap V2 pair address via CREATE2 */
function computeV2PairAddress(tokenA: string, tokenB: string): string {
  const [token0, token1] = sortTokens(tokenA, tokenB);
  const salt = keccak256(solidityPacked(['address', 'address'], [token0, token1]));
  const packed = solidityPacked(
    ['bytes1', 'address', 'bytes32', 'bytes32'],
    ['0xff', UNISWAP_V2_FACTORY, salt, UNISWAP_V2_INIT_CODE_HASH],
  );
  return '0x' + keccak256(packed).slice(-40);
}

/** Compute real Uniswap V3 pool address via CREATE2 */
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

describe('detectUniswapSwaps', () => {
  it('returns empty result when no swap events found', () => {
    const result = detectUniswapSwaps([], [], [], USER);
    expect(result.operations).toHaveLength(0);
    expect(result.transferIndicesToRemove).toHaveLength(0);
    expect(result.nativeTransfersToConsume).toHaveLength(0);
  });

  describe('V3 swaps', () => {
    it('detects single V3 swap via SwapRouter02', () => {
      const poolAddress = computeV3PoolAddress(USDC, WETH_ADDRESS, 500);

      const logs: MoralisTransactionLog[] = [
        makeLog({
          address: poolAddress,
          topic0: UNISWAP_V3_SWAP_TOPIC0,
          topic1: padAddress(UNISWAP_V3_SWAP_ROUTER_02),
          topic2: padAddress(USER),
          data: '0x' + encodeUint256(1000000n) + encodeUint256(500000000000000000n) + '0'.repeat(64 * 3),
          log_index: '5',
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
          logIndex: 3,
        }),
        makeTransfer({
          from: poolAddress,
          to: USER,
          tokenAddress: WETH_ADDRESS,
          tokenName: 'Wrapped Ether',
          tokenSymbol: 'WETH',
          tokenLogo: 'https://example.com/weth.png',
          amount: '500000000000000000',
          decimals: 18,
          logIndex: 4,
        }),
      ];

      const result = detectUniswapSwaps(logs, transfers, [], USER);

      expect(result.operations).toHaveLength(1);
      const op = result.operations[0];
      expect(op.type).toBe('uniswap-swap');
      expect(op.version).toBe('v3');
      expect(op.tokenIn.symbol).toBe('USDC');
      expect(op.tokenIn.amount).toBe('1000000');
      expect(op.tokenOut.symbol).toBe('WETH');
      expect(op.tokenOut.amount).toBe('500000000000000000');
      expect(op.hops).toBe(1);
      expect(result.transferIndicesToRemove).toEqual(expect.arrayContaining([0, 1]));
    });

    it('detects multi-hop V3 swap (2 hops)', () => {
      const pool1 = computeV3PoolAddress(USDC, WETH_ADDRESS, 500);
      const pool2 = computeV3PoolAddress(WETH_ADDRESS, DAI, 3000);

      const logs: MoralisTransactionLog[] = [
        makeLog({
          address: pool1,
          topic0: UNISWAP_V3_SWAP_TOPIC0,
          topic1: padAddress(UNISWAP_V3_SWAP_ROUTER_02),
          topic2: padAddress(UNISWAP_V3_SWAP_ROUTER_02),
          data: '0x' + '0'.repeat(64 * 5),
          log_index: '5',
        }),
        makeLog({
          address: pool2,
          topic0: UNISWAP_V3_SWAP_TOPIC0,
          topic1: padAddress(UNISWAP_V3_SWAP_ROUTER_02),
          topic2: padAddress(USER),
          data: '0x' + '0'.repeat(64 * 5),
          log_index: '8',
        }),
      ];

      const transfers: TokenTransfer[] = [
        makeTransfer({ from: USER, to: pool1, tokenAddress: USDC, logIndex: 3 }),
        makeTransfer({ from: pool1, to: pool2, tokenAddress: WETH_ADDRESS, tokenName: 'Wrapped Ether', tokenSymbol: 'WETH', logIndex: 6 }),
        makeTransfer({
          from: pool2,
          to: USER,
          tokenAddress: DAI,
          tokenName: 'Dai',
          tokenSymbol: 'DAI',
          tokenLogo: 'https://example.com/dai.png',
          amount: '999000000000000000000',
          decimals: 18,
          logIndex: 9,
        }),
      ];

      const result = detectUniswapSwaps(logs, transfers, [], USER);

      expect(result.operations).toHaveLength(1);
      expect(result.operations[0].hops).toBe(2);
      expect(result.operations[0].tokenIn.symbol).toBe('USDC');
      expect(result.operations[0].tokenOut.symbol).toBe('DAI');
      // All 3 transfers should be consumed
      expect(result.transferIndicesToRemove).toHaveLength(3);
    });

    it('verifies V3 pool via CREATE2 when sender is not a known router', () => {
      const poolAddress = computeV3PoolAddress(USDC, WETH_ADDRESS, 500);

      const logs: MoralisTransactionLog[] = [
        makeLog({
          address: poolAddress,
          topic0: UNISWAP_V3_SWAP_TOPIC0,
          topic1: padAddress(USER), // sender is user, not a router
          topic2: padAddress(USER),
          data: '0x' + '0'.repeat(64 * 5),
          log_index: '5',
        }),
      ];

      const transfers: TokenTransfer[] = [
        makeTransfer({ from: USER, to: poolAddress, tokenAddress: USDC, logIndex: 3 }),
        makeTransfer({ from: poolAddress, to: USER, tokenAddress: WETH_ADDRESS, tokenName: 'Wrapped Ether', tokenSymbol: 'WETH', amount: '500000000000000000', decimals: 18, logIndex: 4 }),
      ];

      const result = detectUniswapSwaps(logs, transfers, [], USER);
      expect(result.operations).toHaveLength(1);
      expect(result.operations[0].version).toBe('v3');
    });

    it('filters out V3 fork swaps that fail CREATE2 verification', () => {
      const fakePool = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

      const logs: MoralisTransactionLog[] = [
        makeLog({
          address: fakePool,
          topic0: UNISWAP_V3_SWAP_TOPIC0,
          topic1: padAddress(USER),
          topic2: padAddress(USER),
          data: '0x' + '0'.repeat(64 * 5),
          log_index: '5',
        }),
      ];

      const transfers: TokenTransfer[] = [
        makeTransfer({ from: USER, to: fakePool, tokenAddress: USDC, logIndex: 3 }),
        makeTransfer({ from: fakePool, to: USER, tokenAddress: WETH_ADDRESS, tokenName: 'WETH', tokenSymbol: 'WETH', logIndex: 4 }),
      ];

      const result = detectUniswapSwaps(logs, transfers, [], USER);
      expect(result.operations).toHaveLength(0);
      expect(result.transferIndicesToRemove).toHaveLength(0);
    });
  });

  describe('V2 swaps', () => {
    it('detects V2 swap via V2 Router02 (router fallback, no CREATE2 needed)', () => {
      const pairAddress = computeV2PairAddress(USDC, WETH_ADDRESS);

      const logs: MoralisTransactionLog[] = [
        makeLog({
          address: pairAddress,
          topic0: UNISWAP_V2_SWAP_TOPIC0,
          topic1: padAddress(UNISWAP_V2_ROUTER02), // sender = known router
          topic2: padAddress(USER), // to = user
          data: '0x' + encodeUint256(0n) + encodeUint256(1000000n) + encodeUint256(500000000000000000n) + encodeUint256(0n),
          log_index: '5',
        }),
      ];

      const transfers: TokenTransfer[] = [
        makeTransfer({ from: USER, to: pairAddress, tokenAddress: USDC, amount: '1000000', logIndex: 3 }),
        makeTransfer({ from: pairAddress, to: USER, tokenAddress: WETH_ADDRESS, tokenName: 'Wrapped Ether', tokenSymbol: 'WETH', amount: '500000000000000000', decimals: 18, logIndex: 4 }),
      ];

      const result = detectUniswapSwaps(logs, transfers, [], USER);

      expect(result.operations).toHaveLength(1);
      expect(result.operations[0].version).toBe('v2');
      expect(result.operations[0].tokenIn.symbol).toBe('USDC');
      expect(result.operations[0].tokenOut.symbol).toBe('WETH');
    });

    it('verifies V2 pool via CREATE2 when sender is not a known router', () => {
      const pairAddress = computeV2PairAddress(USDC, WETH_ADDRESS);

      const logs: MoralisTransactionLog[] = [
        makeLog({
          address: pairAddress,
          topic0: UNISWAP_V2_SWAP_TOPIC0,
          topic1: padAddress(USER),
          topic2: padAddress(USER),
          data: '0x' + encodeUint256(0n) + encodeUint256(1000000n) + encodeUint256(500000000000000000n) + encodeUint256(0n),
          log_index: '5',
        }),
      ];

      const transfers: TokenTransfer[] = [
        makeTransfer({ from: USER, to: pairAddress, tokenAddress: USDC, logIndex: 3 }),
        makeTransfer({ from: pairAddress, to: USER, tokenAddress: WETH_ADDRESS, tokenName: 'WETH', tokenSymbol: 'WETH', decimals: 18, logIndex: 4 }),
      ];

      const result = detectUniswapSwaps(logs, transfers, [], USER);
      expect(result.operations).toHaveLength(1);
      expect(result.operations[0].version).toBe('v2');
    });

    it('filters out V2 fork swaps that fail CREATE2 verification', () => {
      const fakePool = '0xcccccccccccccccccccccccccccccccccccccccc';

      const logs: MoralisTransactionLog[] = [
        makeLog({
          address: fakePool,
          topic0: UNISWAP_V2_SWAP_TOPIC0,
          topic1: padAddress(USER),
          topic2: padAddress(USER),
          data: '0x' + '0'.repeat(64 * 4),
          log_index: '5',
        }),
      ];

      const transfers: TokenTransfer[] = [
        makeTransfer({ from: USER, to: fakePool, tokenAddress: USDC, logIndex: 3 }),
        makeTransfer({ from: fakePool, to: USER, tokenAddress: WETH_ADDRESS, tokenName: 'WETH', tokenSymbol: 'WETH', logIndex: 4 }),
      ];

      const result = detectUniswapSwaps(logs, transfers, [], USER);
      expect(result.operations).toHaveLength(0);
    });
  });

  describe('V4 swaps', () => {
    it('detects V4 swap from PoolManager via Universal Router', () => {
      const logs: MoralisTransactionLog[] = [
        makeLog({
          address: UNISWAP_V4_POOL_MANAGER,
          topic0: UNISWAP_V4_SWAP_TOPIC0,
          topic1: padAddress('0x0000000000000000000000000000000000000001'), // poolId
          topic2: padAddress(UNISWAP_UNIVERSAL_ROUTER), // sender
          data: '0x' + '0'.repeat(64 * 6),
          log_index: '5',
        }),
      ];

      const transfers: TokenTransfer[] = [
        makeTransfer({ from: USER, to: UNISWAP_V4_POOL_MANAGER, tokenAddress: USDC, amount: '1000000', logIndex: 3 }),
        makeTransfer({ from: UNISWAP_V4_POOL_MANAGER, to: USER, tokenAddress: DAI, tokenName: 'Dai', tokenSymbol: 'DAI', amount: '999000', decimals: 18, logIndex: 4 }),
      ];

      const result = detectUniswapSwaps(logs, transfers, [], USER);

      expect(result.operations).toHaveLength(1);
      expect(result.operations[0].version).toBe('v4');
      expect(result.operations[0].tokenIn.symbol).toBe('USDC');
      expect(result.operations[0].tokenOut.symbol).toBe('DAI');
    });

    it('ignores V4 swap topic from non-PoolManager address', () => {
      const logs: MoralisTransactionLog[] = [
        makeLog({
          address: '0xdddddddddddddddddddddddddddddddddddddd',
          topic0: UNISWAP_V4_SWAP_TOPIC0,
          topic1: padAddress('0x0000000000000000000000000000000000000001'),
          topic2: padAddress(UNISWAP_UNIVERSAL_ROUTER),
          data: '0x' + '0'.repeat(64 * 6),
          log_index: '5',
        }),
      ];

      const result = detectUniswapSwaps(logs, [], [], USER);
      expect(result.operations).toHaveLength(0);
    });
  });

  describe('Native ETH edge cases', () => {
    it('detects ETH input (user wraps ETH → WETH for swap)', () => {
      const poolAddress = computeV3PoolAddress(USDC, WETH_ADDRESS, 500);

      const logs: MoralisTransactionLog[] = [
        makeLog({
          address: poolAddress,
          topic0: UNISWAP_V3_SWAP_TOPIC0,
          topic1: padAddress(UNISWAP_V3_SWAP_ROUTER_02),
          topic2: padAddress(USER),
          data: '0x' + '0'.repeat(64 * 5),
          log_index: '5',
        }),
      ];

      const transfers: TokenTransfer[] = [
        makeTransfer({
          from: USER,
          to: poolAddress,
          tokenAddress: WETH_ADDRESS,
          tokenName: 'Wrapped Ether',
          tokenSymbol: 'WETH',
          amount: '1000000000000000000',
          decimals: 18,
          logIndex: 3,
        }),
        makeTransfer({
          from: poolAddress,
          to: USER,
          tokenAddress: USDC,
          amount: '2000000000',
          decimals: 6,
          logIndex: 4,
        }),
      ];

      const nativeTransfers: NativeTransfer[] = [
        { from: USER, to: UNISWAP_V3_SWAP_ROUTER_02, amount: '1000000000000000000', logIndex: 100 },
      ];

      const result = detectUniswapSwaps(logs, transfers, nativeTransfers, USER);

      expect(result.operations).toHaveLength(1);
      const op = result.operations[0];
      expect(op.tokenIn.isNative).toBe(true);
      expect(op.tokenIn.symbol).toBe('ETH');
      expect(op.tokenIn.name).toBe('Ether');
      expect(op.tokenIn.amount).toBe('1000000000000000000');
      expect(result.nativeTransfersToConsume).toHaveLength(1);
    });

    it('detects ETH output (router unwraps WETH → ETH for user)', () => {
      const poolAddress = computeV3PoolAddress(USDC, WETH_ADDRESS, 500);

      const logs: MoralisTransactionLog[] = [
        makeLog({
          address: poolAddress,
          topic0: UNISWAP_V3_SWAP_TOPIC0,
          topic1: padAddress(UNISWAP_V3_SWAP_ROUTER_02),
          topic2: padAddress(USER),
          data: '0x' + '0'.repeat(64 * 5),
          log_index: '5',
        }),
      ];

      const transfers: TokenTransfer[] = [
        makeTransfer({
          from: USER,
          to: poolAddress,
          tokenAddress: USDC,
          amount: '2000000000',
          decimals: 6,
          logIndex: 3,
        }),
        makeTransfer({
          from: poolAddress,
          to: USER,
          tokenAddress: WETH_ADDRESS,
          tokenName: 'Wrapped Ether',
          tokenSymbol: 'WETH',
          amount: '1000000000000000000',
          decimals: 18,
          logIndex: 4,
        }),
      ];

      const nativeTransfers: NativeTransfer[] = [
        { from: UNISWAP_V3_SWAP_ROUTER_02, to: USER, amount: '1000000000000000000', logIndex: 100 },
      ];

      const result = detectUniswapSwaps(logs, transfers, nativeTransfers, USER);

      expect(result.operations).toHaveLength(1);
      const op = result.operations[0];
      expect(op.tokenOut.isNative).toBe(true);
      expect(op.tokenOut.symbol).toBe('ETH');
      expect(op.tokenOut.name).toBe('Ether');
      expect(result.nativeTransfersToConsume).toHaveLength(1);
    });
  });

  describe('V2 swap via Universal Router', () => {
    it('detects V2 swap via Universal Router', () => {
      const pairAddress = computeV2PairAddress(USDC, DAI);

      const logs: MoralisTransactionLog[] = [
        makeLog({
          address: pairAddress,
          topic0: UNISWAP_V2_SWAP_TOPIC0,
          topic1: padAddress(UNISWAP_UNIVERSAL_ROUTER),
          topic2: padAddress(USER),
          data: '0x' + encodeUint256(0n) + encodeUint256(1000000n) + encodeUint256(999000000000000000000n) + encodeUint256(0n),
          log_index: '5',
        }),
      ];

      const transfers: TokenTransfer[] = [
        makeTransfer({ from: USER, to: pairAddress, tokenAddress: USDC, amount: '1000000', logIndex: 3 }),
        makeTransfer({ from: pairAddress, to: USER, tokenAddress: DAI, tokenName: 'Dai', tokenSymbol: 'DAI', amount: '999000000000000000000', decimals: 18, logIndex: 4 }),
      ];

      const result = detectUniswapSwaps(logs, transfers, [], USER);

      expect(result.operations).toHaveLength(1);
      expect(result.operations[0].version).toBe('v2');
    });
  });

  describe('mixed transaction', () => {
    it('does not interfere with non-swap transfers', () => {
      const poolAddress = computeV3PoolAddress(USDC, WETH_ADDRESS, 500);
      const otherAddress = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

      const logs: MoralisTransactionLog[] = [
        makeLog({
          address: poolAddress,
          topic0: UNISWAP_V3_SWAP_TOPIC0,
          topic1: padAddress(UNISWAP_V3_SWAP_ROUTER_02),
          topic2: padAddress(USER),
          data: '0x' + '0'.repeat(64 * 5),
          log_index: '10',
        }),
      ];

      const transfers: TokenTransfer[] = [
        // Unrelated transfer (index 0)
        makeTransfer({ from: USER, to: otherAddress, tokenAddress: DAI, tokenName: 'Dai', tokenSymbol: 'DAI', amount: '500000', logIndex: 1 }),
        // Swap transfers (indices 1, 2)
        makeTransfer({ from: USER, to: poolAddress, tokenAddress: USDC, amount: '1000000', logIndex: 5 }),
        makeTransfer({ from: poolAddress, to: USER, tokenAddress: WETH_ADDRESS, tokenName: 'WETH', tokenSymbol: 'WETH', amount: '500000000000000000', decimals: 18, logIndex: 6 }),
      ];

      const result = detectUniswapSwaps(logs, transfers, [], USER);

      expect(result.operations).toHaveLength(1);
      // Only swap transfers consumed (indices 1, 2), not the unrelated one (0)
      expect(result.transferIndicesToRemove).toContain(1);
      expect(result.transferIndicesToRemove).toContain(2);
      expect(result.transferIndicesToRemove).not.toContain(0);
    });
  });

  describe('real transaction fixtures', () => {
    it('ETH → WLFI swap via Universal Router + V3 pool', () => {
      const { logs, internal_transactions, FROM_ADDRESS, TO_ADDRESS, VALUE, WLFI_ADDRESS, WLFI_AMOUNT } = ethToWlfiFixture;

      // Step 1: Parse ERC-20 transfers from raw logs
      const rawTransfers = parseERC20Transfers(logs);
      expect(rawTransfers.length).toBeGreaterThan(0);

      // Step 2: Enrich raw transfers with hardcoded metadata (no API calls in tests)
      const tokenMetadata: Record<string, { name: string; symbol: string; decimals: number; logo: string | null }> = {
        '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': { name: 'Wrapped Ether', symbol: 'WETH', decimals: 18, logo: null },
        [WLFI_ADDRESS]: { name: 'World Liberty Financial', symbol: 'WLFI', decimals: 18, logo: null },
      };

      const transfers: TokenTransfer[] = rawTransfers.map((raw) => {
        const meta = tokenMetadata[raw.tokenAddress.toLowerCase()] ?? {
          name: 'Unknown',
          symbol: '???',
          decimals: 18,
          logo: null,
        };
        return {
          from: raw.from,
          to: raw.to,
          tokenAddress: raw.tokenAddress,
          tokenName: meta.name,
          tokenSymbol: meta.symbol,
          tokenLogo: meta.logo,
          amount: raw.value,
          decimals: meta.decimals,
          logIndex: raw.logIndex,
        };
      });

      // Step 3: Parse native ETH transfers
      const erc20MaxLogIndex = Math.max(...transfers.map((t) => t.logIndex));
      const nativeTransfers = parseNativeTransfers(
        internal_transactions,
        VALUE,
        FROM_ADDRESS,
        TO_ADDRESS,
        erc20MaxLogIndex + 1,
      );

      // Step 4: Detect Uniswap swaps
      const result = detectUniswapSwaps(logs, transfers, nativeTransfers, FROM_ADDRESS);

      // Assertions
      expect(result.operations).toHaveLength(1);

      const op = result.operations[0];
      expect(op.type).toBe('uniswap-swap');
      expect(op.version).toBe('v3');
      expect(op.hops).toBe(1);

      // Input: native ETH (wrapped by Universal Router)
      expect(op.tokenIn.isNative).toBe(true);
      expect(op.tokenIn.symbol).toBe('ETH');
      expect(op.tokenIn.name).toBe('Ether');
      expect(op.tokenIn.amount).toBe(VALUE);

      // Output: WLFI
      expect(op.tokenOut.symbol).toBe('WLFI');
      expect(op.tokenOut.amount).toBe(WLFI_AMOUNT);
      expect(op.tokenOut.address.toLowerCase()).toBe(WLFI_ADDRESS);

      // Transfer indices consumed (both ERC-20 transfers should be consumed)
      expect(result.transferIndicesToRemove.length).toBeGreaterThanOrEqual(2);

      // Native transfer consumed (ETH wrap from user → Universal Router)
      expect(result.nativeTransfersToConsume).toHaveLength(1);
      expect(result.nativeTransfersToConsume[0].from.toLowerCase()).toBe(FROM_ADDRESS);
    });

    it('ETH → token swap via Universal Router + V4 PoolManager', () => {
      const { logs, internal_transactions, FROM_ADDRESS, TO_ADDRESS, VALUE, OUTPUT_TOKEN_ADDRESS, OUTPUT_AMOUNT } = ethToTokenV4Fixture;

      // Step 1: Parse ERC-20 transfers from raw logs
      const rawTransfers = parseERC20Transfers(logs);
      expect(rawTransfers).toHaveLength(1); // Only PoolManager → user transfer

      // Step 2: Enrich raw transfers with hardcoded metadata (no API calls in tests)
      const tokenMetadata: Record<string, { name: string; symbol: string; decimals: number; logo: string | null }> = {
        [OUTPUT_TOKEN_ADDRESS]: { name: 'Output Token', symbol: 'OUT', decimals: 18, logo: null },
      };

      const transfers: TokenTransfer[] = rawTransfers.map((raw) => {
        const meta = tokenMetadata[raw.tokenAddress.toLowerCase()] ?? {
          name: 'Unknown',
          symbol: '???',
          decimals: 18,
          logo: null,
        };
        return {
          from: raw.from,
          to: raw.to,
          tokenAddress: raw.tokenAddress,
          tokenName: meta.name,
          tokenSymbol: meta.symbol,
          tokenLogo: meta.logo,
          amount: raw.value,
          decimals: meta.decimals,
          logIndex: raw.logIndex,
        };
      });

      // Step 3: Parse native ETH transfers
      const erc20MaxLogIndex = Math.max(...transfers.map((t) => t.logIndex));
      const nativeTransfers = parseNativeTransfers(
        internal_transactions,
        VALUE,
        FROM_ADDRESS,
        TO_ADDRESS,
        erc20MaxLogIndex + 1,
      );

      // Step 4: Detect Uniswap swaps
      const result = detectUniswapSwaps(logs, transfers, nativeTransfers, FROM_ADDRESS);

      // Assertions
      expect(result.operations).toHaveLength(1);

      const op = result.operations[0];
      expect(op.type).toBe('uniswap-swap');
      expect(op.version).toBe('v4');
      expect(op.hops).toBe(1);

      // Input: pure native ETH (no WETH wrap)
      expect(op.tokenIn.isNative).toBe(true);
      expect(op.tokenIn.symbol).toBe('ETH');
      expect(op.tokenIn.name).toBe('Ether');
      expect(op.tokenIn.amount).toBe(VALUE);

      // Output: token from PoolManager
      expect(op.tokenOut.address.toLowerCase()).toBe(OUTPUT_TOKEN_ADDRESS);
      expect(op.tokenOut.amount).toBe(OUTPUT_AMOUNT);

      // Transfer indices consumed (the single PoolManager → user transfer)
      expect(result.transferIndicesToRemove).toHaveLength(1);

      // Native transfers consumed (user → router ETH settle)
      expect(result.nativeTransfersToConsume.length).toBeGreaterThanOrEqual(1);
    });

    it('MTK → ETH swap via V2 Router02 (fee-on-transfer token)', () => {
      const { logs, internal_transactions, FROM_ADDRESS, TO_ADDRESS, VALUE, MTK_ADDRESS, ETH_OUTPUT_AMOUNT } = mtkToEthV2Fixture;

      // Step 1: Parse ERC-20 transfers from raw logs
      const rawTransfers = parseERC20Transfers(logs);
      expect(rawTransfers).toHaveLength(3); // user→pair MTK, user→fee MTK, pair→router WETH

      // Step 2: Enrich raw transfers with hardcoded metadata (no API calls in tests)
      const tokenMetadata: Record<string, { name: string; symbol: string; decimals: number; logo: string | null }> = {
        [MTK_ADDRESS]: { name: 'Markhor', symbol: 'MTK', decimals: 9, logo: null },
        '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': { name: 'Wrapped Ether', symbol: 'WETH', decimals: 18, logo: null },
      };

      const transfers: TokenTransfer[] = rawTransfers.map((raw) => {
        const meta = tokenMetadata[raw.tokenAddress.toLowerCase()] ?? {
          name: 'Unknown',
          symbol: '???',
          decimals: 18,
          logo: null,
        };
        return {
          from: raw.from,
          to: raw.to,
          tokenAddress: raw.tokenAddress,
          tokenName: meta.name,
          tokenSymbol: meta.symbol,
          tokenLogo: meta.logo,
          amount: raw.value,
          decimals: meta.decimals,
          logIndex: raw.logIndex,
        };
      });

      // Step 3: Parse native ETH transfers
      const erc20MaxLogIndex = Math.max(...transfers.map((t) => t.logIndex));
      const nativeTransfers = parseNativeTransfers(
        internal_transactions,
        VALUE,
        FROM_ADDRESS,
        TO_ADDRESS,
        erc20MaxLogIndex + 1,
      );

      // Step 4: Detect Uniswap swaps
      const result = detectUniswapSwaps(logs, transfers, nativeTransfers, FROM_ADDRESS);

      // Assertions
      expect(result.operations).toHaveLength(1);

      const op = result.operations[0];
      expect(op.type).toBe('uniswap-swap');
      expect(op.version).toBe('v2');
      expect(op.hops).toBe(1);

      // Input: MTK token (NOT native ETH)
      expect(op.tokenIn.symbol).toBe('MTK');
      expect(op.tokenIn.isNative).toBeFalsy();

      // Output: native ETH (router unwrapped WETH)
      expect(op.tokenOut.isNative).toBe(true);
      expect(op.tokenOut.symbol).toBe('ETH');
      expect(op.tokenOut.amount).toBe(ETH_OUTPUT_AMOUNT);

      // Native transfers consumed (Router02 → user ETH delivery)
      expect(result.nativeTransfersToConsume.length).toBeGreaterThanOrEqual(1);

      // Only user→pair MTK + pair→router WETH consumed (2); fee transfer NOT consumed
      expect(result.transferIndicesToRemove).toHaveLength(2);
    });
  });
});
