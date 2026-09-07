import { useEffect, useRef, useState } from 'react'
import { useApp } from '@/state/store'
import { Banner } from '@/ui/components/Banner'
import { Combo, RoundProgress } from '@/ui/components/Hud'
import { playReward, type RewardVisual } from '@/ui/effects/rewards'
import { primeAudio } from '@/ui/effects/sfx'
import { pairMatchEngine, type PairToken } from '@/domain/engine/pairMatch'

/** Скільки плитка сіріє й гасне перед підміною. Збігається з анімацією в CSS. */
const FADE_MS = 420

/** Головний екран — механіка №1 «утворення пар». */
export function SessionScreen() {
  const round = useApp((s) => s.round)
  const session = useApp((s) => s.session)
  const deck = useApp((s) => s.deck)
  const feedback = useApp((s) => s.feedback)
  const tap = useApp((s) => s.tap)
  const sweep = useApp((s) => s.sweep)
  const finish = useApp((s) => s.finish)
  const consumeRewards = useApp((s) => s.consumeRewards)
  const rewards = useApp((s) => s.rewards)

  const [visual, setVisual] = useState<RewardVisual | null>(null)
  const [shaking, setShaking] = useState(false)
  const completedRef = useRef(false)

  // Проковтуємо чергу нагород і перетворюємо її на звук/вібрацію/анімацію.
  useEffect(() => {
    if (rewards.length === 0) return
    const events = consumeRewards()
    let latest: RewardVisual | null = null
    for (const event of events) {
      const v = playReward(event)
      if (v.banner || v.burst || v.shake) latest = v
    }
    setVisual(latest)
    if (latest?.shake) {
      setShaking(true)
      setTimeout(() => setShaking(false), 320)
    }
  }, [rewards, consumeRewards])

  // Зійшла пара — даємо плиткам посіріти й згаснути, і аж тоді підміняємо.
  // Затримка тут, а не в домені: це питання анімації, а не правил гри.
  useEffect(() => {
    if (feedback.kind !== 'match') return
    const t = setTimeout(sweep, FADE_MS)
    return () => clearTimeout(t)
  }, [feedback, sweep])

  // Раунд закрито — коротка пауза на анімацію, далі підсумок.
  useEffect(() => {
    if (!round || completedRef.current) return
    if (pairMatchEngine.isComplete(round)) {
      completedRef.current = true
      const t = setTimeout(() => void finish(), 700)
      return () => clearTimeout(t)
    }
    return
  }, [round, finish])

  useEffect(() => {
    completedRef.current = false
  }, [session?.id])

  if (!round || !deck) return <div className="screen">Готуємо раунд…</div>

  const prompts = round.tokens.filter((t) => t.side === 'prompt')
  const answers = round.tokens.filter((t) => t.side === 'answer')

  const onTap = (token: PairToken) => {
    primeAudio()
    tap(token.id)
  }

  const stateClass = (token: PairToken) => {
    if (token.matched) return ' tile--matched'
    if (round.selectedId === token.id) return ' tile--selected'
    if (feedback.kind === 'mismatch' && feedback.tokenIds.includes(token.id)) return ' tile--mismatch'
    if (token.generation > 0) return ' tile--enter'
    return ''
  }

  return (
    <>
      <RoundProgress resolved={round.resolved} target={round.target} onFinish={() => void finish()} />
      <Combo combo={session?.combo ?? 0} />
      <div className={`board${shaking ? ' shake' : ''}`}>
        <div className="column">
          <span className="column__label">{deck.sideLabels.prompt}</span>
          {prompts.map((token) => (
            <button
              key={`${token.id}:${token.generation}`}
              className={`tile${stateClass(token)}`}
              onPointerDown={() => onTap(token)}
            >
              {token.text}
            </button>
          ))}
        </div>
        <div className="column">
          <span className="column__label">{deck.sideLabels.answer}</span>
          {answers.map((token) => (
            <button
              key={`${token.id}:${token.generation}`}
              className={`tile${stateClass(token)}`}
              onPointerDown={() => onTap(token)}
            >
              {token.text}
            </button>
          ))}
        </div>
      </div>
      <Banner visual={visual} />
    </>
  )
}
