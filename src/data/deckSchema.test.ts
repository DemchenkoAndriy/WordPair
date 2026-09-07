import { describe, expect, it } from 'vitest'
import { DeckParseError, parseDeck } from './deckSchema'
import jira from '@/content/decks/jira.json'
import sapB1 from '@/content/decks/sap-b1.json'
import vscode from '@/content/decks/vscode.json'
import vscodeUi from '@/content/decks/vscode-ui.json'

const valid = {
  id: 'demo',
  title: 'Демо',
  icon: '🧩',
  accent: '#fff',
  locale: 'uk',
  sideLabels: { prompt: 'Термін', answer: 'Значення' },
  tags: ['test'],
  version: 1,
  cards: [{ id: 'c1', prompt: 'Sprint', answer: 'Відрізок часу' }],
}

describe('deckSchema', () => {
  it('приймає мінімально коректну колоду', () => {
    const deck = parseDeck(valid)
    expect(deck.id).toBe('demo')
    expect(deck.cards).toHaveLength(1)
    expect(deck.speech).toBeUndefined()
  })

  it('відкидає порожній масив карток', () => {
    expect(() => parseDeck({ ...valid, cards: [] })).toThrow(DeckParseError)
  })

  it('відкидає дублікати ідентифікаторів карток', () => {
    const cards = [valid.cards[0], { ...valid.cards[0] }]
    expect(() => parseDeck({ ...valid, cards })).toThrow(/унікальними/)
  })

  it('відкидає складність поза діапазоном 1..5', () => {
    expect(() => parseDeck({ ...valid, cards: [{ ...valid.cards[0], difficulty: 9 }] })).toThrow(/1\.\.5/)
  })

  it('повідомляє, у якому саме полі помилка', () => {
    expect(() => parseDeck({ ...valid, cards: [{ id: 'c1', prompt: '', answer: 'x' }] })).toThrow(
      /cards\[0\]\.prompt/,
    )
  })

  it('приймає налаштування озвучення', () => {
    const deck = parseDeck({ ...valid, speech: { side: 'prompt', lang: 'en-US' } })
    expect(deck.speech).toEqual({ side: 'prompt', lang: 'en-US' })
  })

  it('відкидає невідому сторону озвучення', () => {
    expect(() => parseDeck({ ...valid, speech: { side: 'both', lang: 'en-US' } })).toThrow(/speech\.side/)
  })

  it('відкидає озвучення без мови', () => {
    expect(() => parseDeck({ ...valid, speech: { side: 'prompt' } })).toThrow(/speech\.lang/)
  })

  it('усі колоди репозиторію проходять валідацію', () => {
    for (const raw of [jira, sapB1, vscode, vscodeUi]) {
      const deck = parseDeck(raw)
      expect(deck.cards.length).toBeGreaterThan(0)
      expect(new Set(deck.cards.map((c) => c.id)).size).toBe(deck.cards.length)
    }
  })

  it('озвучують саме англійський бік — і лише ті колоди, де він є', () => {
    expect(parseDeck(vscodeUi).speech).toEqual({ side: 'prompt', lang: 'en-US' })
    expect(parseDeck(jira).speech).toEqual({ side: 'prompt', lang: 'en-US' })
    // Колода гарячих клавіш не має вимовляти «Ctrl+Shift+P»,
    // а SAP-колода — українські терміни англійським голосом.
    expect(parseDeck(vscode).speech).toBeUndefined()
    expect(parseDeck(sapB1).speech).toBeUndefined()
  })

  it('відкидає не-обʼєкт', () => {
    expect(() => parseDeck(null)).toThrow(DeckParseError)
    expect(() => parseDeck('колода')).toThrow(DeckParseError)
  })
})
