import { levelProgress } from '@/domain/scoring'

interface HudProps {
  xp: number
  streakDays: number
  soundEnabled: boolean
  onToggleSound(): void
}

/**
 * Постійні показники прогресу: рівень, XP-смужка, денний стрік.
 * Тут же — вимкнення звуку: воно потрібне саме посеред раунду
 * (в транспорті, на нараді), а не через два переходи в налаштуваннях.
 */
export function Hud({ xp, streakDays, soundEnabled, onToggleSound }: HudProps) {
  const level = levelProgress(xp)
  return (
    <div className="hud">
      <span className="hud__level">LVL {level.level}</span>
      <div className="hud__bar" role="progressbar" aria-valuenow={Math.round(level.ratio * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Прогрес рівня">
        <div className="hud__fill" style={{ width: `${level.ratio * 100}%` }} />
      </div>
      <span className="hud__streak">🔥 {streakDays}</span>
      <button
        type="button"
        className="hud__mute"
        onClick={onToggleSound}
        aria-pressed={!soundEnabled}
        aria-label={soundEnabled ? 'Вимкнути звук' : 'Увімкнути звук'}
        title={soundEnabled ? 'Вимкнути звук' : 'Увімкнути звук'}
      >
        {soundEnabled ? '🔊' : '🔇'}
      </button>
    </div>
  )
}

/** Прогрес усередині раунду — крапки замість відсотків: читається за 100 мс. */
export function RoundProgress({ resolved, total }: { resolved: number; total: number }) {
  return (
    <div className="round-progress" aria-label={`Пар закрито ${resolved} з ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`round-progress__dot${i < resolved ? ' round-progress__dot--done' : ''}`} />
      ))}
    </div>
  )
}

export function Combo({ combo }: { combo: number }) {
  return <div className={`combo${combo > 1 ? ' combo--active' : ''}`}>{combo > 1 ? `×${combo}` : ''}</div>
}
