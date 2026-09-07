import type { Attempt, CardId } from '../types'
import type { RoundEngine, RoundInit, RoundState, RoundStep } from './types'

/**
 * Механіка №1 — утворення пар.
 * Дві колонки плиток; тап по лівій, тап по правій. Збіг — плитки згорають.
 *
 * Стан навмисно «плоский» і серіалізовний: сесію можна відновити після
 * згортання застосунку без втрати раунду.
 */

export type TokenSide = 'prompt' | 'answer'

export interface PairToken {
  id: string
  cardId: CardId
  side: TokenSide
  text: string
  matched: boolean
}

export interface PairRoundState extends RoundState {
  mode: 'pair-match'
  tokens: PairToken[]
  /** Обрана, але ще не спарована плитка. */
  selectedId: string | null
  /** Коли плитку обрали — для вимірювання latency саме на пару, а не на весь раунд. */
  selectedAt: number
  /** Картки, на яких користувач уже помилявся в цьому раунді. */
  missedCardIds: CardId[]
}

export type PairInput = { type: 'tap'; tokenId: string }

function byId(state: PairRoundState, id: string): PairToken | undefined {
  return state.tokens.find((t) => t.id === id)
}

export const pairMatchEngine: RoundEngine<PairRoundState, PairInput> = {
  mode: 'pair-match',

  init({ deck, cards, rng, startedAt }: RoundInit): PairRoundState {
    const prompts: PairToken[] = cards.map((c) => ({
      id: `${c.id}:p`,
      cardId: c.id,
      side: 'prompt',
      text: c.prompt,
      matched: false,
    }))
    const answers: PairToken[] = cards.map((c) => ({
      id: `${c.id}:a`,
      cardId: c.id,
      side: 'answer',
      text: c.answer,
      matched: false,
    }))
    return {
      mode: 'pair-match',
      deckId: deck.id,
      tokens: [...rng.shuffle(prompts), ...rng.shuffle(answers)],
      selectedId: null,
      selectedAt: startedAt,
      resolved: 0,
      total: cards.length,
      startedAt,
      missedCardIds: [],
    }
  },

  submit(state, input, at): RoundStep<PairRoundState> {
    const tapped = byId(state, input.tokenId)
    if (!tapped || tapped.matched) {
      return { state, attempts: [], feedback: { kind: 'none' } }
    }

    // Перший тап або перевибір у тій самій колонці.
    if (!state.selectedId) {
      return {
        state: { ...state, selectedId: tapped.id, selectedAt: at },
        attempts: [],
        feedback: { kind: 'select', tokenId: tapped.id },
      }
    }

    if (state.selectedId === tapped.id) {
      return {
        state: { ...state, selectedId: null },
        attempts: [],
        feedback: { kind: 'deselect', tokenId: tapped.id },
      }
    }

    const selected = byId(state, state.selectedId)
    if (!selected) {
      return { state: { ...state, selectedId: null }, attempts: [], feedback: { kind: 'none' } }
    }

    // Тап по другій плитці тієї ж колонки = просто зміна вибору, а не помилка.
    if (selected.side === tapped.side) {
      return {
        state: { ...state, selectedId: tapped.id, selectedAt: at },
        attempts: [],
        feedback: { kind: 'select', tokenId: tapped.id },
      }
    }

    const correct = selected.cardId === tapped.cardId
    const cardId = selected.side === 'prompt' ? selected.cardId : tapped.cardId
    const attempt: Attempt = {
      cardId,
      deckId: state.deckId,
      mode: 'pair-match',
      correct,
      latencyMs: Math.max(0, at - state.selectedAt),
      at,
    }

    if (!correct) {
      return {
        state: {
          ...state,
          selectedId: null,
          missedCardIds: state.missedCardIds.includes(cardId)
            ? state.missedCardIds
            : [...state.missedCardIds, cardId],
        },
        attempts: [attempt],
        feedback: { kind: 'mismatch', tokenIds: [selected.id, tapped.id] },
      }
    }

    return {
      state: {
        ...state,
        tokens: state.tokens.map((t) =>
          t.id === selected.id || t.id === tapped.id ? { ...t, matched: true } : t,
        ),
        selectedId: null,
        resolved: state.resolved + 1,
      },
      attempts: [attempt],
      feedback: { kind: 'match', tokenIds: [selected.id, tapped.id], cardId },
    }
  },

  isComplete(state) {
    return state.resolved >= state.total
  },
}
