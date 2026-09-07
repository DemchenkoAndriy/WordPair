import { DECK_CATALOG } from '@/data/decks'
import { useApp } from '@/state/store'

/** Вибір колоди. Один тап — і одразу починається раунд, без проміжного «Почати». */
export function DecksScreen() {
  const startRound = useApp((s) => s.startRound)
  const currentId = useApp((s) => s.deck?.id)

  return (
    <div className="screen">
      <h1>Колоди</h1>
      {DECK_CATALOG.map((deck) => (
        <button key={deck.id} className="card" onClick={() => void startRound(deck.id)}>
          <div className="card__title">
            {deck.icon} {deck.title} {deck.id === currentId ? '·' : ''}
          </div>
          <div className="card__sub">
            {deck.subtitle} · {deck.cardCount} слів
          </div>
        </button>
      ))}
    </div>
  )
}
