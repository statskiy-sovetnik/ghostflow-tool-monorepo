import { useState, FormEvent } from 'react';
import { fetchTokenTransfers } from './services/moralis';
import type { TokenTransfer, TransactionResult, AaveSupplyOperation, AaveBorrowOperation, AaveRepayOperation, NativeTransfer, FlowItem } from './types/moralis';

type ResultState =
  | { type: 'idle' }
  | { type: 'loading' }
  | { type: 'success'; result: TransactionResult }
  | { type: 'error'; message: string };

const TX_HASH_REGEX = /^0x[a-fA-F0-9]{64}$/;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

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

export function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return `${str.slice(0, maxLength)}...`;
}

export function isMint(transfer: TokenTransfer): boolean {
  return transfer.from.toLowerCase() === ZERO_ADDRESS;
}

export function isBurn(transfer: TokenTransfer): boolean {
  return transfer.to.toLowerCase() === ZERO_ADDRESS;
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

function TransferItem({ transfer }: { transfer: TokenTransfer }) {
  const amount = formatTransferAmount(transfer.amount, transfer.decimals);
  const tokenName = truncateString(transfer.tokenName, 11);
  const tokenSymbol = truncateString(transfer.tokenSymbol, 8);

  const tokenDisplay = (
    <span className="transfer-token">
      {transfer.tokenLogo && (
        <img src={transfer.tokenLogo} alt="" className="token-logo" />
      )}
      {tokenName} ({tokenSymbol})
    </span>
  );

  if (isMint(transfer)) {
    return (
      <li className="transfer-item">
        <span className="transfer-index">Mint</span>{' '}
        of <span className="transfer-amount">{amount}</span>{' '}
        {tokenDisplay}{' '}
        to <span className="transfer-address">{truncateAddress(transfer.to)}</span>
      </li>
    );
  }

  if (isBurn(transfer)) {
    return (
      <li className="transfer-item">
        <span className="transfer-index">Burn</span>{' '}
        of <span className="transfer-amount">{amount}</span>{' '}
        {tokenDisplay}{' '}
        from <span className="transfer-address">{truncateAddress(transfer.from)}</span>
      </li>
    );
  }

  return (
    <li className="transfer-item">
      <span className="transfer-index">Transfer</span>{' '}
      of <span className="transfer-amount">{amount}</span>{' '}
      {tokenDisplay}{' '}
      from <span className="transfer-address">{truncateAddress(transfer.from)}</span>{' '}
      to <span className="transfer-address">{truncateAddress(transfer.to)}</span>
    </li>
  );
}

function AaveSupplyItem({ operation }: { operation: AaveSupplyOperation }) {
  const amount = formatTransferAmount(operation.amount, operation.decimals);
  const tokenName = truncateString(operation.assetName, 11);
  const tokenSymbol = truncateString(operation.assetSymbol, 8);

  return (
    <li className="operation-item aave-supply">
      <span className="transfer-address">{truncateAddress(operation.supplier)}</span>{' '}
      <span className="operation-type">Supplied</span>{' '}
      <span className="transfer-amount">{amount}</span>{' '}
      of <span className="transfer-token">
        {operation.assetLogo && (
          <img src={operation.assetLogo} alt="" className="token-logo" />
        )}
        {tokenName} ({tokenSymbol})
      </span>{' '}
      on <span className="protocol-name">Aave V3</span>
      {operation.onBehalfOf && (
        <>
          {' '}on behalf of{' '}
          <span className="transfer-address">{truncateAddress(operation.onBehalfOf)}</span>
        </>
      )}
    </li>
  );
}

function AaveBorrowItem({ operation }: { operation: AaveBorrowOperation }) {
  const amount = formatTransferAmount(operation.amount, operation.decimals);
  const tokenName = truncateString(operation.assetName, 11);
  const tokenSymbol = truncateString(operation.assetSymbol, 8);

  return (
    <li className="operation-item aave-borrow">
      <span className="transfer-address">{truncateAddress(operation.borrower)}</span>{' '}
      <span className="operation-type aave-borrow-badge">Borrowed</span>{' '}
      <span className="transfer-amount">{amount}</span>{' '}
      of <span className="transfer-token">
        {operation.assetLogo && (
          <img src={operation.assetLogo} alt="" className="token-logo" />
        )}
        {tokenName} ({tokenSymbol})
      </span>{' '}
      on <span className="protocol-name">Aave V3</span>
    </li>
  );
}

function AaveRepayItem({ operation }: { operation: AaveRepayOperation }) {
  const amount = formatTransferAmount(operation.amount, operation.decimals);
  const tokenName = truncateString(operation.assetName, 11);
  const tokenSymbol = truncateString(operation.assetSymbol, 8);

  return (
    <li className="operation-item aave-repay">
      <span className="transfer-address">{truncateAddress(operation.repayer)}</span>{' '}
      <span className="operation-type aave-repay-badge">Repaid</span>{' '}
      <span className="transfer-amount">{amount}</span>{' '}
      of <span className="transfer-token">
        {operation.assetLogo && (
          <img src={operation.assetLogo} alt="" className="token-logo" />
        )}
        {tokenName} ({tokenSymbol})
      </span>{' '}
      on <span className="protocol-name">Aave V3</span>
      {operation.onBehalfOf && (
        <>
          {' '}on behalf of{' '}
          <span className="transfer-address">{truncateAddress(operation.onBehalfOf)}</span>
        </>
      )}
    </li>
  );
}

function NativeTransferItem({ transfer }: { transfer: NativeTransfer }) {
  const amount = formatTransferAmount(transfer.amount, 18);

  return (
    <li className="native-transfer-item">
      <span className="native-transfer-badge">ETH Transfer</span>{' '}
      of <span className="transfer-amount">{amount}</span>{' '}
      <span className="native-token-label">Ξ ETH</span>{' '}
      from <span className="transfer-address">{truncateAddress(transfer.from)}</span>{' '}
      to <span className="transfer-address">{truncateAddress(transfer.to)}</span>
    </li>
  );
}

function TokenFlow({ flow }: { flow: FlowItem[] }) {
  if (flow.length === 0) {
    return (
      <div className="transfers-empty">
        No token transfers found in this transaction.
      </div>
    );
  }

  return (
    <div className="token-flow">
      <h3 className="token-flow-title">Token Flow ({flow.length})</h3>
      <ul className="token-flow-list">
        {flow.map((item, index) => {
          if (item.kind === 'operation') {
            if (item.data.type === 'aave-supply') {
              return <AaveSupplyItem key={index} operation={item.data as AaveSupplyOperation} />;
            }
            if (item.data.type === 'aave-borrow') {
              return <AaveBorrowItem key={index} operation={item.data as AaveBorrowOperation} />;
            }
            if (item.data.type === 'aave-repay') {
              return <AaveRepayItem key={index} operation={item.data as AaveRepayOperation} />;
            }
            return null;
          }
          if (item.kind === 'native-transfer') {
            return <NativeTransferItem key={index} transfer={item.data} />;
          }
          return <TransferItem key={index} transfer={item.data as TokenTransfer} />;
        })}
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
          <label className="input-label">Enter transaction hash</label>
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
            <TokenFlow flow={result.result.flow} />
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
