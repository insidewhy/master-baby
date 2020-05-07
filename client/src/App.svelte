<script>
  import FaVolumeDown from 'svelte-icons/fa/FaVolumeDown.svelte'
  import FaVolumeUp from 'svelte-icons/fa/FaVolumeUp.svelte'
  import FaSearch from 'svelte-icons/fa/FaSearch.svelte'
  import FaTimes from 'svelte-icons/fa/FaTimes.svelte'

  let ws
  let searching = false
  let watchingPath
  let showList = []
  let youtubeTitle = ''
  let searchTerms = ''
  let searchResults = []
  let searchDuration = 'any'

  const focus = (el) => {
    el.focus()
  }

  const sendMessage = (message) => {
    if (ws) {
      ws.send(JSON.stringify(message))
    }
  }

  const openSearch = () => {
    searching = true
  }

  const sendSearch = () => {
    sendMessage({ type: 'search', terms: searchTerms, duration: searchDuration })
    return false
  }

  const closeSearch = () => {
    searching = false
    searchResults = []
  }

  const startShow = (path, comment) => {
    const message = { type: 'watch', path }
    if (comment) {
      message.comment = comment
    }
    sendMessage(message)
  }

  const sendMessageWithType = type => {
    sendMessage({ type })
  }

  const handleWebsocketMessage = (message) => {
    const data = JSON.parse(message.data)
    switch (data.type) {
      case 'shows':
        watchingPath = data.watchingPath
        showList = data.list
        break

      case 'search-results':
        if (searching) {
          searchResults = data.results
        }
        break

      case 'start':
        watchingPath = data.path
        break

      case 'stop':
        watchingPath = undefined
        // TODO: only refresh show that stopped
        sendMessage({ type: 'show-list' })
        break

      default:
        console.warn('Got unrecognised message', data)
    }
  }

  const start = () => {
    const connectingWs = new WebSocket(`ws://${window.location.hostname}:4920`)

    let closed = false

    const timeoutAttempt = setTimeout(() => {
      if (!closed) {
        console.log('took too long to open websocket, trying again')
        closed = true
        connectingWs.close()
        start()
      }
    }, 3000)

    connectingWs.onopen = () => {
      if (closed) {
        console.log('ignoring duplicate websocket connection')
        connectingWs.close()
      } else {
        clearTimeout(timeoutAttempt)
        console.log('got websocket')
        ws = connectingWs
      }
    }

    connectingWs.onclose = () => {
      if (!closed) {
        if (connectingWs === ws) {
          watchingPath = undefined
          ws = undefined
        }
        console.log('websocket closed, trying again')
        setTimeout(start, 1000)
        closed = true
      }
    }

    connectingWs.onmessage = handleWebsocketMessage
  }

  start()
</script>

<style type="text/scss">
  ul {
    flex-grow: 1;
    width: 100%;
    min-height: 100%;
    list-style: none;
    flex-direction: column;
    overflow-y: scroll;
    margin-top: 0.5rem;
  }

  li {
    width: 100%;
    align-items: center;
    word-break: break-word;
    padding: 0.8rem 1rem;
    border-bottom: #eee solid 1px;

    &:hover {
      cursor: pointer;
      background-color: #a2d9ce;
    }

    &.watching {
      background-color: #a92dce;
    }
  }

  footer {
    flex-shrink: 1;
    align-items: center;
    border-top: solid 1px #aaa;
    padding: 0 1rem;

    >button {
      height: 5rem;
    }

    form, .loading {
      width: 100%;
      justify-content: center;
      height: 100%;
    }

    .loading {
      align-items: center;
    }

    button {
      padding: 0.7rem;
      flex-grow: 1;
      width: 7rem;
      font-size: 1rem;
      justify-content: center;
      align-items: center;
      border: none;
      color: #888;
      cursor: pointer;

      &:hover {
        background-color: #eee;
      }
    }

    form {
      flex-direction: column;

      div {
        align-items: center;

        + div {
          padding-bottom: 1rem;
        }
      }

      button {
        padding: 0 0.7rem;
        max-width: 4.3rem;
        align-self: stretch;
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
    }
  }

  .search-terms {
    flex-grow: 1;
    width: 100%;
    border: none;
    border-bottom: 1px solid #aaa;
    font-size: 1rem;
    margin-right: 1rem;

    &:focus {
      border-bottom-color: #333;
    }
  }
</style>

<ul>
  {#if searchResults.length}
    {#each searchResults as result}
      <li
        on:click={() => { startShow(result.url, result.title) }}
        class:watching={watchingPath === result.url}
      >{result.title}</li>
    {/each}
  {:else}
    {#each showList as show}
      <li
        on:click={() => { startShow(show.path) }}
        class:watching={watchingPath === show.path}
      >{show.filename}</li>
    {/each}
  {/if}
</ul>
<footer>
  {#if !ws}
    <div class="loading">
      Loading
    </div>
  {:else}
    {#if watchingPath}
      <button on:click={() => { sendMessageWithType("volume-down") }}>
        <FaVolumeDown />
      </button>
      <button on:click={() => { sendMessageWithType("volume-up") }}>
        <FaVolumeUp />
      </button>
    {:else}
      {#if searching}
        <form on:submit|preventDefault={sendSearch}>
          <div>
            <input class="search-terms" type="text" use:focus bind:value={searchTerms} />
            <button type="submit"><FaSearch /></button>
            <button on:click={closeSearch}><FaTimes /></button>
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
      {:else}
        <button class="open-search" on:click={openSearch}><FaSearch /></button>
      {/if}
    {/if}
  {/if}
</footer>
