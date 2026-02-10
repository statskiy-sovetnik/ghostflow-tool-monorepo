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
