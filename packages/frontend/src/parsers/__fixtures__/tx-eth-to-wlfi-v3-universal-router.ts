/**
 * Fixture: ETH → WLFI swap via Universal Router + V3 pool
 * TX: 0x19206f7e06007c2eb040c625dbdfec2496b7ef0509495f86aa37b9b4c5b47f64
 *
 * User sends 0.01308 ETH → Universal Router wraps to WETH → V3 pool swaps WETH for WLFI → WLFI sent to user.
 * Pool: 0xcdf9f50519eb0a9995730ddb6e7d3a8b1d8ffa07 (WETH/WLFI)
 */
import type { MoralisTransactionLog, MoralisInternalTransaction } from '../../types/moralis';

export const TX_HASH = '0x19206f7e06007c2eb040c625dbdfec2496b7ef0509495f86aa37b9b4c5b47f64';
export const FROM_ADDRESS = '0xfcdef738b315054aae18bb2d7761e07557205aed';
export const TO_ADDRESS = '0x66a9893cc07d91d95644aedd05d03f95e1dba8af'; // Universal Router
export const VALUE = '13080000000000000'; // 0.01308 ETH

export const WLFI_ADDRESS = '0xda5e1988097297dcdc1f90d4dfe7909e847cbef6';
export const WLFI_AMOUNT = '253216523237809772637';

export const logs: MoralisTransactionLog[] = [
  {
    address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    block_number: '24433128',
    block_hash: '0x7bfd529019ee39b3bb917cc86fb463862c431dbc405334f48c4fa70a6baaff39',
    block_timestamp: '2026-02-11T11:07:35.000Z',
    data: '0x000000000000000000000000000000000000000000000000002e7830d1a98000',
    log_index: '1015',
    transaction_hash: TX_HASH,
    transaction_index: '75',
    transaction_value: '13080000000000000',
    topic0: '0xe1fffcc4923d04b559f4d29a8bfc6cda04eb5b0d3c460751c2402c5c5cc9109c',
    topic1: '0x00000000000000000000000066a9893cc07d91d95644aedd05d03f95e1dba8af',
    topic2: null,
    topic3: null,
    decoded_event: {
      label: 'Deposit',
      signature: 'Deposit(address,uint256)',
      type: 'event',
      params: [
        { name: 'dst', type: 'address', value: '0x66a9893cC07D91D95644AEDD05D03f95e1dBA8Af' },
        { name: 'wad', type: 'uint256', value: '13080000000000000' },
      ],
    },
  },
  {
    address: '0xda5e1988097297dcdc1f90d4dfe7909e847cbef6',
    block_number: '24433128',
    block_hash: '0x7bfd529019ee39b3bb917cc86fb463862c431dbc405334f48c4fa70a6baaff39',
    block_timestamp: '2026-02-11T11:07:35.000Z',
    data: '0x00000000000000000000000000000000000000000000000dba15ce494118d85d',
    log_index: '1016',
    transaction_hash: TX_HASH,
    transaction_index: '75',
    transaction_value: '13080000000000000',
    topic0: '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
    topic1: '0x000000000000000000000000cdf9f50519eb0a9995730ddb6e7d3a8b1d8ffa07',
    topic2: '0x000000000000000000000000fcdef738b315054aae18bb2d7761e07557205aed',
    topic3: null,
    decoded_event: {
      label: 'Transfer',
      signature: 'Transfer(address,address,uint256)',
      type: 'event',
      params: [
        { name: 'from', type: 'address', value: '0xcdF9F50519Eb0a9995730DDB6e7d3A8B1D8fFA07' },
        { name: 'to', type: 'address', value: '0xFcDEF738B315054Aae18BB2d7761E07557205aeD' },
        { name: 'amount', type: 'uint256', value: '253216523237809772637' },
      ],
    },
  },
  {
    address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    block_number: '24433128',
    block_hash: '0x7bfd529019ee39b3bb917cc86fb463862c431dbc405334f48c4fa70a6baaff39',
    block_timestamp: '2026-02-11T11:07:35.000Z',
    data: '0x000000000000000000000000000000000000000000000000002e7830d1a98000',
    log_index: '1017',
    transaction_hash: TX_HASH,
    transaction_index: '75',
    transaction_value: '13080000000000000',
    topic0: '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
    topic1: '0x00000000000000000000000066a9893cc07d91d95644aedd05d03f95e1dba8af',
    topic2: '0x000000000000000000000000cdf9f50519eb0a9995730ddb6e7d3a8b1d8ffa07',
    topic3: null,
    decoded_event: {
      label: 'Transfer',
      signature: 'Transfer(address,address,uint256)',
      type: 'event',
      params: [
        { name: 'src', type: 'address', value: '0x66a9893cC07D91D95644AEDD05D03f95e1dBA8Af' },
        { name: 'dst', type: 'address', value: '0xcdF9F50519Eb0a9995730DDB6e7d3A8B1D8fFA07' },
        { name: 'wad', type: 'uint256', value: '13080000000000000' },
      ],
    },
  },
  {
    address: '0xcdf9f50519eb0a9995730ddb6e7d3a8b1d8ffa07',
    block_number: '24433128',
    block_hash: '0x7bfd529019ee39b3bb917cc86fb463862c431dbc405334f48c4fa70a6baaff39',
    block_timestamp: '2026-02-11T11:07:35.000Z',
    data: '0x000000000000000000000000000000000000000000000000002e7830d1a98000fffffffffffffffffffffffffffffffffffffffffffffff245ea31b6bee727a3000000000000000000000000000000000000008b571c9561d1fe8f790c423c660000000000000000000000000000000000000000000004aba1e4db7f44e6006c00000000000000000000000000000000000000000000000000000000000181b7',
    log_index: '1018',
    transaction_hash: TX_HASH,
    transaction_index: '75',
    transaction_value: '13080000000000000',
    topic0: '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67',
    topic1: '0x00000000000000000000000066a9893cc07d91d95644aedd05d03f95e1dba8af',
    topic2: '0x000000000000000000000000fcdef738b315054aae18bb2d7761e07557205aed',
    topic3: null,
    decoded_event: {
      label: 'Swap',
      signature: 'Swap(address,address,int256,int256,uint160,uint128,int24)',
      type: 'event',
      params: [
        { name: 'sender', type: 'address', value: '0x66a9893cC07D91D95644AEDD05D03f95e1dBA8Af' },
        { name: 'recipient', type: 'address', value: '0xFcDEF738B315054Aae18BB2d7761E07557205aeD' },
        { name: 'amount0', type: 'int256', value: '13080000000000000' },
        { name: 'amount1', type: 'int256', value: '-253216523237809772637' },
        { name: 'sqrtPriceX96', type: 'uint160', value: '11039674340697220968373591096422' },
        { name: 'liquidity', type: 'uint128', value: '22055524858357373861996' },
        { name: 'tick', type: 'int24', value: '98743' },
      ],
    },
  },
];

export const internal_transactions: MoralisInternalTransaction[] = [
  {
    transaction_hash: TX_HASH,
    block_number: 24433128,
    block_hash: '0x7bfd529019ee39b3bb917cc86fb463862c431dbc405334f48c4fa70a6baaff39',
    type: 'CALL',
    from: '0x66a9893cc07d91d95644aedd05d03f95e1dba8af',
    to: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    value: '13080000000000000',
    gas: '173989',
    gas_used: '23974',
    input: '0xd0e30db0',
    output: '0x',
    error: null,
  },
];
