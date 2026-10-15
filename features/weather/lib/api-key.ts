import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const KEY_NAMES = ['WEATHER_API_KEY', 'NEXT_PUBLIC_WEATHER_API_KEY', 'OPENWEATHER_API_KEY'] as const

function fromProcess(): string {
  for (const name of KEY_NAMES) {
    const value = process.env[name]?.trim()
    if (value) return value
  }
  return ''
}

function decodeEnvFile(raw: Buffer): string {
  if (raw.length >= 2 && raw[0] === 0xff && raw[1] === 0xfe) return raw.toString('utf16le')
  if (raw.length >= 2 && raw[0] === 0xfe && raw[1] === 0xff) {
    const swapped = Buffer.alloc(raw.length - 2)
    for (let i = 2; i + 1 < raw.length; i += 2) {
      swapped[i - 2] = raw[i + 1]!
      swapped[i - 1] = raw[i]!
    }
    return swapped.toString('utf16le')
  }
  return raw.toString('utf8').replace(/^\uFEFF/, '')
}

function fromDotEnvFile(): string {
  try {
    for (const file of ['.env.local', '.env']) {
      const path = join(process.cwd(), file)
      if (!existsSync(path)) continue
      const text = decodeEnvFile(readFileSync(path))
      for (const name of KEY_NAMES) {
        const match = text.match(new RegExp(`^${name}=([^\\r\\n]+)`, 'm'))
        const value = match?.[1]?.trim().replace(/^['"]|['"]$/g, '')
        if (value) return value
      }
    }
  } catch {
    return ''
  }
  return ''
}

/** OpenWeatherMap key from the process env, or directly from `.env.local` if Next did not inject it. */
export function weatherApiKey(): string {
  return fromProcess() || fromDotEnvFile()
}
