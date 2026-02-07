import { describe, it, expect } from 'vitest';
import { detectAaveSupply, AAVE_V3_POOL_ADDRESS } from './aaveV3Parser';
import type { DecodedCall, TokenTransfer } from '../types/moralis';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const USER_ADDRESS = '0x1234567890abcdef1234567890abcdef12345678';
const ASSET_ADDRESS = '0xdac17f958d2ee523a2206206994597c13d831ec7';
const OTHER_ADDRESS = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

function createDecodedCall(overrides: Partial<DecodedCall> = {}): DecodedCall {
  return {
    label: 'supply',
    signature: 'supply(address,uint256,address,uint16)',
    params: [
      { name: 'asset', type: 'address', value: ASSET_ADDRESS },
      { name: 'amount', type: 'uint256', value: '1000000' },
      { name: 'onBehalfOf', type: 'address', value: USER_ADDRESS },
      { name: 'referralCode', type: 'uint16', value: '0' },
    ],
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

describe('detectAaveSupply', () => {
  it('detects a valid supply and returns correct operation and indices', () => {
    const transfers = [createTransfer(), createMintTransfer()];
    const result = detectAaveSupply(
      createDecodedCall(),
      AAVE_V3_POOL_ADDRESS,
      USER_ADDRESS,
      transfers,
    );

    expect(result).not.toBeNull();
    expect(result!.operation.type).toBe('aave-supply');
    expect(result!.operation.asset).toBe(ASSET_ADDRESS);
    expect(result!.operation.assetName).toBe('Tether USD');
    expect(result!.operation.assetSymbol).toBe('USDT');
    expect(result!.operation.assetLogo).toBe('https://logo.example.com/usdt.png');
    expect(result!.operation.amount).toBe('1000000');
    expect(result!.operation.decimals).toBe(6);
    expect(result!.operation.onBehalfOf).toBeNull();
    expect(result!.transferIndicesToRemove).toEqual(expect.arrayContaining([0, 1]));
    expect(result!.transferIndicesToRemove).toHaveLength(2);
  });

  it('returns null when decodedCall is null', () => {
    const result = detectAaveSupply(null, AAVE_V3_POOL_ADDRESS, USER_ADDRESS, []);
    expect(result).toBeNull();
  });

  it('returns null when label is not "supply"', () => {
    const call = createDecodedCall({ label: 'borrow' });
    const result = detectAaveSupply(call, AAVE_V3_POOL_ADDRESS, USER_ADDRESS, []);
    expect(result).toBeNull();
  });

  it('returns null when toAddress is not the Aave V3 Pool', () => {
    const result = detectAaveSupply(
      createDecodedCall(),
      '0x0000000000000000000000000000000000000001',
      USER_ADDRESS,
      [],
    );
    expect(result).toBeNull();
  });

  it('sets onBehalfOf to null when same as sender', () => {
    const transfers = [createTransfer(), createMintTransfer()];
    const result = detectAaveSupply(
      createDecodedCall(),
      AAVE_V3_POOL_ADDRESS,
      USER_ADDRESS,
      transfers,
    );

    expect(result!.operation.onBehalfOf).toBeNull();
  });

  it('populates onBehalfOf when different from sender', () => {
    const call = createDecodedCall({
      params: [
        { name: 'asset', type: 'address', value: ASSET_ADDRESS },
        { name: 'amount', type: 'uint256', value: '1000000' },
        { name: 'onBehalfOf', type: 'address', value: OTHER_ADDRESS },
        { name: 'referralCode', type: 'uint16', value: '0' },
      ],
    });
    const transfers = [
      createTransfer(),
      createMintTransfer({ to: OTHER_ADDRESS }),
    ];
    const result = detectAaveSupply(call, AAVE_V3_POOL_ADDRESS, USER_ADDRESS, transfers);

    expect(result!.operation.onBehalfOf).toBe(OTHER_ADDRESS);
  });

  it('sets onBehalfOf to null when it is the zero address', () => {
    const call = createDecodedCall({
      params: [
        { name: 'asset', type: 'address', value: ASSET_ADDRESS },
        { name: 'amount', type: 'uint256', value: '1000000' },
        { name: 'onBehalfOf', type: 'address', value: ZERO_ADDRESS },
        { name: 'referralCode', type: 'uint16', value: '0' },
      ],
    });
    const transfers = [createTransfer(), createMintTransfer()];
    const result = detectAaveSupply(call, AAVE_V3_POOL_ADDRESS, USER_ADDRESS, transfers);

    expect(result!.operation.onBehalfOf).toBeNull();
  });
});
