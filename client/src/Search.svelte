<script>
  import FaSearch from 'svelte-icons/fa/FaSearch.svelte'
  import FaTimes from 'svelte-icons/fa/FaTimes.svelte'
  import FaSpinner from 'svelte-icons/fa/FaSpinner.svelte'
  import { handleMessages } from './handleMessages.js'
  import { setLocation, onLocationChange } from './location.js'

  export let sendMessage
  export let searchResults
  export let onMessage

  let searching = false
  let searchTerms = ''
  let searchDuration = 'any'

  onLocationChange(({ path, params }) => {
    if (path === '/search') {
      searchTerms = params.terms || ''

      if (searchTerms) {
        searching = true
        sendMessage({ type: 'search', terms: searchTerms, duration: searchDuration })
      } else {
        searching = false
        searchResults = []
      }
    }
  })

  handleMessages(onMessage, (data) => {
    if (data.type === 'search-results') {
      searching = false
      searchResults = data.results
    }
  })

  const focus = (el) => {
    el.focus()
  }

  const setSearch = () => {
    setLocation('/search', { terms: searchTerms })
  }

  const closeSearch = () => {
    searchResults = []
    setLocation('/')
  }
</script>

<style type="text/scss">
  $line-height: 5rem;
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
    <label>
      duration:
      <select bind:value={searchDuration}>
        <option>any</option>
        <option>long</option>
        <option>medium</option>
        <option>short</option>
      </select>
    </label>
  </div>
</form>
