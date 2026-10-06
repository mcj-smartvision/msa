'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Controller, useFormContext } from 'react-hook-form'
import { MapPin, Search } from 'lucide-react'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Button } from '@/shared/components/ui/button'
import {
buildGeocodeQuery,
formatCoord,
getCountryMapCenter,
parseGeocoderResult,
parseLatLng,
parsePlaceResult,
} from '@/shared/lib/maps/geocoding'
import { loadLeaflet, nominatimReverse, nominatimSearch, type LeafletMap, type LeafletMarker } from '@/shared/lib/maps/openstreetmap'
import type { ProjectInitializationFormValues } from '@/features/project-init/lib/schema'
import { useProjectFormI18n } from './project-form-i18n'
import { SearchableSelectField } from './form-fields'
import { cn } from '@/shared/lib/utils'

const MAP_LIBRARIES = 'places'
let mapsLoaderPromise: Promise<void> | null = null

function loadGoogleMaps(apiKey: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('SSR'))
  if (window.google?.maps?.Map) return Promise.resolve()
  if (mapsLoaderPromise) return mapsLoaderPromise

  mapsLoaderPromise = new Promise((resolve, reject) => {
    const callbackName = '__sitepilotMapsInit'
    const existing = document.querySelector<HTMLScriptElement>('script[data-google-maps="true"]')
    const win = window as unknown as Record<string, unknown>

    win[callbackName] = () => {
      delete win[callbackName]
      resolve()
    }

    if (existing) {
      const poll = setInterval(() => {
        if (window.google?.maps?.Map) {
          clearInterval(poll)
          resolve()
        }
      }, 100)
      setTimeout(() => {
        clearInterval(poll)
        if (window.google?.maps?.Map) resolve()
        else reject(new Error('Google Maps timeout'))
      }, 15000)
      return
    }

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=${MAP_LIBRARIES}&callback=${callbackName}`
    script.async = true
    script.defer = true
    script.dataset.googleMaps = 'true'
    script.onerror = () => reject(new Error('Google Maps failed to load'))
    document.head.appendChild(script)
  })

  return mapsLoaderPromise
}

function attachMarkerDragHandler(marker: google.maps.Marker, onDrag: (lat: number, lng: number) => void) {
  marker.addListener('dragend', () => {
    const pos = marker.getPosition()
    if (pos) onDrag(pos.lat(), pos.lng())
  })
}

export function SiteLocationPicker({ className }: { className?: string }) {
  const googleApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const { t, options, translateValidation } = useProjectFormI18n()
  const {
    control,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<ProjectInitializationFormValues>()

  const country = watch('country')
  const latitude = watch('latitude')
  const longitude = watch('longitude')
  const address = watch('address')
  const city = watch('city')

  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const markerRef = useRef<google.maps.Marker | null>(null)
  const osmMapRef = useRef<LeafletMap | null>(null)
  const osmMarkerRef = useRef<LeafletMarker | null>(null)
  const geocoderRef = useRef<google.maps.Geocoder | null>(null)
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)
  const addressInputRef = useRef<HTMLInputElement | null>(null)
  const mapInitializedRef = useRef(false)

  const [mapProvider, setMapProvider] = useState<'google' | 'osm' | 'none'>('none')
  const [mapsReady, setMapsReady] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [geocoding, setGeocoding] = useState(false)

  const countryLabel = options.countries.find((c) => c.value === country)?.label

  const applyParsed = useCallback(
    (lat: number, lng: number, parsed?: { address?: string; city?: string; country?: string }) => {
      setValue('latitude', formatCoord(lat), { shouldDirty: true, shouldValidate: true })
      setValue('longitude', formatCoord(lng), { shouldDirty: true, shouldValidate: true })
      if (parsed?.address) setValue('address', parsed.address, { shouldDirty: true, shouldValidate: true })
      if (parsed?.city) setValue('city', parsed.city, { shouldDirty: true, shouldValidate: true })
      if (parsed?.country && options.countries.some((c) => c.value === parsed.country)) {
        setValue('country', parsed.country, { shouldDirty: true, shouldValidate: true })
      }
    },
    [setValue, options.countries]
  )

  const handleOsmReverseRef = useRef<(lat: number, lng: number) => Promise<void>>(async () => {})

  const handleOsmReverse = useCallback(
    async (lat: number, lng: number) => {
      setGeocoding(true)
      const parsed = await nominatimReverse(lat, lng)
      setGeocoding(false)
      applyParsed(lat, lng, parsed ?? undefined)
    },
    [applyParsed]
  )

  handleOsmReverseRef.current = handleOsmReverse

  const leafletRef = useRef<Awaited<ReturnType<typeof loadLeaflet>> | null>(null)

  const updateOsmMarker = useCallback((lat: number, lng: number) => {
    const map = osmMapRef.current
    const L = leafletRef.current
    if (!map || !L) return
    if (osmMarkerRef.current) osmMarkerRef.current.setLatLng([lat, lng])
    else {
      osmMarkerRef.current = L.marker([lat, lng], { draggable: true }).addTo(map)
      osmMarkerRef.current.on('dragend', () => {
        const pos = osmMarkerRef.current?.getLatLng()
        if (pos) void handleOsmReverseRef.current(pos.lat, pos.lng)
      })
    }
    map.setView([lat, lng], 16)
  }, [])

  const reverseGeocodeGoogle = useCallback(
    (lat: number, lng: number) => {
      if (!geocoderRef.current) return
      setGeocoding(true)
      geocoderRef.current.geocode({ location: { lat, lng } }, (results, status) => {
        setGeocoding(false)
        if (status !== 'OK' || !results?.[0]) {
          applyParsed(lat, lng)
          return
        }
        applyParsed(lat, lng, parseGeocoderResult(results[0]))
      })
    },
    [applyParsed]
  )

  const applyLocation = useCallback(
    (lat: number, lng: number, parsed?: { address?: string; city?: string; country?: string }) => {
      applyParsed(lat, lng, parsed)
      if (mapProvider === 'google') {
        const position = { lat, lng }
        mapRef.current?.panTo(position)
        mapRef.current?.setZoom(16)
        if (markerRef.current) markerRef.current.setPosition(position)
        else if (mapRef.current) {
          markerRef.current = new google.maps.Marker({ position, map: mapRef.current, draggable: true })
          attachMarkerDragHandler(markerRef.current, reverseGeocodeGoogle)
        }
      } else if (mapProvider === 'osm') {
        updateOsmMarker(lat, lng)
      }
    },
    [applyParsed, mapProvider, reverseGeocodeGoogle, updateOsmMarker]
  )

  const forwardGeocode = useCallback(async () => {
    if (!address?.trim()) return
    setGeocoding(true)
    const query = buildGeocodeQuery(address, city, country, countryLabel)

    if (mapProvider === 'google' && geocoderRef.current) {
      geocoderRef.current.geocode({ address: query }, (results, status) => {
        setGeocoding(false)
        if (status !== 'OK' || !results?.[0]?.geometry?.location) return
        const loc = results[0].geometry!.location!
        applyLocation(loc.lat(), loc.lng(), parseGeocoderResult(results[0]))
      })
      return
    }

    const result = await nominatimSearch(query)
    setGeocoding(false)
    if (!result) return
    await handleOsmReverse(result.lat, result.lng)
    updateOsmMarker(result.lat, result.lng)
  }, [address, city, country, countryLabel, mapProvider, applyLocation, handleOsmReverse, updateOsmMarker])

  useEffect(() => {
    let cancelled = false

    async function initMap() {
      if (googleApiKey) {
        try {
          await loadGoogleMaps(googleApiKey)
          if (cancelled) return
          geocoderRef.current = new google.maps.Geocoder()
          setMapProvider('google')
          setMapsReady(true)
          return
        } catch {
          /* fall through to OSM */
        }
      }

      try {
        const L = await loadLeaflet()
        if (cancelled) return
        leafletRef.current = L
        setMapProvider('osm')
        setMapsReady(true)
      } catch {
        if (!cancelled) setLoadError(true)
      }
    }

    void initMap()
    return () => {
      cancelled = true
    }
  }, [googleApiKey])

  useEffect(() => {
    if (!mapsReady || !mapContainerRef.current || mapInitializedRef.current) return

    const coords = parseLatLng(latitude, longitude)
    const countryCenter = getCountryMapCenter(country)
    const mapCenter = coords ?? countryCenter
    const mapZoom = coords ? 16 : countryCenter.zoom

    if (mapProvider === 'google') {
      mapInitializedRef.current = true
      const map = new google.maps.Map(mapContainerRef.current, {
        center: { lat: mapCenter.lat, lng: mapCenter.lng },
        zoom: mapZoom,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
      })
      mapRef.current = map

      if (coords) {
        markerRef.current = new google.maps.Marker({ position: coords, map, draggable: true })
        attachMarkerDragHandler(markerRef.current, reverseGeocodeGoogle)
      }

      map.addListener('click', (event) => {
        const lat = event.latLng?.lat()
        const lng = event.latLng?.lng()
        if (lat == null || lng == null) return
        if (markerRef.current) markerRef.current.setPosition({ lat, lng })
        else {
          markerRef.current = new google.maps.Marker({ position: { lat, lng }, map, draggable: true })
          attachMarkerDragHandler(markerRef.current, reverseGeocodeGoogle)
        }
        reverseGeocodeGoogle(lat, lng)
      })

      setTimeout(() => {
        google.maps.event.trigger(map, 'resize')
        map.setCenter({ lat: mapCenter.lat, lng: mapCenter.lng })
      }, 200)
      return
    }

    if (mapProvider === 'osm') {
      const L = leafletRef.current
      if (!L || !mapContainerRef.current) return
      mapInitializedRef.current = true
      const map = L.map(mapContainerRef.current).setView([mapCenter.lat, mapCenter.lng], mapZoom)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
      }).addTo(map)
      osmMapRef.current = map

      if (coords) {
        osmMarkerRef.current = L.marker([coords.lat, coords.lng], { draggable: true }).addTo(map)
        osmMarkerRef.current.on('dragend', () => {
          const pos = osmMarkerRef.current?.getLatLng()
          if (pos) void handleOsmReverseRef.current(pos.lat, pos.lng)
        })
      }

      map.on('click', (e: { latlng: { lat: number; lng: number } }) => {
        void handleOsmReverseRef.current(e.latlng.lat, e.latlng.lng)
        updateOsmMarker(e.latlng.lat, e.latlng.lng)
      })

      setTimeout(() => map.invalidateSize(), 200)
    }
  }, [mapsReady, mapProvider, country, latitude, longitude, reverseGeocodeGoogle, handleOsmReverse, updateOsmMarker])

  useEffect(() => {
    if (mapProvider !== 'google' || !mapsReady || !addressInputRef.current) return

    if (autocompleteRef.current) {
      google.maps.event.clearInstanceListeners(autocompleteRef.current)
    }

    autocompleteRef.current = new google.maps.places.Autocomplete(addressInputRef.current, {
      componentRestrictions: country ? { country: country.toLowerCase() } : undefined,
      fields: ['address_components', 'formatted_address', 'geometry', 'name'],
    })

    autocompleteRef.current.addListener('place_changed', () => {
      const place = autocompleteRef.current?.getPlace()
      if (!place?.geometry?.location) return
      const parsed = parsePlaceResult(place)
      applyLocation(parsed.lat, parsed.lng, parsed)
    })
  }, [mapsReady, mapProvider, country, applyLocation])

  useEffect(() => {
    if (!mapsReady || parseLatLng(latitude, longitude)) return
    const center = getCountryMapCenter(country)
    if (mapProvider === 'google' && mapRef.current) {
      mapRef.current.setCenter({ lat: center.lat, lng: center.lng })
      mapRef.current.setZoom(center.zoom)
    } else if (mapProvider === 'osm' && osmMapRef.current) {
      osmMapRef.current.setView([center.lat, center.lng], center.zoom)
    }
  }, [country, mapsReady, mapProvider, latitude, longitude])

  const addressError = errors.address?.message as string | undefined
  const cityError = errors.city?.message as string | undefined

  return (
    <div className={cn('md:col-span-2 space-y-4', className)}>
      {!googleApiKey ? (
        <p className="text-xs text-muted-foreground rounded-md border border-dashed p-2">
          <MapPin className="inline h-3.5 w-3.5 me-1" />
          {t('descriptions.mapOsmFallback')}
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2 space-y-2">
          <Label htmlFor="site-address">
            {t('fields.address')}
            <span className="text-destructive ms-0.5">*</span>
          </Label>
          <p className="text-xs text-muted-foreground">{t('descriptions.mapAddressHint')}</p>
          <Controller
            name="address"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                id="site-address"
                ref={(el) => {
                  field.ref(el)
                  addressInputRef.current = el
                }}
                placeholder={t('ui.mapAddressPlaceholder')}
                autoComplete="street-address"
              />
            )}
          />
          {addressError ? (
            <p className="text-xs text-destructive">{translateValidation(addressError) ?? addressError}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="site-city">
            {t('fields.city')}
            <span className="text-destructive ms-0.5">*</span>
          </Label>
          <Controller
            name="city"
            control={control}
            render={({ field }) => <Input {...field} id="site-city" autoComplete="address-level2" />}
          />
          {cityError ? (
            <p className="text-xs text-destructive">{translateValidation(cityError) ?? cityError}</p>
          ) : null}
        </div>

        <SearchableSelectField<ProjectInitializationFormValues>
          name="country"
          label={t('fields.country')}
          required
          options={options.countries}
          placeholder={t('ui.countrySearchPlaceholder')}
        />

        <div className="space-y-2">
          <Label htmlFor="site-latitude">{t('fields.latitude')}</Label>
          <Controller
            name="latitude"
            control={control}
            render={({ field }) => <Input {...field} id="site-latitude" readOnly className="bg-muted/40" tabIndex={-1} />}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="site-longitude">{t('fields.longitude')}</Label>
          <Controller
            name="longitude"
            control={control}
            render={({ field }) => <Input {...field} id="site-longitude" readOnly className="bg-muted/40" tabIndex={-1} />}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={() => void forwardGeocode()} disabled={!mapsReady || geocoding || !address?.trim()}>
          <Search className="h-4 w-4 me-1" />
          {geocoding ? t('ui.mapSearching') : t('ui.showOnMap')}
        </Button>
        <p className="text-xs text-muted-foreground">{t('descriptions.mapClickHint')}</p>
      </div>

      <div className="relative h-[360px] w-full rounded-lg border overflow-hidden bg-muted/20">
        {!mapsReady && !loadError ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground z-10 bg-background/80">
            {t('ui.mapLoading')}
          </div>
        ) : null}
        {loadError ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-destructive z-10 p-4 text-center">
            {t('descriptions.mapLoadError')}
          </div>
        ) : null}
        <div ref={mapContainerRef} className="h-full w-full" aria-label={t('fields.mapLocation')} />
      </div>
    </div>
  )
}
