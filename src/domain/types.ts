/**
 * Ядро предметної області. Чистий TypeScript: без React, без IO, без глобальних змінних.
 * Усе, що тут описано, має бути придатним до перевикористання в іншому клієнті
 * (нативний застосунок, серверна валідація) без жодних змін.
 */

export type DeckId = string
export type CardId = string
export type SessionId = string

/** Режим вправи. Нові режими додаються сюди + у registry, решта пайплайну не змінюється. */
export type ExerciseMode = 'pair-match' | 'typing'

/** Одна одиниця знання: пара «підказка ↔ відповідь». */
export interface Card {
  id: CardId
  /** Те, що показуємо (напр. «Перейти до файлу»). */
  prompt: string
  /** Те, що треба згадати (напр. «Ctrl+P»). */
  answer: string
  /** Необовʼязкова підказка/контекст (шлях у меню, розділ довідки). */
  hint?: string
  /** Теги для під-категорій усередині колоди (напр. «навігація», «MRP»). */
  tags?: string[]
  /** Умовна складність 1..5; впливає на початковий інтервал і на XP. */
  difficulty?: 1 | 2 | 3 | 4 | 5
}

/** Колода — стала множина слів або обрана категорія (VS Code, SAP B1, Jira…). */
export interface Deck {
  id: DeckId
  title: string
  subtitle?: string
  /** Емодзі або ключ іконки; тримаємо текстом, щоб не тягнути асети. */
  icon: string
  /** Акцентний колір колоди — використовується в ефектах і на кільці прогресу. */
  accent: string
  locale: string
  /** Підписи сторін для UI: {prompt: 'Дія', answer: 'Скорочення'}. */
  sideLabels: { prompt: string; answer: string }
  tags: string[]
  /** Версія контенту; зростає при зміні карток — потрібна для міграції прогресу. */
  version: number
  cards: Card[]
}

/** Легкий опис колоди для списку — вантажиться одразу, картки — ліниво. */
export type DeckSummary = Omit<Deck, 'cards'> & { cardCount: number }

// ────────────────────────────── Прогрес ──────────────────────────────

/** Стан вивчення однієї картки (Leitner-бокси + елементи SM-2). */
export interface CardProgress {
  cardId: CardId
  deckId: DeckId
  /** 0 = нова, 1..5 = бокси Ляйтнера, 5 = вивчено. */
  box: number
  /** Множник інтервалу, звужується на помилках. 1.3..2.8 */
  ease: number
  reps: number
  lapses: number
  /** Коли картку варто показати знову (epoch ms). */
  dueAt: number
  lastSeenAt: number
  /** Середній час відповіді, мс — сигнал «знає впевнено чи згадує». */
  avgLatencyMs: number
}

/** Одна спроба відповіді. Спільний «валютний» тип для ВСІХ режимів вправ. */
export interface Attempt {
  cardId: CardId
  deckId: DeckId
  mode: ExerciseMode
  correct: boolean
  latencyMs: number
  /** true, якщо користувач скористався підказкою — XP менший, інтервал не росте. */
  usedHint?: boolean
  at: number
}

/** Підсумок завершеної сесії — рядок для історії та статистики. */
export interface SessionRecord {
  id: SessionId
  deckId: DeckId
  mode: ExerciseMode
  startedAt: number
  durationMs: number
  correct: number
  wrong: number
  xp: number
  maxCombo: number
  /** Точність 0..1 */
  accuracy: number
}

/** Глобальний профіль користувача (локальний, без акаунта). */
export interface Profile {
  xp: number
  level: number
  /** Днів поспіль із щонайменше однією завершеною сесією. */
  streakDays: number
  bestStreakDays: number
  /** Останній активний день у форматі YYYY-MM-DD (локальний час). */
  lastActiveDay: string | null
  totalSessions: number
  totalAttempts: number
  bestCombo: number
  createdAt: number
}

export interface Settings {
  soundEnabled: boolean
  hapticsEnabled: boolean
  /** Вимикає важкі анімації; автоматично вмикається при prefers-reduced-motion. */
  reducedMotion: boolean
  /** Скільки пар одночасно видно на полі. */
  boardPairs: number
  /** Скільки пар треба закрити, щоб раунд завершився. Ігнорується в безкінечному режимі. */
  roundPairs: number
  /** Безкінечний режим: картки підтягуються нескінченно, раунд завершує користувач. */
  endless: boolean
  /** Ціль на день у сесіях. */
  dailyGoalSessions: number
  lastDeckId: DeckId | null
  lastMode: ExerciseMode
}

// ────────────────────────────── Нагороди ──────────────────────────────

/**
 * Події «дофамінового» шару. Домен їх лише ПОРОДЖУЄ, нічого не знаючи
 * про звук, вібрацію чи анімацію — це відповідальність features/rewards.
 */
export type RewardEvent =
  | { type: 'hit'; combo: number; xp: number; critical: boolean }
  | { type: 'miss' }
  | { type: 'combo-milestone'; combo: number }
  | { type: 'round-cleared'; perfect: boolean }
  | { type: 'level-up'; level: number }
  | { type: 'streak-extended'; days: number }
  | { type: 'card-mastered'; cardId: CardId }
  | { type: 'deck-mastered'; deckId: DeckId }
