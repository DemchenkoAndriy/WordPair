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

interface RoundProgressProps {
  resolved: number
  /** null — безкінечний режим: цілі немає, є лічильник і кнопка завершення. */
  target: number | null
  onFinish(): void
}

/**
 * Прогрес усередині раунду.
 * У скінченному режимі — смужка з лічильником; у безкінечному цілі не існує,
 * тому показуємо накопичене й даємо єдиний спосіб зупинитися.
 */
export function RoundProgress({ resolved, target, onFinish }: RoundProgressProps) {
  if (target === null) {
    return (
      <div className="round-progress">
        <span className="round-progress__count">∞ · {resolved}</span>
        <button type="button" className="round-progress__finish" onClick={onFinish}>
          Завершити
        </button>
      </div>
    )
  }

  const ratio = target === 0 ? 0 : Math.min(1, resolved / target)
  return (
    <div className="round-progress">
      <div
        className="round-progress__bar"
        role="progressbar"
        aria-valuenow={resolved}
        aria-valuemin={0}
        aria-valuemax={target}
        aria-label={`Пар закрито ${resolved} з ${target}`}
      >
        <div className="round-progress__fill" style={{ width: `${ratio * 100}%` }} />
      </div>
      <span className="round-progress__count">
        {resolved}/{target}
      </span>
    </div>
  )
}

export function Combo({ combo }: { combo: number }) {
  return <div className={`combo${combo > 1 ? ' combo--active' : ''}`}>{combo > 1 ? `×${combo}` : ''}</div>
}
