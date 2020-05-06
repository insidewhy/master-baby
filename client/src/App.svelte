<script>
  let openedWs
  let watchingPath
  let showList = []

  const sendMessage = (ws, message) => {
    if (ws) {
      ws.send(JSON.stringify(message))
    }
  }

  const startShow = path => {
    sendMessage(openedWs, { type: 'watch', path })
  }

  const sendMessageWithType = type => {
    sendMessage(openedWs, { type })
  }

  const handleWebsocketMessage = (ws, message) => {
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
        sendMessage(ws, { type: 'show-list' })
        break

      default:
        console.warn('Got unrecognised message', data)
    }
  }

  const start = () => {
    const ws = new WebSocket(`ws://${window.location.hostname}:4920`)

    let closed = false

    const timeoutAttempt = setTimeout(() => {
      if (!closed) {
        console.log('took too long to open websocket, trying again')
        closed = true
        ws.close()
      }
    }, 1000)

    ws.onopen = () => {
      if (closed) {
        console.log('ignoring duplicate websocket connection')
        ws.close()
      } else {
        clearTimeout(timeoutAttempt)
        console.log('got websocket')
        openedWs = ws
      }
    }

    ws.onclose = () => {
      if (!closed) {
        if (ws === openedWs) {
          openedWs = undefined
        }
        console.log('websocket closed, trying again')
        setTimeout(start, 1000)
        closed = true
      }
    }

    ws.onmessage = handleWebsocketMessage.bind(null, ws)
  }

  start()
</script>

<style>
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
  }

  li:hover {
    cursor: pointer;
    background-color: #a2d9ce;
  }

  li.watching {
    background-color: #a92dce;
  }

  footer {
    flex-shrink: 1;
  }

  footer > * {
    height: 100%;
    width: 100%;
  }

  #loading,
  #controls {
    padding: 1rem;
    height: 5rem;
  }

  #loading {
    align-items: center;
    justify-content: center;
  }

  #controls {
    align-items: center;
  }

  #controls button {
    height: 100%;
    font-size: 1rem;
    justify-content: center;
    align-items: center;
    border: 1px solid black;
    background-color: white;
    flex-grow: 1;
    cursor: pointer;
  }

  #controls button + button {
    margin-left: 1rem;
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
  {#if !openedWs}
    <div id="loading">
      Loading
    </div>
  {/if}
  {#if watchingPath}
    <div id="controls">
      <button
        on:click={() => { sendMessageWithType("volume-down") }}
      >vol down</button>
      <button
        on:click={() => { sendMessageWithType("volume-up") }}
      >vol up</button>
    </div>
  {/if}
</footer>
