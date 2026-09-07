import type { RewardEvent } from '@/domain/types'
import { haptic } from './haptics'
import { sfx } from './sfx'

/**
 * Єдина точка, де подія домену перетворюється на відчуття.
 * Домен не знає про звук і вібрацію; UI не знає про правила нарахування.
 * Додати новий ефект = дописати case, не чіпаючи логіку навчання.
 */
export interface RewardVisual {
  /** Що показати поверх екрана. */
  banner?: { text: string; tone: 'good' | 'great' | 'bad' }
  /** Сплеск часток у місці останнього тапу. */
  burst?: 'small' | 'big'
  /** Струс екрана на помилці. */
  shake?: boolean
}

export function playReward(event: RewardEvent): RewardVisual {
  switch (event.type) {
    case 'hit':
      haptic('hit')
      if (event.critical) {
        sfx.crit()
        return { banner: { text: `КРИТ ×2  +${event.xp}`, tone: 'great' }, burst: 'big' }
      }
      sfx.hit(event.combo)
      return { burst: 'small' }

    case 'miss':
      haptic('miss')
      sfx.miss()
      return { shake: true, banner: { text: 'Комбо втрачено', tone: 'bad' } }

    case 'combo-milestone':
      haptic('milestone')
      sfx.milestone()
      return { banner: { text: `${event.combo} поспіль 🔥`, tone: 'great' }, burst: 'big' }

    case 'round-cleared':
      haptic('clear')
      sfx.clear()
      return event.perfect ? { banner: { text: 'Ідеальний раунд ✨', tone: 'great' }, burst: 'big' } : {}

    case 'level-up':
      haptic('levelUp')
      sfx.levelUp()
      return { banner: { text: `Рівень ${event.level}!`, tone: 'great' }, burst: 'big' }

    case 'streak-extended':
      return { banner: { text: `${event.days} дн. поспіль 🔥`, tone: 'good' } }

    case 'card-mastered':
      return { banner: { text: 'Слово вивчено ✓', tone: 'good' } }

    case 'deck-mastered':
      haptic('levelUp')
      sfx.levelUp()
      return { banner: { text: 'Колоду закрито 🏆', tone: 'great' }, burst: 'big' }
  }
}
