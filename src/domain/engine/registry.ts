import type { ExerciseMode } from '../types'
import { pairMatchEngine } from './pairMatch'

/**
 * Реєстр режимів. Додати «написання з клавіатури» = написати typing.ts,
 * додати рядок у `engines` і пункт у `MODE_META`. Інші шари не змінюються.
 */
const engines = {
  'pair-match': pairMatchEngine,
}

export type ImplementedMode = keyof typeof engines
export type EngineOf<M extends ImplementedMode> = (typeof engines)[M]

export interface ModeMeta {
  mode: ExerciseMode
  title: string
  description: string
  implemented: boolean
}

export const MODE_META: ModeMeta[] = [
  {
    mode: 'pair-match',
    title: 'Пари',
    description: 'Зʼєднай термін із відповіддю',
    implemented: true,
  },
  {
    mode: 'typing',
    title: 'Клавіатура',
    description: 'Введи відповідь із клавіатури',
    implemented: false,
  },
]

export const AVAILABLE_MODES = Object.keys(engines) as ImplementedMode[]

export function getEngine<M extends ImplementedMode>(mode: M): EngineOf<M> {
  return engines[mode]
}

export function isImplemented(mode: ExerciseMode): mode is ImplementedMode {
  return mode in engines
}
