import { describe, it, expect } from 'vitest';
import {
  detectAaveSupplies,
  detectAaveBorrows,
  detectAaveRepays,
  detectAaveWithdraws,
  AAVE_V3_POOL_ADDRESS,
  AAVE_V3_SUPPLY_TOPIC0,
  AAVE_V3_BORROW_TOPIC0,
  AAVE_V3_REPAY_TOPIC0,
  AAVE_V3_WITHDRAW_TOPIC0,
} from './aaveV3Parser';
import { detectUniswapSwaps } from './uniswapParser';
import { parseERC20Transfers } from './erc20TransferParser';
import type { MoralisTransactionLog, TokenTransfer, DeFiOperation } from '../types/moralis';
import * as multiOpFixture from './__fixtures__/tx-aave-uniswap-multi-op';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const USER_ADDRESS = '0x1234567890abcdef1234567890abcdef12345678';
const ASSET_ADDRESS = '0xdac17f958d2ee523a2206206994597c13d831ec7';
const OTHER_ADDRESS = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

function padAddress(addr: string): string {
  return '0x' + addr.slice(2).padStart(64, '0');
}

function encodeUint256(value: bigint): string {
  return value.toString(16).padStart(64, '0');
}

// Supply data: [user (address), amount (uint256)]
function createSupplyLog(overrides: Partial<MoralisTransactionLog> = {}): MoralisTransactionLog {
  const userWord = USER_ADDRESS.slice(2).padStart(64, '0');
  const amount = encodeUint256(1000000n);
  return {
    address: AAVE_V3_POOL_ADDRESS,
    topic0: AAVE_V3_SUPPLY_TOPIC0,
    topic1: padAddress(ASSET_ADDRESS),  // reserve
    topic2: padAddress(USER_ADDRESS),   // onBehalfOf
    topic3: padAddress(ZERO_ADDRESS),   // referralCode (encoded as topic, not used)
    data: '0x' + userWord + amount,
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

// Borrow data: [user (address), amount (uint256), interestRateMode (uint8), borrowRate (uint256)]
function createBorrowLog(overrides: Partial<MoralisTransactionLog> = {}): MoralisTransactionLog {
  const userWord = USER_ADDRESS.slice(2).padStart(64, '0');
  const amount = encodeUint256(5000000n);
  const interestRateMode = encodeUint256(2n);
  const borrowRate = encodeUint256(50000000000000000n);
  return {
    address: AAVE_V3_POOL_ADDRESS,
    topic0: AAVE_V3_BORROW_TOPIC0,
    topic1: padAddress(ASSET_ADDRESS),  // reserve
    topic2: padAddress(USER_ADDRESS),   // onBehalfOf
    topic3: padAddress(ZERO_ADDRESS),   // referralCode
    data: '0x' + userWord + amount + interestRateMode + borrowRate,
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

// Repay data: [amount (uint256), useATokens (bool)]
function createRepayLog(overrides: Partial<MoralisTransactionLog> = {}): MoralisTransactionLog {
  const amount = encodeUint256(3000000n);
  const useATokens = encodeUint256(0n);
  return {
    address: AAVE_V3_POOL_ADDRESS,
    topic0: AAVE_V3_REPAY_TOPIC0,
    topic1: padAddress(ASSET_ADDRESS),  // reserve
    topic2: padAddress(USER_ADDRESS),   // user (whose debt is repaid)
    topic3: padAddress(USER_ADDRESS),   // repayer
    data: '0x' + amount + useATokens,
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

function createTransfer(overrides: Partial<TokenTransfer> = {}): TokenTransfer {
  return {
    from: USER_ADDRESS,
    to: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    tokenAddress: ASSET_ADDRESS,
    tokenName: 'Tether USD',
    tokenSymbol: 'USDT',
    tokenLogo: 'https://logo.example.com/usdt.png',
    amount: '1000000',
    decimals: 6,
    logIndex: 0,
    ...overrides,
  };
}

function createMintTransfer(overrides: Partial<TokenTransfer> = {}): TokenTransfer {
  return createTransfer({
    from: ZERO_ADDRESS,
    to: USER_ADDRESS,
    tokenAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1',
    tokenName: 'Aave USDT',
    tokenSymbol: 'aUSDT',
    amount: '1000000',
    ...overrides,
  });
}

describe('detectAaveSupplies', () => {
  it('detects a supply log with matching transfers and returns correct operation and indices', () => {
    const logs = [createSupplyLog()];
    const transfers = [createTransfer(), createMintTransfer()];

    const results = detectAaveSupplies(logs, transfers);

    expect(results).toHaveLength(1);
    const r = results[0];
    expect(r.operation.type).toBe('aave-supply');
    expect(r.operation.logIndex).toBe(0);
    expect(r.operation.asset).toBe(ASSET_ADDRESS);
    expect(r.operation.assetName).toBe('Tether USD');
    expect(r.operation.assetSymbol).toBe('USDT');
    expect(r.operation.assetLogo).toBe('https://logo.example.com/usdt.png');
    expect(r.operation.amount).toBe('1000000');
    expect(r.operation.decimals).toBe(6);
    expect(r.operation.supplier).toBe(USER_ADDRESS);
    expect(r.operation.onBehalfOf).toBeNull();
    expect(r.transferIndicesToRemove).toEqual(expect.arrayContaining([0, 1]));
    expect(r.transferIndicesToRemove).toHaveLength(2);
  });

  it('returns empty array when no Supply log is present', () => {
    const logs: MoralisTransactionLog[] = [];
    const results = detectAaveSupplies(logs, []);
    expect(results).toEqual([]);
  });

  it('ignores logs from a non-Pool address', () => {
    const logs = [createSupplyLog({ address: '0x0000000000000000000000000000000000000001' })];
    const results = detectAaveSupplies(logs, [createTransfer()]);
    expect(results).toEqual([]);
  });

  it('sets onBehalfOf to null when same as user', () => {
    // topic2 (onBehalfOf) === user (data word 0) === USER_ADDRESS
    const logs = [createSupplyLog()];
    const transfers = [createTransfer(), createMintTransfer()];

    const results = detectAaveSupplies(logs, transfers);
    expect(results[0].operation.onBehalfOf).toBeNull();
  });

  it('populates onBehalfOf when different from user', () => {
    // topic2 = onBehalfOf = OTHER_ADDRESS, data word 0 = user = USER_ADDRESS
    const logs = [createSupplyLog({ topic2: padAddress(OTHER_ADDRESS) })];
    const transfers = [createTransfer(), createMintTransfer({ to: OTHER_ADDRESS })];

    const results = detectAaveSupplies(logs, transfers);
    expect(results[0].operation.onBehalfOf).toBe(OTHER_ADDRESS);
  });

  it('returns operation with event data when no matching underlying transfer found', () => {
    const logs = [createSupplyLog()];
    const transfers = [createTransfer({ tokenAddress: '0x9999999999999999999999999999999999999999' })];

    const results = detectAaveSupplies(logs, transfers);
    expect(results).toHaveLength(1);
    expect(results[0].operation.assetName).toBe('Unknown');
    expect(results[0].operation.assetSymbol).toBe('???');
    expect(results[0].operation.amount).toBe('1000000');
    expect(results[0].operation.decimals).toBe(18);
    expect(results[0].transferIndicesToRemove).toEqual([]);
  });

  it('removes only underlying index when no aToken mint found', () => {
    const logs = [createSupplyLog()];
    const transfers = [createTransfer()];

    const results = detectAaveSupplies(logs, transfers);
    expect(results).toHaveLength(1);
    expect(results[0].transferIndicesToRemove).toEqual([0]);
  });

  it('detects multiple Supply logs in one transaction', () => {
    const asset2 = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    const logs = [
      createSupplyLog(),
      createSupplyLog({ topic1: padAddress(asset2) }),
    ];
    const transfers = [
      createTransfer(),
      createMintTransfer(),
      createTransfer({ tokenAddress: asset2, tokenName: 'Ether', tokenSymbol: 'ETH' }),
    ];

    const results = detectAaveSupplies(logs, transfers);
    expect(results).toHaveLength(2);
    expect(results[0].operation.asset).toBe(ASSET_ADDRESS);
    expect(results[1].operation.asset).toBe(asset2);
  });

  it('does not skip logs with topic3 null (referralCode is not needed)', () => {
    const logs = [createSupplyLog({ topic3: null })];
    const transfers = [createTransfer(), createMintTransfer()];
    const results = detectAaveSupplies(logs, transfers);
    expect(results).toHaveLength(1);
  });

  it('skips logs with missing topic1 or topic2', () => {
    const logs = [
      createSupplyLog({ topic1: null }),
      createSupplyLog({ topic2: null }),
    ];
    const results = detectAaveSupplies(logs, []);
    expect(results).toEqual([]);
  });
});

describe('detectAaveBorrows', () => {
  it('detects a borrow with matching transfers and removes correct indices', () => {
    const logs = [createBorrowLog()];
    // Underlying transfer: tokens sent TO borrower (onBehalfOf)
    const underlyingTransfer = createTransfer({
      from: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      to: USER_ADDRESS,
      amount: '5000000',
    });
    // Debt token mint
    const debtMint = createMintTransfer({
      to: USER_ADDRESS,
      tokenName: 'Aave Variable Debt USDT',
      tokenSymbol: 'variableDebtUSDT',
    });
    const transfers = [underlyingTransfer, debtMint];

    const results = detectAaveBorrows(logs, transfers);

    expect(results).toHaveLength(1);
    const r = results[0];
    expect(r.operation.type).toBe('aave-borrow');
    expect(r.operation.asset).toBe(ASSET_ADDRESS);
    expect(r.operation.assetName).toBe('Tether USD');
    expect(r.operation.assetSymbol).toBe('USDT');
    expect(r.operation.amount).toBe('5000000');
    expect(r.operation.borrower).toBe(USER_ADDRESS);
    expect(r.transferIndicesToRemove).toEqual(expect.arrayContaining([0, 1]));
    expect(r.transferIndicesToRemove).toHaveLength(2);
  });

  it('populates borrower from onBehalfOf (topic2)', () => {
    const logs = [createBorrowLog({ topic2: padAddress(OTHER_ADDRESS) })];
    const transfers = [
      createTransfer({ from: '0xbbbb', to: OTHER_ADDRESS }),
      createMintTransfer({ to: OTHER_ADDRESS }),
    ];

    const results = detectAaveBorrows(logs, transfers);
    expect(results).toHaveLength(1);
    expect(results[0].operation.borrower).toBe(OTHER_ADDRESS);
  });

  it('returns operation with event data when no matching transfers found', () => {
    const logs = [createBorrowLog()];
    const transfers = [createTransfer({ tokenAddress: '0x9999999999999999999999999999999999999999' })];

    const results = detectAaveBorrows(logs, transfers);
    expect(results).toHaveLength(1);
    expect(results[0].operation.assetName).toBe('Unknown');
    expect(results[0].operation.assetSymbol).toBe('???');
    expect(results[0].operation.amount).toBe('5000000');
    expect(results[0].operation.decimals).toBe(18);
    expect(results[0].transferIndicesToRemove).toEqual([]);
  });

  it('skips logs with missing topic1 or topic2', () => {
    const logs = [
      createBorrowLog({ topic1: null }),
      createBorrowLog({ topic2: null }),
    ];
    const results = detectAaveBorrows(logs, []);
    expect(results).toEqual([]);
  });
});

describe('detectAaveRepays', () => {
  it('detects a repay with matching transfers', () => {
    const logs = [createRepayLog()];
    // Underlying transfer: from repayer
    const underlyingTransfer = createTransfer({
      from: USER_ADDRESS,
      to: AAVE_V3_POOL_ADDRESS,
      amount: '3000000',
    });
    // Debt token burn
    const debtBurn = createTransfer({
      from: USER_ADDRESS,
      to: ZERO_ADDRESS,
      tokenAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1',
      tokenName: 'Aave Variable Debt USDT',
      tokenSymbol: 'variableDebtUSDT',
    });
    const transfers = [underlyingTransfer, debtBurn];

    const results = detectAaveRepays(logs, transfers);

    expect(results).toHaveLength(1);
    const r = results[0];
    expect(r.operation.type).toBe('aave-repay');
    expect(r.operation.asset).toBe(ASSET_ADDRESS);
    expect(r.operation.assetName).toBe('Tether USD');
    expect(r.operation.amount).toBe('3000000');
    expect(r.operation.repayer).toBe(USER_ADDRESS);
    expect(r.operation.onBehalfOf).toBeNull();
    expect(r.transferIndicesToRemove).toEqual(expect.arrayContaining([0, 1]));
    expect(r.transferIndicesToRemove).toHaveLength(2);
  });

  it('shows onBehalfOf when repayer differs from user', () => {
    // topic2 = user (whose debt), topic3 = repayer (who pays)
    const logs = [createRepayLog({ topic3: padAddress(OTHER_ADDRESS) })];
    const transfers = [
      createTransfer({ from: OTHER_ADDRESS }),
      createTransfer({ from: USER_ADDRESS, to: ZERO_ADDRESS }),
    ];

    const results = detectAaveRepays(logs, transfers);
    expect(results).toHaveLength(1);
    expect(results[0].operation.repayer).toBe(OTHER_ADDRESS);
    expect(results[0].operation.onBehalfOf).toBe(USER_ADDRESS);
  });

  it('sets onBehalfOf to null when repayer equals user', () => {
    // topic2 = USER_ADDRESS, topic3 = USER_ADDRESS (same person)
    const logs = [createRepayLog()];
    const results = detectAaveRepays(logs, [createTransfer()]);
    expect(results[0].operation.onBehalfOf).toBeNull();
  });

  it('skips logs with missing topics', () => {
    const logs = [
      createRepayLog({ topic1: null }),
      createRepayLog({ topic2: null }),
      createRepayLog({ topic3: null }),
    ];
    const results = detectAaveRepays(logs, []);
    expect(results).toEqual([]);
  });
});

// Withdraw data: [amount (uint256)]
function createWithdrawLog(overrides: Partial<MoralisTransactionLog> = {}): MoralisTransactionLog {
  const amount = encodeUint256(2000000n);
  return {
    address: AAVE_V3_POOL_ADDRESS,
    topic0: AAVE_V3_WITHDRAW_TOPIC0,
    topic1: padAddress(ASSET_ADDRESS),   // reserve
    topic2: padAddress(USER_ADDRESS),    // user (withdrawer)
    topic3: padAddress(USER_ADDRESS),    // to (recipient)
    data: '0x' + amount,
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

describe('detectAaveWithdraws', () => {
  it('detects a withdraw with matching transfers, correct fields, and indices removed', () => {
    const logs = [createWithdrawLog()];
    // aToken burn: from user, to zero
    const burnTransfer = createTransfer({
      from: USER_ADDRESS,
      to: ZERO_ADDRESS,
      tokenAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1',
      tokenName: 'Aave USDT',
      tokenSymbol: 'aUSDT',
      amount: '2000000',
    });
    // Underlying transfer: reserve token to user
    const underlyingTransfer = createTransfer({
      from: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      to: USER_ADDRESS,
      tokenAddress: ASSET_ADDRESS,
      amount: '2000000',
    });
    const transfers = [burnTransfer, underlyingTransfer];

    const results = detectAaveWithdraws(logs, transfers);

    expect(results).toHaveLength(1);
    const r = results[0];
    expect(r.operation.type).toBe('aave-withdraw');
    expect(r.operation.logIndex).toBe(0);
    expect(r.operation.asset).toBe(ASSET_ADDRESS);
    expect(r.operation.assetName).toBe('Tether USD');
    expect(r.operation.assetSymbol).toBe('USDT');
    expect(r.operation.assetLogo).toBe('https://logo.example.com/usdt.png');
    expect(r.operation.amount).toBe('2000000');
    expect(r.operation.decimals).toBe(6);
    expect(r.operation.withdrawer).toBe(USER_ADDRESS);
    expect(r.operation.to).toBeNull();
    expect(r.transferIndicesToRemove).toEqual(expect.arrayContaining([0, 1]));
    expect(r.transferIndicesToRemove).toHaveLength(2);
  });

  it('sets to to null when recipient equals user', () => {
    const logs = [createWithdrawLog()];
    const transfers = [
      createTransfer({ from: USER_ADDRESS, to: ZERO_ADDRESS }),
      createTransfer({ from: '0xbbbb', to: USER_ADDRESS }),
    ];

    const results = detectAaveWithdraws(logs, transfers);
    expect(results[0].operation.to).toBeNull();
  });

  it('populates to when recipient differs from user', () => {
    const logs = [createWithdrawLog({ topic3: padAddress(OTHER_ADDRESS) })];
    const transfers = [
      createTransfer({ from: USER_ADDRESS, to: ZERO_ADDRESS }),
      createTransfer({ from: '0xbbbb', to: OTHER_ADDRESS }),
    ];

    const results = detectAaveWithdraws(logs, transfers);
    expect(results[0].operation.to).toBe(OTHER_ADDRESS);
    expect(results[0].operation.withdrawer).toBe(USER_ADDRESS);
  });

  it('returns operation with event data when no matching transfers found', () => {
    const logs = [createWithdrawLog()];
    const transfers = [createTransfer({ tokenAddress: '0x9999999999999999999999999999999999999999' })];

    const results = detectAaveWithdraws(logs, transfers);
    expect(results).toHaveLength(1);
    expect(results[0].operation.assetName).toBe('Unknown');
    expect(results[0].operation.assetSymbol).toBe('???');
    expect(results[0].operation.amount).toBe('2000000');
    expect(results[0].operation.decimals).toBe(18);
  });

  it('skips logs with missing topics', () => {
    const logs = [
      createWithdrawLog({ topic1: null }),
      createWithdrawLog({ topic2: null }),
      createWithdrawLog({ topic3: null }),
    ];
    const results = detectAaveWithdraws(logs, []);
    expect(results).toEqual([]);
  });

  it('handles multiple withdraws', () => {
    const asset2 = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    const logs = [
      createWithdrawLog(),
      createWithdrawLog({ topic1: padAddress(asset2), log_index: '5' }),
    ];
    const transfers = [
      createTransfer({ from: USER_ADDRESS, to: ZERO_ADDRESS }),
      createTransfer({ from: '0xbbbb', to: USER_ADDRESS }),
      createTransfer({ from: USER_ADDRESS, to: ZERO_ADDRESS, tokenAddress: asset2 }),
      createTransfer({ from: '0xbbbb', to: USER_ADDRESS, tokenAddress: asset2, tokenName: 'Ether', tokenSymbol: 'ETH' }),
    ];

    const results = detectAaveWithdraws(logs, transfers);
    expect(results).toHaveLength(2);
    expect(results[0].operation.asset).toBe(ASSET_ADDRESS);
    expect(results[1].operation.asset).toBe(asset2);
    expect(results[1].operation.logIndex).toBe(5);
  });
});

describe('real transaction fixture — Aave + Uniswap multi-op', () => {
  // Token metadata for enrichment (no API calls in tests)
  const tokenMetadata: Record<string, { name: string; symbol: string; decimals: number; logo: string | null }> = {
    '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': { name: 'Wrapped Ether', symbol: 'WETH', decimals: 18, logo: null },
    '0xbe9895146f7af43049ca1c1ae358b0541ea49704': { name: 'Coinbase Wrapped Staked ETH', symbol: 'cbETH', decimals: 18, logo: null },
    '0x4d5f47fa6a74757f35c14fd3a6ef8e3c9bc514e8': { name: 'Aave Ethereum WETH', symbol: 'aEthWETH', decimals: 18, logo: null },
    '0x0c91bca95b5fe69164ce583a2ec9429a569798ed': { name: 'Aave Ethereum Variable Debt cbETH', symbol: 'variableDebtEthcbETH', decimals: 18, logo: null },
  };

  function enrichTransfers() {
    const rawTransfers = parseERC20Transfers(multiOpFixture.logs);
    return rawTransfers.map((raw) => {
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
      } satisfies TokenTransfer;
    });
  }

  it('detects all 7 operations in correct order', () => {
    const transfers = enrichTransfers();

    // Run all Aave parsers
    const supplies = detectAaveSupplies(multiOpFixture.logs, transfers);
    const borrows = detectAaveBorrows(multiOpFixture.logs, transfers);
    const repays = detectAaveRepays(multiOpFixture.logs, transfers);
    const withdraws = detectAaveWithdraws(multiOpFixture.logs, transfers);

    // Collect consumed transfer indices from Aave
    const indicesToRemove = new Set<number>();
    for (const r of [...supplies, ...borrows, ...repays, ...withdraws]) {
      for (const idx of r.transferIndicesToRemove) indicesToRemove.add(idx);
    }

    // Run Uniswap parser (no native transfers in this fixture)
    const uniResult = detectUniswapSwaps(multiOpFixture.logs, transfers, [], multiOpFixture.FROM_ADDRESS);
    for (const idx of uniResult.transferIndicesToRemove) indicesToRemove.add(idx);

    // Assemble all operations sorted by logIndex
    const allOps: DeFiOperation[] = [
      ...supplies.map((r) => r.operation),
      ...borrows.map((r) => r.operation),
      ...repays.map((r) => r.operation),
      ...withdraws.map((r) => r.operation),
      ...uniResult.operations,
    ].sort((a, b) => a.logIndex - b.logIndex);

    // Should detect exactly 7 operations
    expect(allOps).toHaveLength(7);

    // Verify operation types and logIndex in order
    expect(allOps[0].type).toBe('aave-supply');     // logIndex 99
    expect(allOps[0].logIndex).toBe(99);
    expect(allOps[1].type).toBe('aave-withdraw');    // logIndex 104
    expect(allOps[1].logIndex).toBe(104);
    expect(allOps[2].type).toBe('aave-withdraw');    // logIndex 109
    expect(allOps[2].logIndex).toBe(109);
    expect(allOps[3].type).toBe('uniswap-swap');     // logIndex 116
    expect(allOps[3].logIndex).toBe(116);
    expect(allOps[4].type).toBe('aave-repay');       // logIndex 122
    expect(allOps[4].logIndex).toBe(122);
    expect(allOps[5].type).toBe('aave-withdraw');    // logIndex 127
    expect(allOps[5].logIndex).toBe(127);
    expect(allOps[6].type).toBe('uniswap-swap');     // logIndex 132
    expect(allOps[6].logIndex).toBe(132);
  });

  it('detects correct asset symbols on Aave operations', () => {
    const transfers = enrichTransfers();
    const supplies = detectAaveSupplies(multiOpFixture.logs, transfers);
    const repays = detectAaveRepays(multiOpFixture.logs, transfers);
    const withdraws = detectAaveWithdraws(multiOpFixture.logs, transfers);

    // Supply: 90 WETH
    expect(supplies).toHaveLength(1);
    expect(supplies[0].operation.assetSymbol).toBe('WETH');
    expect(supplies[0].operation.amount).toBe('90000000000000000000'); // 90 * 1e18

    // Repay: cbETH
    expect(repays).toHaveLength(1);
    expect(repays[0].operation.assetSymbol).toBe('cbETH');

    // All 3 withdraws are WETH with distinct amounts
    expect(withdraws).toHaveLength(3);
    const withdrawAmounts = withdraws.map((w) => w.operation.amount);
    for (const w of withdraws) {
      expect(w.operation.assetSymbol).toBe('WETH');
    }
    // Each withdrawal should have a unique amount (not all grabbing the same transfer)
    const uniqueAmounts = new Set(withdrawAmounts);
    expect(uniqueAmounts.size).toBe(3);
    // None of the withdrawals should show 90 WETH (the supply amount / flash loan amount)
    for (const amt of withdrawAmounts) {
      expect(amt).not.toBe('90000000000000000000');
    }
  });

  it('Uniswap swaps have correct token pairs', () => {
    const transfers = enrichTransfers();
    const uniResult = detectUniswapSwaps(multiOpFixture.logs, transfers, [], multiOpFixture.FROM_ADDRESS);

    expect(uniResult.operations).toHaveLength(2);

    // First swap: WETH → cbETH (logIndex 116)
    const swap1 = uniResult.operations[0];
    expect(swap1.version).toBe('v3');
    expect(swap1.tokenIn.symbol).toBe('WETH');
    expect(swap1.tokenOut.symbol).toBe('cbETH');

    // Second swap also uses same V3 pool (cbETH/WETH at 0x177622...)
    // Both swaps share the pool as participant, so the parser attributes
    // based on transfer ordering. Both are detected as V3 swaps.
    const swap2 = uniResult.operations[1];
    expect(swap2.version).toBe('v3');
    // The two tokens involved are always WETH and cbETH
    const swap2Tokens = new Set([swap2.tokenIn.symbol, swap2.tokenOut.symbol]);
    expect(swap2Tokens).toContain('WETH');
    expect(swap2Tokens).toContain('cbETH');
  });

  it('consumed transfers do not leak as standalone items', () => {
    const transfers = enrichTransfers();
    const supplies = detectAaveSupplies(multiOpFixture.logs, transfers);
    const borrows = detectAaveBorrows(multiOpFixture.logs, transfers);
    const repays = detectAaveRepays(multiOpFixture.logs, transfers);
    const withdraws = detectAaveWithdraws(multiOpFixture.logs, transfers);

    const indicesToRemove = new Set<number>();
    for (const r of [...supplies, ...borrows, ...repays, ...withdraws]) {
      for (const idx of r.transferIndicesToRemove) indicesToRemove.add(idx);
    }

    const uniResult = detectUniswapSwaps(multiOpFixture.logs, transfers, [], multiOpFixture.FROM_ADDRESS);
    for (const idx of uniResult.transferIndicesToRemove) indicesToRemove.add(idx);

    const remainingTransfers = transfers.filter((_, i) => !indicesToRemove.has(i));

    // Remaining transfers should only be non-DeFi transfers (e.g., Balancer flash loan transfers)
    // No aToken mints/burns or underlying Aave/Uniswap transfers should remain
    const aEthWETH = '0x4d5f47fa6a74757f35c14fd3a6ef8e3c9bc514e8';
    const variableDebtEthcbETH = '0x0c91bca95b5fe69164ce583a2ec9429a569798ed';
    const WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
    const user = multiOpFixture.FROM_ADDRESS.toLowerCase();

    for (const t of remainingTransfers) {
      // aEthWETH and variableDebtEthcbETH should all be consumed
      expect(t.tokenAddress).not.toBe(aEthWETH);
      expect(t.tokenAddress).not.toBe(variableDebtEthcbETH);
    }

    // No WETH transfer from aEthWETH → user should remain (these are the underlying withdraw transfers)
    const leakedWethWithdraws = remainingTransfers.filter(
      (t) =>
        t.tokenAddress.toLowerCase() === WETH &&
        t.from.toLowerCase() === aEthWETH &&
        t.to.toLowerCase() === user,
    );
    expect(leakedWethWithdraws).toHaveLength(0);
  });
});
