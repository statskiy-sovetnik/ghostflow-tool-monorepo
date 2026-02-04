import Moralis from 'moralis';

let initialized = false;

export async function initMoralis(): Promise<void> {
  if (initialized) {
    return;
  }

  const apiKey = import.meta.env.VITE_MORALIS_API_KEY;

  if (!apiKey) {
    throw new Error('VITE_MORALIS_API_KEY environment variable is not set');
  }

  await Moralis.start({ apiKey });
  initialized = true;
}

export async function fetchTokenTransfers(transactionHash: string) {
  await initMoralis();

  const response = await Moralis.EvmApi.transaction.getTransaction({
    transactionHash,
    chain: Moralis.EvmUtils.EvmChain.ETHEREUM,
  });

  console.log('Moralis response:', response?.toJSON());
  return response;
}

export { Moralis };
