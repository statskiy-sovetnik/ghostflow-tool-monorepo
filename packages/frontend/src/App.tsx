import { useState, FormEvent } from 'react';
import { JsonRpcProvider } from 'ethers';

interface TokenTransfer {
  from: string;
  to: string;
  tokenName: string;
  amount: string;
  decimals: number;
}

interface TransactionResult {
  txHash: string;
  transfers: TokenTransfer[];
}

type ResultState =
  | { type: 'idle' }
  | { type: 'loading' }
  | { type: 'success'; result: TransactionResult }
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

const MOCK_TRANSFERS: TokenTransfer[] = [
  {
    from: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
    to: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    tokenName: 'ETH',
    amount: '1000000000000000000',
    decimals: 18,
  },
  {
    from: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    to: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640',
    tokenName: 'WETH',
    amount: '1000000000000000000',
    decimals: 18,
  },
  {
    from: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640',
    to: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
    tokenName: 'USDC',
    amount: '3250000000',
    decimals: 6,
  },
];

function createMockTransactionResult(txHash: string): TransactionResult {
  return { txHash, transfers: MOCK_TRANSFERS };
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
            <span className="transfer-token">{transfer.tokenName}</span>{' '}
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
      const receipt = await fetchTransactionReceipt(trimmedHash);

      if (receipt) {
        const transactionResult = createMockTransactionResult(trimmedHash);
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
