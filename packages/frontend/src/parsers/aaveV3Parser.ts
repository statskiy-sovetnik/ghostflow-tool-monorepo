import type { MoralisTransactionLog, TokenTransfer, AaveSupplyOperation } from '../types/moralis';
import { extractAddressFromTopic, decodeUint256FromData } from './utils';

export const AAVE_V3_POOL_ADDRESS = '0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2';
export const AAVE_V3_SUPPLY_TOPIC0 = '0xa534c8dbe71f871f9f3530e97a74601fea17b426cae02e1c5aee42c96c784051';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export interface AaveSupplyResult {
  operation: AaveSupplyOperation;
  transferIndicesToRemove: number[];
}

/**
 * Detects Aave V3 Supply operations by scanning transaction logs for Supply events.
 * Works for both top-level calls and internal calls (e.g., via Gnosis Safe).
 */
export function detectAaveSupplies(
  logs: MoralisTransactionLog[],
  transfers: TokenTransfer[],
): AaveSupplyResult[] {
  const results: AaveSupplyResult[] = [];

  for (const log of logs) {
    if (log.address.toLowerCase() !== AAVE_V3_POOL_ADDRESS) continue;
    if (log.topic0 !== AAVE_V3_SUPPLY_TOPIC0) continue;
    if (!log.topic1 || !log.topic2 || !log.topic3) continue;

    const reserve = extractAddressFromTopic(log.topic1);
    const user = extractAddressFromTopic(log.topic2);
    const onBehalfOfRaw = extractAddressFromTopic(log.topic3);
    const amount = decodeUint256FromData(log.data, 0);

    const reserveLower = reserve.toLowerCase();
    const userLower = user.toLowerCase();
    const onBehalfOfLower = onBehalfOfRaw.toLowerCase();

    const indicesToRemove: number[] = [];

    // Find underlying token transfer: tokenAddress matches reserve AND from matches user
    const underlyingIdx = transfers.findIndex(
      (t) => t.tokenAddress.toLowerCase() === reserveLower && t.from.toLowerCase() === userLower,
    );
    if (underlyingIdx !== -1) indicesToRemove.push(underlyingIdx);

    // Find aToken mint: from is zero address AND to matches onBehalfOf or user
    const mintIdx = transfers.findIndex(
      (t) =>
        t.from.toLowerCase() === ZERO_ADDRESS &&
        (t.to.toLowerCase() === onBehalfOfLower || t.to.toLowerCase() === userLower),
    );
    if (mintIdx !== -1) indicesToRemove.push(mintIdx);

    // Get token metadata from the underlying transfer if found
    const metadataTransfer = underlyingIdx !== -1 ? transfers[underlyingIdx] : null;

    // Only show onBehalfOf when it differs from user and isn't zero
    let onBehalfOf: string | null = null;
    if (onBehalfOfLower !== userLower && onBehalfOfLower !== ZERO_ADDRESS) {
      onBehalfOf = onBehalfOfRaw;
    }

    results.push({
      operation: {
        type: 'aave-supply',
        asset: reserve,
        assetName: metadataTransfer?.tokenName ?? 'Unknown',
        assetSymbol: metadataTransfer?.tokenSymbol ?? '???',
        assetLogo: metadataTransfer?.tokenLogo ?? null,
        amount: metadataTransfer?.amount ?? amount,
        decimals: metadataTransfer?.decimals ?? 18,
        onBehalfOf,
      },
      transferIndicesToRemove: indicesToRemove,
    });
  }

  return results;
}
