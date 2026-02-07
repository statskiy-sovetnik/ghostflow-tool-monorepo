/**
 * Quick script to log the full Moralis getTransactionVerbose response
 * for Aave V3 supply investigation.
 *
 * Usage: node scripts/inspect-moralis.mjs <txHash>
 */
import Moralis from 'moralis';

const TX_HASHES = {
  topLevelSupply: '0x18d5c46d0cafa1a8123bb73462b41bec4e9703569532cddcf96bf1d99d5620a7',
  internalCallSupply: '0xb30668900e64c6ea783152370e3a721ae9cafbdfeaac26fca3d5eb176a168ccb',
};

const apiKey = process.env.VITE_MORALIS_API_KEY;
if (!apiKey) {
  console.error('VITE_MORALIS_API_KEY not set. Run with: source ../../.env && node scripts/inspect-moralis.mjs');
  process.exit(1);
}

await Moralis.start({ apiKey });

const txHash = process.argv[2] || TX_HASHES.topLevelSupply;

console.log(`\nFetching verbose response for: ${txHash}\n`);

const response = await Moralis.EvmApi.transaction.getTransactionVerbose({
  transactionHash: txHash,
  chain: Moralis.EvmUtils.EvmChain.ETHEREUM,
});

console.log(JSON.stringify(response.toJSON(), null, 2));
