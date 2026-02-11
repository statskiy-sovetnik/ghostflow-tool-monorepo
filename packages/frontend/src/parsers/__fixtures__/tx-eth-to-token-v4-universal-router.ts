/**
 * Fixture: ETH → token swap via Universal Router + V4 PoolManager
 * TX: 0xca432a8ee84eebddb62a07a240b96b59aa7c340ecafa8b756f8b68a66a76fd40
 *
 * User sends 0.1178 ETH → Universal Router settles ETH to PoolManager (internal tx)
 * → PoolManager transfers output token to user.
 * No WETH wrap — pure native ETH input. Only 1 ERC-20 transfer (PoolManager → user).
 */
import type { MoralisTransactionLog, MoralisInternalTransaction } from '../../types/moralis';

export const TX_HASH = '0xca432a8ee84eebddb62a07a240b96b59aa7c340ecafa8b756f8b68a66a76fd40';
export const FROM_ADDRESS = '0x95707380bad470b4df398aa5ce1d7675667be717';
export const TO_ADDRESS = '0x66a9893cc07d91d95644aedd05d03f95e1dba8af'; // Universal Router
export const VALUE = '117801040032221917'; // ~0.1178 ETH

export const OUTPUT_TOKEN_ADDRESS = '0xf9902edfca4f49dcaebc335c73aebd82c79c2886';
export const OUTPUT_AMOUNT = '9050899907136051844468';

export const logs: MoralisTransactionLog[] = [
  {
    address: '0x000000000004444c5dc75cb358380d2e3de08a90',
    block_number: '24433211',
    block_hash: '0x4b7c9209f5dbfdf905b79b58be8f4a57a95a368844d7a303726892cf6e03c597',
    block_timestamp: '2026-02-11T11:24:23.000Z',
    data: '0xfffffffffffffffffffffffffffffffffffffffffffffffffe5d7c9406b535230000000000000000000000000000000000000000000001eaa677e7d13c5d9574000000000000000000000000000000000000011694d96221514737018df2026900000000000000000000000000000000000000000003ca84eec2f2255f5229a2000000000000000000000000000000000000000000000000000000000001b7d70000000000000000000000000000000000000000000000000000000000002710',
    log_index: '265',
    transaction_hash: TX_HASH,
    transaction_index: '101',
    transaction_value: '117801040032221917',
    topic0: '0x40e9cecb9f5f1f1c5b9c97dec2917b7ee92e57ba5563708daca94dd84ad7112f',
    topic1: '0x4e0c1e2bd52cd0b9c357512a368aaab39f40bcecaea045639f0ab55868b2045c',
    topic2: '0x00000000000000000000000066a9893cc07d91d95644aedd05d03f95e1dba8af',
    topic3: null,
    decoded_event: null,
  },
  {
    address: '0xf9902edfca4f49dcaebc335c73aebd82c79c2886',
    block_number: '24433211',
    block_hash: '0x4b7c9209f5dbfdf905b79b58be8f4a57a95a368844d7a303726892cf6e03c597',
    block_timestamp: '2026-02-11T11:24:23.000Z',
    data: '0x0000000000000000000000000000000000000000000001eaa677e7d13c5d9574',
    log_index: '266',
    transaction_hash: TX_HASH,
    transaction_index: '101',
    transaction_value: '117801040032221917',
    topic0: '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
    topic1: '0x000000000000000000000000000000000004444c5dc75cb358380d2e3de08a90',
    topic2: '0x00000000000000000000000095707380bad470b4df398aa5ce1d7675667be717',
    topic3: null,
    decoded_event: {
      label: 'Transfer',
      signature: 'Transfer(address,address,uint256)',
      type: 'event',
      params: [
        { name: 'from', type: 'address', value: '0x000000000004444c5DC75cB358380D2e3dE08A90' },
        { name: 'to', type: 'address', value: '0x95707380BAD470B4DF398aA5cE1d7675667Be717' },
        { name: 'amount', type: 'uint256', value: '9050899907136051844468' },
      ],
    },
  },
];

export const internal_transactions: MoralisInternalTransaction[] = [
  {
    transaction_hash: TX_HASH,
    block_number: 24433211,
    block_hash: '0x4b7c9209f5dbfdf905b79b58be8f4a57a95a368844d7a303726892cf6e03c597',
    type: 'CALL',
    from: '0x66a9893cc07d91d95644aedd05d03f95e1dba8af',
    to: '0x000000000004444c5dc75cb358380d2e3de08a90',
    value: '117801040032221917',
    gas: '45553',
    gas_used: '1273',
    input: '0x11da60b4',
    output: '0x00000000000000000000000000000000000000000000000001a2836bf94acadd',
    error: null,
  },
];
