import Moralis from 'moralis';
import type { MoralisTransactionLog, MoralisInternalTransaction, TransactionResult, TokenTransfer, FlowItem } from '../types/moralis';
import { parseERC20Transfers } from '../parsers/erc20TransferParser';
import { detectAaveSupplies, detectAaveBorrows, detectAaveRepays, detectAaveWithdraws } from '../parsers/aaveV3Parser';
import { detectUniswapSwaps } from '../parsers/uniswapParser';
import { detectUniswapLiquidity } from '../parsers/uniswapLiquidityParser';
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json = response.toJSON() as any;
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
    const operationItems: FlowItem[] = [];

    // Aave operations
    const aaveSupplies = detectAaveSupplies(logs, transfers);
    const aaveBorrows = detectAaveBorrows(logs, transfers);
    const aaveRepays = detectAaveRepays(logs, transfers);
    const aaveWithdraws = detectAaveWithdraws(logs, transfers);
    for (const result of [...aaveSupplies, ...aaveBorrows, ...aaveRepays, ...aaveWithdraws]) {
      operationItems.push({ kind: 'operation', data: result.operation });
      for (const idx of result.transferIndicesToRemove) {
        indicesToRemove.add(idx);
      }
    }

    // Parse native ETH transfers early so Uniswap parser can reference them
    const internalTxs = (json.internal_transactions ?? []) as MoralisInternalTransaction[];
    const erc20MaxLogIndex = transfers.length > 0
      ? Math.max(...transfers.map((t) => t.logIndex))
      : -1;
    const allNativeTransfers = parseNativeTransfers(
      internalTxs,
      json.value as string,
      json.from_address as string,
      json.to_address as string,
      erc20MaxLogIndex + 1,
    );

    // Uniswap swaps
    const uniswapResult = detectUniswapSwaps(
      logs,
      transfers,
      allNativeTransfers,
      json.from_address as string,
    );
    for (const op of uniswapResult.operations) {
      operationItems.push({ kind: 'operation', data: op });
    }
    for (const idx of uniswapResult.transferIndicesToRemove) {
      indicesToRemove.add(idx);
    }

    // Uniswap liquidity operations
    const liquidityResult = detectUniswapLiquidity(logs, transfers, allNativeTransfers, json.from_address as string);
    for (const op of liquidityResult.operations) {
      operationItems.push({ kind: 'operation', data: op });
    }
    for (const idx of liquidityResult.transferIndicesToRemove) {
      indicesToRemove.add(idx);
    }

    // Filter consumed native transfers
    const nativeTransfersToConsume = [
      ...uniswapResult.nativeTransfersToConsume,
      ...liquidityResult.nativeTransfersToConsume,
    ];
    const filteredNativeTransfers = allNativeTransfers.filter((nt) => {
      return !nativeTransfersToConsume.some(
        (c) =>
          c.from.toLowerCase() === nt.from.toLowerCase() &&
          c.to.toLowerCase() === nt.to.toLowerCase() &&
          c.value === nt.amount,
      );
    });

    const transferItems: FlowItem[] = transfers
      .filter((_, i) => !indicesToRemove.has(i))
      .map((t) => ({ kind: 'transfer' as const, data: t }));

    const nativeItems: FlowItem[] = filteredNativeTransfers.map((nt) => ({
      kind: 'native-transfer' as const,
      data: nt,
    }));

    flow = [...transferItems, ...operationItems, ...nativeItems].sort(
      (a, b) => a.data.logIndex - b.data.logIndex,
    );
  } else {
    // No ERC-20 transfers, but still parse native transfers
    const internalTxs = (json.internal_transactions ?? []) as MoralisInternalTransaction[];
    const allNativeTransfers = parseNativeTransfers(
      internalTxs,
      json.value as string,
      json.from_address as string,
      json.to_address as string,
      0,
    );

    const nativeItems: FlowItem[] = allNativeTransfers.map((nt) => ({
      kind: 'native-transfer' as const,
      data: nt,
    }));

    flow = nativeItems;
  }

  return {
    txHash: transactionHash,
    flow,
  };
}

export { Moralis };
