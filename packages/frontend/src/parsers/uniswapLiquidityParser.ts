import { keccak256, solidityPacked, AbiCoder, getAddress } from 'ethers';
import type {
  MoralisTransactionLog,
  TokenTransfer,
  NativeTransfer,
  UniswapLiquidityResult,
  UniswapAddLiquidityOperation,
  UniswapRemoveLiquidityOperation,
  UniswapCollectFeesOperation,
  UniswapLiquidityToken,
} from '../types/moralis';
import { extractAddressFromTopic } from './utils';
import {
  UNISWAP_V3_NPM,
  V3_INCREASE_LIQUIDITY_TOPIC0,
  V3_DECREASE_LIQUIDITY_TOPIC0,
  V3_NPM_COLLECT_TOPIC0,
  V3_POOL_MINT_TOPIC0,
  V3_POOL_BURN_TOPIC0,
  V2_MINT_TOPIC0,
  V2_BURN_TOPIC0,
  UNISWAP_V2_FACTORY,
  UNISWAP_V2_INIT_CODE_HASH,
  UNISWAP_V3_FACTORY,
  UNISWAP_V3_INIT_CODE_HASH,
  V3_FEE_TIERS,
  KNOWN_UNISWAP_ROUTERS,
  WETH_ADDRESS,
} from './uniswapConstants';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

function computeCreate2Address(deployer: string, salt: string, initCodeHash: string): string {
  const packed = solidityPacked(
    ['bytes1', 'address', 'bytes32', 'bytes32'],
    ['0xff', deployer, salt, initCodeHash],
  );
  return '0x' + keccak256(packed).slice(-40);
}

function sortTokens(a: string, b: string): [string, string] {
  const addrA = getAddress(a);
  const addrB = getAddress(b);
  return BigInt(addrA) < BigInt(addrB) ? [addrA, addrB] : [addrB, addrA];
}

function verifyV2Pair(pairAddress: string, tokenA: string, tokenB: string): boolean {
  const [token0, token1] = sortTokens(tokenA, tokenB);
  const salt = keccak256(solidityPacked(['address', 'address'], [token0, token1]));
  const computed = computeCreate2Address(UNISWAP_V2_FACTORY, salt, UNISWAP_V2_INIT_CODE_HASH);
  return computed.toLowerCase() === pairAddress.toLowerCase();
}

function verifyV3Pool(poolAddress: string, tokenA: string, tokenB: string): boolean {
  const [token0, token1] = sortTokens(tokenA, tokenB);
  const abiCoder = AbiCoder.defaultAbiCoder();
  for (const fee of V3_FEE_TIERS) {
    const salt = keccak256(abiCoder.encode(['address', 'address', 'uint24'], [token0, token1, fee]));
    const computed = computeCreate2Address(UNISWAP_V3_FACTORY, salt, UNISWAP_V3_INIT_CODE_HASH);
    if (computed.toLowerCase() === poolAddress.toLowerCase()) return true;
  }
  return false;
}

function makeToken(transfer: TokenTransfer, isNative?: boolean): UniswapLiquidityToken {
  return {
    address: transfer.tokenAddress,
    symbol: isNative ? 'ETH' : transfer.tokenSymbol,
    name: isNative ? 'Ether' : transfer.tokenName,
    logo: isNative ? null : transfer.tokenLogo,
    decimals: transfer.decimals,
    amount: isNative ? transfer.amount : transfer.amount,
    isNative: isNative || undefined,
  };
}

function makeZeroToken(): UniswapLiquidityToken {
  return {
    address: ZERO_ADDRESS,
    symbol: '???',
    name: 'Unknown',
    logo: null,
    decimals: 18,
    amount: '0',
  };
}

/**
 * Finds the closest transfer matching criteria by logIndex distance from an anchor.
 * direction: 'before' means transfer.logIndex <= anchorLogIndex
 *            'after' means transfer.logIndex >= anchorLogIndex
 */
function findClosestTransfer(
  transfers: TokenTransfer[],
  anchorLogIndex: number,
  direction: 'before' | 'after',
  predicate: (t: TokenTransfer) => boolean,
  excludeIndices: Set<number>,
): { index: number; transfer: TokenTransfer } | null {
  let bestIdx = -1;
  let bestDist = Infinity;

  for (let i = 0; i < transfers.length; i++) {
    if (excludeIndices.has(i)) continue;
    const t = transfers[i];
    if (!predicate(t)) continue;

    if (direction === 'before' && t.logIndex > anchorLogIndex) continue;
    if (direction === 'after' && t.logIndex < anchorLogIndex) continue;

    const dist = Math.abs(t.logIndex - anchorLogIndex);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }

  return bestIdx !== -1 ? { index: bestIdx, transfer: transfers[bestIdx] } : null;
}

// ─── V3 Add Liquidity ─────────────────────────────────────────────────

function detectV3AddLiquidity(
  logs: MoralisTransactionLog[],
  transfers: TokenTransfer[],
  nativeTransfers: NativeTransfer[],
  txFrom: string,
): { operations: UniswapAddLiquidityOperation[]; indicesToRemove: number[]; nativeToConsume: Array<{ from: string; to: string; value: string }> } {
  const operations: UniswapAddLiquidityOperation[] = [];
  const indicesToRemove: number[] = [];
  const nativeToConsume: Array<{ from: string; to: string; value: string }> = [];
  const usedIndices = new Set<number>();

  // Find IncreaseLiquidity events from NPM
  for (const log of logs) {
    if (log.topic0 !== V3_INCREASE_LIQUIDITY_TOPIC0) continue;
    if (log.address.toLowerCase() !== UNISWAP_V3_NPM) continue;

    const anchorLogIndex = parseInt(log.log_index);

    // Find the nearby Pool Mint event to identify the pool
    let poolAddress: string | null = null;
    let bestPoolDist = Infinity;
    for (const pLog of logs) {
      if (pLog.topic0 !== V3_POOL_MINT_TOPIC0) continue;
      const pLogIndex = parseInt(pLog.log_index);
      const dist = Math.abs(pLogIndex - anchorLogIndex);
      if (dist < bestPoolDist) {
        bestPoolDist = dist;
        poolAddress = pLog.address.toLowerCase();
      }
    }

    if (!poolAddress) continue;

    // Find token transfers TO the pool (user → pool) before the anchor
    const poolLower = poolAddress.toLowerCase();
    const token0Match = findClosestTransfer(transfers, anchorLogIndex, 'before',
      (t) => t.to.toLowerCase() === poolLower, usedIndices);

    let token1Match: { index: number; transfer: TokenTransfer } | null = null;
    if (token0Match) {
      const exclude = new Set(usedIndices);
      exclude.add(token0Match.index);
      token1Match = findClosestTransfer(transfers, anchorLogIndex, 'before',
        (t) => t.to.toLowerCase() === poolLower && t.tokenAddress.toLowerCase() !== token0Match.transfer.tokenAddress.toLowerCase(),
        exclude);
    }

    if (!token0Match && !token1Match) continue;

    // Verify pool via CREATE2
    const tokenAddrs: string[] = [];
    if (token0Match) tokenAddrs.push(token0Match.transfer.tokenAddress);
    if (token1Match) tokenAddrs.push(token1Match.transfer.tokenAddress);

    if (tokenAddrs.length === 2) {
      if (!verifyV3Pool(poolAddress, tokenAddrs[0], tokenAddrs[1])) continue;
    }
    // For one-sided liquidity (1 token), we can't fully verify via CREATE2
    // but the NPM address check is sufficient

    const provider = token0Match
      ? token0Match.transfer.from.toLowerCase()
      : token1Match!.transfer.from.toLowerCase();

    // Check for WETH/ETH wrapping
    let token0IsNative = false;
    let token1IsNative = false;

    if (token0Match && token0Match.transfer.tokenAddress.toLowerCase() === WETH_ADDRESS) {
      const nativeIn = nativeTransfers.find(
        (nt) => nt.from.toLowerCase() === txFrom.toLowerCase() &&
          KNOWN_UNISWAP_ROUTERS.has(nt.to.toLowerCase()),
      );
      if (nativeIn) {
        token0IsNative = true;
        nativeToConsume.push({ from: nativeIn.from, to: nativeIn.to, value: nativeIn.amount });
      }
    }
    if (token1Match && token1Match.transfer.tokenAddress.toLowerCase() === WETH_ADDRESS) {
      const nativeIn = nativeTransfers.find(
        (nt) => nt.from.toLowerCase() === txFrom.toLowerCase() &&
          KNOWN_UNISWAP_ROUTERS.has(nt.to.toLowerCase()),
      );
      if (nativeIn && !token0IsNative) {
        token1IsNative = true;
        nativeToConsume.push({ from: nativeIn.from, to: nativeIn.to, value: nativeIn.amount });
      }
    }

    const t0 = token0Match ? makeToken(token0Match.transfer, token0IsNative) : makeZeroToken();
    const t1 = token1Match ? makeToken(token1Match.transfer, token1IsNative) : makeZeroToken();

    operations.push({
      type: 'uniswap-add-liquidity',
      logIndex: anchorLogIndex,
      version: 'v3',
      token0: t0,
      token1: t1,
      provider,
    });

    if (token0Match) { indicesToRemove.push(token0Match.index); usedIndices.add(token0Match.index); }
    if (token1Match) { indicesToRemove.push(token1Match.index); usedIndices.add(token1Match.index); }
  }

  return { operations, indicesToRemove, nativeToConsume };
}

// ─── V3 Remove Liquidity ──────────────────────────────────────────────

function detectV3RemoveLiquidity(
  logs: MoralisTransactionLog[],
  transfers: TokenTransfer[],
  nativeTransfers: NativeTransfer[],
  txFrom: string,
): {
  operations: UniswapRemoveLiquidityOperation[];
  indicesToRemove: number[];
  nativeToConsume: Array<{ from: string; to: string; value: string }>;
  decreaseTokenIds: Set<string>;
} {
  const operations: UniswapRemoveLiquidityOperation[] = [];
  const indicesToRemove: number[] = [];
  const nativeToConsume: Array<{ from: string; to: string; value: string }> = [];
  const usedIndices = new Set<number>();
  const decreaseTokenIds = new Set<string>();

  for (const log of logs) {
    if (log.topic0 !== V3_DECREASE_LIQUIDITY_TOPIC0) continue;
    if (log.address.toLowerCase() !== UNISWAP_V3_NPM) continue;

    const anchorLogIndex = parseInt(log.log_index);
    const tokenId = log.topic1 ?? '';
    decreaseTokenIds.add(tokenId);

    // Find the nearby Pool Burn event to identify the pool
    let poolAddress: string | null = null;
    let bestPoolDist = Infinity;
    for (const pLog of logs) {
      if (pLog.topic0 !== V3_POOL_BURN_TOPIC0) continue;
      const pLogIndex = parseInt(pLog.log_index);
      const dist = Math.abs(pLogIndex - anchorLogIndex);
      if (dist < bestPoolDist) {
        bestPoolDist = dist;
        poolAddress = pLog.address.toLowerCase();
      }
    }

    if (!poolAddress) continue;

    // For V3 remove: pool → NPM → user transfer pattern
    // First find pool → NPM transfers after the anchor
    const npmLower = UNISWAP_V3_NPM;
    const poolLower = poolAddress;

    const poolToNpm0 = findClosestTransfer(transfers, anchorLogIndex, 'after',
      (t) => t.from.toLowerCase() === poolLower && t.to.toLowerCase() === npmLower,
      usedIndices);

    let poolToNpm1: { index: number; transfer: TokenTransfer } | null = null;
    if (poolToNpm0) {
      const exclude = new Set(usedIndices);
      exclude.add(poolToNpm0.index);
      poolToNpm1 = findClosestTransfer(transfers, anchorLogIndex, 'after',
        (t) => t.from.toLowerCase() === poolLower && t.to.toLowerCase() === npmLower &&
          t.tokenAddress.toLowerCase() !== poolToNpm0.transfer.tokenAddress.toLowerCase(),
        exclude);
    }

    // Then find NPM → user transfers
    const npmToUser0 = findClosestTransfer(transfers, anchorLogIndex, 'after',
      (t) => t.from.toLowerCase() === npmLower && t.to.toLowerCase() !== poolLower,
      usedIndices);

    let npmToUser1: { index: number; transfer: TokenTransfer } | null = null;
    if (npmToUser0) {
      const exclude = new Set(usedIndices);
      exclude.add(npmToUser0.index);
      npmToUser1 = findClosestTransfer(transfers, anchorLogIndex, 'after',
        (t) => t.from.toLowerCase() === npmLower && t.to.toLowerCase() !== poolLower &&
          t.tokenAddress.toLowerCase() !== npmToUser0.transfer.tokenAddress.toLowerCase(),
        exclude);
    }

    // Use NPM→user transfers for display (what the user actually receives)
    // Consume pool→NPM transfers too
    const displayTransfers = [npmToUser0, npmToUser1].filter(Boolean) as { index: number; transfer: TokenTransfer }[];
    const poolTransfers = [poolToNpm0, poolToNpm1].filter(Boolean) as { index: number; transfer: TokenTransfer }[];

    if (displayTransfers.length === 0) continue;

    // Verify pool via CREATE2 using pool→NPM transfer tokens
    if (poolTransfers.length >= 2) {
      if (!verifyV3Pool(poolAddress, poolTransfers[0].transfer.tokenAddress, poolTransfers[1].transfer.tokenAddress)) continue;
    } else if (poolTransfers.length === 1 && displayTransfers.length >= 1) {
      // One-sided — can't fully verify but NPM check is sufficient
    }

    const recipient = displayTransfers[0].transfer.to.toLowerCase();

    // Check for WETH unwrap (NPM sends WETH, then native ETH to user)
    let token0IsNative = false;
    let token1IsNative = false;
    if (displayTransfers[0] && displayTransfers[0].transfer.tokenAddress.toLowerCase() === WETH_ADDRESS) {
      const nativeOut = nativeTransfers.find(
        (nt) => nt.to.toLowerCase() === recipient && nt.from.toLowerCase() === npmLower,
      );
      if (nativeOut) {
        token0IsNative = true;
        nativeToConsume.push({ from: nativeOut.from, to: nativeOut.to, value: nativeOut.amount });
      }
    }
    if (displayTransfers[1] && displayTransfers[1].transfer.tokenAddress.toLowerCase() === WETH_ADDRESS) {
      const nativeOut = nativeTransfers.find(
        (nt) => nt.to.toLowerCase() === recipient && nt.from.toLowerCase() === npmLower,
      );
      if (nativeOut && !token0IsNative) {
        token1IsNative = true;
        nativeToConsume.push({ from: nativeOut.from, to: nativeOut.to, value: nativeOut.amount });
      }
    }

    const t0 = displayTransfers[0] ? makeToken(displayTransfers[0].transfer, token0IsNative) : makeZeroToken();
    const t1 = displayTransfers[1] ? makeToken(displayTransfers[1].transfer, token1IsNative) : makeZeroToken();

    operations.push({
      type: 'uniswap-remove-liquidity',
      logIndex: anchorLogIndex,
      version: 'v3',
      token0: t0,
      token1: t1,
      recipient,
    });

    for (const m of [...displayTransfers, ...poolTransfers]) {
      indicesToRemove.push(m.index);
      usedIndices.add(m.index);
    }
  }

  return { operations, indicesToRemove, nativeToConsume, decreaseTokenIds };
}

// ─── V3 Collect Fees ──────────────────────────────────────────────────

function detectV3CollectFees(
  logs: MoralisTransactionLog[],
  transfers: TokenTransfer[],
  nativeTransfers: NativeTransfer[],
  txFrom: string,
  decreaseTokenIds: Set<string>,
  alreadyUsedIndices: Set<number>,
): { operations: UniswapCollectFeesOperation[]; indicesToRemove: number[]; nativeToConsume: Array<{ from: string; to: string; value: string }> } {
  const operations: UniswapCollectFeesOperation[] = [];
  const indicesToRemove: number[] = [];
  const nativeToConsume: Array<{ from: string; to: string; value: string }> = [];
  const usedIndices = new Set(alreadyUsedIndices);

  for (const log of logs) {
    if (log.topic0 !== V3_NPM_COLLECT_TOPIC0) continue;
    if (log.address.toLowerCase() !== UNISWAP_V3_NPM) continue;

    const tokenId = log.topic1 ?? '';
    // Skip Collect events associated with a DecreaseLiquidity
    if (decreaseTokenIds.has(tokenId)) continue;

    const anchorLogIndex = parseInt(log.log_index);
    const npmLower = UNISWAP_V3_NPM;

    // Find NPM → user transfers after the anchor
    const npmToUser0 = findClosestTransfer(transfers, anchorLogIndex, 'after',
      (t) => t.from.toLowerCase() === npmLower,
      usedIndices);

    let npmToUser1: { index: number; transfer: TokenTransfer } | null = null;
    if (npmToUser0) {
      const exclude = new Set(usedIndices);
      exclude.add(npmToUser0.index);
      npmToUser1 = findClosestTransfer(transfers, anchorLogIndex, 'after',
        (t) => t.from.toLowerCase() === npmLower &&
          t.tokenAddress.toLowerCase() !== npmToUser0.transfer.tokenAddress.toLowerCase(),
        exclude);
    }

    // Also consume pool → NPM transfers (pool sends to NPM during collect)
    const poolToNpm: { index: number; transfer: TokenTransfer }[] = [];
    for (let i = 0; i < transfers.length; i++) {
      if (usedIndices.has(i)) continue;
      const t = transfers[i];
      if (t.to.toLowerCase() === npmLower && t.logIndex >= anchorLogIndex - 5 && t.logIndex <= anchorLogIndex + 5) {
        // Check it's not from NPM itself
        if (t.from.toLowerCase() !== npmLower) {
          poolToNpm.push({ index: i, transfer: t });
        }
      }
    }

    const displayTransfers = [npmToUser0, npmToUser1].filter(Boolean) as { index: number; transfer: TokenTransfer }[];
    if (displayTransfers.length === 0) continue;

    const collector = displayTransfers[0].transfer.to.toLowerCase();

    const t0 = displayTransfers[0] ? makeToken(displayTransfers[0].transfer) : makeZeroToken();
    const t1 = displayTransfers[1] ? makeToken(displayTransfers[1].transfer) : makeZeroToken();

    operations.push({
      type: 'uniswap-collect-fees',
      logIndex: anchorLogIndex,
      version: 'v3',
      token0: t0,
      token1: t1,
      collector,
    });

    for (const m of [...displayTransfers, ...poolToNpm]) {
      indicesToRemove.push(m.index);
      usedIndices.add(m.index);
    }
  }

  return { operations, indicesToRemove, nativeToConsume };
}

// ─── V2 Add Liquidity ─────────────────────────────────────────────────

function detectV2AddLiquidity(
  logs: MoralisTransactionLog[],
  transfers: TokenTransfer[],
  nativeTransfers: NativeTransfer[],
  txFrom: string,
): { operations: UniswapAddLiquidityOperation[]; indicesToRemove: number[]; nativeToConsume: Array<{ from: string; to: string; value: string }> } {
  const operations: UniswapAddLiquidityOperation[] = [];
  const indicesToRemove: number[] = [];
  const nativeToConsume: Array<{ from: string; to: string; value: string }> = [];
  const usedIndices = new Set<number>();

  for (const log of logs) {
    if (log.topic0 !== V2_MINT_TOPIC0) continue;

    const pairAddress = log.address.toLowerCase();
    const anchorLogIndex = parseInt(log.log_index);

    // Find token transfers TO the pair before the anchor
    const token0Match = findClosestTransfer(transfers, anchorLogIndex, 'before',
      (t) => t.to.toLowerCase() === pairAddress && t.from.toLowerCase() !== ZERO_ADDRESS,
      usedIndices);

    let token1Match: { index: number; transfer: TokenTransfer } | null = null;
    if (token0Match) {
      const exclude = new Set(usedIndices);
      exclude.add(token0Match.index);
      token1Match = findClosestTransfer(transfers, anchorLogIndex, 'before',
        (t) => t.to.toLowerCase() === pairAddress && t.from.toLowerCase() !== ZERO_ADDRESS &&
          t.tokenAddress.toLowerCase() !== token0Match.transfer.tokenAddress.toLowerCase(),
        exclude);
    }

    if (!token0Match) continue;

    // Verify pair via CREATE2
    if (token1Match) {
      if (!verifyV2Pair(pairAddress, token0Match.transfer.tokenAddress, token1Match.transfer.tokenAddress)) continue;
    } else {
      // Can't verify with one token — skip
      continue;
    }

    // Find LP token mint (from 0x0 to user, where tokenAddress = pair address)
    const lpMint = findClosestTransfer(transfers, anchorLogIndex, 'after',
      (t) => t.from.toLowerCase() === ZERO_ADDRESS && t.tokenAddress.toLowerCase() === pairAddress,
      usedIndices);

    const provider = token0Match.transfer.from.toLowerCase();

    // Check for WETH/ETH wrapping via router
    let token0IsNative = false;
    let token1IsNative = false;
    if (token0Match.transfer.tokenAddress.toLowerCase() === WETH_ADDRESS) {
      const nativeIn = nativeTransfers.find(
        (nt) => nt.from.toLowerCase() === txFrom.toLowerCase() &&
          KNOWN_UNISWAP_ROUTERS.has(nt.to.toLowerCase()),
      );
      if (nativeIn) {
        token0IsNative = true;
        nativeToConsume.push({ from: nativeIn.from, to: nativeIn.to, value: nativeIn.amount });
      }
    }
    if (token1Match && token1Match.transfer.tokenAddress.toLowerCase() === WETH_ADDRESS) {
      const nativeIn = nativeTransfers.find(
        (nt) => nt.from.toLowerCase() === txFrom.toLowerCase() &&
          KNOWN_UNISWAP_ROUTERS.has(nt.to.toLowerCase()),
      );
      if (nativeIn && !token0IsNative) {
        token1IsNative = true;
        nativeToConsume.push({ from: nativeIn.from, to: nativeIn.to, value: nativeIn.amount });
      }
    }

    const t0 = makeToken(token0Match.transfer, token0IsNative);
    const t1 = token1Match ? makeToken(token1Match.transfer, token1IsNative) : makeZeroToken();

    operations.push({
      type: 'uniswap-add-liquidity',
      logIndex: anchorLogIndex,
      version: 'v2',
      token0: t0,
      token1: t1,
      provider,
    });

    indicesToRemove.push(token0Match.index); usedIndices.add(token0Match.index);
    if (token1Match) { indicesToRemove.push(token1Match.index); usedIndices.add(token1Match.index); }
    if (lpMint) { indicesToRemove.push(lpMint.index); usedIndices.add(lpMint.index); }
  }

  return { operations, indicesToRemove, nativeToConsume };
}

// ─── V2 Remove Liquidity ──────────────────────────────────────────────

function detectV2RemoveLiquidity(
  logs: MoralisTransactionLog[],
  transfers: TokenTransfer[],
  nativeTransfers: NativeTransfer[],
  txFrom: string,
): { operations: UniswapRemoveLiquidityOperation[]; indicesToRemove: number[]; nativeToConsume: Array<{ from: string; to: string; value: string }> } {
  const operations: UniswapRemoveLiquidityOperation[] = [];
  const indicesToRemove: number[] = [];
  const nativeToConsume: Array<{ from: string; to: string; value: string }> = [];
  const usedIndices = new Set<number>();

  for (const log of logs) {
    if (log.topic0 !== V2_BURN_TOPIC0) continue;

    const pairAddress = log.address.toLowerCase();
    const anchorLogIndex = parseInt(log.log_index);

    // The recipient is in topic2
    const recipient = log.topic2 ? extractAddressFromTopic(log.topic2) : txFrom.toLowerCase();

    // Find token transfers FROM the pair after the Burn event
    const pairToUser0 = findClosestTransfer(transfers, anchorLogIndex, 'after',
      (t) => t.from.toLowerCase() === pairAddress && t.to.toLowerCase() !== ZERO_ADDRESS,
      usedIndices);

    let pairToUser1: { index: number; transfer: TokenTransfer } | null = null;
    if (pairToUser0) {
      const exclude = new Set(usedIndices);
      exclude.add(pairToUser0.index);
      pairToUser1 = findClosestTransfer(transfers, anchorLogIndex, 'after',
        (t) => t.from.toLowerCase() === pairAddress && t.to.toLowerCase() !== ZERO_ADDRESS &&
          t.tokenAddress.toLowerCase() !== pairToUser0.transfer.tokenAddress.toLowerCase(),
        exclude);
    }

    if (!pairToUser0) continue;

    // Verify pair via CREATE2
    if (pairToUser1) {
      if (!verifyV2Pair(pairAddress, pairToUser0.transfer.tokenAddress, pairToUser1.transfer.tokenAddress)) continue;
    } else {
      continue;
    }

    // Find LP token burn (to 0x0 or to pair, where tokenAddress = pair address)
    const lpBurn = findClosestTransfer(transfers, anchorLogIndex, 'before',
      (t) => (t.to.toLowerCase() === ZERO_ADDRESS || t.to.toLowerCase() === pairAddress) &&
        t.tokenAddress.toLowerCase() === pairAddress,
      usedIndices);

    // Check WETH unwrap
    let token0IsNative = false;
    let token1IsNative = false;
    const effectiveRecipient = pairToUser0.transfer.to.toLowerCase();

    // If pair sends to router, look for router→user native transfer
    if (KNOWN_UNISWAP_ROUTERS.has(effectiveRecipient)) {
      if (pairToUser0.transfer.tokenAddress.toLowerCase() === WETH_ADDRESS) {
        const nativeOut = nativeTransfers.find(
          (nt) => nt.from.toLowerCase() === effectiveRecipient &&
            nt.to.toLowerCase() === txFrom.toLowerCase(),
        );
        if (nativeOut) {
          token0IsNative = true;
          nativeToConsume.push({ from: nativeOut.from, to: nativeOut.to, value: nativeOut.amount });
        }
      }
      if (pairToUser1 && pairToUser1.transfer.tokenAddress.toLowerCase() === WETH_ADDRESS && !token0IsNative) {
        const nativeOut = nativeTransfers.find(
          (nt) => nt.from.toLowerCase() === effectiveRecipient &&
            nt.to.toLowerCase() === txFrom.toLowerCase(),
        );
        if (nativeOut) {
          token1IsNative = true;
          nativeToConsume.push({ from: nativeOut.from, to: nativeOut.to, value: nativeOut.amount });
        }
      }
    }

    const t0 = makeToken(pairToUser0.transfer, token0IsNative);
    const t1 = pairToUser1 ? makeToken(pairToUser1.transfer, token1IsNative) : makeZeroToken();

    operations.push({
      type: 'uniswap-remove-liquidity',
      logIndex: anchorLogIndex,
      version: 'v2',
      token0: t0,
      token1: t1,
      recipient: token0IsNative || token1IsNative ? txFrom.toLowerCase() : effectiveRecipient,
    });

    indicesToRemove.push(pairToUser0.index); usedIndices.add(pairToUser0.index);
    if (pairToUser1) { indicesToRemove.push(pairToUser1.index); usedIndices.add(pairToUser1.index); }
    if (lpBurn) { indicesToRemove.push(lpBurn.index); usedIndices.add(lpBurn.index); }
  }

  return { operations, indicesToRemove, nativeToConsume };
}

// ─── Combined Entry Point ─────────────────────────────────────────────

export function detectUniswapLiquidity(
  logs: MoralisTransactionLog[],
  transfers: TokenTransfer[],
  nativeTransfers: NativeTransfer[],
  txFrom: string,
): UniswapLiquidityResult {
  const allOperations: UniswapLiquidityResult['operations'] = [];
  const allIndicesToRemove: number[] = [];
  const allNativeToConsume: Array<{ from: string; to: string; value: string }> = [];

  // V3 Remove first (to collect decreaseTokenIds for collect filtering)
  const v3Remove = detectV3RemoveLiquidity(logs, transfers, nativeTransfers, txFrom);
  allOperations.push(...v3Remove.operations);
  allIndicesToRemove.push(...v3Remove.indicesToRemove);
  allNativeToConsume.push(...v3Remove.nativeToConsume);

  // V3 Collect (standalone only — skip if paired with DecreaseLiquidity)
  const alreadyUsed = new Set(v3Remove.indicesToRemove);
  const v3Collect = detectV3CollectFees(logs, transfers, nativeTransfers, txFrom, v3Remove.decreaseTokenIds, alreadyUsed);
  allOperations.push(...v3Collect.operations);
  allIndicesToRemove.push(...v3Collect.indicesToRemove);
  allNativeToConsume.push(...v3Collect.nativeToConsume);

  // V3 Add
  const v3Add = detectV3AddLiquidity(logs, transfers, nativeTransfers, txFrom);
  allOperations.push(...v3Add.operations);
  allIndicesToRemove.push(...v3Add.indicesToRemove);
  allNativeToConsume.push(...v3Add.nativeToConsume);

  // V2 Add
  const v2Add = detectV2AddLiquidity(logs, transfers, nativeTransfers, txFrom);
  allOperations.push(...v2Add.operations);
  allIndicesToRemove.push(...v2Add.indicesToRemove);
  allNativeToConsume.push(...v2Add.nativeToConsume);

  // V2 Remove
  const v2Remove = detectV2RemoveLiquidity(logs, transfers, nativeTransfers, txFrom);
  allOperations.push(...v2Remove.operations);
  allIndicesToRemove.push(...v2Remove.indicesToRemove);
  allNativeToConsume.push(...v2Remove.nativeToConsume);

  return {
    operations: allOperations,
    transferIndicesToRemove: allIndicesToRemove,
    nativeTransfersToConsume: allNativeToConsume,
  };
}
