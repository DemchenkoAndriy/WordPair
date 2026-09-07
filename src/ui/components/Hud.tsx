import { levelProgress } from '@/domain/scoring'

/** Постійні показники прогресу: рівень, XP-смужка, денний стрік. */
export function Hud({ xp, streakDays }: { xp: number; streakDays: number }) {
  const level = levelProgress(xp)
  return (
    <div className="hud">
      <span className="hud__level">LVL {level.level}</span>
      <div className="hud__bar" role="progressbar" aria-valuenow={Math.round(level.ratio * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Прогрес рівня">
        <div className="hud__fill" style={{ width: `${level.ratio * 100}%` }} />
      </div>
      <span className="hud__streak">🔥 {streakDays}</span>
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
