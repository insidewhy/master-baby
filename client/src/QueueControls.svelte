<script lang="ts">
  import type { EventEmitter } from 'event-emitters'
  import FaTrash from 'svelte-icons/fa/FaTrash.svelte'

  import { handleMessages } from './handleMessages'
  import Loading from './Loading.svelte'

  export let selections: Set<string>
  export let sendMessage: (data: object) => void
  export let onMessage: EventEmitter<any>

  let pendingOperation = false

  handleMessages(onMessage, (data: any) => {
    if (data.type === 'dequeued') {
      pendingOperation = false
      selections.clear()
      selections = selections
    }
  })

  const deleteSelections = () => {
    pendingOperation = true
    sendMessage({ type: 'dequeue', media: Array.from(selections) })
  }
</script>

<style lang="scss">
  .queue-controls {
    width: 100%;
    align-items: center;
    justify-content: center;
  }
</style>

<div class="queue-controls">
  {#if pendingOperation}
    <Loading />
  {:else}
    <button on:click={deleteSelections}>
      <FaTrash />
    </button>
  {/if}
</div>
