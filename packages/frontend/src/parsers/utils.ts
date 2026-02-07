/**
 * Shared utilities for parsing Ethereum event logs.
 */

/** Extracts a lowercase checksumless address from an ABI-encoded topic (last 40 hex chars). */
export function extractAddressFromTopic(topic: string): string {
  return '0x' + topic.slice(-40);
}

/** Decodes a uint256 from a specific 32-byte word in ABI-encoded event data. */
export function decodeUint256FromData(data: string, wordIndex: number): string {
  // Each word is 64 hex chars (32 bytes). Skip '0x' prefix.
  const start = 2 + wordIndex * 64;
  const hex = data.slice(start, start + 64);
  if (!hex || hex.length !== 64) return '0';
  return BigInt('0x' + hex).toString();
}
