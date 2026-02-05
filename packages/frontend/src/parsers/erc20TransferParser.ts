import type { MoralisTransactionLog } from '../types/moralis';

export const ERC20_TRANSFER_SIGNATURE = 'Transfer(address,address,uint256)';

export interface RawERC20Transfer {
  from: string;
  to: string;
  value: string;
  tokenAddress: string;
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
      console.warn('ERC-20 Transfer log missing required params:', {
        from,
        to,
        value,
        address: log.address,
      });
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
