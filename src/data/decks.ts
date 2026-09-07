import type { Deck, DeckId, DeckSummary } from '@/domain/types'
import { parseDeck } from './deckSchema'

/**
 * Реєстр колод.
 *
 * Короткі описи (`summaries`) підвантажуються синхронно — вони потрібні на першому екрані.
 * Самі картки лежать в окремих чанках і вантажаться ліниво: холодний старт не має
 * тягнути 20 колод, коли користувач відкриє одну.
 */

const loaders: Record<DeckId, () => Promise<{ default: unknown }>> = {
  vscode: () => import('@/content/decks/vscode.json'),
  'vscode-ui': () => import('@/content/decks/vscode-ui.json'),
  'sap-b1': () => import('@/content/decks/sap-b1.json'),
  jira: () => import('@/content/decks/jira.json'),
}

/** Легкий каталог. Тримається окремо від контенту, щоб не роздувати перший чанк. */
export const DECK_CATALOG: DeckSummary[] = [
  {
    id: 'vscode-ui',
    title: 'VS Code · Інтерфейс',
    subtitle: 'Як називаються частини редактора',
    icon: '🧩',
    accent: '#5cc8ff',
    locale: 'uk',
    sideLabels: { prompt: 'Назва в інтерфейсі', answer: 'Що це' },
    tags: ['ide', 'ui'],
    version: 1,
    cardCount: 40,
  },
  {
    id: 'vscode',
    title: 'VS Code · Клавіші',
    subtitle: 'Гарячі клавіші (Windows / Linux)',
    icon: '⌨️',
    accent: '#3aa0ff',
    locale: 'uk',
    sideLabels: { prompt: 'Дія', answer: 'Скорочення' },
    tags: ['ide', 'shortcuts'],
    version: 2,
    cardCount: 40,
  },
  {
    id: 'sap-b1',
    title: 'SAP Business One',
    subtitle: 'Українська локалізація + Beas',
    icon: '🏭',
    accent: '#00e0a4',
    locale: 'uk',
    sideLabels: { prompt: 'Термін інтерфейсу', answer: 'Що це' },
    tags: ['erp', 'sap'],
    version: 1,
    cardCount: 22,
  },
  {
    id: 'jira',
    title: 'Jira',
    subtitle: 'Терміни трекера задач',
    icon: '🗂️',
    accent: '#7c5cff',
    locale: 'uk',
    sideLabels: { prompt: 'Термін', answer: 'Значення' },
    tags: ['agile', 'tools'],
    version: 1,
    cardCount: 20,
  },
]

export const DEFAULT_DECK_ID: DeckId = 'vscode-ui'

const cache = new Map<DeckId, Deck>()

export function getCachedDeck(id: DeckId): Deck | undefined {
  return cache.get(id)
}

export async function loadDeck(id: DeckId): Promise<Deck> {
  const cached = cache.get(id)
  if (cached) return cached
  const loader = loaders[id]
  if (!loader) throw new Error(`Невідома колода: ${id}`)
  // JSON — зовнішні дані, тому проходять валідацію, а не приведення типу.
  const deck = parseDeck((await loader()).default)
  cache.set(id, deck)
  return deck
}

export function findSummary(id: DeckId): DeckSummary | undefined {
  return DECK_CATALOG.find((d) => d.id === id)
}
