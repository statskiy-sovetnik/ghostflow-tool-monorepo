const ETHERSCAN_API_KEY = import.meta.env.VITE_ETHERSCAN_API_KEY;
const RATE_LIMIT_MS = 350;

const cache = new Map<string, string | null>();
const inFlight = new Map<string, Promise<string | null>>();

let lastCallTime = 0;
const queue: Array<{ resolve: () => void }> = [];
let processing = false;

async function processQueue(): Promise<void> {
  if (processing) return;
  processing = true;

  while (queue.length > 0) {
    const elapsed = Date.now() - lastCallTime;
    if (elapsed < RATE_LIMIT_MS) {
      await new Promise((r) => setTimeout(r, RATE_LIMIT_MS - elapsed));
    }
    lastCallTime = Date.now();
    const item = queue.shift()!;
    item.resolve();
  }

  processing = false;
}

function enqueue(): Promise<void> {
  return new Promise((resolve) => {
    queue.push({ resolve });
    processQueue();
  });
}

async function callEtherscan(address: string): Promise<string | null> {
  await enqueue();

  const url = `https://api.etherscan.io/v2/api?chainid=1&module=contract&action=getsourcecode&address=${address}&apikey=${ETHERSCAN_API_KEY}`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    return null;
  }

  let data: { status: string; result: string | Array<{ ContractName: string }> };
  try {
    data = await response.json();
  } catch {
    return null;
  }

  if (data.status === '1' && Array.isArray(data.result) && data.result.length > 0) {
    const name = data.result[0].ContractName;
    return name || null;
  }

  if (data.status === '0' && typeof data.result === 'string') {
    if (data.result.toLowerCase().includes('rate limit')) {
      // Don't cache — caller should retry
      throw new RateLimitError();
    }
  }

  // EOA, unverified, or other error — cache as null
  return null;
}

class RateLimitError extends Error {
  constructor() {
    super('Rate limited');
  }
}

export async function fetchContractName(address: string): Promise<string | null> {
  const key = address.toLowerCase();

  if (cache.has(key)) {
    return cache.get(key)!;
  }

  if (inFlight.has(key)) {
    return inFlight.get(key)!;
  }

  const promise = callEtherscan(address)
    .then((name) => {
      cache.set(key, name);
      inFlight.delete(key);
      return name;
    })
    .catch((err) => {
      inFlight.delete(key);
      if (err instanceof RateLimitError) {
        // Don't cache, allow retry
        return null;
      }
      return null;
    });

  inFlight.set(key, promise);
  return promise;
}

/** Exposed for testing only */
export function _resetForTesting(): void {
  cache.clear();
  inFlight.clear();
  lastCallTime = 0;
  queue.length = 0;
  processing = false;
}
