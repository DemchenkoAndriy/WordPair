import { useEffect, useState } from 'react'
import { useApp } from '@/state/store'
import { idbRepository } from '@/data/idbRepository'
import { levelProgress } from '@/domain/scoring'
import type { SessionRecord } from '@/domain/types'

/** Показники прогресу за весь час. Читає історію напряму зі сховища. */
export function StatsScreen() {
  const profile = useApp((s) => s.profile)
  const [sessions, setSessions] = useState<SessionRecord[]>([])

  useEffect(() => {
    void idbRepository.recentSessions(20).then(setSessions)
  }, [])

  const level = levelProgress(profile.xp)
  const totalMinutes = Math.round(sessions.reduce((sum, s) => sum + s.durationMs, 0) / 60000)
  const avgAccuracy = sessions.length
    ? Math.round((sessions.reduce((sum, s) => sum + s.accuracy, 0) / sessions.length) * 100)
    : 0

  return (
    <div className="screen">
      <h1>Прогрес</h1>
      <div className="stats-grid">
        <div className="stat">
          <div className="stat__value">{level.level}</div>
          <div className="stat__label">Рівень · {profile.xp} XP</div>
        </div>
        <div className="stat">
          <div className="stat__value">🔥 {profile.streakDays}</div>
          <div className="stat__label">Днів поспіль (рекорд {profile.bestStreakDays})</div>
        </div>
        <div className="stat">
          <div className="stat__value">{profile.totalSessions}</div>
          <div className="stat__label">Раундів усього</div>
        </div>
        <div className="stat">
          <div className="stat__value">×{profile.bestCombo}</div>
          <div className="stat__label">Найкраще комбо</div>
        </div>
        <div className="stat">
          <div className="stat__value">{avgAccuracy}%</div>
          <div className="stat__label">Середня точність</div>
        </div>
        <div className="stat">
          <div className="stat__value">{totalMinutes} хв</div>
          <div className="stat__label">Часу за останні раунди</div>
        </div>
      </div>
    </div>
  )
}
