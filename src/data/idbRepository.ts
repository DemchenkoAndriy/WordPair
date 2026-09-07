import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { CardId, CardProgress, DeckId, Profile, SessionRecord, Settings } from '@/domain/types'
import type { ProgressRepository } from './repository'
import { dayKey } from '@/lib/time'

interface WordPairDB extends DBSchema {
  cardProgress: {
    key: string // `${deckId}:${cardId}`
    value: CardProgress & { key: string }
    indexes: { byDeck: DeckId }
  }
  sessions: {
    key: string
    value: SessionRecord
    indexes: { byStartedAt: number }
  }
  kv: {
    key: string
    value: unknown
  }
}

const DB_NAME = 'wordpair'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<WordPairDB>> | null = null

function db() {
  dbPromise ??= openDB<WordPairDB>(DB_NAME, DB_VERSION, {
    upgrade(database) {
      const progress = database.createObjectStore('cardProgress', { keyPath: 'key' })
      progress.createIndex('byDeck', 'deckId')
      const sessions = database.createObjectStore('sessions', { keyPath: 'id' })
      sessions.createIndex('byStartedAt', 'startedAt')
      database.createObjectStore('kv')
    },
  })
  return dbPromise
}

const progressKey = (deckId: DeckId, cardId: CardId) => `${deckId}:${cardId}`

export const idbRepository: ProgressRepository = {
  async loadDeckProgress(deckId) {
    const rows = await (await db()).getAllFromIndex('cardProgress', 'byDeck', deckId)
    return new Map(rows.map((row) => [row.cardId, row]))
  },

  async saveCardProgress(items) {
    if (items.length === 0) return
    const tx = (await db()).transaction('cardProgress', 'readwrite')
    await Promise.all([
      ...items.map((item) => tx.store.put({ ...item, key: progressKey(item.deckId, item.cardId) })),
      tx.done,
    ])
  },

  async loadProfile() {
    return ((await (await db()).get('kv', 'profile')) as Profile | undefined) ?? null
  },

  async saveProfile(profile) {
    await (await db()).put('kv', profile, 'profile')
  },

  async loadSettings() {
    return ((await (await db()).get('kv', 'settings')) as Settings | undefined) ?? null
  },

  async saveSettings(settings) {
    await (await db()).put('kv', settings, 'settings')
  },

  async appendSession(record) {
    await (await db()).put('sessions', record)
  },

  async recentSessions(limit) {
    const all = await (await db()).getAllFromIndex('sessions', 'byStartedAt')
    return all.slice(-limit).reverse()
  },

  async activityByDay(sinceDayKey) {
    const all = await (await db()).getAllFromIndex('sessions', 'byStartedAt')
    const out: Record<string, number> = {}
    for (const record of all) {
      const key = dayKey(record.startedAt)
      if (key < sinceDayKey) continue
      out[key] = (out[key] ?? 0) + 1
    }
    return out
  },
}
