import { describe, expect, it } from 'vitest'
import { SWEEP_BATCH, livePairs, pairMatchEngine, type PairRoundState } from './pairMatch'
import { createRng } from '@/lib/rng'
import type { Card } from '../types'

const deckCards: Card[] = Array.from({ length: 10 }, (_, i) => ({
  id: `c${i}`,
  prompt: `підказка ${i}`,
  answer: `відповідь ${i}`,
}))

const NOW = 1_700_000_000_000

function init(options: { boardPairs?: number; target?: number | null; cards?: Card[] } = {}): PairRoundState {
  return pairMatchEngine.init({
    deck: { id: 'vscode' },
    cards: options.cards ?? deckCards,
    boardPairs: options.boardPairs ?? 3,
    target: options.target === undefined ? 6 : options.target,
    rng: createRng(42),
    startedAt: NOW,
  })
}

/** Знаходить слот, у якому зараз лежить конкретна картка. */
function slotOf(state: PairRoundState, cardId: string, side: 'prompt' | 'answer'): string {
  const token = state.tokens.find((t) => t.cardId === cardId && t.side === side && !t.matched)
  if (!token) throw new Error(`немає живого слота для ${cardId}/${side}`)
  return token.id
}

/** Закриває одну пару, що зараз на полі. */
function solve(state: PairRoundState, cardId: string, at = NOW): PairRoundState {
  const a = pairMatchEngine.submit(state, { type: 'tap', tokenId: slotOf(state, cardId, 'prompt') }, at)
  return pairMatchEngine.submit(a.state, { type: 'tap', tokenId: slotOf(a.state, cardId, 'answer') }, at).state
}

/** Картки, що зараз живі на полі. */
function onBoard(state: PairRoundState): string[] {
  return state.tokens.filter((t) => t.side === 'prompt' && !t.matched).map((t) => t.cardId).sort()
}

describe('pair-match: поле й вибір', () => {
  it('на поле виходить рівно boardPairs карток, решта чекає в черзі', () => {
    const state = init({ boardPairs: 3 })
    expect(livePairs(state)).toBe(3)
    expect(state.tokens).toHaveLength(6)
    expect(pairMatchEngine.queued(state)).toBe(7)
  })

  it('колонки перемішані незалежно — рядок не підказує пару', () => {
    const state = init({ boardPairs: 10 })
    const prompts = state.tokens.filter((t) => t.side === 'prompt').map((t) => t.cardId)
    const answers = state.tokens.filter((t) => t.side === 'answer').map((t) => t.cardId)
    expect(prompts.sort()).toEqual(answers.slice().sort())
    expect(state.tokens.filter((t) => t.side === 'prompt').map((t) => t.cardId)).not.toEqual(
      state.tokens.filter((t) => t.side === 'answer').map((t) => t.cardId),
    )
  })

  it('перший тап лише обирає плитку і не породжує спроби', () => {
    const step = pairMatchEngine.submit(init(), { type: 'tap', tokenId: 'p0' }, NOW)
    expect(step.attempts).toHaveLength(0)
    expect(step.state.selectedId).toBe('p0')
  })

  it('повторний тап по тій самій плитці знімає вибір', () => {
    const first = pairMatchEngine.submit(init(), { type: 'tap', tokenId: 'p0' }, NOW)
    const second = pairMatchEngine.submit(first.state, { type: 'tap', tokenId: 'p0' }, NOW)
    expect(second.state.selectedId).toBeNull()
    expect(second.attempts).toHaveLength(0)
  })

  it('тап по другій плитці тієї ж колонки — зміна вибору, а не помилка', () => {
    const first = pairMatchEngine.submit(init(), { type: 'tap', tokenId: 'p0' }, NOW)
    const second = pairMatchEngine.submit(first.state, { type: 'tap', tokenId: 'p1' }, NOW)
    expect(second.attempts).toHaveLength(0)
    expect(second.state.selectedId).toBe('p1')
  })

  it('правильна пара дає спробу з часом реакції й не звільняє слот одразу', () => {
    const state = init()
    const cardId = state.tokens[0]!.cardId
    const first = pairMatchEngine.submit(state, { type: 'tap', tokenId: slotOf(state, cardId, 'prompt') }, NOW)
    const second = pairMatchEngine.submit(
      first.state,
      { type: 'tap', tokenId: slotOf(first.state, cardId, 'answer') },
      NOW + 1200,
    )
    expect(second.attempts).toEqual([
      { cardId, deckId: 'vscode', mode: 'pair-match', correct: true, latencyMs: 1200, at: NOW + 1200 },
    ])
    expect(second.state.resolved).toBe(1)
    // Плитки лишаються на місці — гаснуть, доки не прийде підміна.
    expect(second.state.tokens).toHaveLength(6)
    expect(second.state.tokens.filter((t) => t.matched)).toHaveLength(2)
  })

  it('хибна пара дає негативну спробу і запам’ятовує картку', () => {
    const state = init()
    const first = state.tokens.find((t) => t.side === 'prompt')!
    const wrong = state.tokens.find((t) => t.side === 'answer' && t.cardId !== first.cardId)!
    const a = pairMatchEngine.submit(state, { type: 'tap', tokenId: first.id }, NOW)
    const b = pairMatchEngine.submit(a.state, { type: 'tap', tokenId: wrong.id }, NOW + 900)
    expect(b.attempts[0]?.correct).toBe(false)
    expect(b.state.resolved).toBe(0)
    expect(b.state.missedCardIds).toEqual([first.cardId])
  })

  it('тап по вже зійшлій плитці нічого не змінює', () => {
    const state = solve(init(), init().tokens[0]!.cardId)
    const matched = state.tokens.find((t) => t.matched)!
    const step = pairMatchEngine.submit(state, { type: 'tap', tokenId: matched.id }, NOW)
    expect(step.state).toBe(state)
    expect(step.attempts).toHaveLength(0)
  })
})

describe('pair-match: конвеєр підміни', () => {
  it('одна зійшла пара підміну не запускає — інакше нову пару можна вгадати за позицією', () => {
    const state = solve(init(), init().tokens[0]!.cardId)
    expect(SWEEP_BATCH).toBe(2)
    expect(pairMatchEngine.canSweep(state)).toBe(false)
  })

  it('після SWEEP_BATCH пар підміна дає нові слова на тих самих слотах', () => {
    let state = init({ boardPairs: 3 })
    const before = onBoard(state)
    state = solve(state, before[0]!)
    state = solve(state, before[1]!)
    expect(pairMatchEngine.canSweep(state)).toBe(true)

    const swept = pairMatchEngine.sweep(state, createRng(7))
    expect(livePairs(swept)).toBe(3) // поле знову повне
    expect(swept.tokens).toHaveLength(6)
    expect(swept.tokens.every((t) => !t.matched)).toBe(true)
    expect(pairMatchEngine.queued(swept)).toBe(5) // дві картки пішли з черги

    const after = onBoard(swept)
    expect(after).not.toContain(before[0])
    expect(after).not.toContain(before[1])
    expect(after).toContain(before[2]) // незакрита картка лишилась на місці
  })

  it('підмінені слоти отримують нове покоління — UI перезапустить анімацію появи', () => {
    let state = init({ boardPairs: 3 })
    const before = onBoard(state)
    state = solve(state, before[0]!)
    state = solve(state, before[1]!)
    const swept = pairMatchEngine.sweep(state, createRng(7))
    expect(swept.tokens.filter((t) => t.generation === 1)).toHaveLength(4)
    expect(swept.tokens.filter((t) => t.generation === 0)).toHaveLength(2)
  })

  it('обидві колонки заповнюються незалежно — звільнені слоти не лишаються парою', () => {
    // Перебираємо зерна ГПВЧ: хоча б для одного розкладка має відрізнятися
    // від «нова картка стала рівно туди, звідки пішла стара».
    const layouts = new Set<string>()
    for (let seed = 1; seed <= 12; seed++) {
      let state = init({ boardPairs: 4 })
      const before = onBoard(state)
      state = solve(state, before[0]!)
      state = solve(state, before[1]!)
      const swept = pairMatchEngine.sweep(state, createRng(seed))
      layouts.add(
        swept.tokens
          .filter((t) => t.generation === 1)
          .map((t) => `${t.id}=${t.cardId}`)
          .join(','),
      )
    }
    expect(layouts.size).toBeGreaterThan(1)
  })

  it('коли черга порожня, підміна просто прибирає плитки й поле стискається', () => {
    let state = init({ cards: deckCards.slice(0, 3), boardPairs: 3, target: 3 })
    expect(pairMatchEngine.queued(state)).toBe(0)
    const before = onBoard(state)
    state = solve(state, before[0]!)
    expect(pairMatchEngine.canSweep(state)).toBe(true) // чекати нема на що

    const swept = pairMatchEngine.sweep(state, createRng(1))
    expect(livePairs(swept)).toBe(2)
    expect(swept.tokens).toHaveLength(4)
  })

  it('refill додає картки в чергу, порожній виклик нічого не змінює', () => {
    const state = init({ boardPairs: 3 })
    const filled = pairMatchEngine.refill(state, deckCards.slice(0, 2))
    expect(pairMatchEngine.queued(filled)).toBe(pairMatchEngine.queued(state) + 2)
    expect(pairMatchEngine.refill(state, [])).toBe(state)
  })
})

describe('pair-match: завершення раунду', () => {
  it('скінченний раунд завершується на цілі', () => {
    let state = init({ boardPairs: 3, target: 2 })
    expect(pairMatchEngine.isComplete(state)).toBe(false)
    state = solve(state, onBoard(state)[0]!)
    expect(pairMatchEngine.isComplete(state)).toBe(false)
    state = solve(state, onBoard(state)[0]!)
    expect(pairMatchEngine.isComplete(state)).toBe(true)
  })

  it('безкінечний раунд не завершується сам, скільки б пар не закрили', () => {
    let state = init({ boardPairs: 3, target: null })
    for (let i = 0; i < 3; i++) {
      state = solve(state, onBoard(state)[0]!)
      if (pairMatchEngine.canSweep(state)) state = pairMatchEngine.sweep(state, createRng(i))
    }
    expect(state.resolved).toBe(3)
    expect(pairMatchEngine.isComplete(state)).toBe(false)
  })

  it('скінченний раунд завершується і тоді, коли колода вичерпалась раніше за ціль', () => {
    let state = init({ cards: deckCards.slice(0, 2), boardPairs: 2, target: 50 })
    state = solve(state, onBoard(state)[0]!)
    state = solve(state, onBoard(state)[0]!)
    expect(pairMatchEngine.isComplete(state)).toBe(true)
  })
})
