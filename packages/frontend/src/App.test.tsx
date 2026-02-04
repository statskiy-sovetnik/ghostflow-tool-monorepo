import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App, { validateTxHash, formatTransferAmount, truncateAddress } from './App';

// Real mainnet transactions that exist
const REAL_TX_HASHES = {
  tx1: '0x4c4d15f80f7d2240dfe7d3ae7d4d0d296236ecd9285c25918dbd5bf537916728',
  tx2: '0x50539d4fa5bbe6aab765429b943ef35d8c21887e674e3eb3bc73d938174e6b2d',
};

// Fake hash - valid format but doesn't exist on chain
const FAKE_TX_HASH = '0x0000000000000000000000000000000000000000000000000000000000000001';

// Check if Alchemy API key is available for integration tests
const HAS_API_KEY = !!import.meta.env.VITE_ALCHEMY_API_KEY;
const describeIntegration = HAS_API_KEY ? describe : describe.skip;

describe('validateTxHash', () => {
  it('returns error for empty input', () => {
    expect(validateTxHash('')).toBe('Please enter a transaction hash');
  });

  it('returns error for missing 0x prefix', () => {
    expect(validateTxHash('5c504ed432cb51138bcf09aa5e8a410dd4a1e204ef84bfed1be16dfba1b22060')).toBe(
      'Transaction hash must start with 0x'
    );
  });

  it('returns error for wrong length', () => {
    expect(validateTxHash('0x5c504ed432cb51138bcf09aa5e8a')).toBe(
      'Transaction hash must be 66 characters (got 30)'
    );
  });

  it('returns error for invalid characters', () => {
    expect(validateTxHash('0xZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ')).toBe(
      'Transaction hash contains invalid characters'
    );
  });

  it('returns null for valid hash', () => {
    expect(validateTxHash(REAL_TX_HASHES.tx1)).toBeNull();
  });
});

describe('formatTransferAmount', () => {
  it('formats whole numbers without decimals', () => {
    expect(formatTransferAmount('1000000000000000000', 18)).toBe('1');
    expect(formatTransferAmount('5000000', 6)).toBe('5');
  });

  it('formats amounts with decimal places', () => {
    expect(formatTransferAmount('1500000000000000000', 18)).toBe('1.5');
    expect(formatTransferAmount('3250000000', 6)).toBe('3250');
  });

  it('trims trailing zeros from decimal part', () => {
    expect(formatTransferAmount('1100000000000000000', 18)).toBe('1.1');
  });

  it('handles zero amount', () => {
    expect(formatTransferAmount('0', 18)).toBe('0');
  });
});

describe('truncateAddress', () => {
  it('truncates address to first 6 and last 4 characters', () => {
    expect(truncateAddress('0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45')).toBe('0x68b3...Fc45');
    expect(truncateAddress('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2')).toBe('0xC02a...6Cc2');
  });
});

describe('App component', () => {
  it('renders form with input and button', () => {
    render(<App />);

    expect(screen.getByPlaceholderText('0x...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Analyze' })).toBeInTheDocument();
  });

  it('shows validation error for malformed hash without network call', async () => {
    const user = userEvent.setup();
    render(<App />);

    const input = screen.getByPlaceholderText('0x...');
    const button = screen.getByRole('button', { name: 'Analyze' });

    await user.type(input, 'invalid-hash');
    await user.click(button);

    expect(screen.getByText('Transaction hash must start with 0x')).toBeInTheDocument();
  });
});

describeIntegration('App component (integration tests with network)', () => {
  it('shows success message and transfer list for real transaction (tx1)', async () => {
    const user = userEvent.setup();
    render(<App />);

    const input = screen.getByPlaceholderText('0x...');
    const button = screen.getByRole('button', { name: 'Analyze' });

    await user.type(input, REAL_TX_HASHES.tx1);
    await user.click(button);

    await waitFor(
      () => {
        expect(screen.getByText('Transaction found on Ethereum mainnet')).toBeInTheDocument();
      },
      { timeout: 15000 }
    );

    // Check that transfer list is displayed with mock data
    expect(screen.getByText('Token Transfers (3)')).toBeInTheDocument();
    expect(screen.getByText('Transfer 1')).toBeInTheDocument();
    expect(screen.getByText('ETH')).toBeInTheDocument();
    expect(screen.getByText('WETH')).toBeInTheDocument();
    expect(screen.getByText('USDC')).toBeInTheDocument();
  }, 20000);

  it('shows success message for second real transaction (tx2)', async () => {
    const user = userEvent.setup();
    render(<App />);

    const input = screen.getByPlaceholderText('0x...');
    const button = screen.getByRole('button', { name: 'Analyze' });

    await user.type(input, REAL_TX_HASHES.tx2);
    await user.click(button);

    await waitFor(
      () => {
        expect(screen.getByText('Transaction found on Ethereum mainnet')).toBeInTheDocument();
      },
      { timeout: 15000 }
    );

    // Verify transfer list appears
    expect(screen.getByText('Token Transfers (3)')).toBeInTheDocument();
  }, 20000);

  it('shows not found error for fake hash that does not exist on chain', async () => {
    const user = userEvent.setup();
    render(<App />);

    const input = screen.getByPlaceholderText('0x...');
    const button = screen.getByRole('button', { name: 'Analyze' });

    await user.type(input, FAKE_TX_HASH);
    await user.click(button);

    await waitFor(
      () => {
        expect(screen.getByText('Transaction not found on Ethereum mainnet')).toBeInTheDocument();
      },
      { timeout: 15000 }
    );

    // Verify no transfer list appears on error
    expect(screen.queryByText('Token Transfers')).not.toBeInTheDocument();
  }, 20000);
});
