import { describe, expect, it } from 'vitest'
import { selectVoice } from './speech'

const voices = [
  { lang: 'uk-UA', name: 'Lesya' },
  { lang: 'en_GB', name: 'Daniel' },
  { lang: 'en-US', name: 'Samantha' },
]

describe('selectVoice', () => {
  it('віддає перевагу точному збігу мови', () => {
    expect(selectVoice(voices, 'en-US')?.name).toBe('Samantha')
  })

  it('падає назад на будь-який голос тієї ж мови', () => {
    expect(selectVoice(voices, 'en-AU')?.name).toBe('Daniel')
  })

  it('не зважає на підкреслення в коді мови — так їх пише iOS', () => {
    expect(selectVoice(voices, 'en-GB')?.name).toBe('Daniel')
  })

  it('не зважає на регістр', () => {
    expect(selectVoice(voices, 'EN-us')?.name).toBe('Samantha')
  })

  it('повертає undefined, коли потрібної мови немає', () => {
    expect(selectVoice(voices, 'de-DE')).toBeUndefined()
    expect(selectVoice([], 'en-US')).toBeUndefined()
  })
})
