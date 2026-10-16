/**
 * @file features/weather/hooks/use-weather.ts
 * @purpose هوک — هوای کارگاه (use-weather)
 * @safe-to-edit CAREFUL
 * @affects هوای کارگاه
 * @depends-on features/weather/lib/types
 */

'use client'

import { useEffect, useState } from 'react'
import type { WeatherPayload } from '@/features/weather/lib/types'

interface WeatherState {
  data: WeatherPayload | null
  error: string | null
  loading: boolean
}

const cache = new Map<string, WeatherPayload>()
const inflight = new Map<string, Promise<void>>()
const listeners = new Map<string, Set<(state: WeatherState) => void>>()

function keyOf(projectId: string | null): string {
  return projectId || 'tehran'
}

function emit(key: string, state: WeatherState) {
  const set = listeners.get(key)
  if (!set) return
  for (const listener of set) listener(state)
}

export function reloadWeather(projectId: string | null): Promise<void> {
  const key = keyOf(projectId)
  const existing = inflight.get(key)
  if (existing) return existing

  emit(key, { data: cache.get(key) ?? null, error: null, loading: true })
  const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''
  const task = fetch(`/api/weather${query}`, { cache: 'no-store' })
    .then(async (res) => {
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'خواندن وضعیت هوا ناموفق بود')
      cache.set(key, json as WeatherPayload)
      emit(key, { data: json as WeatherPayload, error: null, loading: false })
    })
    .catch((err) => {
      emit(key, {
        data: cache.get(key) ?? null,
        error: err instanceof Error ? err.message : 'خواندن وضعیت هوا ناموفق بود',
        loading: false,
      })
    })
    .finally(() => {
      inflight.delete(key)
    })
  inflight.set(key, task)
  return task
}

export function useWeather(projectId: string | null) {
  const key = keyOf(projectId)
  const [state, setState] = useState<WeatherState>({
    data: cache.get(key) ?? null,
    error: null,
    loading: !cache.has(key),
  })

  useEffect(() => {
    const next = (value: WeatherState) => setState(value)
    let bucket = listeners.get(key)
    if (!bucket) {
      bucket = new Set()
      listeners.set(key, bucket)
    }
    bucket.add(next)
    if (cache.has(key)) setState({ data: cache.get(key) ?? null, error: null, loading: false })
    else void reloadWeather(projectId)
    const timer = setInterval(() => void reloadWeather(projectId), 10 * 60 * 1000)
    return () => {
      bucket?.delete(next)
      clearInterval(timer)
    }
  }, [key, projectId])

  return { ...state, reload: () => reloadWeather(projectId) }
}
