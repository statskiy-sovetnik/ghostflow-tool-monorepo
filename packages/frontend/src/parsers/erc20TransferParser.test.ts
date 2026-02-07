import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseERC20Transfers, ERC20_TRANSFER_SIGNATURE, ERC20_TRANSFER_TOPIC0 } from './erc20TransferParser';
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
      logIndex: 115,
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

  it('skips logs with null decoded_event when raw log is not a Transfer', () => {
    const logs: MoralisTransactionLog[] = [
      createLog({
        decoded_event: null,
        topic0: '0xOtherEventSignature',
        topic1: null,
        topic2: null,
      }),
    ];

    const result = parseERC20Transfers(logs);

    expect(result).toHaveLength(0);
  });

  it('falls back to raw log when decoded_event params are missing "from"', () => {
    const logs: MoralisTransactionLog[] = [
      createLog({
        address: '0xTokenAddress',
        decoded_event: {
          label: 'Transfer',
          signature: ERC20_TRANSFER_SIGNATURE,
          type: 'event',
          params: [
            { name: 'to', type: 'address', value: '0xTo' },
            { name: 'value', type: 'uint256', value: '1000' },
          ],
        },
        topic0: ERC20_TRANSFER_TOPIC0,
        topic1: '0x0000000000000000000000001111111111111111111111111111111111111111',
        topic2: '0x0000000000000000000000002222222222222222222222222222222222222222',
        data: '0x0000000000000000000000000000000000000000000000000000000000001000',
      }),
    ];

    const result = parseERC20Transfers(logs);

    expect(result).toHaveLength(1);
    expect(result[0].from).toBe('0x1111111111111111111111111111111111111111');
    expect(result[0].to).toBe('0x2222222222222222222222222222222222222222');
    expect(result[0].value).toBe('4096');
  });

  it('falls back to raw log when decoded_event params are missing "to"', () => {
    const logs: MoralisTransactionLog[] = [
      createLog({
        address: '0xTokenAddress',
        decoded_event: {
          label: 'Transfer',
          signature: ERC20_TRANSFER_SIGNATURE,
          type: 'event',
          params: [
            { name: 'from', type: 'address', value: '0xFrom' },
            { name: 'value', type: 'uint256', value: '1000' },
          ],
        },
        topic0: ERC20_TRANSFER_TOPIC0,
        topic1: '0x000000000000000000000000aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        topic2: '0x000000000000000000000000bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        data: '0x0000000000000000000000000000000000000000000000000000000000000800',
      }),
    ];

    const result = parseERC20Transfers(logs);

    expect(result).toHaveLength(1);
    expect(result[0].from).toBe('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    expect(result[0].to).toBe('0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
    expect(result[0].value).toBe('2048');
  });

  it('falls back to raw log when decoded_event params are missing "value" and "amount"', () => {
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
          ],
        },
        topic0: ERC20_TRANSFER_TOPIC0,
        topic1: '0x000000000000000000000000cccccccccccccccccccccccccccccccccccccccc',
        topic2: '0x000000000000000000000000dddddddddddddddddddddddddddddddddddddddd',
        data: '0x0000000000000000000000000000000000000000000000000000000000000400',
      }),
    ];

    const result = parseERC20Transfers(logs);

    expect(result).toHaveLength(1);
    expect(result[0].from).toBe('0xcccccccccccccccccccccccccccccccccccccccc');
    expect(result[0].to).toBe('0xdddddddddddddddddddddddddddddddddddddddd');
    expect(result[0].value).toBe('1024');
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
      createLog({ decoded_event: null }), // Skip - null decoded_event, not a Transfer topic
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

  describe('raw log fallback parsing', () => {
    it('parses Transfer from raw log when decoded_event is null', () => {
      const logs: MoralisTransactionLog[] = [
        createLog({
          address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
          decoded_event: null,
          topic0: ERC20_TRANSFER_TOPIC0,
          topic1: '0x000000000000000000000000def1c0ded9bec7f1a1670819833240f027b25eff',
          topic2: '0x00000000000000000000000068b3465833fb72a70ecdf485e0e4c7bd8665fc45',
          data: '0x0000000000000000000000000000000000000000000000000de0b6b3a7640000', // 1 ETH in wei
        }),
      ];

      const result = parseERC20Transfers(logs);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        from: '0xdef1c0ded9bec7f1a1670819833240f027b25eff',
        to: '0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45',
        value: '1000000000000000000',
        tokenAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        logIndex: 115,
      });
    });

    it('prefers decoded_event over raw log parsing', () => {
      const logs: MoralisTransactionLog[] = [
        createLog({
          address: '0xTokenAddress',
          decoded_event: {
            label: 'Transfer',
            signature: ERC20_TRANSFER_SIGNATURE,
            type: 'event',
            params: [
              { name: 'from', type: 'address', value: '0xDecodedFrom' },
              { name: 'to', type: 'address', value: '0xDecodedTo' },
              { name: 'value', type: 'uint256', value: '9999' },
            ],
          },
          topic0: ERC20_TRANSFER_TOPIC0,
          topic1: '0x0000000000000000000000001111111111111111111111111111111111111111',
          topic2: '0x0000000000000000000000002222222222222222222222222222222222222222',
          data: '0x0000000000000000000000000000000000000000000000000000000000001111',
        }),
      ];

      const result = parseERC20Transfers(logs);

      expect(result).toHaveLength(1);
      expect(result[0].from).toBe('0xDecodedFrom');
      expect(result[0].to).toBe('0xDecodedTo');
      expect(result[0].value).toBe('9999');
    });

    it('skips raw log when topic0 does not match Transfer signature', () => {
      const logs: MoralisTransactionLog[] = [
        createLog({
          decoded_event: null,
          topic0: '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925', // Approval
          topic1: '0x0000000000000000000000001111111111111111111111111111111111111111',
          topic2: '0x0000000000000000000000002222222222222222222222222222222222222222',
          data: '0x0000000000000000000000000000000000000000000000000000000000001000',
        }),
      ];

      const result = parseERC20Transfers(logs);

      expect(result).toHaveLength(0);
    });

    it('skips raw log when topic1 is missing and logs warning', () => {
      const logs: MoralisTransactionLog[] = [
        createLog({
          decoded_event: null,
          topic0: ERC20_TRANSFER_TOPIC0,
          topic1: null,
          topic2: '0x0000000000000000000000002222222222222222222222222222222222222222',
          data: '0x0000000000000000000000000000000000000000000000000000000000001000',
        }),
      ];

      const result = parseERC20Transfers(logs);

      expect(result).toHaveLength(0);
      expect(console.warn).toHaveBeenCalledWith(
        'Raw Transfer log missing required fields:',
        expect.objectContaining({ address: expect.any(String) })
      );
    });

    it('skips raw log when topic2 is missing and logs warning', () => {
      const logs: MoralisTransactionLog[] = [
        createLog({
          decoded_event: null,
          topic0: ERC20_TRANSFER_TOPIC0,
          topic1: '0x0000000000000000000000001111111111111111111111111111111111111111',
          topic2: null,
          data: '0x0000000000000000000000000000000000000000000000000000000000001000',
        }),
      ];

      const result = parseERC20Transfers(logs);

      expect(result).toHaveLength(0);
      expect(console.warn).toHaveBeenCalled();
    });

    it('skips raw log when data is missing and logs warning', () => {
      const logs: MoralisTransactionLog[] = [
        createLog({
          decoded_event: null,
          topic0: ERC20_TRANSFER_TOPIC0,
          topic1: '0x0000000000000000000000001111111111111111111111111111111111111111',
          topic2: '0x0000000000000000000000002222222222222222222222222222222222222222',
          data: '',
        }),
      ];

      const result = parseERC20Transfers(logs);

      expect(result).toHaveLength(0);
      expect(console.warn).toHaveBeenCalled();
    });

    it('handles large transfer values (max uint256)', () => {
      const maxUint256 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
      const logs: MoralisTransactionLog[] = [
        createLog({
          decoded_event: null,
          topic0: ERC20_TRANSFER_TOPIC0,
          topic1: '0x0000000000000000000000001111111111111111111111111111111111111111',
          topic2: '0x0000000000000000000000002222222222222222222222222222222222222222',
          data: maxUint256,
        }),
      ];

      const result = parseERC20Transfers(logs);

      expect(result).toHaveLength(1);
      expect(result[0].value).toBe('115792089237316195423570985008687907853269984665640564039457584007913129639935');
    });

    it('parses mixed decoded and raw logs correctly', () => {
      const logs: MoralisTransactionLog[] = [
        // Decoded Transfer
        createLog({
          address: '0xDecodedToken',
          decoded_event: {
            label: 'Transfer',
            signature: ERC20_TRANSFER_SIGNATURE,
            type: 'event',
            params: [
              { name: 'from', type: 'address', value: '0xDecodedFrom' },
              { name: 'to', type: 'address', value: '0xDecodedTo' },
              { name: 'value', type: 'uint256', value: '1000' },
            ],
          },
        }),
        // Raw Transfer (WETH-style)
        createLog({
          address: '0xRawToken',
          decoded_event: null,
          topic0: ERC20_TRANSFER_TOPIC0,
          topic1: '0x000000000000000000000000aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          topic2: '0x000000000000000000000000bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          data: '0x0000000000000000000000000000000000000000000000000000000000002000',
        }),
        // Non-Transfer event
        createLog({
          decoded_event: {
            label: 'Approval',
            signature: 'Approval(address,address,uint256)',
            type: 'event',
            params: [],
          },
        }),
      ];

      const result = parseERC20Transfers(logs);

      expect(result).toHaveLength(2);
      expect(result[0].tokenAddress).toBe('0xDecodedToken');
      expect(result[0].from).toBe('0xDecodedFrom');
      expect(result[1].tokenAddress).toBe('0xRawToken');
      expect(result[1].from).toBe('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
      expect(result[1].to).toBe('0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
      expect(result[1].value).toBe('8192');
    });

    it('handles zero value transfers', () => {
      const logs: MoralisTransactionLog[] = [
        createLog({
          decoded_event: null,
          topic0: ERC20_TRANSFER_TOPIC0,
          topic1: '0x0000000000000000000000001111111111111111111111111111111111111111',
          topic2: '0x0000000000000000000000002222222222222222222222222222222222222222',
          data: '0x0000000000000000000000000000000000000000000000000000000000000000',
        }),
      ];

      const result = parseERC20Transfers(logs);

      expect(result).toHaveLength(1);
      expect(result[0].value).toBe('0');
    });

    it('falls back to raw log when decoded_event has empty params array (WETH-like)', () => {
      const logs: MoralisTransactionLog[] = [
        createLog({
          address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
          decoded_event: {
            label: 'Transfer',
            signature: ERC20_TRANSFER_SIGNATURE,
            type: 'event',
            params: [], // Empty params - Moralis returns this for some tokens
          },
          topic0: ERC20_TRANSFER_TOPIC0,
          topic1: '0x000000000000000000000000def1c0ded9bec7f1a1670819833240f027b25eff',
          topic2: '0x00000000000000000000000068b3465833fb72a70ecdf485e0e4c7bd8665fc45',
          data: '0x0000000000000000000000000000000000000000000000000de0b6b3a7640000', // 1 ETH in wei
        }),
      ];

      const result = parseERC20Transfers(logs);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        from: '0xdef1c0ded9bec7f1a1670819833240f027b25eff',
        to: '0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45',
        value: '1000000000000000000',
        tokenAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        logIndex: 115,
      });
    });

    it('skips when decoded_event params missing AND raw log data unavailable', () => {
      const logs: MoralisTransactionLog[] = [
        createLog({
          address: '0xTokenAddress',
          decoded_event: {
            label: 'Transfer',
            signature: ERC20_TRANSFER_SIGNATURE,
            type: 'event',
            params: [], // Empty params
          },
          topic0: ERC20_TRANSFER_TOPIC0,
          topic1: null, // Raw log also missing data
          topic2: null,
          data: '',
        }),
      ];

      const result = parseERC20Transfers(logs);

      expect(result).toHaveLength(0);
      expect(console.warn).toHaveBeenCalledWith(
        'Raw Transfer log missing required fields:',
        expect.objectContaining({ address: '0xTokenAddress' })
      );
    });
  });
});
