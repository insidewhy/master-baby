import type { EventEmitter } from 'event-emitters'
import { onMount, onDestroy } from 'svelte'

export function handleMessages(
  onMessage: EventEmitter<any>,
  messageHandler: (data: any) => void,
) {
  onMount(() => {
    onMessage.subscribe(messageHandler)
  })

  onDestroy(() => {
    onMessage.unsubscribe(messageHandler)
  })
}
