import type { DeckId, ExerciseMode } from '@/domain/types'

/**
 * Швидкий старт.
 *
 * IndexedDB асинхронна — читання з неї коштує кадр-два, а це видно як «блимання».
 * Тому мінімум, потрібний для показу першого екрана (яка колода, який режим,
 * рівень і стрік для шапки), дублюється в localStorage і читається СИНХРОННО
 * ще до першого рендера. Повний стан підвантажується з IDB вже під анімацію.
 */
const KEY = 'wp:boot'

export interface BootSnapshot {
  deckId: DeckId
  mode: ExerciseMode
  level: number
  xp: number
  streakDays: number
  /** Коли знімок записано — щоб не показувати протухлий стрік. */
  savedAt: number
}

export function readBootSnapshot(): BootSnapshot | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as BootSnapshot) : null
  } catch {
    return null
  }
}

export function writeBootSnapshot(snapshot: BootSnapshot): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(snapshot))
  } catch {
    // приватний режим / переповнене сховище — не критично, просто старт буде «холодним»
  }
}
