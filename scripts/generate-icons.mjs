/**
 * Генерація іконок PWA з тієї самої фігури, що й favicon.svg.
 * Пишемо PNG вручну через zlib, щоб не тягнути в проєкт залежність
 * заради двох файлів, які змінюються раз на рік.
 *
 *   node scripts/generate-icons.mjs
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(ROOT, 'public')

const BG = [0x0b, 0x0d, 0x17]
const LEFT = [0x7c, 0x5c, 0xff]
const RIGHT = [0x00, 0xe0, 0xa4]
/** Згладжування суперсемплінгом: рахуємо SS×SS підпікселів на піксель. */
const SS = 4

function crc32(buf) {
  let crc = ~0
  for (const byte of buf) {
    crc ^= byte
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return ~crc >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function png(size, pixels) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // біт на канал
  ihdr[9] = 2 // truecolor RGB
  // рядки з фільтром 0 на початку кожного
  const stride = size * 3
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** Колір підпікселя: дві кола-«пари», що частково перекриваються. */
function sample(x, y, size) {
  const r = size * 0.17
  const cy = size / 2
  const inLeft = (x - size * 0.38) ** 2 + (y - cy) ** 2 <= r * r
  const inRight = (x - size * 0.62) ** 2 + (y - cy) ** 2 <= r * r
  if (inLeft && inRight) return [0x3e, 0x9e, 0xd4] // зона перекриття — «пара утворена»
  if (inLeft) return LEFT
  if (inRight) return RIGHT
  return BG
}

function render(size) {
  const pixels = Buffer.alloc(size * size * 3)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0
      let g = 0
      let b = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const c = sample(x + (sx + 0.5) / SS, y + (sy + 0.5) / SS, size)
          r += c[0]
          g += c[1]
          b += c[2]
        }
      }
      const n = SS * SS
      const i = (y * size + x) * 3
      pixels[i] = Math.round(r / n)
      pixels[i + 1] = Math.round(g / n)
      pixels[i + 2] = Math.round(b / n)
    }
  }
  return png(size, pixels)
}

mkdirSync(OUT, { recursive: true })
for (const size of [192, 512]) {
  const file = resolve(OUT, `icon-${size}.png`)
  writeFileSync(file, render(size))
  console.log(`✓ public/icon-${size}.png`)
}
