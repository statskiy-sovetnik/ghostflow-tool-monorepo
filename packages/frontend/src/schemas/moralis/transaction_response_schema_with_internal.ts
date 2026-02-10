export type MoralisTxJSONResponseSchemaWithInternalTx = {
  "hash": "0xfeda0e8f0d6e54112c28d319c0d303c065d1125c9197bd653682f5fcb0a6c81e",
  "nonce": "327",
  "transaction_index": "176",
  "from_address_entity": null,
  "from_address_entity_logo": null,
  "from_address": "0xcb1c1fde09f811b294172696404e88e658659905",
  "from_address_label": "reubenrjs.eth",
  "to_address_entity": "1inch",
  "to_address_entity_logo": "https://entities-logos.s3.us-east-1.amazonaws.com/1inch.png",
  "to_address": "0x111111125421ca6dc452d289314280a0f8842a65",
  "to_address_label": "1inch: AggregationRouterV6",
  "value": "0",
  "gas": "217574",
  "gas_price": "848440939",
  "input": "0x07ed23790000000000000000000000005141b82f5ffda4c6fe1e372978f1c5427640a190000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee0000000000000000000000005141b82f5ffda4c6fe1e372978f1c5427640a190000000000000000000000000cb1c1fde09f811b294172696404e88e65865990500000000000000000000000000000000000000000000000000000000003b1b3a0000000000000000000000000000000000000000000000000004d6f6c0122be30000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000012000000000000000000000000000000000000000000000000000000000000002ce0000000000000000000000000000000000000002b000029a00025e00004e00a0744c8c09a0b86991c6218b36c1d19d4a2e9eb0ce3606eb484a183b7ed67b9e14b3f45abfb2cf44ed22c29e54000000000000000000000000000000000000000000000000000000000000790c5120111111125421ca6dc452d289314280a0f8842a65a0b86991c6218b36c1d19d4a2e9eb0ce3606eb480124cc713a04c6b37972e103ade988a9f14ee156bd19f77ca69f18c0e2b8a3aa42d9a9e5174b000000000000000000000000807cf9a772d5a3f9cefbc1192e939d62f0d9bd380000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb480000000000000000000000000000000000000000000000000004d9a88df1cf6900000000000000000000000000000000000000000000000000000000003aa22e00000000000000000000000000000355dc0067bb2894372978f1c5427640a1900000000000000000000000000000000000000000000000000000000000000160000000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000041f5d6913daad212e46bad07ef9c092fa27ea384f44c979caa8b7d595b195f3554670402862f9e694f8dec3a89a80bdf3aedcc032b216f7638cf6d7bd8b73de3781b000000000000000000000000000000000000000000000000000000000000004101c02aaa39b223fe8d0a0e5c4f27ead9083c756cc200042e1a7d4d0000000000000000000000000000000000000000000000000000000000000000c061111111125421ca6dc452d289314280a0f8842a650000000000000000000000000000000000006963f2b1",
  "receipt_cumulative_gas_used": "14285174",
  "receipt_gas_used": "159799",
  "receipt_contract_address": null,
  "receipt_root": null,
  "receipt_status": "1",
  "block_timestamp": "2025-02-23T13:54:11.000Z",
  "block_number": "21909451",
  "block_hash": "0xa9a18f34fff4c3fb68e3b95c7bf0f888fc84dc8e0f708b0d4cd704acbd33c37c",
  "logs": [
    {
      "address": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      "block_number": "21909451",
      "block_hash": "0xa9a18f34fff4c3fb68e3b95c7bf0f888fc84dc8e0f708b0d4cd704acbd33c37c",
      "block_timestamp": "2025-02-23T13:54:11.000Z",
      "data": "0x00000000000000000000000000000000000000000000000000000000003b1b3a",
      "log_index": "365",
      "transaction_hash": "0xfeda0e8f0d6e54112c28d319c0d303c065d1125c9197bd653682f5fcb0a6c81e",
      "transaction_index": "176",
      "transaction_value": "0",
      "topic0": "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
      "topic1": "0x000000000000000000000000cb1c1fde09f811b294172696404e88e658659905",
      "topic2": "0x0000000000000000000000005141b82f5ffda4c6fe1e372978f1c5427640a190",
      "topic3": null,
      "decoded_event": {
        "label": "Transfer",
        "signature": "Transfer(address,address,uint256)",
        "type": "event",
        "params": [
          {
            "name": "from",
            "type": "address",
            "value": "0xcB1C1FdE09f811B294172696404e88E658659905"
          },
          {
            "name": "to",
            "type": "address",
            "value": "0x5141B82f5fFDa4c6fE1E372978F1C5427640a190"
          },
          {
            "name": "amount",
            "type": "uint256",
            "value": "3873594"
          }
        ]
      }
    },
    {
      "address": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      "block_number": "21909451",
      "block_hash": "0xa9a18f34fff4c3fb68e3b95c7bf0f888fc84dc8e0f708b0d4cd704acbd33c37c",
      "block_timestamp": "2025-02-23T13:54:11.000Z",
      "data": "0x000000000000000000000000000000000000000000000000000000000000790c",
      "log_index": "366",
      "transaction_hash": "0xfeda0e8f0d6e54112c28d319c0d303c065d1125c9197bd653682f5fcb0a6c81e",
      "transaction_index": "176",
      "transaction_value": "0",
      "topic0": "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
      "topic1": "0x0000000000000000000000005141b82f5ffda4c6fe1e372978f1c5427640a190",
      "topic2": "0x0000000000000000000000004a183b7ed67b9e14b3f45abfb2cf44ed22c29e54",
      "topic3": null,
      "decoded_event": {
        "label": "Transfer",
        "signature": "Transfer(address,address,uint256)",
        "type": "event",
        "params": [
          {
            "name": "from",
            "type": "address",
            "value": "0x5141B82f5fFDa4c6fE1E372978F1C5427640a190"
          },
          {
            "name": "to",
            "type": "address",
            "value": "0x4a183b7ED67B9E14b3f45Abfb2Cf44ed22c29E54"
          },
          {
            "name": "amount",
            "type": "uint256",
            "value": "30988"
          }
        ]
      }
    },
    {
      "address": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      "block_number": "21909451",
      "block_hash": "0xa9a18f34fff4c3fb68e3b95c7bf0f888fc84dc8e0f708b0d4cd704acbd33c37c",
      "block_timestamp": "2025-02-23T13:54:11.000Z",
      "data": "0x00000000000000000000000000000000000000000000000000000000003aa22e",
      "log_index": "367",
      "transaction_hash": "0xfeda0e8f0d6e54112c28d319c0d303c065d1125c9197bd653682f5fcb0a6c81e",
      "transaction_index": "176",
      "transaction_value": "0",
      "topic0": "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925",
      "topic1": "0x0000000000000000000000005141b82f5ffda4c6fe1e372978f1c5427640a190",
      "topic2": "0x000000000000000000000000111111125421ca6dc452d289314280a0f8842a65",
      "topic3": null,
      "decoded_event": {
        "label": "Approval",
        "signature": "Approval(address,address,uint256)",
        "type": "event",
        "params": [
          {
            "name": "owner",
            "type": "address",
            "value": "0x5141B82f5fFDa4c6fE1E372978F1C5427640a190"
          },
          {
            "name": "spender",
            "type": "address",
            "value": "0x111111125421cA6dc452d289314280a0f8842A65"
          },
          {
            "name": "amount",
            "type": "uint256",
            "value": "3842606"
          }
        ]
      }
    },
    {
      "address": "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
      "block_number": "21909451",
      "block_hash": "0xa9a18f34fff4c3fb68e3b95c7bf0f888fc84dc8e0f708b0d4cd704acbd33c37c",
      "block_timestamp": "2025-02-23T13:54:11.000Z",
      "data": "0x0000000000000000000000000000000000000000000000000004d9a88df1cf69",
      "log_index": "368",
      "transaction_hash": "0xfeda0e8f0d6e54112c28d319c0d303c065d1125c9197bd653682f5fcb0a6c81e",
      "transaction_index": "176",
      "transaction_value": "0",
      "topic0": "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
      "topic1": "0x000000000000000000000000807cf9a772d5a3f9cefbc1192e939d62f0d9bd38",
      "topic2": "0x0000000000000000000000005141b82f5ffda4c6fe1e372978f1c5427640a190",
      "topic3": null,
      "decoded_event": {
        "label": "Transfer",
        "signature": "Transfer(address,address,uint256)",
        "type": "event",
        "params": [
          {
            "name": "src",
            "type": "address",
            "value": "0x807cF9A772d5a3f9CeFBc1192e939D62f0D9bD38"
          },
          {
            "name": "dst",
            "type": "address",
            "value": "0x5141B82f5fFDa4c6fE1E372978F1C5427640a190"
          },
          {
            "name": "wad",
            "type": "uint256",
            "value": "1365217866010473"
          }
        ]
      }
    },
    {
      "address": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      "block_number": "21909451",
      "block_hash": "0xa9a18f34fff4c3fb68e3b95c7bf0f888fc84dc8e0f708b0d4cd704acbd33c37c",
      "block_timestamp": "2025-02-23T13:54:11.000Z",
      "data": "0x00000000000000000000000000000000000000000000000000000000003aa22e",
      "log_index": "369",
      "transaction_hash": "0xfeda0e8f0d6e54112c28d319c0d303c065d1125c9197bd653682f5fcb0a6c81e",
      "transaction_index": "176",
      "transaction_value": "0",
      "topic0": "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
      "topic1": "0x0000000000000000000000005141b82f5ffda4c6fe1e372978f1c5427640a190",
      "topic2": "0x000000000000000000000000807cf9a772d5a3f9cefbc1192e939d62f0d9bd38",
      "topic3": null,
      "decoded_event": {
        "label": "Transfer",
        "signature": "Transfer(address,address,uint256)",
        "type": "event",
        "params": [
          {
            "name": "from",
            "type": "address",
            "value": "0x5141B82f5fFDa4c6fE1E372978F1C5427640a190"
          },
          {
            "name": "to",
            "type": "address",
            "value": "0x807cF9A772d5a3f9CeFBc1192e939D62f0D9bD38"
          },
          {
            "name": "amount",
            "type": "uint256",
            "value": "3842606"
          }
        ]
      }
    },
    {
      "address": "0x111111125421ca6dc452d289314280a0f8842a65",
      "block_number": "21909451",
      "block_hash": "0xa9a18f34fff4c3fb68e3b95c7bf0f888fc84dc8e0f708b0d4cd704acbd33c37c",
      "block_timestamp": "2025-02-23T13:54:11.000Z",
      "data": "0x9bc3ffdc03b30f4e23f2a87963c3743a6b8ea7b7a58d2ef013c83750a89266f70000000000000000000000000000000000000000000000000000000000000000",
      "log_index": "370",
      "transaction_hash": "0xfeda0e8f0d6e54112c28d319c0d303c065d1125c9197bd653682f5fcb0a6c81e",
      "transaction_index": "176",
      "transaction_value": "0",
      "topic0": "0xfec331350fce78ba658e082a71da20ac9f8d798a99b3c79681c8440cbfe77e07",
      "topic1": null,
      "topic2": null,
      "topic3": null,
      "decoded_event": null
    },
    {
      "address": "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
      "block_number": "21909451",
      "block_hash": "0xa9a18f34fff4c3fb68e3b95c7bf0f888fc84dc8e0f708b0d4cd704acbd33c37c",
      "block_timestamp": "2025-02-23T13:54:11.000Z",
      "data": "0x0000000000000000000000000000000000000000000000000004d9a88df1cf69",
      "log_index": "371",
      "transaction_hash": "0xfeda0e8f0d6e54112c28d319c0d303c065d1125c9197bd653682f5fcb0a6c81e",
      "transaction_index": "176",
      "transaction_value": "0",
      "topic0": "0x7fcf532c15f0a6db0bd6d0e038bea71d30d808c7d98cb3bf7268a95bf5081b65",
      "topic1": "0x0000000000000000000000005141b82f5ffda4c6fe1e372978f1c5427640a190",
      "topic2": null,
      "topic3": null,
      "decoded_event": {
        "label": "Withdrawal",
        "signature": "Withdrawal(address,uint256)",
        "type": "event",
        "params": [
          {
            "name": "src",
            "type": "address",
            "value": "0x5141B82f5fFDa4c6fE1E372978F1C5427640a190"
          },
          {
            "name": "wad",
            "type": "uint256",
            "value": "1365217866010473"
          }
        ]
      }
    }
  ],
  "decoded_call": null,
  "transaction_fee": "0.000135580013611261",
  "internal_transactions": [
    {
      "transaction_hash": "0xfeda0e8f0d6e54112c28d319c0d303c065d1125c9197bd653682f5fcb0a6c81e",
      "block_number": 21909451,
      "block_hash": "0xa9a18f34fff4c3fb68e3b95c7bf0f888fc84dc8e0f708b0d4cd704acbd33c37c",
      "type": "CALL",
      "from": "0x111111125421ca6dc452d289314280a0f8842a65",
      "to": "0xcb1c1fde09f811b294172696404e88e658659905",
      "value": "1365217866010473",
      "gas": "7300",
      "gas_used": "0",
      "input": "0x",
      "output": "0x",
      "error": null
    },
    {
      "transaction_hash": "0xfeda0e8f0d6e54112c28d319c0d303c065d1125c9197bd653682f5fcb0a6c81e",
      "block_number": 21909451,
      "block_hash": "0xa9a18f34fff4c3fb68e3b95c7bf0f888fc84dc8e0f708b0d4cd704acbd33c37c",
      "type": "CALL",
      "from": "0x5141b82f5ffda4c6fe1e372978f1c5427640a190",
      "to": "0x111111125421ca6dc452d289314280a0f8842a65",
      "value": "1365217866010473",
      "gas": "28039",
      "gas_used": "154",
      "input": "0x",
      "output": "0x",
      "error": null
    },
    {
      "transaction_hash": "0xfeda0e8f0d6e54112c28d319c0d303c065d1125c9197bd653682f5fcb0a6c81e",
      "block_number": 21909451,
      "block_hash": "0xa9a18f34fff4c3fb68e3b95c7bf0f888fc84dc8e0f708b0d4cd704acbd33c37c",
      "type": "CALL",
      "from": "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
      "to": "0x5141b82f5ffda4c6fe1e372978f1c5427640a190",
      "value": "1365217866010473",
      "gas": "2300",
      "gas_used": "82",
      "input": "0x",
      "output": "0x",
      "error": null
    }
  ]
}