import type { MoralisInternalTransaction, NativeTransfer } from '../types/moralis';

export function parseNativeTransfers(
  internalTxs: MoralisInternalTransaction[],
  topLevelValue: string,
  topLevelFrom: string,
  topLevelTo: string,
  startLogIndex: number,
): NativeTransfer[] {
  const results: NativeTransfer[] = [];
  let idx = startLogIndex;

  if (BigInt(topLevelValue) > 0n) {
    results.push({
      from: topLevelFrom,
      to: topLevelTo,
      amount: topLevelValue,
      logIndex: idx++,
    });
  }

  for (const tx of internalTxs) {
    if (BigInt(tx.value) > 0n) {
      results.push({
        from: tx.from,
        to: tx.to,
        amount: tx.value,
        logIndex: idx++,
      });
    }
  }

  return results;
}
