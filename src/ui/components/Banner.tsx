import type { RewardVisual } from '@/ui/effects/rewards'

export function Banner({ visual }: { visual: RewardVisual | null }) {
  if (!visual?.banner) return null
  return (
    <div className={`banner banner--${visual.banner.tone}`} key={visual.banner.text + Date.now()}>
      {visual.banner.text}
    </div>
  )
}
