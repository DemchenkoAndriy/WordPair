import { describe, expect, it } from 'vitest'
import { comboMultiplier, COMBO_CAP, levelFromXp, levelProgress, scoreHit, speedBonus, xpForLevel } from './scoring'
import { createRng } from '@/lib/rng'

/** ГПВЧ із фіксованим значенням — щоб перевіряти формулу без випадковості. */
const fixedRng = (value: number) => ({ ...createRng(1), next: () => value })

describe('scoring', () => {
  it('бонус за швидкість спадає з часом і не стає відʼємним', () => {
    expect(speedBonus(500)).toBe(0.5)
    expect(speedBonus(4000)).toBeCloseTo(0.25, 5)
    expect(speedBonus(9000)).toBe(0)
  })

  it('множник комбо обмежений стелею', () => {
    expect(comboMultiplier(0)).toBe(1)
    expect(comboMultiplier(COMBO_CAP)).toBeCloseTo(2, 5)
    expect(comboMultiplier(999)).toBeCloseTo(2, 5)
  })

  it('критичний удар подвоює XP', () => {
    const args = { combo: 1, latencyMs: 1000 }
    const normal = scoreHit({ ...args, rng: fixedRng(0.99) })
    const crit = scoreHit({ ...args, rng: fixedRng(0) })
    expect(normal.critical).toBe(false)
    expect(crit.critical).toBe(true)
    expect(crit.xp).toBe(normal.xp * 2)
  })

  it('підказка різко зменшує XP і виключає крит', () => {
    const hinted = scoreHit({ combo: 1, latencyMs: 1000, usedHint: true, rng: fixedRng(0) })
    const clean = scoreHit({ combo: 1, latencyMs: 1000, rng: fixedRng(0.99) })
    expect(hinted.critical).toBe(false)
    expect(hinted.xp).toBeLessThan(clean.xp)
  })

  it('рівні узгоджені: xpForLevel і levelFromXp — взаємно обернені', () => {
    for (let level = 1; level <= 20; level++) {
      expect(levelFromXp(xpForLevel(level))).toBe(level)
      expect(levelFromXp(xpForLevel(level + 1) - 1)).toBe(level)
    }
  })

  it('прогрес рівня дає частку 0..1', () => {
    const p = levelProgress(150)
    expect(p.level).toBe(2)
    expect(p.ratio).toBeGreaterThan(0)
    expect(p.ratio).toBeLessThan(1)
    expect(p.xpInLevel + p.xpForNext).toBe(xpForLevel(3) - xpForLevel(2))
  })
})
