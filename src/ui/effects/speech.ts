/**
 * Озвучення слів через Web Speech API.
 *
 * Голоси системні: нуль байтів у бандлі, працює офлайн, не потребує ні ключа,
 * ні мережі — тобто не суперечить локальності застосунку.
 *
 * Усе тут захищене від відсутності API: на пристрої без голосів озвучення
 * просто мовчить, нічого не ламаючи.
 */

let enabled = true

/**
 * Фрази, які ще не відзвучали.
 *
 * Не косметика: WebKit може зібрати SpeechSynthesisUtterance сміттям ще до того,
 * як вона прозвучить, якщо на неї ніхто не посилається. Тоді озвучення мовчки
 * не відбувається — саме той симптом, який важко пояснити.
 */
const pending = new Set<SpeechSynthesisUtterance>()

function synth(): SpeechSynthesis | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null
  return window.speechSynthesis
}

/** Список голосів на iOS приходить не одразу — торкаємось його, щоб почав вантажитись. */
export function initSpeech(): void {
  const s = synth()
  if (!s) return
  s.getVoices()
  s.addEventListener?.('voiceschanged', () => s.getVoices())
}

export function setSpeechEnabled(value: boolean): void {
  enabled = value
  if (!value) {
    synth()?.cancel()
    pending.clear()
  }
}

export function isSpeechEnabled(): boolean {
  return enabled
}

/**
 * Вибір голосу під мову. Чиста функція — щоб правило було перевіреним,
 * а не з'ясовувалось на пристрої користувача.
 */
export function selectVoice<T extends { lang: string }>(voices: readonly T[], lang: string): T | undefined {
  const want = lang.replace('_', '-').toLowerCase()
  const norm = (v: T) => v.lang.replace('_', '-').toLowerCase()
  return voices.find((v) => norm(v) === want) ?? voices.find((v) => norm(v).startsWith(want.split('-')[0] ?? ''))
}

/** Голоси перечитуємо щоразу: застарілий обʼєкт голосу на iOS дає німу фразу. */
function voicesNow(): SpeechSynthesisVoice[] {
  return synth()?.getVoices() ?? []
}

export interface SpeechDiagnostics {
  supported: boolean
  enabled: boolean
  voiceCount: number
  matching: string[]
  selected: string | null
  /** Скільки фраз ще не відзвучали. Ненульове значення, що не спадає, — ознака зависання. */
  pending: number
}

/** Що застосунок бачить просто зараз — для панелі перевірки в налаштуваннях. */
export function diagnose(lang: string): SpeechDiagnostics {
  const voices = voicesNow()
  const want = lang.split('-')[0]?.toLowerCase() ?? ''
  const matching = voices.filter((v) => v.lang.replace('_', '-').toLowerCase().startsWith(want))
  const selected = selectVoice(voices, lang)
  return {
    supported: synth() !== null,
    enabled,
    voiceCount: voices.length,
    matching: matching.map((v) => `${v.name} (${v.lang})`),
    selected: selected ? `${selected.name} (${selected.lang})` : null,
    pending: pending.size,
  }
}

export type SpeakStatus = 'requested' | 'speaking' | 'done' | 'error'

/**
 * Вимовити слово.
 *
 * ВАЖЛИВО: на iOS виклик має йти з обробника дотику. Тому цю функцію кличемо
 * прямо з onPointerDown плитки, а не з useEffect після оновлення стану —
 * інакше Safari мовчки проігнорує.
 *
 * `onStatus` дозволяє побачити, що саме сталося: якщо приходить `speaking`,
 * а звуку не чути — проблема не в коді, а в гучності чи режимі пристрою.
 */
export function speak(
  text: string,
  lang: string,
  onStatus?: (status: SpeakStatus, detail?: string) => void,
): void {
  if (!enabled) {
    onStatus?.('error', 'озвучення вимкнено в налаштуваннях')
    return
  }
  const s = synth()
  if (!s) {
    onStatus?.('error', 'браузер не підтримує Web Speech API')
    return
  }

  // iOS іноді лишає синтез на паузі після згортання застосунку.
  if (s.paused) s.resume()
  // Швидкі тапи не мають ставати чергою: свіже слово перебиває попереднє.
  if (s.speaking || s.pending) s.cancel()

  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = lang
  const voice = selectVoice(voicesNow(), lang)
  if (voice) utterance.voice = voice
  utterance.rate = 0.95
  utterance.onstart = () => onStatus?.('speaking')
  utterance.onend = () => {
    pending.delete(utterance)
    onStatus?.('done')
  }
  utterance.onerror = (event) => {
    pending.delete(utterance)
    onStatus?.('error', (event as SpeechSynthesisErrorEvent).error || 'невідома помилка')
  }

  pending.add(utterance)
  onStatus?.('requested')
  try {
    s.speak(utterance)
  } catch (error) {
    pending.delete(utterance)
    onStatus?.('error', error instanceof Error ? error.message : String(error))
  }
}
