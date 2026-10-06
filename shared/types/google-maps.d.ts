/* Minimal Google Maps types for SiteLocationPicker — replace with @types/google.maps if installed */
declare namespace google.maps {
  class Map {
    constructor(el: HTMLElement, opts: MapOptions)
    panTo(latLng: LatLngLiteral): void
    setCenter(latLng: LatLngLiteral): void
    setZoom(zoom: number): void
    addListener(event: string, handler: (e: MapMouseEvent) => void): MapsEventListener
  }
  class Marker {
    constructor(opts: MarkerOptions)
    setPosition(latLng: LatLngLiteral): void
    getPosition(): LatLng | null
    addListener(event: string, handler: () => void): MapsEventListener
  }
  class Geocoder {
    geocode(
      request: GeocoderRequest,
      callback: (results: GeocoderResult[] | null, status: GeocoderStatus) => void
    ): void
  }
  namespace places {
    class Autocomplete {
      constructor(input: HTMLInputElement, opts?: AutocompleteOptions)
      addListener(event: string, handler: () => void): MapsEventListener
      getPlace(): PlaceResult
      unbindAll(): void
    }
    interface AutocompleteOptions {
      componentRestrictions?: { country?: string | string[] }
      fields?: string[]
    }
    interface PlaceResult {
      address_components?: GeocoderAddressComponent[]
      formatted_address?: string
      name?: string
      geometry?: { location?: LatLng }
    }
  }
  namespace event {
    function clearInstanceListeners(instance: object): void
    function trigger(instance: object, eventName: string): void
  }
  interface MapOptions {
    center: LatLngLiteral
    zoom: number
    mapTypeControl?: boolean
    streetViewControl?: boolean
    fullscreenControl?: boolean
  }
  interface MarkerOptions {
    position: LatLngLiteral
    map?: Map
    draggable?: boolean
  }
  interface LatLngLiteral {
    lat: number
    lng: number
  }
  interface LatLng {
    lat(): number
    lng(): number
  }
  interface MapMouseEvent {
    latLng?: LatLng | null
  }
  interface GeocoderRequest {
    address?: string
    location?: LatLngLiteral
  }
  interface GeocoderResult {
    address_components?: GeocoderAddressComponent[]
    formatted_address?: string
    geometry?: { location?: LatLng }
  }
  interface GeocoderAddressComponent {
    long_name: string
    short_name: string
    types: string[]
  }
  type GeocoderStatus = 'OK' | string
  interface MapsEventListener {
    remove(): void
  }
}

declare namespace google {
  const maps: typeof google.maps
}

declare global {
  interface Window {
    google?: typeof google
  }
}
