import { EventEmitter } from 'event-emitters'
import { onMount, onDestroy } from 'svelte'

interface LocationInfo {
  path: string
  params: Record<string, string>
}

const locationEmitter = new EventEmitter<LocationInfo>()

const getCurrentLocation = (): LocationInfo => {
  const path = decodeURIComponent(window.location.pathname)
  const { search } = window.location
  const params = {}
  if (search) {
    search
      .slice(1)
      .split('&')
      .forEach((keyValue) => {
        const [key, value] = keyValue.split('=')
        params[key] = decodeURIComponent(value)
      })
  }
  return { path, params }
}

const emitCurrentLocation = (): void => {
  locationEmitter.emit(getCurrentLocation())
}

window.addEventListener('popstate', emitCurrentLocation)

export function onLocationChange(
  handler: (locationInfo: LocationInfo) => void,
) {
  handler(getCurrentLocation())

  onMount(() => {
    locationEmitter.subscribe(handler)
  })

  onDestroy(() => {
    locationEmitter.unsubscribe(handler)
  })
}

export function setLocation(path: string, params: Record<string, string>) {
  const url =
    path +
    (!params
      ? ''
      : '?' +
        Object.entries(params)
          .map(([key, value]) => {
            return key + '=' + encodeURIComponent(value)
          })
          .join('&'))

  history.pushState({}, '', url)
  locationEmitter.emit({ path, params })
}
