<script>
  import { EventEmitter } from 'event-emitters'
  import FaVolumeDown from 'svelte-icons/fa/FaVolumeDown.svelte'
  import FaVolumeUp from 'svelte-icons/fa/FaVolumeUp.svelte'
  import FaSearch from 'svelte-icons/fa/FaSearch.svelte'
  import FaSpinner from 'svelte-icons/fa/FaSpinner.svelte'
  import Search from './Search.svelte'

  let ws
  let watchingPath
  let showList = []
  const onMessage = new EventEmitter()

  // search bind
  let searchOpen = false
  let searchResults = []

  const sendMessage = (message) => {
    if (ws) {
      ws.send(JSON.stringify(message))
    }
  }

  const openSearch = () => {
    searchOpen = true
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
    onMessage.emit(data)

    switch (data.type) {
      case 'shows':
        watchingPath = data.watchingPath
        showList = data.list
        break

      case 'start':
        watchingPath = data.path
        break

      case 'stop':
        watchingPath = undefined
        // TODO: only refresh show that stopped
        sendMessage({ type: 'show-list' })
        break
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

    button, .loading {
      height: 5rem;
    }

    .loading {
      width: 100%;
      justify-content: center;
      align-items: center;
      overflow: hidden;

      div {
        $width: 3.5rem;
        width: $width;
        height: $width;
        animation-name: spin;
        animation-duration: 4000ms;
        animation-iteration-count: infinite;
        animation-timing-function: linear;
        flex-basis: auto;
      }
    }

    button {
      padding: 0.7rem;
      flex-grow: 1;
      width: 7rem;
      font-size: 1rem;
      justify-content: center;
      align-items: center;
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
      <div>
        <FaSpinner />
      </div>
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
      {#if searchOpen}
        <Search
          sendMessage={sendMessage}
          onMessage={onMessage}
          bind:searchOpen={searchOpen}
          bind:searchResults={searchResults}
        />
      {:else}
        <button class="open-search" on:click={openSearch}><FaSearch /></button>
      {/if}
    {/if}
  {/if}
</footer>
