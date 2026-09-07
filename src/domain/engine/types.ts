import type { Attempt, Card, Deck, ExerciseMode } from '../types'
import type { Rng } from '@/lib/rng'

/**
 * Контракт режиму вправи.
 *
 * Ключова ідея архітектури: режими відрізняються ЛИШЕ способом введення й розкладкою.
 * Кожен режим на виході дає той самий потік `Attempt`, тому нарахування XP,
 * планувальник повторень, статистика й ефекти пишуться ОДИН раз
 * і не змінюються при додаванні «написання з клавіатури» чи будь-чого далі.
 */
export interface RoundEngine<TState extends RoundState, TInput> {
  readonly mode: ExerciseMode
  /** Готує раунд із набору карток. Чиста функція від (cards, rng). */
  init(input: RoundInit): TState
  /** Обробляє дію користувача. Повертає новий стан + спроби, які з неї випливають. */
  submit(state: TState, input: TInput, at: number): RoundStep<TState>
  /** Раунд завершено — усі картки закриті. */
  isComplete(state: TState): boolean
}

export interface RoundInit {
  deck: Pick<Deck, 'id'>
  /** Перші `boardPairs` карток ідуть на поле, решта — у чергу на підміну. */
  cards: readonly Card[]
  boardPairs: number
  /** Скільки пар закрити до завершення; null — безкінечний режим. */
  target: number | null
  rng: Rng
  startedAt: number
}

/**
 * Рушій, у якому поле не спорожнюється: закрита картка гасне, а на її місце
 * приходить нова. Винесено в окремий інтерфейс — режим «написання з клавіатури»
 * цього не потребує, і не має тягнути зайвих методів.
 */
export interface RefillableEngine<TState extends RoundState> {
  /** Чи вже можна робити підміну (див. SWEEP_BATCH у реалізації). */
  canSweep(state: TState): boolean
  /** Прибирає зійшлі пари й підтягує нові. Викликає UI — після анімації згасання. */
  sweep(state: TState, rng: Rng): TState
  /** Додає картки в чергу. Потрібно безкінечному режиму. */
  refill(state: TState, cards: readonly Card[]): TState
  /** Скільки карток лишилось у черзі — щоб знати, коли доливати. */
  queued(state: TState): number
}

/** Спільна частина стану будь-якого раунду. */
export interface RoundState {
  mode: ExerciseMode
  deckId: string
  /** Скільки пар закрито від початку раунду. */
  resolved: number
  /** Ціль раунду; null — безкінечний режим. */
  target: number | null
  startedAt: number
}

export interface RoundStep<TState extends RoundState> {
  state: TState
  /** 0..n спроб, породжених цією дією (для parування — одна на пару). */
  attempts: Attempt[]
  /** Підказка для UI: що саме анімувати. Домен не знає, ЯК це виглядає. */
  feedback: Feedback
}

export type Feedback =
  | { kind: 'none' }
  | { kind: 'select'; tokenId: string }
  | { kind: 'deselect'; tokenId: string }
  | { kind: 'match'; tokenIds: [string, string]; cardId: string }
  | { kind: 'mismatch'; tokenIds: [string, string] }
