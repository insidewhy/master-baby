<script lang="ts">
  import type { EventEmitter } from 'event-emitters'
  import FaSearch from 'svelte-icons/fa/FaSearch.svelte'
  import FaTimes from 'svelte-icons/fa/FaTimes.svelte'
  import FaSpinner from 'svelte-icons/fa/FaSpinner.svelte'
  import FaYoutube from 'svelte-icons/fa/FaYoutube.svelte'
  import FaSpotify from 'svelte-icons/fa/FaSpotify.svelte'
  import { handleMessages } from './handleMessages'
  import { setLocation, onLocationChange } from './location'

  export let sendMessage: (data: object) => void;
  export let onSearchResults: (results: unknown[]) => void;
  export let onMessage: EventEmitter<any>
  export let searchService: string

  let searching = false
  let searchTerms = ''
  let searchDuration = 'any'

  onLocationChange(({ path, params }) => {
    if (path === '/search') {
      searchTerms = params.terms || ''
      searchService = params.service

      if (searchTerms) {
        searching = true
        if (searchService === 'youtube') {
          sendMessage({
            type: 'search',
            terms: searchTerms,
            duration: searchDuration,
            service: 'youtube'
          })
        } else {
          sendMessage({ type: 'search', terms: searchTerms, service: searchService })
        }
      } else {
        searching = false
        onSearchResults([])
      }
    }
  })

  handleMessages(onMessage, (data: any) => {
    if (data.type === 'search-results') {
      searching = false
      onSearchResults(data.results)
    }
  })

  const focus = (el: HTMLElement) => {
    el.focus()
  }

  const setSearch = () => {
    setLocation('/search', { terms: searchTerms, service: searchService })
  }

  const closeSearch = () => {
    onSearchResults([])
    setLocation('/')
  }
</script>

<style lang="scss">
  $line-height: 4.5rem;
  $button-color: #888;

  form {
    width: 100%;
    justify-content: center;
    flex-direction: column;

    div {
      align-items: center;

      + div {
        padding-bottom: 1rem;
      }
    }
  }

  button {
    height: $line-height;
    width: $line-height;
    padding: 0.7rem;
    color: $button-color;
    align-self: stretch;

    &.toggle {
      color: #ddd;

      &.active {
        color: $button-color;
      }
    }
  }

  .search-terms {
    flex-grow: 1;
    width: 100%;
    border-bottom: 1px solid #aaa;
    font-size: 1rem;
    margin-right: 1rem;

    &:focus {
      border-bottom-color: #333;
    }
  }

  label {
    align-items: center;
    font-family: sans-serif;
    margin-right: 1rem;
    visibility: hidden;

    &.visible {
      visibility: visible;
    }
  }

  select {
    font-size: 1rem;
    background-color: inherit;
    margin-left: 1rem;
    padding: 0.4rem;
  }

  .searching {
    width: $line-height;
    height: $line-height;
    color: $button-color;
    animation-name: spin;
    animation-duration: 4000ms;
    animation-iteration-count: infinite;
    animation-timing-function: linear;
    flex-basis: auto;
  }
</style>

<form on:submit|preventDefault={setSearch}>
  <div>
    <input class="search-terms" type="text" use:focus bind:value={searchTerms} />
    {#if !searching}
      <button><FaSearch /></button>
    {:else}
      <div class="searching">
        <FaSpinner />
      </div>
    {/if}
    <button type="button" on:click={closeSearch}><FaTimes /></button>
  </div>
  <div>
    <label class:visible={searchService === 'youtube'}>
      duration:
      <select bind:value={searchDuration}>
        <option>any</option>
        <option>long</option>
        <option>medium</option>
        <option>short</option>
      </select>
    </label>
    <button
      type="button"
      class="toggle"
      class:active={searchService === 'youtube'}
      on:click={() => { searchService = 'youtube' }}
    ><FaYoutube /></button>
    <button
      type="button"
      class="toggle"
      class:active={searchService === 'spotify'}
      on:click={() => { searchService = 'spotify' }}
    ><FaSpotify /></button>
  </div>
</form>
