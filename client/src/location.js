import { EventEmitter } from 'event-emitters'
import { onMount, onDestroy } from 'svelte'

const locationEmitter = new EventEmitter()

const getCurrentLocation = () => {
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

const emitCurrentLocation = () => {
  locationEmitter.emit(getCurrentLocation())
}

window.addEventListener('popstate', emitCurrentLocation)

export function onLocationChange(handler) {
  handler(getCurrentLocation())

  onMount(() => {
    locationEmitter.subscribe(handler)
  })

  onDestroy(() => {
    locationEmitter.unsubscribe(handler)
  })
}

export function setLocation(path, params) {
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
