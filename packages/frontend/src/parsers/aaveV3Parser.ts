import type { DecodedCall, TokenTransfer, AaveSupplyOperation } from '../types/moralis';

export const AAVE_V3_POOL_ADDRESS = '0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

interface AaveSupplyResult {
  operation: AaveSupplyOperation;
  transferIndicesToRemove: number[];
}

export function detectAaveSupply(
  decodedCall: DecodedCall | null,
  toAddress: string,
  fromAddress: string,
  transfers: TokenTransfer[],
): AaveSupplyResult | null {
  if (!decodedCall) return null;
  if (decodedCall.label !== 'supply') return null;
  if (toAddress.toLowerCase() !== AAVE_V3_POOL_ADDRESS) return null;

  const params = decodedCall.params;
  const asset = params[0]?.value;
  const amount = params[1]?.value;
  const onBehalfOfRaw = params[2]?.value;

  if (!asset || !amount) return null;

  const assetLower = asset.toLowerCase();
  const fromLower = fromAddress.toLowerCase();
  const onBehalfOfLower = onBehalfOfRaw?.toLowerCase() ?? fromLower;

  const indicesToRemove: number[] = [];

  // Find underlying token transfer: tokenAddress matches asset AND from matches fromAddress
  const underlyingIdx = transfers.findIndex(
    (t) => t.tokenAddress.toLowerCase() === assetLower && t.from.toLowerCase() === fromLower,
  );
  if (underlyingIdx !== -1) indicesToRemove.push(underlyingIdx);

  // Find aToken mint: from is zero address AND to matches onBehalfOf (or fromAddress)
  const mintIdx = transfers.findIndex(
    (t) =>
      t.from.toLowerCase() === ZERO_ADDRESS &&
      (t.to.toLowerCase() === onBehalfOfLower || t.to.toLowerCase() === fromLower),
  );
  if (mintIdx !== -1) indicesToRemove.push(mintIdx);

  // Get token metadata from the underlying transfer (preferred) or mint transfer
  const metadataTransfer = underlyingIdx !== -1 ? transfers[underlyingIdx] : null;

  // Determine if onBehalfOf should be shown
  let onBehalfOf: string | null = null;
  if (
    onBehalfOfRaw &&
    onBehalfOfRaw.toLowerCase() !== fromLower &&
    onBehalfOfRaw.toLowerCase() !== ZERO_ADDRESS
  ) {
    onBehalfOf = onBehalfOfRaw;
  }

  return {
    operation: {
      type: 'aave-supply',
      asset,
      assetName: metadataTransfer?.tokenName ?? 'Unknown',
      assetSymbol: metadataTransfer?.tokenSymbol ?? '???',
      assetLogo: metadataTransfer?.tokenLogo ?? null,
      amount: metadataTransfer?.amount ?? amount,
      decimals: metadataTransfer?.decimals ?? 18,
      onBehalfOf,
    },
    transferIndicesToRemove: indicesToRemove,
  };
}
