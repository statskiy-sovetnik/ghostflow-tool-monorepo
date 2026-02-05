import Moralis from 'moralis';
import type { TokenMetadata } from '../types/moralis';

// In-memory cache for token metadata
const metadataCache = new Map<string, TokenMetadata>();

const DEFAULT_DECIMALS = 18;
const UNKNOWN_SYMBOL = 'UNKNOWN';
const UNKNOWN_NAME = 'Unknown Token';

// Moralis allows up to 25 addresses per batch request
const BATCH_SIZE = 25;

/**
 * Fetches token metadata for multiple addresses using Moralis API.
 * Results are cached to avoid redundant API calls.
 *
 * @param addresses Array of token contract addresses
 * @returns Map of address -> TokenMetadata
 */
export async function fetchTokenMetadataBatch(
  addresses: string[]
): Promise<Map<string, TokenMetadata>> {
  const result = new Map<string, TokenMetadata>();
  const uncachedAddresses: string[] = [];

  // Check cache first
  for (const address of addresses) {
    const normalizedAddress = address.toLowerCase();
    const cached = metadataCache.get(normalizedAddress);
    if (cached) {
      result.set(normalizedAddress, cached);
    } else {
      uncachedAddresses.push(address);
    }
  }

  if (uncachedAddresses.length === 0) {
    return result;
  }

  // Fetch uncached addresses in batches
  for (let i = 0; i < uncachedAddresses.length; i += BATCH_SIZE) {
    const batch = uncachedAddresses.slice(i, i + BATCH_SIZE);

    try {
      const response = await Moralis.EvmApi.token.getTokenMetadata({
        addresses: batch,
        chain: Moralis.EvmUtils.EvmChain.ETHEREUM,
      });

      const tokens = response.toJSON();

      for (const token of tokens) {
        const normalizedAddress = token.address.toLowerCase();
        const metadata: TokenMetadata = {
          address: normalizedAddress,
          name: token.name || UNKNOWN_NAME,
          symbol: token.symbol || UNKNOWN_SYMBOL,
          decimals: token.decimals ? Number(token.decimals) : DEFAULT_DECIMALS,
          logo: token.logo || null,
        };

        metadataCache.set(normalizedAddress, metadata);
        result.set(normalizedAddress, metadata);
      }
    } catch (error) {
      console.warn('Failed to fetch token metadata for batch:', batch, error);

      // Set fallback values for failed batch
      for (const address of batch) {
        const normalizedAddress = address.toLowerCase();
        const fallback: TokenMetadata = {
          address: normalizedAddress,
          name: UNKNOWN_NAME,
          symbol: UNKNOWN_SYMBOL,
          decimals: DEFAULT_DECIMALS,
          logo: null,
        };
        result.set(normalizedAddress, fallback);
      }
    }
  }

  // Ensure all requested addresses have metadata (even if API didn't return them)
  for (const address of addresses) {
    const normalizedAddress = address.toLowerCase();
    if (!result.has(normalizedAddress)) {
      const fallback: TokenMetadata = {
        address: normalizedAddress,
        name: UNKNOWN_NAME,
        symbol: UNKNOWN_SYMBOL,
        decimals: DEFAULT_DECIMALS,
        logo: null,
      };
      result.set(normalizedAddress, fallback);
    }
  }

  return result;
}

/**
 * Clears the metadata cache. Useful for testing.
 */
export function clearMetadataCache(): void {
  metadataCache.clear();
}
