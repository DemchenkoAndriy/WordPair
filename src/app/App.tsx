import { useEffect } from 'react'
import { useApp, type Screen } from '@/state/store'
import { Hud } from '@/ui/components/Hud'
import { SessionScreen } from '@/screens/SessionScreen'
import { ResultScreen } from '@/screens/ResultScreen'
import { DecksScreen } from '@/screens/DecksScreen'
import { StatsScreen } from '@/screens/StatsScreen'
import { SettingsScreen } from '@/screens/SettingsScreen'
import { setHapticsEnabled } from '@/ui/effects/haptics'
import { setSoundEnabled } from '@/ui/effects/sfx'

const NAV: { screen: Screen; label: string }[] = [
  { screen: 'session', label: 'Тренування' },
  { screen: 'decks', label: 'Колоди' },
  { screen: 'stats', label: 'Прогрес' },
  { screen: 'settings', label: 'Ще' },
]

export function App() {
  const boot = useApp((s) => s.boot)
  const ready = useApp((s) => s.ready)
  const screen = useApp((s) => s.screen)
  const goTo = useApp((s) => s.goTo)
  const startRound = useApp((s) => s.startRound)
  const profile = useApp((s) => s.profile)
  const settings = useApp((s) => s.settings)

  useEffect(() => {
    void boot()
  }, [boot])

  useEffect(() => {
    setSoundEnabled(settings.soundEnabled)
    setHapticsEnabled(settings.hapticsEnabled)
  }, [settings.soundEnabled, settings.hapticsEnabled])

  return (
    <div className="app">
      <Hud xp={profile.xp} streakDays={profile.streakDays} />
      {!ready && <div className="screen">Завантаження…</div>}
      {ready && screen === 'session' && <SessionScreen />}
      {ready && screen === 'result' && <ResultScreen />}
      {ready && screen === 'decks' && <DecksScreen />}
      {ready && screen === 'stats' && <StatsScreen />}
      {ready && screen === 'settings' && <SettingsScreen />}
      <nav className="nav">
        {NAV.map((item) => (
          <button
            key={item.screen}
            className={`nav__item${screen === item.screen ? ' nav__item--active' : ''}`}
            onClick={() => (item.screen === 'session' ? void startRound() : goTo(item.screen))}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
