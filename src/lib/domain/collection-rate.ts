export function collectionRate(
  receivablePaise: bigint,
  collectedPaise: bigint,
): number {
  if (receivablePaise === 0n) {
    return 0;
  }
  return (Number(collectedPaise) / Number(receivablePaise)) * 100;
}
