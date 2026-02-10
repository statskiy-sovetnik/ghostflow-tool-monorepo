import Moralis from 'moralis';
import type { MoralisTransactionLog, MoralisInternalTransaction, TransactionResult, TokenTransfer, FlowItem } from '../types/moralis';
import { parseERC20Transfers } from '../parsers/erc20TransferParser';
import { detectAaveSupplies, detectAaveBorrows, detectAaveRepays } from '../parsers/aaveV3Parser';
import { parseNativeTransfers } from '../parsers/nativeTransferParser';
import { fetchTokenMetadataBatch } from './tokenMetadata';

let initialized = false;

export async function initMoralis(): Promise<void> {
  if (initialized) {
    return;
  }

  const apiKey = import.meta.env.VITE_MORALIS_API_KEY;

  if (!apiKey) {
    throw new Error('VITE_MORALIS_API_KEY environment variable is not set');
  }

  await Moralis.start({ apiKey });
  initialized = true;
}

/**
 * Fetches and parses ERC-20 token transfers from a transaction.
 *
 * @param transactionHash The transaction hash to analyze
 * @returns TransactionResult with unified flow items, or null if transaction not found
 */
export async function fetchTokenTransfers(
  transactionHash: string
): Promise<TransactionResult | null> {
  await initMoralis();

  const response = await Moralis.EvmApi.transaction.getTransactionVerbose({
    transactionHash,
    chain: Moralis.EvmUtils.EvmChain.ETHEREUM,
    include: "internal_transactions"
  });

  if (!response) {
    return null;
  }

  const json = response.toJSON();
  const logs = json.logs as MoralisTransactionLog[];

  // Parse raw ERC-20 transfers from logs
  const rawTransfers = parseERC20Transfers(logs);

  let flow: FlowItem[] = [];

  if (rawTransfers.length > 0) {
    // Get unique token addresses
    const uniqueAddresses = [...new Set(rawTransfers.map((t) => t.tokenAddress))];

    // Fetch metadata for all tokens
    const metadataMap = await fetchTokenMetadataBatch(uniqueAddresses);

    // Enrich transfers with metadata
    const transfers: TokenTransfer[] = rawTransfers.map((raw) => {
      const metadata = metadataMap.get(raw.tokenAddress.toLowerCase())!;
      return {
        from: raw.from,
        to: raw.to,
        tokenAddress: raw.tokenAddress,
        tokenName: metadata.name,
        tokenSymbol: metadata.symbol,
        tokenLogo: metadata.logo,
        amount: raw.value,
        decimals: metadata.decimals,
        logIndex: raw.logIndex,
      };
    });

    // Detect DeFi operations
    const indicesToRemove = new Set<number>();

    const aaveSupplies = detectAaveSupplies(logs, transfers);
    const aaveBorrows = detectAaveBorrows(logs, transfers);
    const aaveRepays = detectAaveRepays(logs, transfers);
    const operationItems: FlowItem[] = [];
    for (const supply of aaveSupplies) {
      operationItems.push({ kind: 'operation', data: supply.operation });
      for (const idx of supply.transferIndicesToRemove) {
        indicesToRemove.add(idx);
      }
    }
    for (const borrow of aaveBorrows) {
      operationItems.push({ kind: 'operation', data: borrow.operation });
      for (const idx of borrow.transferIndicesToRemove) {
        indicesToRemove.add(idx);
      }
    }
    for (const repay of aaveRepays) {
      operationItems.push({ kind: 'operation', data: repay.operation });
      for (const idx of repay.transferIndicesToRemove) {
        indicesToRemove.add(idx);
      }
    }

    const transferItems: FlowItem[] = transfers
      .filter((_, i) => !indicesToRemove.has(i))
      .map((t) => ({ kind: 'transfer' as const, data: t }));

    flow = [...transferItems, ...operationItems].sort(
      (a, b) => a.data.logIndex - b.data.logIndex,
    );
  }

  // Parse native ETH transfers (top-level + internal)
  const internalTxs = (json.internal_transactions ?? []) as MoralisInternalTransaction[];
  const maxLogIndex = flow.length > 0
    ? Math.max(...flow.map((item) => item.data.logIndex))
    : -1;

  const nativeTransfers = parseNativeTransfers(
    internalTxs,
    json.value as string,
    json.from_address as string,
    json.to_address as string,
    maxLogIndex + 1,
  );

  const nativeItems: FlowItem[] = nativeTransfers.map((nt) => ({
    kind: 'native-transfer' as const,
    data: nt,
  }));

  flow = [...flow, ...nativeItems].sort(
    (a, b) => a.data.logIndex - b.data.logIndex,
  );

  return {
    txHash: transactionHash,
    flow,
  };
}

export { Moralis };
