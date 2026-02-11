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
import type { MoralisTransactionLog, TokenTransfer } from '../types/moralis';

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

/**
 * Real transaction test: 0xcb3061fccc99753c9e6be8b2dd27f1b6030db263f42ce1c5310eb683573834f1
 *
 * This is a complex flash-loan arbitrage tx with multiple Aave operations:
 *   - 1 Supply (90 WETH)
 *   - 3 Withdrawals (678.6 WETH, 28.2 WETH, 90 WETH)
 *   - 1 Repay (29.2 cbETH)
 *
 * It exercises the parsers with real-world data where multiple operations
 * of the same type compete for the same pool of ERC-20 transfers.
 */
describe('real tx 0xcb3061…34f1 — multi-operation Aave parsing', () => {
  // Addresses from the real transaction
  const TX_USER = '0xc3623ab16de256bf11855f884fdffd6f971c5fb7';
  const WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
  const A_ETH_WETH = '0x4d5f47fa6a74757f35c14fd3a6ef8e3c9bc514e8';
  const CB_ETH = '0xbe9895146f7af43049ca1c1ae358b0541ea49704';
  const CB_ETH_ATOKEN = '0x977b6fc5de62598b08c85ac8cf2b745874e8b78c';
  const VAR_DEBT_CB_ETH = '0x0c91bca95b5fe69164ce583a2ec9429a569798ed';
  const BALANCER_VAULT = '0xba12222222228d8ba445958a75a0704d566bf2c8';
  const UNIV3_POOL = '0x177622e79acece98c39f6e12fa78ac7fc8a8bf62';
  const MEV_BOT = '0x000000000035b5e5ad9019092c665357240f594e';

  function baseMoralisLog(overrides: Partial<MoralisTransactionLog>): MoralisTransactionLog {
    return {
      address: '',
      topic0: '',
      topic1: null,
      topic2: null,
      topic3: null,
      data: '0x',
      block_number: '22038621',
      block_hash: '0x0',
      block_timestamp: '2025-07-07T00:00:00Z',
      log_index: '0',
      transaction_hash: '0xcb3061fccc99753c9e6be8b2dd27f1b6030db263f42ce1c5310eb683573834f1',
      transaction_index: '0',
      transaction_value: '0',
      decoded_event: null,
      ...overrides,
    };
  }

  // ── Aave Pool event logs (from the real receipt) ──────────────────────

  const supplyLog = baseMoralisLog({
    address: AAVE_V3_POOL_ADDRESS,
    topic0: AAVE_V3_SUPPLY_TOPIC0,
    topic1: padAddress(WETH),
    topic2: padAddress(TX_USER),
    topic3: padAddress(ZERO_ADDRESS),
    // data: [user (address), amount (uint256)]
    data: '0x' + TX_USER.slice(2).padStart(64, '0') + '000000000000000000000000000000000000000000000004e1003b28d9280000',
    log_index: '99',
  });

  const withdrawLog1 = baseMoralisLog({
    address: AAVE_V3_POOL_ADDRESS,
    topic0: AAVE_V3_WITHDRAW_TOPIC0,
    topic1: padAddress(WETH),
    topic2: padAddress(TX_USER),
    topic3: padAddress(TX_USER),
    data: '0x000000000000000000000000000000000000000000000024c9b412fcac599129',
    log_index: '104',
  });

  const withdrawLog2 = baseMoralisLog({
    address: AAVE_V3_POOL_ADDRESS,
    topic0: AAVE_V3_WITHDRAW_TOPIC0,
    topic1: padAddress(WETH),
    topic2: padAddress(TX_USER),
    topic3: padAddress(TX_USER),
    data: '0x00000000000000000000000000000000000000000000000187c209c8edd10331',
    log_index: '109',
  });

  const repayLog = baseMoralisLog({
    address: AAVE_V3_POOL_ADDRESS,
    topic0: AAVE_V3_REPAY_TOPIC0,
    topic1: padAddress(CB_ETH),
    topic2: padAddress(TX_USER),
    topic3: padAddress(TX_USER),
    data: '0x000000000000000000000000000000000000000000000001955b578ecb8042080000000000000000000000000000000000000000000000000000000000000000',
    log_index: '122',
  });

  const withdrawLog3 = baseMoralisLog({
    address: AAVE_V3_POOL_ADDRESS,
    topic0: AAVE_V3_WITHDRAW_TOPIC0,
    topic1: padAddress(WETH),
    topic2: padAddress(TX_USER),
    topic3: padAddress(TX_USER),
    data: '0x00000000000000000000000000000000000000000000000004e1003b28d927fffd',
    log_index: '127',
  });

  const allLogs = [supplyLog, withdrawLog1, withdrawLog2, repayLog, withdrawLog3];

  // ── ERC-20 transfers (enriched, in log-index order) ───────────────────

  const transfers: TokenTransfer[] = [
    // idx 0 — log 93: Balancer → User 90 WETH (flash loan)
    { from: BALANCER_VAULT, to: TX_USER, tokenAddress: WETH, tokenName: 'Wrapped Ether', tokenSymbol: 'WETH', tokenLogo: null, amount: '90000000000000000000', decimals: 18, logIndex: 93 },
    // idx 1 — log 96: User → aEthWETH 90 WETH (supply underlying)
    { from: TX_USER, to: A_ETH_WETH, tokenAddress: WETH, tokenName: 'Wrapped Ether', tokenSymbol: 'WETH', tokenLogo: null, amount: '90000000000000000000', decimals: 18, logIndex: 96 },
    // idx 2 — log 97: 0x0 → User aEthWETH mint (supply aToken)
    { from: ZERO_ADDRESS, to: TX_USER, tokenAddress: A_ETH_WETH, tokenName: 'Aave Ethereum WETH', tokenSymbol: 'aEthWETH', tokenLogo: null, amount: '89999999999999999999', decimals: 18, logIndex: 97 },
    // idx 3 — log 101: User → 0x0 aEthWETH burn (withdraw1)
    { from: TX_USER, to: ZERO_ADDRESS, tokenAddress: A_ETH_WETH, tokenName: 'Aave Ethereum WETH', tokenSymbol: 'aEthWETH', tokenLogo: null, amount: '678617049427407900969', decimals: 18, logIndex: 101 },
    // idx 4 — log 103: aEthWETH → User 678.6 WETH (withdraw1 underlying)
    { from: A_ETH_WETH, to: TX_USER, tokenAddress: WETH, tokenName: 'Wrapped Ether', tokenSymbol: 'WETH', tokenLogo: null, amount: '678617049427407900969', decimals: 18, logIndex: 103 },
    // idx 5 — log 106: User → 0x0 aEthWETH burn (withdraw2)
    { from: TX_USER, to: ZERO_ADDRESS, tokenAddress: A_ETH_WETH, tokenName: 'Aave Ethereum WETH', tokenSymbol: 'aEthWETH', tokenLogo: null, amount: '28229136172899697458', decimals: 18, logIndex: 106 },
    // idx 6 — log 108: aEthWETH → User 28.2 WETH (withdraw2 underlying)
    { from: A_ETH_WETH, to: TX_USER, tokenAddress: WETH, tokenName: 'Wrapped Ether', tokenSymbol: 'WETH', tokenLogo: null, amount: '28229136172899697457', decimals: 18, logIndex: 108 },
    // idx 7 — log 111: UniV3 → User cbETH
    { from: UNIV3_POOL, to: TX_USER, tokenAddress: CB_ETH, tokenName: 'Coinbase Wrapped Staked ETH', tokenSymbol: 'cbETH', tokenLogo: null, amount: '4045416570496434508', decimals: 18, logIndex: 111 },
    // idx 8 — log 112: UniV3 → User WETH (swap dust)
    { from: UNIV3_POOL, to: TX_USER, tokenAddress: WETH, tokenName: 'Wrapped Ether', tokenSymbol: 'WETH', tokenLogo: null, amount: '4308237167753400', decimals: 18, logIndex: 112 },
    // idx 9 — log 114: UniV3 → User cbETH
    { from: UNIV3_POOL, to: TX_USER, tokenAddress: CB_ETH, tokenName: 'Coinbase Wrapped Staked ETH', tokenSymbol: 'cbETH', tokenLogo: null, amount: '25172003097585304855', decimals: 18, logIndex: 114 },
    // idx 10 — log 115: User → UniV3 WETH (swap input)
    { from: TX_USER, to: UNIV3_POOL, tokenAddress: WETH, tokenName: 'Wrapped Ether', tokenSymbol: 'WETH', tokenLogo: null, amount: '28233444410067450857', decimals: 18, logIndex: 115 },
    // idx 11 — log 118: User → 0x0 variableDebtCbETH burn (repay debt burn)
    { from: TX_USER, to: ZERO_ADDRESS, tokenAddress: VAR_DEBT_CB_ETH, tokenName: 'Variable Debt cbETH', tokenSymbol: 'variableDebtCbETH', tokenLogo: null, amount: '29209036079052636680', decimals: 18, logIndex: 118 },
    // idx 12 — log 121: User → cbETH aToken (repay underlying)
    { from: TX_USER, to: CB_ETH_ATOKEN, tokenAddress: CB_ETH, tokenName: 'Coinbase Wrapped Staked ETH', tokenSymbol: 'cbETH', tokenLogo: null, amount: '29209036079052636680', decimals: 18, logIndex: 121 },
    // idx 13 — log 124: User → 0x0 aEthWETH burn (withdraw3)
    { from: TX_USER, to: ZERO_ADDRESS, tokenAddress: A_ETH_WETH, tokenName: 'Aave Ethereum WETH', tokenSymbol: 'aEthWETH', tokenLogo: null, amount: '89999999999999999997', decimals: 18, logIndex: 124 },
    // idx 14 — log 126: aEthWETH → User 90 WETH (withdraw3 underlying)
    { from: A_ETH_WETH, to: TX_USER, tokenAddress: WETH, tokenName: 'Wrapped Ether', tokenSymbol: 'WETH', tokenLogo: null, amount: '89999999999999999997', decimals: 18, logIndex: 126 },
    // idx 15 — log 128: User → Balancer 90 WETH (flash loan repay)
    { from: TX_USER, to: BALANCER_VAULT, tokenAddress: WETH, tokenName: 'Wrapped Ether', tokenSymbol: 'WETH', tokenLogo: null, amount: '90000000000000000000', decimals: 18, logIndex: 128 },
    // idx 16 — log 130: UniV3 → User WETH (swap dust)
    { from: UNIV3_POOL, to: TX_USER, tokenAddress: WETH, tokenName: 'Wrapped Ether', tokenSymbol: 'WETH', tokenLogo: null, amount: '9405985612255629', decimals: 18, logIndex: 130 },
    // idx 17 — log 131: User → UniV3 cbETH
    { from: TX_USER, to: UNIV3_POOL, tokenAddress: CB_ETH, tokenName: 'Coinbase Wrapped Staked ETH', tokenSymbol: 'cbETH', tokenLogo: null, amount: '8383589029102681', decimals: 18, logIndex: 131 },
    // idx 18 — log 133: User → MEV Bot 678.6 WETH (profit extraction)
    { from: TX_USER, to: MEV_BOT, tokenAddress: WETH, tokenName: 'Wrapped Ether', tokenSymbol: 'WETH', tokenLogo: null, amount: '678626455413020156593', decimals: 18, logIndex: 133 },
  ];

  it('detects 1 Supply of 90 WETH', () => {
    const results = detectAaveSupplies(allLogs, transfers);

    expect(results).toHaveLength(1);
    const supply = results[0].operation;
    expect(supply.type).toBe('aave-supply');
    expect(supply.logIndex).toBe(99);
    expect(supply.asset).toBe(WETH);
    expect(supply.assetSymbol).toBe('WETH');
    expect(supply.amount).toBe('90000000000000000000');
    expect(supply.supplier).toBe(TX_USER);
    expect(supply.onBehalfOf).toBeNull();
    // Should remove the underlying (idx 1) and aToken mint (idx 2)
    expect(results[0].transferIndicesToRemove).toEqual(expect.arrayContaining([1, 2]));
    expect(results[0].transferIndicesToRemove).toHaveLength(2);
  });

  it('detects 3 Withdrawals of WETH with correct amounts', () => {
    const results = detectAaveWithdraws(allLogs, transfers);

    expect(results).toHaveLength(3);

    // Withdraw 1: ~678.6 WETH
    const w1 = results[0].operation;
    expect(w1.type).toBe('aave-withdraw');
    expect(w1.logIndex).toBe(104);
    expect(w1.asset).toBe(WETH);
    expect(w1.assetSymbol).toBe('WETH');
    expect(w1.amount).toBe('678617049427407900969');
    expect(w1.withdrawer).toBe(TX_USER);
    expect(w1.to).toBeNull(); // recipient == withdrawer
    // Should remove burn (idx 3) and underlying (idx 4)
    expect(results[0].transferIndicesToRemove).toEqual(expect.arrayContaining([3, 4]));
    expect(results[0].transferIndicesToRemove).toHaveLength(2);

    // Withdraw 2: ~28.2 WETH
    const w2 = results[1].operation;
    expect(w2.logIndex).toBe(109);
    expect(w2.amount).toBe('28229136172899697457');
    // Should remove burn (idx 5) and underlying (idx 6)
    expect(results[1].transferIndicesToRemove).toEqual(expect.arrayContaining([5, 6]));
    expect(results[1].transferIndicesToRemove).toHaveLength(2);

    // Withdraw 3: ~90 WETH
    const w3 = results[2].operation;
    expect(w3.logIndex).toBe(127);
    expect(w3.amount).toBe('89999999999999999997');
    // Should remove burn (idx 13) and underlying (idx 14)
    expect(results[2].transferIndicesToRemove).toEqual(expect.arrayContaining([13, 14]));
    expect(results[2].transferIndicesToRemove).toHaveLength(2);
  });

  it('detects 1 Repay of cbETH', () => {
    const results = detectAaveRepays(allLogs, transfers);

    expect(results).toHaveLength(1);
    const repay = results[0].operation;
    expect(repay.type).toBe('aave-repay');
    expect(repay.logIndex).toBe(122);
    expect(repay.asset).toBe(CB_ETH);
    expect(repay.assetSymbol).toBe('cbETH');
    expect(repay.amount).toBe('29209036079052636680');
    expect(repay.repayer).toBe(TX_USER);
    expect(repay.onBehalfOf).toBeNull();
    // Should remove underlying (idx 12) and debt burn (idx 11)
    expect(results[0].transferIndicesToRemove).toEqual(expect.arrayContaining([11, 12]));
    expect(results[0].transferIndicesToRemove).toHaveLength(2);
  });

  it('all parsers with shared claimedIndices remove exactly the right 10 transfers', () => {
    const claimed = new Set<number>();

    const supplies = detectAaveSupplies(allLogs, transfers, claimed);
    const borrows = detectAaveBorrows(allLogs, transfers, claimed);
    const repays = detectAaveRepays(allLogs, transfers, claimed);
    const withdraws = detectAaveWithdraws(allLogs, transfers, claimed);

    // Collect every removed index
    const allRemoved = new Set<number>();
    for (const r of [...supplies, ...borrows, ...repays, ...withdraws]) {
      for (const idx of r.transferIndicesToRemove) allRemoved.add(idx);
    }

    // 5 operations × 2 transfers each = 10 transfers removed
    expect(allRemoved.size).toBe(10);

    // The 9 remaining transfers should be the non-Aave ones
    const remaining = transfers.filter((_, i) => !allRemoved.has(i));
    expect(remaining).toHaveLength(9);

    // Spot-check: flash loan in/out, swaps, MEV profit should survive
    expect(remaining.some(t => t.from === BALANCER_VAULT)).toBe(true);   // flash loan in
    expect(remaining.some(t => t.to === BALANCER_VAULT)).toBe(true);     // flash loan repay
    expect(remaining.some(t => t.to === MEV_BOT)).toBe(true);            // profit extraction
  });
});

/**
 * Real transaction test: 0x3dd1601079319490b361d3509b5f22677d1a86d98e68085978ee5ba421aea619
 *
 * CoW Protocol swap that involves Aave V3 operations executed by a solver
 * on behalf of a different user:
 *   - 1 Repay (WETH) — repayer=solver, user(debtor)=debtor
 *   - 1 Borrow (USDT) — user(initiator)=solver, onBehalfOf=debtor
 *
 * This exercises the edge case where someone acts on behalf of another user,
 * so the underlying token flow goes to/from the initiator, not the debt holder.
 */
describe('real tx 0x3dd160…a619 — CoW solver Aave Repay + Borrow', () => {
  const SOLVER = '0x2774690c94f7f11a66a358f050b641ec8b5c63e8';
  const DEBTOR = '0xdb25941d6a7bb498dab8235d0848f5bc121ba8c9';
  const COW_SETTLEMENT = '0x9008d19f58aabd9ed0d60971565aa8510560ab41';
  const WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
  const USDT = '0xdac17f958d2ee523a2206206994597c13d831ec7';
  const A_ETH_USDT = '0x23878914efe38d27c4d67ab83ed1b93a74d4086a';
  const A_ETH_WETH = '0x4d5f47fa6a74757f35c14fd3a6ef8e3c9bc514e8';
  const VAR_DEBT_WETH = '0xea51d7853eefb32b6ee06b1c12e6dcca88be0ffe';
  const VAR_DEBT_USDT = '0x6df1c1e379bc5a00a7b4c6e67a203333772f45a8';
  const DECC_ADDR = '0xdecc46a4000000000000000000000000000000a4';
  const ADDR_51C7 = '0x51c7284800000000000000000000000000000051';

  function baseMoralisLog(overrides: Partial<MoralisTransactionLog>): MoralisTransactionLog {
    return {
      address: '',
      topic0: '',
      topic1: null,
      topic2: null,
      topic3: null,
      data: '0x',
      block_number: '22100000',
      block_hash: '0x0',
      block_timestamp: '2025-07-10T00:00:00Z',
      log_index: '0',
      transaction_hash: '0x3dd1601079319490b361d3509b5f22677d1a86d98e68085978ee5ba421aea619',
      transaction_index: '0',
      transaction_value: '0',
      decoded_event: null,
      ...overrides,
    };
  }

  // ── Aave Pool event logs ──────────────────────────────────────────────

  // Repay (log 314): reserve=WETH, user=debtor, repayer=solver
  const repayLog = baseMoralisLog({
    address: AAVE_V3_POOL_ADDRESS,
    topic0: AAVE_V3_REPAY_TOPIC0,
    topic1: padAddress(WETH),
    topic2: padAddress(DEBTOR),
    topic3: padAddress(SOLVER),
    // data: [amount (uint256), useATokens (bool)]
    data: '0x' + encodeUint256(16429459348410497719n) + encodeUint256(0n),
    log_index: '314',
  });

  // Borrow (log 320): reserve=USDT, onBehalfOf=debtor, data=[solver, amount, ...]
  const borrowLog = baseMoralisLog({
    address: AAVE_V3_POOL_ADDRESS,
    topic0: AAVE_V3_BORROW_TOPIC0,
    topic1: padAddress(USDT),
    topic2: padAddress(DEBTOR),
    topic3: padAddress(ZERO_ADDRESS), // referralCode
    // data: [user(address=solver), amount, interestRateMode, borrowRate]
    data: '0x' + SOLVER.slice(2).padStart(64, '0') + encodeUint256(33432229161n) + encodeUint256(2n) + encodeUint256(50000000000000000n),
    log_index: '320',
  });

  const allLogs = [repayLog, borrowLog];

  // ── ERC-20 transfers (15 total, in log-index order) ────────────────────

  const transfers: TokenTransfer[] = [
    // idx 0 — log 298: USDT aEthUSDT → DECC
    { from: A_ETH_USDT, to: DECC_ADDR, tokenAddress: USDT, tokenName: 'Tether USD', tokenSymbol: 'USDT', tokenLogo: null, amount: '33432229161', decimals: 6, logIndex: 298 },
    // idx 1 — log 300: USDT DECC → solver
    { from: DECC_ADDR, to: SOLVER, tokenAddress: USDT, tokenName: 'Tether USD', tokenSymbol: 'USDT', tokenLogo: null, amount: '33432229161', decimals: 6, logIndex: 300 },
    // idx 2 — log 303: USDT solver → CoW Settlement
    { from: SOLVER, to: COW_SETTLEMENT, tokenAddress: USDT, tokenName: 'Tether USD', tokenSymbol: 'USDT', tokenLogo: null, amount: '33010598117', decimals: 6, logIndex: 303 },
    // idx 3 — log 304: USDT CoW Settlement → 0x51c7
    { from: COW_SETTLEMENT, to: ADDR_51C7, tokenAddress: USDT, tokenName: 'Tether USD', tokenSymbol: 'USDT', tokenLogo: null, amount: '32997472987', decimals: 6, logIndex: 304 },
    // idx 4 — log 305: WETH 0x51c7 → CoW Settlement
    { from: ADDR_51C7, to: COW_SETTLEMENT, tokenAddress: WETH, tokenName: 'Wrapped Ether', tokenSymbol: 'WETH', tokenLogo: null, amount: '16434386434471735011', decimals: 18, logIndex: 305 },
    // idx 5 — log 308: WETH CoW Settlement → solver
    { from: COW_SETTLEMENT, to: SOLVER, tokenAddress: WETH, tokenName: 'Wrapped Ether', tokenSymbol: 'WETH', tokenLogo: null, amount: '16434386434471735011', decimals: 18, logIndex: 308 },
    // idx 6 — log 310: varDebtWETH debtor → 0x0 (burn)
    { from: DEBTOR, to: ZERO_ADDRESS, tokenAddress: VAR_DEBT_WETH, tokenName: 'Variable Debt WETH', tokenSymbol: 'varDebtWETH', tokenLogo: null, amount: '16424290351671088961', decimals: 18, logIndex: 310 },
    // idx 7 — log 313: WETH solver → aEthWETH (repay underlying)
    { from: SOLVER, to: A_ETH_WETH, tokenAddress: WETH, tokenName: 'Wrapped Ether', tokenSymbol: 'WETH', tokenLogo: null, amount: '16429459066714065591', decimals: 18, logIndex: 313 },
    // idx 8 — log 316: varDebtUSDT 0x0 → debtor (mint)
    { from: ZERO_ADDRESS, to: DEBTOR, tokenAddress: VAR_DEBT_USDT, tokenName: 'Variable Debt USDT', tokenSymbol: 'varDebtUSDT', tokenLogo: null, amount: '33432229162', decimals: 6, logIndex: 316 },
    // idx 9 — log 319: USDT aEthUSDT → solver (borrow underlying)
    { from: A_ETH_USDT, to: SOLVER, tokenAddress: USDT, tokenName: 'Tether USD', tokenSymbol: 'USDT', tokenLogo: null, amount: '33432229161', decimals: 6, logIndex: 319 },
    // idx 10 — log 321: USDT solver → solver (self-transfer)
    { from: SOLVER, to: SOLVER, tokenAddress: USDT, tokenName: 'Tether USD', tokenSymbol: 'USDT', tokenLogo: null, amount: '33432229161', decimals: 6, logIndex: 321 },
    // idx 11 — log 323: USDT solver → DECC
    { from: SOLVER, to: DECC_ADDR, tokenAddress: USDT, tokenName: 'Tether USD', tokenSymbol: 'USDT', tokenLogo: null, amount: '33448945276', decimals: 6, logIndex: 323 },
    // idx 12 — log 325: USDT solver → debtor (dust)
    { from: SOLVER, to: DEBTOR, tokenAddress: USDT, tokenName: 'Tether USD', tokenSymbol: 'USDT', tokenLogo: null, amount: '404914929', decimals: 6, logIndex: 325 },
    // idx 13 — log 326: WETH solver → debtor (dust)
    { from: SOLVER, to: DEBTOR, tokenAddress: WETH, tokenName: 'Wrapped Ether', tokenSymbol: 'WETH', tokenLogo: null, amount: '4927367757669420', decimals: 18, logIndex: 326 },
    // idx 14 — log 330: USDT DECC → aEthUSDT
    { from: DECC_ADDR, to: A_ETH_USDT, tokenAddress: USDT, tokenName: 'Tether USD', tokenSymbol: 'USDT', tokenLogo: null, amount: '33448945276', decimals: 6, logIndex: 330 },
  ];

  it('detects 1 Repay of WETH with solver as repayer and debtor as onBehalfOf', () => {
    const results = detectAaveRepays(allLogs, transfers);

    expect(results).toHaveLength(1);
    const repay = results[0].operation;
    expect(repay.type).toBe('aave-repay');
    expect(repay.logIndex).toBe(314);
    expect(repay.asset).toBe(WETH);
    expect(repay.assetSymbol).toBe('WETH');
    expect(repay.repayer).toBe(SOLVER);
    expect(repay.onBehalfOf).toBe(DEBTOR);
    // underlying = idx 7 (log 313, solver → aEthWETH), debt burn = idx 6 (log 310)
    expect(results[0].transferIndicesToRemove).toEqual(expect.arrayContaining([6, 7]));
    expect(results[0].transferIndicesToRemove).toHaveLength(2);
  });

  it('detects 1 Borrow of USDT with correct underlying (idx 9, not dust idx 12)', () => {
    const results = detectAaveBorrows(allLogs, transfers);

    expect(results).toHaveLength(1);
    const borrow = results[0].operation;
    expect(borrow.type).toBe('aave-borrow');
    expect(borrow.logIndex).toBe(320);
    expect(borrow.asset).toBe(USDT);
    expect(borrow.assetSymbol).toBe('USDT');
    expect(borrow.borrower).toBe(DEBTOR);
    // underlying = idx 9 (log 319, aEthUSDT → solver), debt mint = idx 8 (log 316)
    expect(results[0].transferIndicesToRemove).toEqual(expect.arrayContaining([8, 9]));
    expect(results[0].transferIndicesToRemove).toHaveLength(2);
  });

  it('detects no supplies or withdrawals', () => {
    expect(detectAaveSupplies(allLogs, transfers)).toHaveLength(0);
    expect(detectAaveWithdraws(allLogs, transfers)).toHaveLength(0);
  });

  it('all parsers with shared claimedIndices remove exactly 4 transfers, 11 remain', () => {
    const claimed = new Set<number>();

    const supplies = detectAaveSupplies(allLogs, transfers, claimed);
    const borrows = detectAaveBorrows(allLogs, transfers, claimed);
    const repays = detectAaveRepays(allLogs, transfers, claimed);
    const withdraws = detectAaveWithdraws(allLogs, transfers, claimed);

    const allRemoved = new Set<number>();
    for (const r of [...supplies, ...borrows, ...repays, ...withdraws]) {
      for (const idx of r.transferIndicesToRemove) allRemoved.add(idx);
    }

    // 2 operations × 2 transfers each = 4 transfers removed
    expect(allRemoved.size).toBe(4);

    const remaining = transfers.filter((_, i) => !allRemoved.has(i));
    expect(remaining).toHaveLength(11);
  });
});
