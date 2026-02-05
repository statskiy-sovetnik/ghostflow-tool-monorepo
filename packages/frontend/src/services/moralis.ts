import Moralis from 'moralis';
import type { MoralisTransactionLog, TransactionResult, TokenTransfer } from '../types/moralis';
import { parseERC20Transfers } from '../parsers/erc20TransferParser';
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
 * @returns TransactionResult with enriched transfers, or null if transaction not found
 */
export async function fetchTokenTransfers(
  transactionHash: string
): Promise<TransactionResult | null> {
  await initMoralis();

  const response = await Moralis.EvmApi.transaction.getTransactionVerbose({
    transactionHash,
    chain: Moralis.EvmUtils.EvmChain.ETHEREUM,
  });

  if (!response) {
    return null;
  }

  const json = response.toJSON();
  const logs = json.logs as MoralisTransactionLog[];

  // Parse raw ERC-20 transfers from logs
  const rawTransfers = parseERC20Transfers(logs);

  if (rawTransfers.length === 0) {
    return {
      txHash: transactionHash,
      transfers: [],
    };
  }
  
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
      amount: raw.value,
      decimals: metadata.decimals,
    };
  });

  return {
    txHash: transactionHash,
    transfers,
  };
}

export { Moralis };
