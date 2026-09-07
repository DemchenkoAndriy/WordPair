import { useApp } from '@/state/store'
import { setHapticsEnabled } from '@/ui/effects/haptics'
import { setSoundEnabled } from '@/ui/effects/sfx'

export function SettingsScreen() {
  const settings = useApp((s) => s.settings)
  const update = useApp((s) => s.updateSettings)

  return (
    <div className="screen">
      <h1>Налаштування</h1>

      <label className="row">
        <span>Звук</span>
        <input
          type="checkbox"
          checked={settings.soundEnabled}
          onChange={(e) => {
            setSoundEnabled(e.target.checked)
            update({ soundEnabled: e.target.checked })
          }}
        />
      </label>

      <label className="row">
        <span>Вібрація</span>
        <input
          type="checkbox"
          checked={settings.hapticsEnabled}
          onChange={(e) => {
            setHapticsEnabled(e.target.checked)
            update({ hapticsEnabled: e.target.checked })
          }}
        />
      </label>

      <label className="row">
        <span>Пар у раунді</span>
        <input
          type="range"
          min={4}
          max={8}
          value={settings.pairsPerRound}
          onChange={(e) => update({ pairsPerRound: Number(e.target.value) })}
        />
        <strong>{settings.pairsPerRound}</strong>
      </label>

      <label className="row">
        <span>Ціль на день, раундів</span>
        <input
          type="range"
          min={1}
          max={10}
          value={settings.dailyGoalSessions}
          onChange={(e) => update({ dailyGoalSessions: Number(e.target.value) })}
        />
        <strong>{settings.dailyGoalSessions}</strong>
      </label>
    </div>
  )
}
