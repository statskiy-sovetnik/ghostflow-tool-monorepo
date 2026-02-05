import { useState, FormEvent } from 'react';
import { fetchTokenTransfers } from './services/moralis';
import type { TokenTransfer, TransactionResult } from './types/moralis';

type ResultState =
  | { type: 'idle' }
  | { type: 'loading' }
  | { type: 'success'; result: TransactionResult }
  | { type: 'error'; message: string };

const TX_HASH_REGEX = /^0x[a-fA-F0-9]{64}$/;

export function formatTransferAmount(amount: string, decimals: number): string {
  const divisor = BigInt(10 ** decimals);
  const raw = BigInt(amount);
  const whole = raw / divisor;
  const remainder = raw % divisor;

  if (remainder === 0n) {
    return whole.toString();
  }

  const decimalPart = remainder.toString().padStart(decimals, '0');
  const trimmed = decimalPart.replace(/0+$/, '');
  return `${whole}.${trimmed}`;
}

export function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
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

function TransferList({ transfers }: { transfers: TokenTransfer[] }) {
  if (transfers.length === 0) {
    return (
      <div className="transfers-empty">
        No token transfers found in this transaction.
      </div>
    );
  }

  return (
    <div className="transfers">
      <h3 className="transfers-title">Token Transfers ({transfers.length})</h3>
      <ul className="transfers-list">
        {transfers.map((transfer, index) => (
          <li key={`${transfer.from}-${transfer.to}-${index}`} className="transfer-item">
            <span className="transfer-index">Transfer {index + 1}</span>{' '}
            of <span className="transfer-amount">{formatTransferAmount(transfer.amount, transfer.decimals)}</span>{' '}
            <span className="transfer-token">{transfer.tokenName} ({transfer.tokenSymbol})</span>{' '}
            from <span className="transfer-address">{truncateAddress(transfer.from)}</span>{' '}
            to <span className="transfer-address">{truncateAddress(transfer.to)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
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
      const transactionResult = await fetchTokenTransfers(trimmedHash);

      if (transactionResult) {
        setResult({ type: 'success', result: transactionResult });
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

        {result.type === 'loading' && (
          <div className="result loading">
            <span className="spinner" />
            <span className="message">Checking transaction...</span>
          </div>
        )}

        {result.type === 'success' && (
          <>
            <div className="result success">
              <span className="icon">✓</span>
              <span className="message">Transaction found on Ethereum mainnet</span>
            </div>
            <TransferList transfers={result.result.transfers} />
          </>
        )}

        {result.type === 'error' && (
          <div className="result error">
            <span className="icon">✗</span>
            <span className="message">{result.message}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
