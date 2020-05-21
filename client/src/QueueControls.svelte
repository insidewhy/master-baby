<script>
  import FaTrash from 'svelte-icons/fa/FaTrash.svelte'

  import { handleMessages } from './handleMessages.js'
  import Loading from './Loading.svelte'

  export let selections
  export let sendMessage
  export let onMessage

  let pendingOperation = false

  handleMessages(onMessage, (data) => {
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

<style type="text/scss">
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
