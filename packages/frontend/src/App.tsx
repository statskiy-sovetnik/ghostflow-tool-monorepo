import { useState, FormEvent } from 'react';
import { JsonRpcProvider } from 'ethers';

type ResultState =
  | { type: 'idle' }
  | { type: 'loading' }
  | { type: 'success'; message: string }
  | { type: 'error'; message: string };

const TX_HASH_REGEX = /^0x[a-fA-F0-9]{64}$/;
const ALCHEMY_RPC_URL = `https://eth-mainnet.g.alchemy.com/v2/${import.meta.env.VITE_ALCHEMY_API_KEY}`;
const FALLBACK_RPC_URL = 'https://eth.llamarpc.com';

async function fetchTransactionReceipt(hash: string) {
  try {
    const provider = new JsonRpcProvider(ALCHEMY_RPC_URL);
    return await provider.getTransactionReceipt(hash);
  } catch {
    const fallbackProvider = new JsonRpcProvider(FALLBACK_RPC_URL);
    return await fallbackProvider.getTransactionReceipt(hash);
  }
}

export function validateTxHash(hash: string): string | null {
  if (!hash) {
    return 'Please enter a transaction hash';
  }
  if (!hash.startsWith('0x')) {
    return 'Transaction hash must start with 0x';
  }
  if (hash.length !== 66) {
    return `Transaction hash must be 66 characters (got ${hash.length})`;
  }
  if (!TX_HASH_REGEX.test(hash)) {
    return 'Transaction hash contains invalid characters';
  }
  return null;
}

function App() {
  const [txHash, setTxHash] = useState('');
  const [result, setResult] = useState<ResultState>({ type: 'idle' });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const trimmedHash = txHash.trim();
    const validationError = validateTxHash(trimmedHash);

    if (validationError) {
      setResult({ type: 'error', message: validationError });
      return;
    }

    setResult({ type: 'loading' });

    try {
      const receipt = await fetchTransactionReceipt(trimmedHash);

      if (receipt) {
        setResult({ type: 'success', message: 'Transaction found on Ethereum mainnet' });
      } else {
        setResult({ type: 'error', message: 'Transaction not found on Ethereum mainnet' });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error occurred';
      setResult({ type: 'error', message: `Failed to fetch transaction: ${message}` });
    }
  };

  return (
    <div className="container">
      <div className="card">
        <header className="header">
          <h1 className="title">GhostFlow</h1>
          <p className="subtitle">Ethereum Transaction Analyzer</p>
          <p className="network-note">Ethereum mainnet only</p>
        </header>

        <form onSubmit={handleSubmit} className="form">
          <input
            type="text"
            value={txHash}
            onChange={(e) => setTxHash(e.target.value)}
            placeholder="0x..."
            className="input"
            spellCheck={false}
            autoComplete="off"
          />
          <button type="submit" className="button" disabled={result.type === 'loading'}>
            {result.type === 'loading' ? 'Analyzing...' : 'Analyze'}
          </button>
        </form>

        {result.type !== 'idle' && (
          <div className={`result ${result.type}`}>
            {result.type === 'loading' && <span className="spinner" />}
            {result.type === 'success' && <span className="icon">✓</span>}
            {result.type === 'error' && <span className="icon">✗</span>}
            {result.type !== 'loading' && <span className="message">{result.message}</span>}
            {result.type === 'loading' && <span className="message">Checking transaction...</span>}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
