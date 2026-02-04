import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App, { validateTxHash } from './App';

// Real mainnet transactions that exist
const REAL_TX_HASHES = {
  // First ever Ethereum transaction (Vitalik's test tx from 2015)
  firstEthTx: '0x5c504ed432cb51138bcf09aa5e8a410dd4a1e204ef84bfed1be16dfba1b22060',
  // Genesis block coinbase (earliest possible tx)
  genesisReward: '0xe9e91f1ee4b56c0df2e9f06c2b8c27c6076195a88a7b8537ba8313d80e6f124e',
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
      'Transaction hash must be 66 characters (got 32)'
    );
  });

  it('returns error for invalid characters', () => {
    expect(validateTxHash('0xZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ')).toBe(
      'Transaction hash contains invalid characters'
    );
  });

  it('returns null for valid hash', () => {
    expect(validateTxHash(REAL_TX_HASHES.firstEthTx)).toBeNull();
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
  it('shows success message for real transaction (firstEthTx)', async () => {
    const user = userEvent.setup();
    render(<App />);

    const input = screen.getByPlaceholderText('0x...');
    const button = screen.getByRole('button', { name: 'Analyze' });

    await user.type(input, REAL_TX_HASHES.firstEthTx);
    await user.click(button);

    await waitFor(
      () => {
        expect(screen.getByText('Transaction found on Ethereum mainnet')).toBeInTheDocument();
      },
      { timeout: 15000 }
    );
  }, 20000);

  it('shows success message for second real transaction (genesisReward)', async () => {
    const user = userEvent.setup();
    render(<App />);

    const input = screen.getByPlaceholderText('0x...');
    const button = screen.getByRole('button', { name: 'Analyze' });

    await user.type(input, REAL_TX_HASHES.genesisReward);
    await user.click(button);

    await waitFor(
      () => {
        expect(screen.getByText('Transaction found on Ethereum mainnet')).toBeInTheDocument();
      },
      { timeout: 15000 }
    );
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
  }, 20000);
});
