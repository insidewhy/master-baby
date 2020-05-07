import { onMount, onDestroy } from 'svelte'

export function handleMessages(onMessage, messageHandler) {
  onMount(() => {
    onMessage.subscribe(messageHandler)
  })

  onDestroy(() => {
    onMessage.unsubscribe(messageHandler)
  })
}
