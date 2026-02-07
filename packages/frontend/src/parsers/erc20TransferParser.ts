import type { MoralisTransactionLog } from '../types/moralis';
import { extractAddressFromTopic } from './utils';

export const ERC20_TRANSFER_SIGNATURE = 'Transfer(address,address,uint256)';
export const ERC20_TRANSFER_TOPIC0 = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

export interface RawERC20Transfer {
  from: string;
  to: string;
  value: string;
  tokenAddress: string;
}

function extractValueFromData(data: string): string {
  if (!data || data === '0x') return '0';
  return BigInt(data).toString();
}

function parseTransferFromRawLog(log: MoralisTransactionLog): RawERC20Transfer | null {
  if (log.topic0 !== ERC20_TRANSFER_TOPIC0) return null;
  if (!log.topic1 || !log.topic2 || !log.data) {
    console.warn('Raw Transfer log missing required fields:', { address: log.address });
    return null;
  }
  return {
    from: extractAddressFromTopic(log.topic1),
    to: extractAddressFromTopic(log.topic2),
    value: extractValueFromData(log.data),
    tokenAddress: log.address,
  };
}

/**
 * Parses ERC-20 Transfer events from Moralis transaction logs.
 * Filters logs by the Transfer(address,address,uint256) signature
 * and extracts from/to/value parameters.
 */
export function parseERC20Transfers(logs: MoralisTransactionLog[]): RawERC20Transfer[] {
  const transfers: RawERC20Transfer[] = [];

  for (const log of logs) {
    if (!log.decoded_event) {
      // Try fallback to raw log parsing
      const rawTransfer = parseTransferFromRawLog(log);
      if (rawTransfer) {
        transfers.push(rawTransfer);
      }
      continue;
    }

    if (log.decoded_event.signature !== ERC20_TRANSFER_SIGNATURE) {
      continue;
    }

    const params = log.decoded_event.params;
    const from = params.find((p) => p.name === 'from')?.value;
    const to = params.find((p) => p.name === 'to')?.value;
    // Some tokens use 'value', others use 'amount'
    const value = params.find((p) => p.name === 'value')?.value
               ?? params.find((p) => p.name === 'amount')?.value;

    if (!from || !to || !value) {
      // decoded_event exists but params are missing - try raw log parsing as fallback
      const rawTransfer = parseTransferFromRawLog(log);
      if (rawTransfer) {
        transfers.push(rawTransfer);
      }
      continue;
    }

    transfers.push({
      from,
      to,
      value,
      tokenAddress: log.address,
    });
  }

  return transfers;
}
