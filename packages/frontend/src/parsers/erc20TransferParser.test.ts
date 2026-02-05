import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseERC20Transfers, ERC20_TRANSFER_SIGNATURE } from './erc20TransferParser';
import type { MoralisTransactionLog } from '../types/moralis';

function createLog(overrides: Partial<MoralisTransactionLog> = {}): MoralisTransactionLog {
  return {
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    block_number: '24381633',
    block_hash: '0xa50171d4c6bd8efb2616a6951ee70f607e74995914016ad888fc5fc8efd09835',
    block_timestamp: '2026-02-04T06:16:11.000Z',
    data: '0x',
    log_index: '115',
    transaction_hash: '0x50539d4fa5bbe6aab765429b943ef35d8c21887e674e3eb3bc73d938174e6b2d',
    transaction_index: '55',
    transaction_value: '0',
    topic0: '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
    topic1: null,
    topic2: null,
    topic3: null,
    decoded_event: null,
    ...overrides,
  };
}

describe('parseERC20Transfers', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('parses valid Transfer events', () => {
    const logs: MoralisTransactionLog[] = [
      createLog({
        address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        decoded_event: {
          label: 'Transfer',
          signature: ERC20_TRANSFER_SIGNATURE,
          type: 'event',
          params: [
            { name: 'from', type: 'address', value: '0xSender1' },
            { name: 'to', type: 'address', value: '0xReceiver1' },
            { name: 'value', type: 'uint256', value: '1000000' },
          ],
        },
      }),
    ];

    const result = parseERC20Transfers(logs);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      from: '0xSender1',
      to: '0xReceiver1',
      value: '1000000',
      tokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    });
  });

  it('parses Transfer events with "amount" param instead of "value"', () => {
    const logs: MoralisTransactionLog[] = [
      createLog({
        address: '0xTokenAddress',
        decoded_event: {
          label: 'Transfer',
          signature: ERC20_TRANSFER_SIGNATURE,
          type: 'event',
          params: [
            { name: 'from', type: 'address', value: '0xFrom' },
            { name: 'to', type: 'address', value: '0xTo' },
            { name: 'amount', type: 'uint256', value: '5000' },
          ],
        },
      }),
    ];

    const result = parseERC20Transfers(logs);

    expect(result).toHaveLength(1);
    expect(result[0].value).toBe('5000');
  });

  it('filters out Approval events', () => {
    const logs: MoralisTransactionLog[] = [
      createLog({
        decoded_event: {
          label: 'Approval',
          signature: 'Approval(address,address,uint256)',
          type: 'event',
          params: [
            { name: 'owner', type: 'address', value: '0xOwner' },
            { name: 'spender', type: 'address', value: '0xSpender' },
            { name: 'amount', type: 'uint256', value: '1000' },
          ],
        },
      }),
    ];

    const result = parseERC20Transfers(logs);

    expect(result).toHaveLength(0);
  });

  it('filters out non-ERC20 Transfer events (different signature)', () => {
    const logs: MoralisTransactionLog[] = [
      createLog({
        decoded_event: {
          label: 'Transfer',
          signature: 'Transfer(address,address,uint256,bytes)', // Different signature
          type: 'event',
          params: [
            { name: 'from', type: 'address', value: '0xFrom' },
            { name: 'to', type: 'address', value: '0xTo' },
            { name: 'value', type: 'uint256', value: '1000' },
            { name: 'data', type: 'bytes', value: '0x' },
          ],
        },
      }),
    ];

    const result = parseERC20Transfers(logs);

    expect(result).toHaveLength(0);
  });

  it('handles logs with null decoded_event', () => {
    const logs: MoralisTransactionLog[] = [
      createLog({ decoded_event: null }),
    ];

    const result = parseERC20Transfers(logs);

    expect(result).toHaveLength(0);
  });

  it('skips Transfer events with missing "from" param and logs warning', () => {
    const logs: MoralisTransactionLog[] = [
      createLog({
        decoded_event: {
          label: 'Transfer',
          signature: ERC20_TRANSFER_SIGNATURE,
          type: 'event',
          params: [
            { name: 'to', type: 'address', value: '0xTo' },
            { name: 'value', type: 'uint256', value: '1000' },
          ],
        },
      }),
    ];

    const result = parseERC20Transfers(logs);

    expect(result).toHaveLength(0);
    expect(console.warn).toHaveBeenCalled();
  });

  it('skips Transfer events with missing "to" param and logs warning', () => {
    const logs: MoralisTransactionLog[] = [
      createLog({
        decoded_event: {
          label: 'Transfer',
          signature: ERC20_TRANSFER_SIGNATURE,
          type: 'event',
          params: [
            { name: 'from', type: 'address', value: '0xFrom' },
            { name: 'value', type: 'uint256', value: '1000' },
          ],
        },
      }),
    ];

    const result = parseERC20Transfers(logs);

    expect(result).toHaveLength(0);
    expect(console.warn).toHaveBeenCalled();
  });

  it('skips Transfer events with missing "value" and "amount" params', () => {
    const logs: MoralisTransactionLog[] = [
      createLog({
        decoded_event: {
          label: 'Transfer',
          signature: ERC20_TRANSFER_SIGNATURE,
          type: 'event',
          params: [
            { name: 'from', type: 'address', value: '0xFrom' },
            { name: 'to', type: 'address', value: '0xTo' },
          ],
        },
      }),
    ];

    const result = parseERC20Transfers(logs);

    expect(result).toHaveLength(0);
    expect(console.warn).toHaveBeenCalled();
  });

  it('parses multiple Transfer events from different tokens', () => {
    const logs: MoralisTransactionLog[] = [
      createLog({
        address: '0xTokenA',
        decoded_event: {
          label: 'Transfer',
          signature: ERC20_TRANSFER_SIGNATURE,
          type: 'event',
          params: [
            { name: 'from', type: 'address', value: '0xFrom1' },
            { name: 'to', type: 'address', value: '0xTo1' },
            { name: 'value', type: 'uint256', value: '100' },
          ],
        },
      }),
      createLog({
        address: '0xTokenB',
        decoded_event: {
          label: 'Transfer',
          signature: ERC20_TRANSFER_SIGNATURE,
          type: 'event',
          params: [
            { name: 'from', type: 'address', value: '0xFrom2' },
            { name: 'to', type: 'address', value: '0xTo2' },
            { name: 'value', type: 'uint256', value: '200' },
          ],
        },
      }),
    ];

    const result = parseERC20Transfers(logs);

    expect(result).toHaveLength(2);
    expect(result[0].tokenAddress).toBe('0xTokenA');
    expect(result[1].tokenAddress).toBe('0xTokenB');
  });

  it('handles empty logs array', () => {
    const result = parseERC20Transfers([]);

    expect(result).toHaveLength(0);
  });

  it('handles mixed valid and invalid logs', () => {
    const logs: MoralisTransactionLog[] = [
      createLog({ decoded_event: null }), // Skip - null decoded_event
      createLog({
        address: '0xValidToken',
        decoded_event: {
          label: 'Transfer',
          signature: ERC20_TRANSFER_SIGNATURE,
          type: 'event',
          params: [
            { name: 'from', type: 'address', value: '0xFrom' },
            { name: 'to', type: 'address', value: '0xTo' },
            { name: 'value', type: 'uint256', value: '1000' },
          ],
        },
      }),
      createLog({
        decoded_event: {
          label: 'Approval',
          signature: 'Approval(address,address,uint256)',
          type: 'event',
          params: [],
        },
      }), // Skip - not Transfer
    ];

    const result = parseERC20Transfers(logs);

    expect(result).toHaveLength(1);
    expect(result[0].tokenAddress).toBe('0xValidToken');
  });
});
