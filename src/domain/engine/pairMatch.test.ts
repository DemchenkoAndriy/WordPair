import { describe, expect, it } from 'vitest'
import { pairMatchEngine, type PairRoundState } from './pairMatch'
import { createRng } from '@/lib/rng'
import type { Card } from '../types'

const cards: Card[] = [
  { id: 'c1', prompt: 'Палітра команд', answer: 'Ctrl+Shift+P' },
  { id: 'c2', prompt: 'Перехід до файлу', answer: 'Ctrl+P' },
]

const NOW = 1_700_000_000_000

function init(): PairRoundState {
  return pairMatchEngine.init({ deck: { id: 'vscode' }, cards, rng: createRng(42), startedAt: NOW })
}

describe('pair-match engine', () => {
  it('створює по плитці на кожну сторону кожної картки', () => {
    const state = init()
    expect(state.tokens).toHaveLength(4)
    expect(state.total).toBe(2)
    expect(state.resolved).toBe(0)
  })

  it('перший тап лише обирає плитку і не породжує спроби', () => {
    const step = pairMatchEngine.submit(init(), { type: 'tap', tokenId: 'c1:p' }, NOW)
    expect(step.attempts).toHaveLength(0)
    expect(step.state.selectedId).toBe('c1:p')
    expect(step.feedback).toEqual({ kind: 'select', tokenId: 'c1:p' })
  })

  it('повторний тап по тій самій плитці знімає вибір', () => {
    const first = pairMatchEngine.submit(init(), { type: 'tap', tokenId: 'c1:p' }, NOW)
    const second = pairMatchEngine.submit(first.state, { type: 'tap', tokenId: 'c1:p' }, NOW)
    expect(second.state.selectedId).toBeNull()
    expect(second.attempts).toHaveLength(0)
  })

  it('тап по другій плитці тієї ж колонки — це зміна вибору, а не помилка', () => {
    const first = pairMatchEngine.submit(init(), { type: 'tap', tokenId: 'c1:p' }, NOW)
    const second = pairMatchEngine.submit(first.state, { type: 'tap', tokenId: 'c2:p' }, NOW)
    expect(second.attempts).toHaveLength(0)
    expect(second.state.selectedId).toBe('c2:p')
  })

  it('правильна пара закривається і дає спробу з часом реакції', () => {
    const first = pairMatchEngine.submit(init(), { type: 'tap', tokenId: 'c1:p' }, NOW)
    const second = pairMatchEngine.submit(first.state, { type: 'tap', tokenId: 'c1:a' }, NOW + 1200)
    expect(second.attempts).toEqual([
      { cardId: 'c1', deckId: 'vscode', mode: 'pair-match', correct: true, latencyMs: 1200, at: NOW + 1200 },
    ])
    expect(second.state.resolved).toBe(1)
    expect(second.state.tokens.filter((t) => t.matched)).toHaveLength(2)
    expect(second.feedback.kind).toBe('match')
  })

  it('хибна пара дає негативну спробу і запамʼятовує картку як помилкову', () => {
    const first = pairMatchEngine.submit(init(), { type: 'tap', tokenId: 'c1:p' }, NOW)
    const second = pairMatchEngine.submit(first.state, { type: 'tap', tokenId: 'c2:a' }, NOW + 900)
    expect(second.attempts[0]?.correct).toBe(false)
    expect(second.state.resolved).toBe(0)
    expect(second.state.missedCardIds).toEqual(['c1'])
    expect(second.state.selectedId).toBeNull()
  })

  it('тап по вже спарованій плитці нічого не змінює', () => {
    let state = init()
    state = pairMatchEngine.submit(state, { type: 'tap', tokenId: 'c1:p' }, NOW).state
    state = pairMatchEngine.submit(state, { type: 'tap', tokenId: 'c1:a' }, NOW).state
    const step = pairMatchEngine.submit(state, { type: 'tap', tokenId: 'c1:p' }, NOW)
    expect(step.state).toBe(state)
    expect(step.attempts).toHaveLength(0)
  })

  it('раунд завершується, коли закрито всі пари', () => {
    let state = init()
    expect(pairMatchEngine.isComplete(state)).toBe(false)
    for (const id of ['c1', 'c2']) {
      state = pairMatchEngine.submit(state, { type: 'tap', tokenId: `${id}:p` }, NOW).state
      state = pairMatchEngine.submit(state, { type: 'tap', tokenId: `${id}:a` }, NOW).state
    }
    expect(pairMatchEngine.isComplete(state)).toBe(true)
  })
})
