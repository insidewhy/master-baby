<script>
  import { onMount } from 'svelte'
  import { handleMessages } from './handleMessages.js'

  export let sortOrder
  export let sendMessage
  export let onMessage

  let displays = ['unknown']
  let currentDisplay = 'unknown'
  let prevCurrentDisplay = currentDisplay

  handleMessages(onMessage, (data) => {
    if (data.type === 'displays') {
      displays = data.displays
      currentDisplay = data.current
      if (currentDisplay === 'unknown') {
        displays.unshift('unknown')
      }
    }
  })

  onMount(() => {
    sendMessage({ type: 'get-displays' })
  })

  const setDisplay = () => {
    if (currentDisplay !== prevCurrentDisplay) {
      prevCurrentDisplay = currentDisplay
      sendMessage({ type: 'set-display', display: currentDisplay })
      if (displays.includes('unknown')) {
        displays = displays.filter(display => display !== 'unknown')
      }
    }
  }

  $: currentDisplay, setDisplay()
</script>
<style lang="scss">
  section {
    width: 100%;
    justify-content: center;
    align-items: center;
    padding: 0.5rem;
    gap: 1.4rem;
  }

  label {
    align-items: center;
  }

  select {
    margin-left: 1rem;
    font-size: 0.8rem;
    padding: 0.5rem 0.3rem;
  }
</style>
<section>
  <label>
    Sort:
    <select bind:value={sortOrder}>
      <option value="location">Media location</option>
      <option value="mtime">Last Modified</option>
    </select>
  </label>
  <label>
    Display:
    <select bind:value={currentDisplay}>
      {#each displays as display}
        <option>{display}</option>
      {/each}
    </select>
  </label>
</section>
