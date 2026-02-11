/**
 * Fetches full Moralis transaction data (logs + internal txs) for a given hash
 * and outputs a focused fixture object suitable for parser tests.
 *
 * Usage: source ../../.env && node scripts/fetch-tx-fixture.mjs <txHash>
 *
 * Output: JSON object with { hash, from_address, to_address, value, logs, internal_transactions }
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Moralis from 'moralis';

const txHash = process.argv[2];
if (!txHash) {
  console.error('Usage: node scripts/fetch-tx-fixture.mjs <txHash>');
  process.exit(1);
}

// Auto-load .env from monorepo root
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../../../.env');
try {
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
} catch {
  // .env file not found, rely on existing environment
}

const apiKey = process.env.VITE_MORALIS_API_KEY;
if (!apiKey) {
  console.error('VITE_MORALIS_API_KEY not set. Create a .env file in the monorepo root.');
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
