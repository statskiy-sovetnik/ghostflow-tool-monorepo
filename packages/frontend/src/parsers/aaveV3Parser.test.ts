import { describe, it, expect } from 'vitest';
import { detectAaveSupplies, AAVE_V3_POOL_ADDRESS, AAVE_V3_SUPPLY_TOPIC0 } from './aaveV3Parser';
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

function createSupplyLog(overrides: Partial<MoralisTransactionLog> = {}): MoralisTransactionLog {
  // data: amount (word 0) + referralCode (word 1)
  const amount = encodeUint256(1000000n);
  const referral = encodeUint256(0n);
  return {
    address: AAVE_V3_POOL_ADDRESS,
    topic0: AAVE_V3_SUPPLY_TOPIC0,
    topic1: padAddress(ASSET_ADDRESS),
    topic2: padAddress(USER_ADDRESS),
    topic3: padAddress(USER_ADDRESS),
    data: '0x' + amount + referral,
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
    const logs = [createSupplyLog()]; // topic2 === topic3 === USER_ADDRESS
    const transfers = [createTransfer(), createMintTransfer()];

    const results = detectAaveSupplies(logs, transfers);
    expect(results[0].operation.onBehalfOf).toBeNull();
  });

  it('populates onBehalfOf when different from user', () => {
    const logs = [createSupplyLog({ topic3: padAddress(OTHER_ADDRESS) })];
    const transfers = [createTransfer(), createMintTransfer({ to: OTHER_ADDRESS })];

    const results = detectAaveSupplies(logs, transfers);
    expect(results[0].operation.onBehalfOf).toBe(OTHER_ADDRESS);
  });

  it('returns operation with event data when no matching underlying transfer found', () => {
    const logs = [createSupplyLog()];
    // No transfers match the reserve/user
    const transfers = [createTransfer({ tokenAddress: '0x9999999999999999999999999999999999999999' })];

    const results = detectAaveSupplies(logs, transfers);
    expect(results).toHaveLength(1);
    expect(results[0].operation.assetName).toBe('Unknown');
    expect(results[0].operation.assetSymbol).toBe('???');
    expect(results[0].operation.amount).toBe('1000000');
    expect(results[0].operation.decimals).toBe(18);
    // No underlying index removed, but mint still not found either
    expect(results[0].transferIndicesToRemove).toEqual([]);
  });

  it('removes only underlying index when no aToken mint found', () => {
    const logs = [createSupplyLog()];
    // Underlying transfer matches, but no mint (from ZERO_ADDRESS)
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

  it('skips malformed logs with missing topics', () => {
    const logs = [
      createSupplyLog({ topic1: null }),
      createSupplyLog({ topic2: null }),
      createSupplyLog({ topic3: null }),
    ];
    const results = detectAaveSupplies(logs, []);
    expect(results).toEqual([]);
  });
});
