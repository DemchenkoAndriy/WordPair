import { useApp } from '@/state/store'
import { levelProgress } from '@/domain/scoring'
import { deckMastery } from '@/domain/scheduler'

/** Підсумок раунду. Головна кнопка одна — «Ще раунд»: продовження має бути в один тап. */
export function ResultScreen() {
  const record = useApp((s) => s.lastRecord)
  const profile = useApp((s) => s.profile)
  const deck = useApp((s) => s.deck)
  const progress = useApp((s) => s.progress)
  const startRound = useApp((s) => s.startRound)
  const goTo = useApp((s) => s.goTo)

  if (!record || !deck) return null
  const level = levelProgress(profile.xp)
  const mastery = deckMastery(deck.cards.map((c) => c.id), progress)

  return (
    <div className="screen">
      <h1>+{record.xp} XP</h1>
      <div className="stats-grid">
        <div className="stat">
          <div className="stat__value">{Math.round(record.accuracy * 100)}%</div>
          <div className="stat__label">Точність</div>
        </div>
        <div className="stat">
          <div className="stat__value">×{record.maxCombo}</div>
          <div className="stat__label">Найкраще комбо</div>
        </div>
        <div className="stat">
          <div className="stat__value">{Math.round(record.durationMs / 1000)} с</div>
          <div className="stat__label">Тривалість</div>
        </div>
        <div className="stat">
          <div className="stat__value">{level.xpForNext}</div>
          <div className="stat__label">XP до {level.level + 1} рівня</div>
        </div>
      </div>

      <div className="row" style={{ marginTop: 12, display: 'block' }}>
        <div className="card__title">{deck.icon} {deck.title}</div>
        <div className="card__sub">
          вивчено {mastery.mastered} · у роботі {mastery.learning} · нових {mastery.fresh}
        </div>
        <div className="mastery">
          <div className="mastery__fill" style={{ width: `${mastery.ratio * 100}%`, background: deck.accent }} />
        </div>
      </div>

      <button className="btn" onClick={() => void startRound()}>Ще раунд</button>
      <button className="btn btn--ghost" style={{ marginTop: 8 }} onClick={() => goTo('decks')}>
        Інша колода
      </button>
    </div>
  )
}
