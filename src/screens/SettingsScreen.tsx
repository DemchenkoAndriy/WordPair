import { useApp } from '@/state/store'

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
          onChange={(e) => update({ soundEnabled: e.target.checked })}
        />
      </label>

      <label className="row">
        <span>Вібрація</span>
        <input
          type="checkbox"
          checked={settings.hapticsEnabled}
          onChange={(e) => update({ hapticsEnabled: e.target.checked })}
        />
      </label>

      <label className="row">
        <span>Безкінечний режим</span>
        <input
          type="checkbox"
          checked={settings.endless}
          onChange={(e) => update({ endless: e.target.checked })}
        />
      </label>

      <label className="row">
        <span>Пар на полі</span>
        <input
          type="range"
          min={3}
          max={8}
          value={settings.boardPairs}
          onChange={(e) => update({ boardPairs: Number(e.target.value) })}
        />
        <strong>{settings.boardPairs}</strong>
      </label>

      {!settings.endless && (
        <label className="row">
          <span>Пар у раунді</span>
          <input
            type="range"
            min={5}
            max={40}
            step={5}
            value={settings.roundPairs}
            onChange={(e) => update({ roundPairs: Number(e.target.value) })}
          />
          <strong>{settings.roundPairs}</strong>
        </label>
      )}

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
