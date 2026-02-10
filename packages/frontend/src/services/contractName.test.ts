import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchContractName, _resetForTesting } from './contractName';

function mockFetchResponse(body: object) {
  return vi.fn().mockResolvedValue({
    json: () => Promise.resolve(body),
  });
}

describe('fetchContractName', () => {
  beforeEach(() => {
    _resetForTesting();
    vi.restoreAllMocks();
  });

  it('returns contract name for verified contract', async () => {
    const fetchSpy = mockFetchResponse({
      status: '1',
      result: [{ ContractName: 'AggregationRouterV6' }],
    });
    vi.stubGlobal('fetch', fetchSpy);

    const name = await fetchContractName('0x1111111254EEB25477B68fb85Ed929f73A960582');
    expect(name).toBe('AggregationRouterV6');
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it('returns null for EOA (empty ContractName)', async () => {
    const fetchSpy = mockFetchResponse({
      status: '1',
      result: [{ ContractName: '' }],
    });
    vi.stubGlobal('fetch', fetchSpy);

    const name = await fetchContractName('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045');
    expect(name).toBeNull();
  });

  it('caches results (second call does not trigger fetch)', async () => {
    const fetchSpy = mockFetchResponse({
      status: '1',
      result: [{ ContractName: 'Pool' }],
    });
    vi.stubGlobal('fetch', fetchSpy);

    const addr = '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2';
    await fetchContractName(addr);
    const second = await fetchContractName(addr);

    expect(second).toBe('Pool');
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it('deduplicates concurrent requests for same address', async () => {
    const fetchSpy = mockFetchResponse({
      status: '1',
      result: [{ ContractName: 'WETH9' }],
    });
    vi.stubGlobal('fetch', fetchSpy);

    const addr = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
    const [a, b] = await Promise.all([
      fetchContractName(addr),
      fetchContractName(addr),
    ]);

    expect(a).toBe('WETH9');
    expect(b).toBe('WETH9');
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it('returns null on network error (graceful degradation)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const name = await fetchContractName('0x0000000000000000000000000000000000000001');
    expect(name).toBeNull();
  });

  it('returns null on API error status', async () => {
    const fetchSpy = mockFetchResponse({
      status: '0',
      result: 'Contract source code not verified',
    });
    vi.stubGlobal('fetch', fetchSpy);

    const name = await fetchContractName('0x0000000000000000000000000000000000000002');
    expect(name).toBeNull();
  });

  it('treats addresses case-insensitively for caching', async () => {
    const fetchSpy = mockFetchResponse({
      status: '1',
      result: [{ ContractName: 'TestContract' }],
    });
    vi.stubGlobal('fetch', fetchSpy);

    await fetchContractName('0xAbCdEf0000000000000000000000000000000000');
    const second = await fetchContractName('0xabcdef0000000000000000000000000000000000');

    expect(second).toBe('TestContract');
    expect(fetchSpy).toHaveBeenCalledOnce();
  });
});
