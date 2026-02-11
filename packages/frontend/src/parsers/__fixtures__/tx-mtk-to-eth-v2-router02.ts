/**
 * Fixture: MTK → ETH swap via V2 Router02 (fee-on-transfer token)
 * TX: 0x4ad5d09328358c755555bc3d68a88c03d1b434de741c5b9d0ed2b0bba0e76be4
 *
 * User calls swapExactTokensForETHSupportingFeeOnTransferTokens on V2 Router02.
 * MTK has a token tax — extra Transfer to fee recipient not consumed by swap.
 * Router02 unwraps WETH and sends native ETH to user.
 *
 * ERC-20 transfers:
 *   log 798: MTK user → V2 pair (swap input)
 *   log 799: MTK user → fee recipient (token tax, not consumed)
 *   log 801: WETH pair → V2 Router02 (swap output, triggers native ETH detection)
 *
 * Other events: Burn (800), Sync (802), V2 Swap (803), WETH Withdrawal (804)
 *
 * Internal txs: WETH → Router02 (unwrap), Router02 → user (ETH delivery)
 */
import type { MoralisTransactionLog, MoralisInternalTransaction } from '../../types/moralis';

export const TX_HASH = '0x4ad5d09328358c755555bc3d68a88c03d1b434de741c5b9d0ed2b0bba0e76be4';
export const FROM_ADDRESS = '0xba49d175894f97ca0e3ed5f3c75ab04db64ca81d';
export const TO_ADDRESS = '0x7a250d5630b4cf539739df2c5dacb4c659f2488d'; // V2 Router02
export const VALUE = '0';

export const MTK_ADDRESS = '0x01ee1f75d0e80ed907aa0221bf29e380d03ba15a';
export const ETH_OUTPUT_AMOUNT = '32243172196196555';

const BLOCK_NUMBER = '24433846';
const BLOCK_HASH = '0x0ca971ac82e8ee4e6a356215948d76e94e6c5084743d1ede0df2088b23055a6e';
const BLOCK_TIMESTAMP = '2026-02-11T00:00:00.000Z';
const TX_INDEX = '411';

export const logs: MoralisTransactionLog[] = [
  // log 798: MTK Transfer — user → V2 pair (swap input)
  {
    address: '0x01ee1f75d0e80ed907aa0221bf29e380d03ba15a',
    block_number: BLOCK_NUMBER,
    block_hash: BLOCK_HASH,
    block_timestamp: BLOCK_TIMESTAMP,
    data: '0x000000000000000000000000000000000000000006f3b4982a70f3e82258e76b',
    log_index: '798',
    transaction_hash: TX_HASH,
    transaction_index: TX_INDEX,
    transaction_value: '0',
    topic0: '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
    topic1: '0x000000000000000000000000ba49d175894f97ca0e3ed5f3c75ab04db64ca81d',
    topic2: '0x0000000000000000000000006dad4b92cd4f540cce9fc49810bd44100e50c6af',
    topic3: null,
    decoded_event: {
      label: 'Transfer',
      signature: 'Transfer(address,address,uint256)',
      type: 'event',
      params: [
        { name: 'from', type: 'address', value: '0xba49d175894f97ca0e3ed5f3c75ab04db64ca81d' },
        { name: 'to', type: 'address', value: '0x6dad4b92cd4f540cce9fc49810bd44100e50c6af' },
        { name: 'value', type: 'uint256', value: '2151531866024653367111378795' },
      ],
    },
  },
  // log 799: MTK Transfer — user → fee recipient (token tax)
  {
    address: '0x01ee1f75d0e80ed907aa0221bf29e380d03ba15a',
    block_number: BLOCK_NUMBER,
    block_hash: BLOCK_HASH,
    block_timestamp: BLOCK_TIMESTAMP,
    data: '0x000000000000000000000000000000000000000000055aed333999832347e80b',
    log_index: '799',
    transaction_hash: TX_HASH,
    transaction_index: TX_INDEX,
    transaction_value: '0',
    topic0: '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
    topic1: '0x000000000000000000000000ba49d175894f97ca0e3ed5f3c75ab04db64ca81d',
    topic2: '0x000000000000000000000000dfb03b25eac446cf7acd2643fc97d5c03bd836f3',
    topic3: null,
    decoded_event: {
      label: 'Transfer',
      signature: 'Transfer(address,address,uint256)',
      type: 'event',
      params: [
        { name: 'from', type: 'address', value: '0xba49d175894f97ca0e3ed5f3c75ab04db64ca81d' },
        { name: 'to', type: 'address', value: '0xdfb03b25eac446cf7acd2643fc97d5c03bd836f3' },
        { name: 'value', type: 'uint256', value: '6474017651027041225009163' },
      ],
    },
  },
  // log 800: Burn event (MTK token tax mechanism)
  {
    address: '0x01ee1f75d0e80ed907aa0221bf29e380d03ba15a',
    block_number: BLOCK_NUMBER,
    block_hash: BLOCK_HASH,
    block_timestamp: BLOCK_TIMESTAMP,
    data: '0x000000000000000000000000000000000000000000055aed333999832347e80b',
    log_index: '800',
    transaction_hash: TX_HASH,
    transaction_index: TX_INDEX,
    transaction_value: '0',
    topic0: '0x5d37fd68fe66745a199f8c603e00ae02183f4aabb8ec0089589b0b40c4ead5e1',
    topic1: '0x000000000000000000000000ba49d175894f97ca0e3ed5f3c75ab04db64ca81d',
    topic2: '0x0000000000000000000000006dad4b92cd4f540cce9fc49810bd44100e50c6af',
    topic3: null,
    decoded_event: null,
  },
  // log 801: WETH Transfer — V2 pair → V2 Router02 (swap output)
  {
    address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    block_number: BLOCK_NUMBER,
    block_hash: BLOCK_HASH,
    block_timestamp: BLOCK_TIMESTAMP,
    data: '0x00000000000000000000000000000000000000000000000000728cfe892fa0cb',
    log_index: '801',
    transaction_hash: TX_HASH,
    transaction_index: TX_INDEX,
    transaction_value: '0',
    topic0: '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
    topic1: '0x0000000000000000000000006dad4b92cd4f540cce9fc49810bd44100e50c6af',
    topic2: '0x0000000000000000000000007a250d5630b4cf539739df2c5dacb4c659f2488d',
    topic3: null,
    decoded_event: {
      label: 'Transfer',
      signature: 'Transfer(address,address,uint256)',
      type: 'event',
      params: [
        { name: 'src', type: 'address', value: '0x6dad4b92cd4f540cce9fc49810bd44100e50c6af' },
        { name: 'dst', type: 'address', value: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D' },
        { name: 'wad', type: 'uint256', value: '32243172196196555' },
      ],
    },
  },
  // log 802: Sync event (V2 pair reserves update)
  {
    address: '0x6dad4b92cd4f540cce9fc49810bd44100e50c6af',
    block_number: BLOCK_NUMBER,
    block_hash: BLOCK_HASH,
    block_timestamp: BLOCK_TIMESTAMP,
    data: '0x000000000000000000000000000000000000000ce458de27f3b7252c8337f5a6000000000000000000000000000000000000000000000000d49e050d772f1274',
    log_index: '802',
    transaction_hash: TX_HASH,
    transaction_index: TX_INDEX,
    transaction_value: '0',
    topic0: '0x1c411e9a96e071241c2f21f7726b17ae89e3cab4c78be50e062b03a9fffbbad1',
    topic1: null,
    topic2: null,
    topic3: null,
    decoded_event: null,
  },
  // log 803: V2 Swap event (sender=Router02, to=Router02)
  {
    address: '0x6dad4b92cd4f540cce9fc49810bd44100e50c6af',
    block_number: BLOCK_NUMBER,
    block_hash: BLOCK_HASH,
    block_timestamp: BLOCK_TIMESTAMP,
    data: '0x000000000000000000000000000000000000000006f3b4982a70f3e82258e76b0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000728cfe892fa0cb',
    log_index: '803',
    transaction_hash: TX_HASH,
    transaction_index: TX_INDEX,
    transaction_value: '0',
    topic0: '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822',
    topic1: '0x0000000000000000000000007a250d5630b4cf539739df2c5dacb4c659f2488d',
    topic2: '0x0000000000000000000000007a250d5630b4cf539739df2c5dacb4c659f2488d',
    topic3: null,
    decoded_event: {
      label: 'Swap',
      signature: 'Swap(address,uint256,uint256,uint256,uint256,address)',
      type: 'event',
      params: [
        { name: 'sender', type: 'address', value: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D' },
        { name: 'amount0In', type: 'uint256', value: '2151531866024653367111378795' },
        { name: 'amount1In', type: 'uint256', value: '0' },
        { name: 'amount0Out', type: 'uint256', value: '0' },
        { name: 'amount1Out', type: 'uint256', value: '32243172196196555' },
        { name: 'to', type: 'address', value: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D' },
      ],
    },
  },
  // log 804: WETH Withdrawal event
  {
    address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    block_number: BLOCK_NUMBER,
    block_hash: BLOCK_HASH,
    block_timestamp: BLOCK_TIMESTAMP,
    data: '0x00000000000000000000000000000000000000000000000000728cfe892fa0cb',
    log_index: '804',
    transaction_hash: TX_HASH,
    transaction_index: TX_INDEX,
    transaction_value: '0',
    topic0: '0x7fcf532c15f0a6db0bd6d0e038bea71d30d808c7d98cb3bf7268a95bf5081b65',
    topic1: '0x0000000000000000000000007a250d5630b4cf539739df2c5dacb4c659f2488d',
    topic2: null,
    topic3: null,
    decoded_event: {
      label: 'Withdrawal',
      signature: 'Withdrawal(address,uint256)',
      type: 'event',
      params: [
        { name: 'src', type: 'address', value: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D' },
        { name: 'wad', type: 'uint256', value: '32243172196196555' },
      ],
    },
  },
];

export const internal_transactions: MoralisInternalTransaction[] = [
  // WETH contract → Router02 (unwrap)
  {
    transaction_hash: TX_HASH,
    block_number: 24433846,
    block_hash: BLOCK_HASH,
    type: 'CALL',
    from: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    to: '0x7a250d5630b4cf539739df2c5dacb4c659f2488d',
    value: '32243172196196555',
    gas: '36014',
    gas_used: '0',
    input: '0x',
    output: '0x',
    error: null,
  },
  // Router02 → user (ETH delivery)
  {
    transaction_hash: TX_HASH,
    block_number: 24433846,
    block_hash: BLOCK_HASH,
    type: 'CALL',
    from: '0x7a250d5630b4cf539739df2c5dacb4c659f2488d',
    to: '0xba49d175894f97ca0e3ed5f3c75ab04db64ca81d',
    value: '32243172196196555',
    gas: '23000',
    gas_used: '0',
    input: '0x',
    output: '0x',
    error: null,
  },
];
