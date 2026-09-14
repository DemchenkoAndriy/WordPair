import { useEffect, useState } from 'react'
import { DECK_CATALOG } from '@/data/decks'
import { diagnose, speak, type SpeakStatus } from '@/ui/effects/speech'

const TEST_LANG = 'en-US'
const TEST_PHRASE = 'Command Palette'

/**
 * Перевірка озвучення.
 *
 * Потрібна тому, що німе озвучення має щонайменше чотири різні причини —
 * немає API, немає голосу, вимкнено в налаштуваннях, або звук глушить сам
 * пристрій — і зовні вони виглядають однаково. Панель розрізняє їх за фактом:
 * якщо приходить «звучить», а чути нічого, справа вже не в застосунку.
 */
export function SpeechCheck() {
  const [info, setInfo] = useState(() => diagnose(TEST_LANG))
  const [status, setStatus] = useState<SpeakStatus | null>(null)
  const [detail, setDetail] = useState<string | null>(null)

  // Голоси на iOS з’являються не одразу — перечитуємо, поки не з’являться.
  useEffect(() => {
    if (info.voiceCount > 0) return
    const t = setInterval(() => setInfo(diagnose(TEST_LANG)), 500)
    const stop = setTimeout(() => clearInterval(t), 5000)
    return () => {
      clearInterval(t)
      clearTimeout(stop)
    }
  }, [info.voiceCount])

  const speaking = DECK_CATALOG.filter((d) => d.id === 'vscode-ui' || d.id === 'jira')

  const run = () => {
    setStatus(null)
    setDetail(null)
    setInfo(diagnose(TEST_LANG))
    speak(TEST_PHRASE, TEST_LANG, (next, why) => {
      setStatus(next)
      if (why) setDetail(why)
    })
  }

  const verdict = (): string => {
    if (!info.supported) return 'Браузер не підтримує озвучення'
    if (!info.enabled) return 'Вимкнено — увімкніть звук у шапці й тумблер вище'
    if (info.voiceCount === 0) return 'Система ще не віддала голоси'
    if (info.matching.length === 0) return 'Немає жодного англійського голосу'
    if (status === 'error') return `Помилка: ${detail}`
    if (status === 'speaking') return 'Звучить — якщо не чути, справа в гучності або беззвучному режимі'
    if (status === 'done') return 'Фразу вимовлено повністю'
    if (status === 'requested') return 'Запит надіслано, чекаємо на початок…'
    return 'Готово до перевірки'
  }

  return (
    <div className="row" style={{ display: 'block' }}>
      <div className="card__title">Перевірка озвучення</div>
      <div className="card__sub" style={{ marginTop: 6 }}>
        Голосів у системі: {info.voiceCount}, англійських: {info.matching.length}
        <br />
        Обрано: {info.selected ?? '—'}
        {info.pending > 0 && <><br />У черзі фраз: {info.pending}</>}
      </div>
      <button className="btn btn--ghost" style={{ marginTop: 10 }} onClick={run}>
        Вимовити «{TEST_PHRASE}»
      </button>
      <div className="card__sub" style={{ marginTop: 8 }}>{verdict()}</div>
      <div className="card__sub" style={{ marginTop: 8 }}>
        Озвучуються лише колоди з англійським боком: {speaking.map((d) => d.title).join(', ')}.
        Колоди клавіш і SAP мовчать за задумом.
      </div>
    </div>
  )
}
