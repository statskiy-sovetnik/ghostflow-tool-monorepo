import type { MoralisTransactionLog, TokenTransfer, AaveSupplyOperation, AaveBorrowOperation, AaveRepayOperation } from '../types/moralis';
import { extractAddressFromTopic, extractAddressFromData, decodeUint256FromData } from './utils';

export const AAVE_V3_POOL_ADDRESS = '0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2';
export const AAVE_V3_SUPPLY_TOPIC0 = '0x2b627736bca15cd5381dcf80b0bf11fd197d01a037c52b927a881a10fb73ba61';
export const AAVE_V3_BORROW_TOPIC0 = '0xb3d084820fb1a9decffb176436bd02558d15fac9b0ddfed8c465bc7359d7dce0';
export const AAVE_V3_REPAY_TOPIC0 = '0xa534c8dbe71f871f9f3530e97a74601fea17b426cae02e1c5aee42c96c784051';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export interface AaveSupplyResult {
  operation: AaveSupplyOperation;
  transferIndicesToRemove: number[];
}

export interface AaveBorrowResult {
  operation: AaveBorrowOperation;
  transferIndicesToRemove: number[];
}

export interface AaveRepayResult {
  operation: AaveRepayOperation;
  transferIndicesToRemove: number[];
}

/**
 * Detects Aave V3 Supply operations by scanning transaction logs for Supply events.
 *
 * Supply event layout:
 *   topic1: reserve, topic2: onBehalfOf, topic3: referralCode (uint16)
 *   data: [user (address), amount (uint256)]
 */
export function detectAaveSupplies(
  logs: MoralisTransactionLog[],
  transfers: TokenTransfer[],
): AaveSupplyResult[] {
  const results: AaveSupplyResult[] = [];

  for (const log of logs) {
    if (log.address.toLowerCase() !== AAVE_V3_POOL_ADDRESS) continue;
    if (log.topic0 !== AAVE_V3_SUPPLY_TOPIC0) continue;
    if (!log.topic1 || !log.topic2) continue;

    const reserve = extractAddressFromTopic(log.topic1);
    const onBehalfOfRaw = extractAddressFromTopic(log.topic2);
    const user = extractAddressFromData(log.data, 0);
    const amount = decodeUint256FromData(log.data, 1);

    const reserveLower = reserve.toLowerCase();
    const userLower = user.toLowerCase();
    const onBehalfOfLower = onBehalfOfRaw.toLowerCase();

    const indicesToRemove: number[] = [];

    // Find underlying token transfer: tokenAddress matches reserve AND from matches user
    const underlyingIdx = transfers.findIndex(
      (t) => t.tokenAddress.toLowerCase() === reserveLower && t.from.toLowerCase() === userLower,
    );
    if (underlyingIdx !== -1) indicesToRemove.push(underlyingIdx);

    // Find aToken mint: from is zero address AND to matches onBehalfOf
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
        logIndex: parseInt(log.log_index),
        asset: reserve,
        assetName: metadataTransfer?.tokenName ?? 'Unknown',
        assetSymbol: metadataTransfer?.tokenSymbol ?? '???',
        assetLogo: metadataTransfer?.tokenLogo ?? null,
        amount: metadataTransfer?.amount ?? amount,
        decimals: metadataTransfer?.decimals ?? 18,
        supplier: user,
        onBehalfOf,
      },
      transferIndicesToRemove: indicesToRemove,
    });
  }

  return results;
}

/**
 * Detects Aave V3 Borrow operations.
 *
 * Borrow event layout:
 *   topic1: reserve, topic2: onBehalfOf, topic3: referralCode (uint16)
 *   data: [user (address), amount (uint256), interestRateMode (uint8), borrowRate (uint256)]
 */
export function detectAaveBorrows(
  logs: MoralisTransactionLog[],
  transfers: TokenTransfer[],
): AaveBorrowResult[] {
  const results: AaveBorrowResult[] = [];

  for (const log of logs) {
    if (log.address.toLowerCase() !== AAVE_V3_POOL_ADDRESS) continue;
    if (log.topic0 !== AAVE_V3_BORROW_TOPIC0) continue;
    if (!log.topic1 || !log.topic2) continue;

    const reserve = extractAddressFromTopic(log.topic1);
    const onBehalfOfRaw = extractAddressFromTopic(log.topic2);
    const amount = decodeUint256FromData(log.data, 1);

    const reserveLower = reserve.toLowerCase();
    const onBehalfOfLower = onBehalfOfRaw.toLowerCase();

    const indicesToRemove: number[] = [];

    // Find underlying token transfer: tokenAddress matches reserve AND to matches onBehalfOf (borrower receives tokens)
    const underlyingIdx = transfers.findIndex(
      (t) => t.tokenAddress.toLowerCase() === reserveLower && t.to.toLowerCase() === onBehalfOfLower,
    );
    if (underlyingIdx !== -1) indicesToRemove.push(underlyingIdx);

    // Find debt token mint: from is zero address AND to matches onBehalfOf
    const debtMintIdx = transfers.findIndex(
      (t) =>
        t.from.toLowerCase() === ZERO_ADDRESS &&
        t.to.toLowerCase() === onBehalfOfLower,
    );
    if (debtMintIdx !== -1) indicesToRemove.push(debtMintIdx);

    const metadataTransfer = underlyingIdx !== -1 ? transfers[underlyingIdx] : null;

    results.push({
      operation: {
        type: 'aave-borrow',
        logIndex: parseInt(log.log_index),
        asset: reserve,
        assetName: metadataTransfer?.tokenName ?? 'Unknown',
        assetSymbol: metadataTransfer?.tokenSymbol ?? '???',
        assetLogo: metadataTransfer?.tokenLogo ?? null,
        amount: metadataTransfer?.amount ?? amount,
        decimals: metadataTransfer?.decimals ?? 18,
        borrower: onBehalfOfRaw,
      },
      transferIndicesToRemove: indicesToRemove,
    });
  }

  return results;
}

/**
 * Detects Aave V3 Repay operations.
 *
 * Repay event layout:
 *   topic1: reserve, topic2: user (whose debt is repaid), topic3: repayer
 *   data: [amount (uint256), useATokens (bool)]
 */
export function detectAaveRepays(
  logs: MoralisTransactionLog[],
  transfers: TokenTransfer[],
): AaveRepayResult[] {
  const results: AaveRepayResult[] = [];

  for (const log of logs) {
    if (log.address.toLowerCase() !== AAVE_V3_POOL_ADDRESS) continue;
    if (log.topic0 !== AAVE_V3_REPAY_TOPIC0) continue;
    if (!log.topic1 || !log.topic2 || !log.topic3) continue;

    const reserve = extractAddressFromTopic(log.topic1);
    const userRaw = extractAddressFromTopic(log.topic2);
    const repayerRaw = extractAddressFromTopic(log.topic3);
    const amount = decodeUint256FromData(log.data, 0);

    const reserveLower = reserve.toLowerCase();
    const repayerLower = repayerRaw.toLowerCase();
    const userLower = userRaw.toLowerCase();

    const indicesToRemove: number[] = [];

    // Find underlying token transfer: tokenAddress matches reserve AND from matches repayer
    const underlyingIdx = transfers.findIndex(
      (t) => t.tokenAddress.toLowerCase() === reserveLower && t.from.toLowerCase() === repayerLower,
    );
    if (underlyingIdx !== -1) indicesToRemove.push(underlyingIdx);

    // Find debt token burn: to is zero address
    const debtBurnIdx = transfers.findIndex(
      (t) => t.to.toLowerCase() === ZERO_ADDRESS,
    );
    if (debtBurnIdx !== -1) indicesToRemove.push(debtBurnIdx);

    const metadataTransfer = underlyingIdx !== -1 ? transfers[underlyingIdx] : null;

    // Only show onBehalfOf when repayer differs from user
    let onBehalfOf: string | null = null;
    if (repayerLower !== userLower) {
      onBehalfOf = userRaw;
    }

    results.push({
      operation: {
        type: 'aave-repay',
        logIndex: parseInt(log.log_index),
        asset: reserve,
        assetName: metadataTransfer?.tokenName ?? 'Unknown',
        assetSymbol: metadataTransfer?.tokenSymbol ?? '???',
        assetLogo: metadataTransfer?.tokenLogo ?? null,
        amount: metadataTransfer?.amount ?? amount,
        decimals: metadataTransfer?.decimals ?? 18,
        repayer: repayerRaw,
        onBehalfOf,
      },
      transferIndicesToRemove: indicesToRemove,
    });
  }

  return results;
}
