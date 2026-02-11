import { keccak256, solidityPacked, AbiCoder, getAddress } from 'ethers';
import type {
  MoralisTransactionLog,
  TokenTransfer,
  NativeTransfer,
  UniswapSwapOperation,
  UniswapSwapResult,
} from '../types/moralis';
import { extractAddressFromTopic } from './utils';
import {
  UNISWAP_V2_SWAP_TOPIC0,
  UNISWAP_V3_SWAP_TOPIC0,
  UNISWAP_V4_SWAP_TOPIC0,
  UNISWAP_V4_POOL_MANAGER,
  UNISWAP_V2_FACTORY,
  UNISWAP_V2_INIT_CODE_HASH,
  UNISWAP_V3_FACTORY,
  UNISWAP_V3_INIT_CODE_HASH,
  V3_FEE_TIERS,
  KNOWN_UNISWAP_ROUTERS,
  WETH_ADDRESS,
} from './uniswapConstants';

interface RawSwapEvent {
  version: 'v2' | 'v3' | 'v4';
  pool: string;
  sender: string;
  recipient: string;
  logIndex: number;
}

/**
 * Computes a CREATE2 address.
 */
function computeCreate2Address(deployer: string, salt: string, initCodeHash: string): string {
  const packed = solidityPacked(
    ['bytes1', 'address', 'bytes32', 'bytes32'],
    ['0xff', deployer, salt, initCodeHash],
  );
  return '0x' + keccak256(packed).slice(-40);
}

/**
 * Verifies a Uniswap V2 pair address via CREATE2.
 * Token order: token0 < token1 (sorted numerically).
 */
function verifyV2Pool(poolAddress: string, tokenA: string, tokenB: string): boolean {
  const [token0, token1] = sortTokens(tokenA, tokenB);
  const salt = keccak256(solidityPacked(['address', 'address'], [token0, token1]));
  const computed = computeCreate2Address(UNISWAP_V2_FACTORY, salt, UNISWAP_V2_INIT_CODE_HASH);
  return computed.toLowerCase() === poolAddress.toLowerCase();
}

/**
 * Verifies a Uniswap V3 pool address via CREATE2, trying all 4 fee tiers.
 */
function verifyV3Pool(poolAddress: string, tokenA: string, tokenB: string): boolean {
  const [token0, token1] = sortTokens(tokenA, tokenB);
  const abiCoder = AbiCoder.defaultAbiCoder();

  for (const fee of V3_FEE_TIERS) {
    const salt = keccak256(abiCoder.encode(['address', 'address', 'uint24'], [token0, token1, fee]));
    const computed = computeCreate2Address(UNISWAP_V3_FACTORY, salt, UNISWAP_V3_INIT_CODE_HASH);
    if (computed.toLowerCase() === poolAddress.toLowerCase()) {
      return true;
    }
  }
  return false;
}

/**
 * Sorts two token addresses so that token0 < token1 (by numeric value).
 * Uses getAddress to normalize to checksummed form for solidityPacked.
 */
function sortTokens(a: string, b: string): [string, string] {
  const addrA = getAddress(a);
  const addrB = getAddress(b);
  return BigInt(addrA) < BigInt(addrB) ? [addrA, addrB] : [addrB, addrA];
}

/**
 * Finds the unique token addresses involved in transfers to/from a given address.
 */
function findTokensForPool(pool: string, transfers: TokenTransfer[]): Set<string> {
  const tokens = new Set<string>();
  const poolLower = pool.toLowerCase();
  for (const t of transfers) {
    if (t.from.toLowerCase() === poolLower || t.to.toLowerCase() === poolLower) {
      tokens.add(t.tokenAddress.toLowerCase());
    }
  }
  return tokens;
}

/**
 * Detects Uniswap swap operations from transaction logs and matches related transfers.
 */
export function detectUniswapSwaps(
  logs: MoralisTransactionLog[],
  transfers: TokenTransfer[],
  nativeTransfers: NativeTransfer[],
  txFrom: string,
): UniswapSwapResult {
  const emptyResult: UniswapSwapResult = {
    operations: [],
    transferIndicesToRemove: [],
    nativeTransfersToConsume: [],
  };

  // Phase 1: Find all Swap events
  const swapEvents: RawSwapEvent[] = [];

  for (const log of logs) {
    if (log.topic0 === UNISWAP_V3_SWAP_TOPIC0 && log.topic1 && log.topic2) {
      swapEvents.push({
        version: 'v3',
        pool: log.address.toLowerCase(),
        sender: extractAddressFromTopic(log.topic1),
        recipient: extractAddressFromTopic(log.topic2),
        logIndex: parseInt(log.log_index),
      });
    } else if (log.topic0 === UNISWAP_V2_SWAP_TOPIC0 && log.topic1 && log.topic2) {
      swapEvents.push({
        version: 'v2',
        pool: log.address.toLowerCase(),
        sender: extractAddressFromTopic(log.topic1),
        recipient: extractAddressFromTopic(log.topic2),
        logIndex: parseInt(log.log_index),
      });
    } else if (
      log.topic0 === UNISWAP_V4_SWAP_TOPIC0 &&
      log.address.toLowerCase() === UNISWAP_V4_POOL_MANAGER &&
      log.topic2
    ) {
      swapEvents.push({
        version: 'v4',
        pool: UNISWAP_V4_POOL_MANAGER,
        sender: extractAddressFromTopic(log.topic2),
        recipient: txFrom.toLowerCase(), // V4: user receives from PoolManager
        logIndex: parseInt(log.log_index),
      });
    }
  }

  if (swapEvents.length === 0) return emptyResult;

  // Phase 2: Verify V2/V3 pools (skip if sender is a known router)
  const verifiedEvents: RawSwapEvent[] = [];

  for (const event of swapEvents) {
    if (event.version === 'v4') {
      verifiedEvents.push(event);
      continue;
    }

    const senderIsRouter = KNOWN_UNISWAP_ROUTERS.has(event.sender.toLowerCase());
    if (senderIsRouter) {
      verifiedEvents.push(event);
      continue;
    }

    // Need CREATE2 verification
    const poolTokens = findTokensForPool(event.pool, transfers);
    if (poolTokens.size < 2) {
      // Can't determine token pair; skip this event
      continue;
    }

    const tokenArr = [...poolTokens];
    // For a pool, we expect exactly 2 tokens. Take the first two.
    const tokenA = tokenArr[0];
    const tokenB = tokenArr[1];

    if (event.version === 'v2' && verifyV2Pool(event.pool, tokenA, tokenB)) {
      verifiedEvents.push(event);
    } else if (event.version === 'v3' && verifyV3Pool(event.pool, tokenA, tokenB)) {
      verifiedEvents.push(event);
    }
    // If verification fails, it's a fork swap — skip it
  }

  if (verifiedEvents.length === 0) return emptyResult;

  // Phase 3: Build swap participant set
  const participants = new Set<string>();
  for (const event of verifiedEvents) {
    participants.add(event.pool);
    if (KNOWN_UNISWAP_ROUTERS.has(event.sender.toLowerCase())) {
      participants.add(event.sender.toLowerCase());
    }
  }

  // Phase 4: Group swap events into logical swaps by shared router
  const groups = groupSwapEvents(verifiedEvents);

  // Phase 5: For each group, match transfers and build operations
  const allIndicesToRemove: number[] = [];
  const allNativeToConsume: Array<{ from: string; to: string; value: string }> = [];
  const operations: UniswapSwapOperation[] = [];

  for (const group of groups) {
    const result = buildSwapOperation(group, transfers, nativeTransfers, participants, txFrom);
    if (result) {
      operations.push(result.operation);
      allIndicesToRemove.push(...result.transferIndices);
      allNativeToConsume.push(...result.nativeToConsume);
    }
  }

  return {
    operations,
    transferIndicesToRemove: allIndicesToRemove,
    nativeTransfersToConsume: allNativeToConsume,
  };
}

/**
 * Groups swap events into logical swaps. Events sharing the same router sender
 * are grouped together (simplification: all events with same router = one swap).
 * Events without a known router sender are treated as individual direct swaps.
 */
function groupSwapEvents(events: RawSwapEvent[]): RawSwapEvent[][] {
  const routerGroups = new Map<string, RawSwapEvent[]>();
  const directSwaps: RawSwapEvent[][] = [];

  for (const event of events) {
    if (KNOWN_UNISWAP_ROUTERS.has(event.sender.toLowerCase())) {
      const key = event.sender.toLowerCase();
      if (!routerGroups.has(key)) routerGroups.set(key, []);
      routerGroups.get(key)!.push(event);
    } else {
      // Direct pool swap (no router)
      directSwaps.push([event]);
    }
  }

  const groups: RawSwapEvent[][] = [...routerGroups.values(), ...directSwaps];
  // Sort each group by logIndex
  for (const g of groups) {
    g.sort((a, b) => a.logIndex - b.logIndex);
  }

  return groups;
}

/**
 * Builds a single UniswapSwapOperation from a group of swap events.
 */
function buildSwapOperation(
  group: RawSwapEvent[],
  transfers: TokenTransfer[],
  nativeTransfers: NativeTransfer[],
  participants: Set<string>,
  txFrom: string,
): { operation: UniswapSwapOperation; transferIndices: number[]; nativeToConsume: Array<{ from: string; to: string; value: string }> } | null {
  const txFromLower = txFrom.toLowerCase();

  // Find all transfer indices that involve swap participants
  const matchedIndices: number[] = [];
  for (let i = 0; i < transfers.length; i++) {
    const t = transfers[i];
    if (participants.has(t.from.toLowerCase()) || participants.has(t.to.toLowerCase())) {
      matchedIndices.push(i);
    }
  }

  if (matchedIndices.length === 0) return null;

  const matchedTransfers = matchedIndices.map((i) => ({ index: i, transfer: transfers[i] }));

  // Determine user input: transfer where from === txFrom AND to is a participant
  // (user sending tokens into the swap)
  let inputTransfer = matchedTransfers.find(
    (m) => m.transfer.from.toLowerCase() === txFromLower && participants.has(m.transfer.to.toLowerCase()),
  );

  // For V3 direct pool swaps, the user might send directly to the pool
  // For Universal Router, user sends to the router
  // Also check: user could be the recipient field if sender is a router
  if (!inputTransfer) {
    // Fallback: first transfer where from === txFrom
    inputTransfer = matchedTransfers.find((m) => m.transfer.from.toLowerCase() === txFromLower);
  }

  // Fallback for native ETH input via Universal Router: the router wraps ETH and sends
  // WETH to the pool, so the input transfer is router→pool (not user→pool). Detect this
  // when there's a native transfer from user→router backing the WETH transfer.
  if (!inputTransfer) {
    const wethFromRouter = matchedTransfers.find(
      (m) =>
        m.transfer.tokenAddress.toLowerCase() === WETH_ADDRESS &&
        KNOWN_UNISWAP_ROUTERS.has(m.transfer.from.toLowerCase()) &&
        participants.has(m.transfer.to.toLowerCase()),
    );
    if (wethFromRouter) {
      const hasNativeBacking = nativeTransfers.some(
        (nt) =>
          nt.from.toLowerCase() === txFromLower &&
          nt.to.toLowerCase() === wethFromRouter.transfer.from.toLowerCase(),
      );
      if (hasNativeBacking) {
        inputTransfer = wethFromRouter;
      }
    }
  }

  // Final fallback: pure native ETH input (e.g. V4 settles ETH directly, no WETH transfer)
  let pureNativeInput: NativeTransfer | undefined;
  if (!inputTransfer) {
    const nativeIn = nativeTransfers.find(
      (nt) => nt.from.toLowerCase() === txFromLower && participants.has(nt.to.toLowerCase()),
    );
    if (nativeIn) {
      pureNativeInput = nativeIn;
    }
  }

  // Determine user output: transfer where to === txFrom AND from is a participant
  const lastSwapEvent = group[group.length - 1];
  let outputTransfer = matchedTransfers.find(
    (m) => m.transfer.to.toLowerCase() === txFromLower && participants.has(m.transfer.from.toLowerCase()),
  );

  // Fallback: check recipient from swap event
  if (!outputTransfer && lastSwapEvent.recipient.toLowerCase() !== txFromLower) {
    outputTransfer = matchedTransfers.find(
      (m) => m.transfer.to.toLowerCase() === lastSwapEvent.recipient.toLowerCase(),
    );
  }

  if (!inputTransfer && !pureNativeInput && !outputTransfer) return null;

  // Handle native ETH edge cases
  const nativeToConsume: Array<{ from: string; to: string; value: string }> = [];
  let inputIsNative = false;
  let outputIsNative = false;
  let nativeInputAmount: string | undefined;
  let nativeOutputAmount: string | undefined;

  // Check if input involves WETH → might be native ETH wrap
  if (inputTransfer && inputTransfer.transfer.tokenAddress.toLowerCase() === WETH_ADDRESS) {
    // Look for native transfer from user to a router/participant
    const nativeIn = nativeTransfers.find(
      (nt) => nt.from.toLowerCase() === txFromLower && participants.has(nt.to.toLowerCase()),
    );
    if (nativeIn) {
      inputIsNative = true;
      nativeInputAmount = nativeIn.amount;
      nativeToConsume.push({ from: nativeIn.from, to: nativeIn.to, value: nativeIn.amount });
    }
  }

  // Pure native ETH input (no WETH transfer at all)
  if (pureNativeInput) {
    inputIsNative = true;
    nativeInputAmount = pureNativeInput.amount;
    nativeToConsume.push({ from: pureNativeInput.from, to: pureNativeInput.to, value: pureNativeInput.amount });
  }

  // Check if output involves WETH → might be native ETH unwrap
  if (outputTransfer && outputTransfer.transfer.tokenAddress.toLowerCase() === WETH_ADDRESS) {
    // Look for native transfer from a router/participant to user
    const nativeOut = nativeTransfers.find(
      (nt) => nt.to.toLowerCase() === txFromLower && participants.has(nt.from.toLowerCase()),
    );
    if (nativeOut) {
      outputIsNative = true;
      nativeOutputAmount = nativeOut.amount;
      nativeToConsume.push({ from: nativeOut.from, to: nativeOut.to, value: nativeOut.amount });
    }
  }

  // Build token info
  const version = group[0].version;
  const hops = group.length;

  const tokenIn = pureNativeInput
    ? {
        address: WETH_ADDRESS,
        symbol: 'ETH',
        name: 'Ether',
        logo: null,
        decimals: 18,
        amount: pureNativeInput.amount,
        isNative: true as const,
      }
    : inputTransfer
      ? {
          address: inputTransfer.transfer.tokenAddress,
          symbol: inputIsNative ? 'ETH' : inputTransfer.transfer.tokenSymbol,
          name: inputIsNative ? 'Ether' : inputTransfer.transfer.tokenName,
          logo: inputIsNative ? null : inputTransfer.transfer.tokenLogo,
          decimals: inputTransfer.transfer.decimals,
          amount: inputIsNative && nativeInputAmount ? nativeInputAmount : inputTransfer.transfer.amount,
          isNative: inputIsNative || undefined,
        }
      : null;

  const tokenOut = outputTransfer
    ? {
        address: outputTransfer.transfer.tokenAddress,
        symbol: outputIsNative ? 'ETH' : outputTransfer.transfer.tokenSymbol,
        name: outputIsNative ? 'Ether' : outputTransfer.transfer.tokenName,
        logo: outputIsNative ? null : outputTransfer.transfer.tokenLogo,
        decimals: outputTransfer.transfer.decimals,
        amount: outputIsNative && nativeOutputAmount ? nativeOutputAmount : outputTransfer.transfer.amount,
        isNative: outputIsNative || undefined,
      }
    : null;

  // Contract-mediated swap fallback: when swap sender/recipient differs from txFrom
  // and is not a known router, find input/output by logIndex proximity to each swap event.
  if (!tokenIn || !tokenOut) {
    const effectiveUsers = new Set(
      group.flatMap((e) => [e.sender.toLowerCase(), e.recipient.toLowerCase()]),
    );
    effectiveUsers.delete(txFromLower); // Already tried txFrom
    // Remove pools — they're not the user
    for (const event of group) {
      effectiveUsers.delete(event.pool);
    }

    for (const user of effectiveUsers) {
      if (KNOWN_UNISWAP_ROUTERS.has(user)) continue;

      // For each swap event, find its closest input/output transfers by logIndex
      const claimedIndices: number[] = [];
      let groupInputTransfer: (typeof matchedTransfers)[number] | undefined;
      let groupOutputTransfer: (typeof matchedTransfers)[number] | undefined;

      for (const event of group) {
        let bestInputIdx = -1;
        let bestInputDist = Infinity;
        let bestOutputIdx = -1;
        let bestOutputDist = Infinity;

        for (let i = 0; i < transfers.length; i++) {
          const t = transfers[i];
          if (t.logIndex > event.logIndex) continue;
          const dist = event.logIndex - t.logIndex;

          if (
            t.to.toLowerCase() === event.pool &&
            t.from.toLowerCase() === user &&
            dist < bestInputDist
          ) {
            bestInputIdx = i;
            bestInputDist = dist;
          }
          if (
            t.from.toLowerCase() === event.pool &&
            t.to.toLowerCase() === user &&
            dist < bestOutputDist
          ) {
            bestOutputIdx = i;
            bestOutputDist = dist;
          }
        }

        if (bestInputIdx !== -1) claimedIndices.push(bestInputIdx);
        if (bestOutputIdx !== -1) claimedIndices.push(bestOutputIdx);

        // First swap event's output = group output; last event's input = group input
        if (!groupOutputTransfer && bestOutputIdx !== -1) {
          groupOutputTransfer = { index: bestOutputIdx, transfer: transfers[bestOutputIdx] };
        }
        if (bestInputIdx !== -1) {
          groupInputTransfer = { index: bestInputIdx, transfer: transfers[bestInputIdx] };
        }
      }

      if (groupInputTransfer && groupOutputTransfer) {
        const mediatedOp: UniswapSwapOperation = {
          type: 'uniswap-swap',
          logIndex: group[0].logIndex,
          version,
          tokenIn: {
            address: groupInputTransfer.transfer.tokenAddress,
            symbol: groupInputTransfer.transfer.tokenSymbol,
            name: groupInputTransfer.transfer.tokenName,
            logo: groupInputTransfer.transfer.tokenLogo,
            decimals: groupInputTransfer.transfer.decimals,
            amount: groupInputTransfer.transfer.amount,
          },
          tokenOut: {
            address: groupOutputTransfer.transfer.tokenAddress,
            symbol: groupOutputTransfer.transfer.tokenSymbol,
            name: groupOutputTransfer.transfer.tokenName,
            logo: groupOutputTransfer.transfer.tokenLogo,
            decimals: groupOutputTransfer.transfer.decimals,
            amount: groupOutputTransfer.transfer.amount,
          },
          sender: user,
          recipient: group[group.length - 1].recipient.toLowerCase() || user,
          hops,
        };

        return {
          operation: mediatedOp,
          transferIndices: claimedIndices,
          nativeToConsume: [],
        };
      }
    }
  }

  if (!tokenIn || !tokenOut) return null;

  const operation: UniswapSwapOperation = {
    type: 'uniswap-swap',
    logIndex: group[0].logIndex,
    version,
    tokenIn,
    tokenOut,
    sender: txFromLower,
    recipient: lastSwapEvent.recipient.toLowerCase() || txFromLower,
    hops,
  };

  return {
    operation,
    transferIndices: matchedIndices,
    nativeToConsume,
  };
}
