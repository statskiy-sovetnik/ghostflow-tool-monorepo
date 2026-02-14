import type { MoralisTransactionLog, TokenTransfer, AaveSupplyOperation, AaveBorrowOperation, AaveRepayOperation, AaveWithdrawOperation } from '../types/moralis';
import { extractAddressFromTopic, extractAddressFromData, decodeUint256FromData } from './utils';

export const AAVE_V3_POOL_ADDRESS = '0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2';
export const AAVE_V3_SUPPLY_TOPIC0 = '0x2b627736bca15cd5381dcf80b0bf11fd197d01a037c52b927a881a10fb73ba61';
export const AAVE_V3_BORROW_TOPIC0 = '0xb3d084820fb1a9decffb176436bd02558d15fac9b0ddfed8c465bc7359d7dce0';
export const AAVE_V3_REPAY_TOPIC0 = '0xa534c8dbe71f871f9f3530e97a74601fea17b426cae02e1c5aee42c96c784051';
export const AAVE_V3_WITHDRAW_TOPIC0 = '0x3115d1449a7b732c986cba18244e897a450f61e1bb8d589cd2e69e6c8924f9f7';

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

export interface AaveWithdrawResult {
  operation: AaveWithdrawOperation;
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
    const eventLogIndex = parseInt(log.log_index);

    // Find underlying token transfer: tokenAddress matches reserve AND from matches user, closest logIndex <= event
    let underlyingIdx = -1;
    let underlyingDist = Infinity;
    for (let i = 0; i < transfers.length; i++) {
      const t = transfers[i];
      if (
        t.tokenAddress.toLowerCase() === reserveLower &&
        t.from.toLowerCase() === userLower &&
        t.logIndex <= eventLogIndex
      ) {
        const dist = eventLogIndex - t.logIndex;
        if (dist < underlyingDist) {
          underlyingIdx = i;
          underlyingDist = dist;
        }
      }
    }
    if (underlyingIdx !== -1) indicesToRemove.push(underlyingIdx);

    // Find aToken mint: from is zero address AND to matches onBehalfOf, closest logIndex <= event
    let mintIdx = -1;
    let mintDist = Infinity;
    for (let i = 0; i < transfers.length; i++) {
      const t = transfers[i];
      if (
        t.from.toLowerCase() === ZERO_ADDRESS &&
        (t.to.toLowerCase() === onBehalfOfLower || t.to.toLowerCase() === userLower) &&
        t.logIndex <= eventLogIndex
      ) {
        const dist = eventLogIndex - t.logIndex;
        if (dist < mintDist) {
          mintIdx = i;
          mintDist = dist;
        }
      }
    }
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
    const eventLogIndex = parseInt(log.log_index);

    // Find underlying token transfer: tokenAddress matches reserve AND to matches onBehalfOf, closest logIndex <= event
    let underlyingIdx = -1;
    let underlyingDist = Infinity;
    for (let i = 0; i < transfers.length; i++) {
      const t = transfers[i];
      if (
        t.tokenAddress.toLowerCase() === reserveLower &&
        t.to.toLowerCase() === onBehalfOfLower &&
        t.logIndex <= eventLogIndex
      ) {
        const dist = eventLogIndex - t.logIndex;
        if (dist < underlyingDist) {
          underlyingIdx = i;
          underlyingDist = dist;
        }
      }
    }
    if (underlyingIdx !== -1) indicesToRemove.push(underlyingIdx);

    // Find debt token mint: from is zero address AND to matches onBehalfOf, closest logIndex <= event
    let debtMintIdx = -1;
    let debtMintDist = Infinity;
    for (let i = 0; i < transfers.length; i++) {
      const t = transfers[i];
      if (
        t.from.toLowerCase() === ZERO_ADDRESS &&
        t.to.toLowerCase() === onBehalfOfLower &&
        t.logIndex <= eventLogIndex
      ) {
        const dist = eventLogIndex - t.logIndex;
        if (dist < debtMintDist) {
          debtMintIdx = i;
          debtMintDist = dist;
        }
      }
    }
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
    const eventLogIndex = parseInt(log.log_index);

    // Find underlying token transfer: tokenAddress matches reserve AND from matches repayer, closest logIndex <= event
    let underlyingIdx = -1;
    let underlyingDist = Infinity;
    for (let i = 0; i < transfers.length; i++) {
      const t = transfers[i];
      if (
        t.tokenAddress.toLowerCase() === reserveLower &&
        t.from.toLowerCase() === repayerLower &&
        t.logIndex <= eventLogIndex
      ) {
        const dist = eventLogIndex - t.logIndex;
        if (dist < underlyingDist) {
          underlyingIdx = i;
          underlyingDist = dist;
        }
      }
    }
    if (underlyingIdx !== -1) indicesToRemove.push(underlyingIdx);

    // Find debt token burn: from = user (whose debt), to = zero address, closest logIndex <= event
    let debtBurnIdx = -1;
    let debtBurnDist = Infinity;
    for (let i = 0; i < transfers.length; i++) {
      const t = transfers[i];
      if (
        t.from.toLowerCase() === userLower &&
        t.to.toLowerCase() === ZERO_ADDRESS &&
        t.logIndex <= eventLogIndex
      ) {
        const dist = eventLogIndex - t.logIndex;
        if (dist < debtBurnDist) {
          debtBurnIdx = i;
          debtBurnDist = dist;
        }
      }
    }
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

/**
 * Detects Aave V3 Withdraw operations.
 *
 * Withdraw event layout:
 *   topic1: reserve, topic2: user (whose aTokens are burned), topic3: to (recipient)
 *   data: [amount (uint256)]
 */
export function detectAaveWithdraws(
  logs: MoralisTransactionLog[],
  transfers: TokenTransfer[],
): AaveWithdrawResult[] {
  const results: AaveWithdrawResult[] = [];

  for (const log of logs) {
    if (log.address.toLowerCase() !== AAVE_V3_POOL_ADDRESS) continue;
    if (log.topic0 !== AAVE_V3_WITHDRAW_TOPIC0) continue;
    if (!log.topic1 || !log.topic2 || !log.topic3) continue;

    const reserve = extractAddressFromTopic(log.topic1);
    const userRaw = extractAddressFromTopic(log.topic2);
    const toRaw = extractAddressFromTopic(log.topic3);
    const amount = decodeUint256FromData(log.data, 0);

    const reserveLower = reserve.toLowerCase();
    const userLower = userRaw.toLowerCase();
    const toLower = toRaw.toLowerCase();
    const recipient = toLower === userLower ? userLower : toLower;

    const indicesToRemove: number[] = [];

    // Find aToken burn: from = user, to = zero address, closest logIndex <= event
    const eventLogIndex = parseInt(log.log_index);
    let burnIdx = -1;
    let burnDist = Infinity;
    for (let i = 0; i < transfers.length; i++) {
      const t = transfers[i];
      if (
        t.from.toLowerCase() === userLower &&
        t.to.toLowerCase() === ZERO_ADDRESS &&
        t.logIndex <= eventLogIndex
      ) {
        const dist = eventLogIndex - t.logIndex;
        if (dist < burnDist) {
          burnIdx = i;
          burnDist = dist;
        }
      }
    }
    if (burnIdx !== -1) indicesToRemove.push(burnIdx);

    // Find underlying token transfer: tokenAddress = reserve, to = recipient, closest logIndex <= event
    let underlyingIdx = -1;
    let underlyingDist = Infinity;
    for (let i = 0; i < transfers.length; i++) {
      const t = transfers[i];
      if (
        t.tokenAddress.toLowerCase() === reserveLower &&
        t.to.toLowerCase() === recipient &&
        t.logIndex <= eventLogIndex
      ) {
        const dist = eventLogIndex - t.logIndex;
        if (dist < underlyingDist) {
          underlyingIdx = i;
          underlyingDist = dist;
        }
      }
    }
    if (underlyingIdx !== -1) indicesToRemove.push(underlyingIdx);

    const metadataTransfer = underlyingIdx !== -1 ? transfers[underlyingIdx] : null;

    // Only show `to` when recipient differs from withdrawer
    const to = toLower !== userLower ? toRaw : null;

    results.push({
      operation: {
        type: 'aave-withdraw',
        logIndex: parseInt(log.log_index),
        asset: reserve,
        assetName: metadataTransfer?.tokenName ?? 'Unknown',
        assetSymbol: metadataTransfer?.tokenSymbol ?? '???',
        assetLogo: metadataTransfer?.tokenLogo ?? null,
        amount: metadataTransfer?.amount ?? amount,
        decimals: metadataTransfer?.decimals ?? 18,
        withdrawer: userRaw,
        to,
      },
      transferIndicesToRemove: indicesToRemove,
    });
  }

  return results;
}
