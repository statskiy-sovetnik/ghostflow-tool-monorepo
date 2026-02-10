import { describe, it, expect } from 'vitest';
import { parseNativeTransfers } from './nativeTransferParser';
import type { MoralisInternalTransaction } from '../types/moralis';

function makeInternalTx(overrides: Partial<MoralisInternalTransaction> = {}): MoralisInternalTransaction {
  return {
    transaction_hash: '0xabc',
    block_number: 1,
    block_hash: '0xdef',
    type: 'CALL',
    from: '0x1111111111111111111111111111111111111111',
    to: '0x2222222222222222222222222222222222222222',
    value: '0',
    gas: '21000',
    gas_used: '21000',
    input: '0x',
    output: '0x',
    error: null,
    ...overrides,
  };
}

describe('parseNativeTransfers', () => {
  it('includes top-level ETH when value > 0', () => {
    const result = parseNativeTransfers(
      [],
      '1000000000000000000',
      '0xaaa',
      '0xbbb',
      10,
    );
    expect(result).toEqual([
      { from: '0xaaa', to: '0xbbb', amount: '1000000000000000000', logIndex: 10 },
    ]);
  });

  it('excludes top-level ETH when value is "0"', () => {
    const result = parseNativeTransfers([], '0', '0xaaa', '0xbbb', 10);
    expect(result).toEqual([]);
  });

  it('filters out zero-value internal txs', () => {
    const internalTxs = [
      makeInternalTx({ value: '500000000000000000', from: '0xc1', to: '0xc2' }),
      makeInternalTx({ value: '0', from: '0xc3', to: '0xc4' }),
      makeInternalTx({ value: '250000000000000000', from: '0xc5', to: '0xc6' }),
    ];
    const result = parseNativeTransfers(internalTxs, '0', '0xaaa', '0xbbb', 5);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ from: '0xc1', to: '0xc2', amount: '500000000000000000', logIndex: 5 });
    expect(result[1]).toEqual({ from: '0xc5', to: '0xc6', amount: '250000000000000000', logIndex: 6 });
  });

  it('assigns sequential synthetic logIndex starting from startLogIndex', () => {
    const internalTxs = [
      makeInternalTx({ value: '100', from: '0xa', to: '0xb' }),
      makeInternalTx({ value: '200', from: '0xc', to: '0xd' }),
    ];
    const result = parseNativeTransfers(
      internalTxs,
      '50',
      '0xsender',
      '0xreceiver',
      20,
    );
    expect(result[0].logIndex).toBe(20); // top-level
    expect(result[1].logIndex).toBe(21); // first internal
    expect(result[2].logIndex).toBe(22); // second internal
  });

  it('handles empty internal transactions array with no top-level value', () => {
    const result = parseNativeTransfers([], '0', '0xaaa', '0xbbb', 0);
    expect(result).toEqual([]);
  });

  it('uses BigInt for value comparison (large decimal strings)', () => {
    const largeTx = makeInternalTx({
      value: '115792089237316195423570985008687907853269984665640564039457584007913129639935',
      from: '0xa',
      to: '0xb',
    });
    const result = parseNativeTransfers([largeTx], '0', '0x', '0x', 0);
    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe('115792089237316195423570985008687907853269984665640564039457584007913129639935');
  });
});
