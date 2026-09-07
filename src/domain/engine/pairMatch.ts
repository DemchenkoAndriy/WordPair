import type { Attempt, Card, CardId } from '../types'
import type { RefillableEngine, RoundEngine, RoundInit, RoundState, RoundStep } from './types'
import type { Rng } from '@/lib/rng'

/**
 * Механіка №1 — утворення пар, у режимі «конвеєра».
 *
 * Плитка — це СЛОТ, який живе весь раунд; картки в ньому змінюються.
 * Зійшла пара → обидві плитки сіріють і гаснуть, але місце тримають,
 * доки не прийде підміна. Завдяки цьому сесія триває скільки завгодно,
 * а поле ніколи не спорожнюється.
 *
 * Стан плоский і серіалізовний: раунд переживає згортання застосунку.
 */

export type TokenSide = 'prompt' | 'answer'

export interface PairToken {
  /** Ідентифікатор слота (`p0`, `a3`), а не картки — позиція стабільна між підмінами. */
  id: string
  cardId: CardId
  side: TokenSide
  text: string
  /** Пара зійшлася: плитка гасне, але ще займає слот до підміни. */
  matched: boolean
  /** Скільки разів слот заповнювався. UI використовує це, щоб перезапустити анімацію появи. */
  generation: number
}

export interface PairRoundState extends RoundState {
  mode: 'pair-match'
  tokens: PairToken[]
  /** Обрана, але ще не спарована плитка. */
  selectedId: string | null
  /** Коли плитку обрали — щоб міряти latency на пару, а не на весь раунд. */
  selectedAt: number
  /** Картки, що чекають своєї черги на поле. */
  queue: Card[]
  /** Картки, на яких користувач помилявся в цьому раунді. */
  missedCardIds: CardId[]
}

export type PairInput = { type: 'tap'; tokenId: string }

/**
 * Скільки зійшлих пар накопичити перед підміною.
 *
 * Якщо міняти по одній, нова пара займе рівно ті два слоти, які щойно
 * звільнилися, — і її можна вгадати, взагалі не знаючи слова. Пачкою від двох
 * нові картки розкидаються по звільнених слотах незалежно в кожній колонці,
 * тож позиція більше нічого не підказує.
 */
export const SWEEP_BATCH = 2

function byId(state: PairRoundState, id: string): PairToken | undefined {
  return state.tokens.find((t) => t.id === id)
}

function matchedSlots(state: PairRoundState, side: TokenSide): PairToken[] {
  return state.tokens.filter((t) => t.matched && t.side === side)
}

export const pairMatchEngine: RoundEngine<PairRoundState, PairInput> & RefillableEngine<PairRoundState> = {
  mode: 'pair-match',

  init({ deck, cards, boardPairs, target, rng, startedAt }: RoundInit): PairRoundState {
    const size = Math.min(boardPairs, cards.length)
    const onBoard = cards.slice(0, size)

    // Колонки перемішуються НЕЗАЛЕЖНО: інакше рядок підказував би пару.
    const prompts = rng.shuffle(onBoard)
    const answers = rng.shuffle(onBoard)

    return {
      mode: 'pair-match',
      deckId: deck.id,
      tokens: [
        ...prompts.map((c, i) => ({
          id: `p${i}`,
          cardId: c.id,
          side: 'prompt' as const,
          text: c.prompt,
          matched: false,
          generation: 0,
        })),
        ...answers.map((c, i) => ({
          id: `a${i}`,
          cardId: c.id,
          side: 'answer' as const,
          text: c.answer,
          matched: false,
          generation: 0,
        })),
      ],
      selectedId: null,
      selectedAt: startedAt,
      queue: cards.slice(size),
      resolved: 0,
      target,
      startedAt,
      missedCardIds: [],
    }
  },

  submit(state, input, at): RoundStep<PairRoundState> {
    const tapped = byId(state, input.tokenId)
    if (!tapped || tapped.matched) {
      return { state, attempts: [], feedback: { kind: 'none' } }
    }

    // Перший тап або перевибір.
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
    if (!selected || selected.matched) {
      return {
        state: { ...state, selectedId: tapped.id, selectedAt: at },
        attempts: [],
        feedback: { kind: 'select', tokenId: tapped.id },
      }
    }

    // Тап по другій плитці тієї ж колонки = зміна вибору, а не помилка.
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
    if (state.target !== null && state.resolved >= state.target) return true
    // Колода вичерпалась: черга порожня і на полі не лишилось живих плиток.
    return state.tokens.length > 0 && state.queue.length === 0 && state.tokens.every((t) => t.matched)
  },

  canSweep(state) {
    const pending = matchedSlots(state, 'prompt').length
    if (pending === 0) return false
    if (pending >= SWEEP_BATCH) return true
    // Доливати нема з чого — чекати на другу пару немає сенсу, просто прибираємо.
    return state.queue.length < SWEEP_BATCH
  },

  sweep(state, rng) {
    const prompts = matchedSlots(state, 'prompt')
    const answers = matchedSlots(state, 'answer')
    const replaced = Math.min(prompts.length, answers.length, state.queue.length)

    if (replaced === 0) {
      // Підміняти нічим — звільняємо місце, поле стискається.
      return { ...state, tokens: state.tokens.filter((t) => !t.matched) }
    }

    const incoming = state.queue.slice(0, replaced)
    const promptIds = rng.shuffle(prompts.slice(0, replaced).map((t) => t.id))
    const answerIds = rng.shuffle(answers.slice(0, replaced).map((t) => t.id))

    const fill = new Map<string, { cardId: CardId; text: string }>()
    incoming.forEach((card, i) => {
      fill.set(promptIds[i] as string, { cardId: card.id, text: card.prompt })
      fill.set(answerIds[i] as string, { cardId: card.id, text: card.answer })
    })

    return {
      ...state,
      queue: state.queue.slice(replaced),
      tokens: state.tokens.flatMap((t) => {
        const next = fill.get(t.id)
        if (next) return [{ ...t, ...next, matched: false, generation: t.generation + 1 }]
        return t.matched ? [] : [t] // зійшла пара, якій не знайшлося заміни
      }),
    }
  },

  refill(state, cards) {
    return cards.length === 0 ? state : { ...state, queue: [...state.queue, ...cards] }
  },

  queued(state) {
    return state.queue.length
  },
}

/** Скільки пар зараз живі на полі — потрібно UI та тестам. */
export function livePairs(state: PairRoundState): number {
  return state.tokens.filter((t) => t.side === 'prompt' && !t.matched).length
}

export type { Rng }
