/** Детермінований ГПВЧ (mulberry32) — щоб раунди були відтворюваними в тестах. */
export interface Rng {
  next(): number
  int(maxExclusive: number): number
  pick<T>(items: readonly T[]): T
  shuffle<T>(items: readonly T[]): T[]
}

export function createRng(seed = Date.now()): Rng {
  let s = seed >>> 0
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const int = (maxExclusive: number) => Math.floor(next() * maxExclusive)
  return {
    next,
    int,
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new Error('rng.pick: порожній масив')
      return items[int(items.length)] as T
    },
    shuffle<T>(items: readonly T[]): T[] {
      const out = items.slice()
      for (let i = out.length - 1; i > 0; i--) {
        const j = int(i + 1)
        const a = out[i] as T
        out[i] = out[j] as T
        out[j] = a
      }
      return out
    },
  }
}
