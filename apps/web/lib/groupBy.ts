export function groupBy<T>(items: T[], keyFn: (item: T) => string): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = keyFn(item);
    (map.get(k) ?? map.set(k, []).get(k)!).push(item);
  }
  return [...map.entries()];
}
