<script>
  import FaVolumeDown from 'svelte-icons/fa/FaVolumeDown.svelte'
  import FaVolumeUp from 'svelte-icons/fa/FaVolumeUp.svelte'

  let ws
  let watchingPath
  let showList = []

  const sendMessage = (message) => {
    if (ws) {
      ws.send(JSON.stringify(message))
    }
  }

  const startShow = path => {
    sendMessage({ type: 'watch', path })
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

    > * {
      height: 100%;
      width: 100%;
    }
  }

  #loading,
  #controls {
    height: 5rem;
  }

  #loading {
    align-items: center;
    justify-content: center;
  }

  #controls {
    align-items: center;
    border-top: solid 1px #aaa;

    button {
      padding: 0.7rem;
      height: 100%;
      font-size: 1rem;
      justify-content: center;
      align-items: center;
      border: none;
      color: #888;
      background-color: white;
      flex-grow: 1;
      cursor: pointer;

      &:hover {
        background-color: #eee;
      }

      + button {
        border-left: solid 1px #aaa;
      }
    }
  }
</style>

<ul id="shows">
  {#each showList as show}
    <li
      on:click={() => { startShow(show.path) }}
      class:watching={watchingPath === show.path}
    >{show.filename}</li>
  {/each}
</ul>
<footer>
  {#if !ws}
    <div id="loading">
      Loading
    </div>
  {/if}
  {#if watchingPath}
    <div id="controls">
      <button
        on:click={() => { sendMessageWithType("volume-down") }}
      >
        <FaVolumeDown />
      </button>
      <button
        on:click={() => { sendMessageWithType("volume-up") }}
      >
        <FaVolumeUp />
      </button>
    </div>
  {/if}
</footer>
