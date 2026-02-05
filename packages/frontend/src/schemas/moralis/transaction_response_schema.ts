// This is just an example response, not the actual type to be used!

export type MoralisTxJSONResponseSchema = {
  hash: string,
  nonce: string,
  transaction_index: string,
  "from_address": "0x95222290dd7278aa3ddd389cc1e1d165cc4bafe5",
  "to_address": "0x388c818ca8b9251b393131c08a736a67ccb19297",
  "value": "62754610757602656",
  "gas": "30000",
  "gas_price": "10350264493",
  "input": "0x",
  "receipt_cumulative_gas_used": "19314887",
  "receipt_gas_used": "22111",
  "receipt_contract_address": null,
  "receipt_root": null,
  "receipt_status": "1",
  "block_timestamp": "2022-11-07T08:36:11.000Z",
  "block_number": "15916991",
  "block_hash": "0xd517ab9abb4beed9efb6b74ecbabc141d8550abe11aedb715ce9d133dcb32c9b",
  "transfer_index": [15916991, 203],
  "logs": [
    {
      address: '0x43e54c2e7b3e294de3a155785f52ab49d87b9922',
      block_number: '24381633',
      block_hash: '0xa50171d4c6bd8efb2616a6951ee70f607e74995914016ad888fc5fc8efd09835',
      block_timestamp: '2026-02-04T06:16:11.000Z',
      data: '0x0000000000000000000000000000000000000000000000a2a15d09519be00000',
      log_index: '115',
      transaction_hash: '0x50539d4fa5bbe6aab765429b943ef35d8c21887e674e3eb3bc73d938174e6b2d',
      transaction_index: '55',
      transaction_value: '0',
      topic0: '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925',
      topic1: '0x00000000000000000000000076c506c9a3af417deecbb980da4ff6c4b5c71b98',
      topic2: '0x0000000000000000000000007a186984ac827fb7ad274ebac333b45c20be9def',
      topic3: null,
      decoded_event: {
        label: 'Approval',
        signature: 'Approval(address,address,uint256)',
        type: 'event',
        params: [
          {
            name: 'owner',
            type: 'address',
            value: '0x76c506c9A3AF417deECbB980DA4FF6c4B5C71B98'
          },
          {
            name: 'spender',
            type: 'address',
            value: '0x7A186984Ac827Fb7Ad274Ebac333B45C20bE9dEF'
          },
          {
            name: 'amount',
            type: 'uint256',
            value: '3000000000000000000000'
          }
        ]
      }
    }
  ]
}