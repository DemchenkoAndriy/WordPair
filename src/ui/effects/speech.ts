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
let voices: SpeechSynthesisVoice[] = []

function synth(): SpeechSynthesis | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null
  return window.speechSynthesis
}

/** Список голосів на iOS приходить не одразу — перечитуємо за подією. */
export function initSpeech(): void {
  const s = synth()
  if (!s) return
  const read = () => {
    voices = s.getVoices()
  }
  read()
  s.addEventListener?.('voiceschanged', read)
}

export function setSpeechEnabled(value: boolean): void {
  enabled = value
  if (!value) synth()?.cancel()
}

function pickVoice(lang: string): SpeechSynthesisVoice | undefined {
  if (voices.length === 0) voices = synth()?.getVoices() ?? []
  const exact = voices.find((v) => v.lang.replace('_', '-').toLowerCase() === lang.toLowerCase())
  if (exact) return exact
  const prefix = lang.split('-')[0]?.toLowerCase() ?? ''
  return voices.find((v) => v.lang.replace('_', '-').toLowerCase().startsWith(prefix))
}

/** Чи є взагалі чим озвучити цю мову. */
export function canSpeak(lang: string): boolean {
  return synth() !== null && pickVoice(lang) !== undefined
}

/**
 * Вимовити слово.
 *
 * ВАЖЛИВО: на iOS перший виклик має піти з обробника дотику. Тому цю функцію
 * кличемо прямо з onPointerDown плитки, а не з useEffect після оновлення стану —
 * інакше Safari мовчки проігнорує.
 */
export function speak(text: string, lang: string): void {
  if (!enabled) return
  const s = synth()
  if (!s) return

  // Швидкі тапи не мають ставати чергою: свіже слово перебиває попереднє.
  if (s.speaking || s.pending) s.cancel()

  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = lang
  const voice = pickVoice(lang)
  if (voice) utterance.voice = voice
  utterance.rate = 0.95
  try {
    s.speak(utterance)
  } catch {
    // деякі рушії кидають, якщо викликати поза жестом користувача
  }
}
