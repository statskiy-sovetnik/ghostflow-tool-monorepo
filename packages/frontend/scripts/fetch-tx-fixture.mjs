/**
 * Fetches full Moralis transaction data (logs + internal txs) for a given hash
 * and outputs a focused fixture object suitable for parser tests.
 *
 * Usage: source ../../.env && node scripts/fetch-tx-fixture.mjs <txHash>
 *
 * Output: JSON object with { hash, from_address, to_address, value, logs, internal_transactions }
 */
import Moralis from 'moralis';

const txHash = process.argv[2];
if (!txHash) {
  console.error('Usage: node scripts/fetch-tx-fixture.mjs <txHash>');
  process.exit(1);
}

const apiKey = process.env.VITE_MORALIS_API_KEY;
if (!apiKey) {
  console.error('VITE_MORALIS_API_KEY not set. Run with: source ../../.env && node scripts/fetch-tx-fixture.mjs');
  process.exit(1);
}

await Moralis.start({ apiKey });

const response = await Moralis.EvmApi.transaction.getTransactionVerbose({
  transactionHash: txHash,
  chain: Moralis.EvmUtils.EvmChain.ETHEREUM,
  include: 'internal_transactions',
});

const json = response.toJSON();

const fixture = {
  hash: json.hash,
  from_address: json.from_address,
  to_address: json.to_address,
  value: json.value,
  logs: json.logs,
  internal_transactions: json.internal_transactions ?? [],
};

console.log(JSON.stringify(fixture, null, 2));
