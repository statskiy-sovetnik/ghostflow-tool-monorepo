/**
 * Uniswap contract addresses and event topic hashes for Ethereum mainnet.
 */

// Swap event topic0 hashes
export const UNISWAP_V2_SWAP_TOPIC0 = '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822';
export const UNISWAP_V3_SWAP_TOPIC0 = '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67';
export const UNISWAP_V4_SWAP_TOPIC0 = '0x40e9cecb9f5f1f1c5b9c97dec2917b7ee92e57ba5563708daca94dd84ad7112f';

// Router addresses
export const UNISWAP_V2_ROUTER02 = '0x7a250d5630b4cf539739df2c5dacb4c659f2488d';
export const UNISWAP_V3_SWAP_ROUTER = '0xe592427a0aece92de3edee1f18e0157c05861564';
export const UNISWAP_V3_SWAP_ROUTER_02 = '0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45';
export const UNISWAP_UNIVERSAL_ROUTER = '0x66a9893cc07d91d95644aedd05d03f95e1dba8af';

export const KNOWN_UNISWAP_ROUTERS = new Set([
  UNISWAP_V2_ROUTER02,
  UNISWAP_V3_SWAP_ROUTER,
  UNISWAP_V3_SWAP_ROUTER_02,
  UNISWAP_UNIVERSAL_ROUTER,
]);

// Core contracts
export const UNISWAP_V4_POOL_MANAGER = '0x000000000004444c5dc75cb358380d2e3de08a90';

// Factory addresses and init code hashes for CREATE2 verification
export const UNISWAP_V2_FACTORY = '0x5c69bee701ef814a2b6a3edd4b1652cb9cc5aa6f';
export const UNISWAP_V2_INIT_CODE_HASH = '0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f';

export const UNISWAP_V3_FACTORY = '0x1f98431c8ad98523631ae4a59f267346ea31f984';
export const UNISWAP_V3_INIT_CODE_HASH = '0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54';

export const V3_FEE_TIERS = [100, 500, 3000, 10000] as const;

// V3 NonfungiblePositionManager
export const UNISWAP_V3_NPM = '0xc36442b4a4522e871399cd717abdd847ab11fe88';

// Liquidity event topic0 hashes
export const V3_INCREASE_LIQUIDITY_TOPIC0 = '0x3067048beee31b25b2f1681f88dac838c8bba36af25bfb2b7cf7473a5847e35f';
export const V3_DECREASE_LIQUIDITY_TOPIC0 = '0x26f6a048ee9138f2c0ce266f322cb99228e8d619ae2bff30c67f8dcf9d2377b4';
export const V3_NPM_COLLECT_TOPIC0 = '0x40d0efd1a53d60ecbf40971b9daf7dc90178c3aadc7aab1765632738fa8b8f01';
export const V3_POOL_MINT_TOPIC0 = '0x7a53080ba414158be7ec69b987b5fb7d07dee101fe85488f0853ae16239d0bde';
export const V3_POOL_BURN_TOPIC0 = '0x0c396cd989a39f4459b5fa1aed6a9a8dcdbc45908acfd67e028cd568da98982c';
export const V2_MINT_TOPIC0 = '0x4c209b5fc8ad50758f13e2e1088ba56a560dff690a1c6fef26394f4c03821c4f';
export const V2_BURN_TOPIC0 = '0xdccd412f0b1252819cb1fd330b93224ca42612892bb3f4f789976e6d81936496';

// Tokens
export const WETH_ADDRESS = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
