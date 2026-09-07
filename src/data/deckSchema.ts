import type { Card, Deck } from '@/domain/types'

/**
 * Валідація контенту на межі системи.
 *
 * Колоди — це дані ззовні (JSON у репозиторії, згодом — імпорт користувача чи
 * завантаження з мережі). Тому вони заходять як `unknown` і перевіряються тут,
 * а далі по коду ходить уже гарантовано коректний `Deck`.
 */
export class DeckParseError extends Error {}

function str(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new DeckParseError(`${path}: очікується непорожній рядок`)
  }
  return value
}

function difficulty(value: unknown, path: string): Card['difficulty'] {
  if (value === undefined) return undefined
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 5) {
    throw new DeckParseError(`${path}: складність має бути цілим числом 1..5`)
  }
  return value as Card['difficulty']
}

function parseCard(raw: unknown, index: number): Card {
  if (typeof raw !== 'object' || raw === null) throw new DeckParseError(`cards[${index}]: очікується обʼєкт`)
  const r = raw as Record<string, unknown>
  const level = difficulty(r['difficulty'], `cards[${index}].difficulty`)
  return {
    id: str(r['id'], `cards[${index}].id`),
    prompt: str(r['prompt'], `cards[${index}].prompt`),
    answer: str(r['answer'], `cards[${index}].answer`),
    ...(typeof r['hint'] === 'string' ? { hint: r['hint'] } : {}),
    ...(Array.isArray(r['tags']) ? { tags: r['tags'].map((t, i) => str(t, `cards[${index}].tags[${i}]`)) } : {}),
    ...(level !== undefined ? { difficulty: level } : {}),
  }
}

function parseSpeech(raw: unknown): Deck['speech'] {
  if (raw === undefined) return undefined
  if (typeof raw !== 'object' || raw === null) throw new DeckParseError('speech: очікується обʼєкт')
  const r = raw as Record<string, unknown>
  const side = r['side']
  if (side !== 'prompt' && side !== 'answer') {
    throw new DeckParseError('speech.side: очікується "prompt" або "answer"')
  }
  return { side, lang: str(r['lang'], 'speech.lang') }
}

export function parseDeck(raw: unknown): Deck {
  if (typeof raw !== 'object' || raw === null) throw new DeckParseError('колода: очікується обʼєкт')
  const r = raw as Record<string, unknown>
  const sides = r['sideLabels']
  if (typeof sides !== 'object' || sides === null) throw new DeckParseError('sideLabels: очікується обʼєкт')
  const s = sides as Record<string, unknown>

  const cards = r['cards']
  if (!Array.isArray(cards) || cards.length === 0) throw new DeckParseError('cards: очікується непорожній масив')

  const parsed = cards.map(parseCard)
  const ids = new Set(parsed.map((c) => c.id))
  if (ids.size !== parsed.length) throw new DeckParseError('cards: ідентифікатори карток мають бути унікальними')

  return {
    id: str(r['id'], 'id'),
    title: str(r['title'], 'title'),
    ...(typeof r['subtitle'] === 'string' ? { subtitle: r['subtitle'] } : {}),
    icon: str(r['icon'], 'icon'),
    accent: str(r['accent'], 'accent'),
    locale: str(r['locale'], 'locale'),
    sideLabels: { prompt: str(s['prompt'], 'sideLabels.prompt'), answer: str(s['answer'], 'sideLabels.answer') },
    tags: Array.isArray(r['tags']) ? r['tags'].map((t, i) => str(t, `tags[${i}]`)) : [],
    version: typeof r['version'] === 'number' ? r['version'] : 1,
    ...(() => {
      const speech = parseSpeech(r['speech'])
      return speech ? { speech } : {}
    })(),
    cards: parsed,
  }
}
