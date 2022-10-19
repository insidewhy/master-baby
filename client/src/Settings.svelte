<script>
  import { onMount } from 'svelte'
  import { handleMessages } from './handleMessages.js'

  export let sortOrder
  export let sendMessage
  export let onMessage
  export let mediaInfo

  let displays = ['unknown']
  let currentDisplay = 'unknown'
  let prevCurrentDisplay = 'unknown'
  let prevActiveAudioTrack = 'unknown'
  let prevActiveSubTrack = 'unknown'

  onMount(() => {
    sendMessage({ type: 'get-displays' })
    prevCurrentDisplay = currentDisplay
    prevActiveAudioTrack = mediaInfo.activeAudioTrack
    prevActiveSubTrack = mediaInfo.activeSubTrack
  })

  const setActiveSubTrack = () => {
    if (
      mediaInfo.activeSubTrack &&
      mediaInfo.activeSubTrack !== 'unknown' &&
      mediaInfo.activeSubTrack !== prevActiveSubTrack)
    {
      prevActiveSubTrack = mediaInfo.activeSubTrack
      sendMessage({ type: 'set-sid', value: mediaInfo.activeSubTrack })
    }
  }

  const setActiveAudioTrack = () => {
    if (
      mediaInfo.activeAudioTrack &&
      mediaInfo.activeAudioTrack !== 'unknown' &&
      mediaInfo.activeAudioTrack !== prevActiveAudioTrack)
    {
      prevActiveAudioTrack = mediaInfo.activeAudioTrack
      sendMessage({ type: 'set-aid', value: mediaInfo.activeAudioTrack })
    }
  }

  $: mediaInfo.activeSubTrack, setActiveSubTrack()
  $: mediaInfo.activeAudioTrack, setActiveAudioTrack()

  handleMessages(onMessage, (data) => {
    if (data.type === 'displays') {
      displays = data.displays
      currentDisplay = data.current
      if (currentDisplay === 'unknown') {
        displays.unshift('unknown')
      }
    }
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
    padding: 0.5rem 0.2rem;
    gap: 1.4rem;
    flex-wrap: wrap;
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
  {#if displays.length > 1}
    <label>
      Display:
      <select bind:value={currentDisplay}>
        {#each displays as display}
          <option>{display}</option>
        {/each}
      </select>
    </label>
  {/if}
  {#if mediaInfo.audioTracks.length > 1}
    <label>
      Audio:
      <select bind:value={mediaInfo.activeAudioTrack}>
        {#each mediaInfo.audioTracks as audioTrack}
          <option value={audioTrack[0]}>{audioTrack[1]}</option>
        {/each}
      </select>
    </label>
  {/if}
  {#if mediaInfo.subTracks.length > 1}
    <label>
      Subs:
      <select bind:value={mediaInfo.activeSubTrack}>
        {#each mediaInfo.subTracks as subTrack}
          <option value={subTrack[0]}>{subTrack[1]}</option>
        {/each}
      </select>
    </label>
  {/if}
</section>
