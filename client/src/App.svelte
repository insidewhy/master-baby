<script>
  import { EventEmitter } from 'event-emitters'
  import FaListOl from 'svelte-icons/fa/FaListOl.svelte'
  import FaVolumeDown from 'svelte-icons/fa/FaVolumeDown.svelte'
  import FaVolumeUp from 'svelte-icons/fa/FaVolumeUp.svelte'
  import FaSearch from 'svelte-icons/fa/FaSearch.svelte'
  import FaSpinner from 'svelte-icons/fa/FaSpinner.svelte'
  import FaTimes from 'svelte-icons/fa/FaTimes.svelte'

  import Search from './Search.svelte'
  import { onLocationChange, setLocation } from './location.js'

  let ws
  let watchingVideo
  let showList = []
  let queue = []
  let queueTitles
  const onMessage = new EventEmitter()

  // search binds
  let searchOpen = false
  let queueOpen = false
  let searchResults = []

  onLocationChange(({ path }) => {
    searchOpen = path === '/search'
    queueOpen = path === '/queue'
  })

  const sendMessage = (message) => {
    if (ws) {
      ws.send(JSON.stringify(message))
    }
  }

  const startShow = (path, comment) => {
    const message = { type: 'enqueue', path }
    if (comment) {
      message.comment = comment
    }
    sendMessage(message)
  }

  const sendMessageWithType = type => {
    sendMessage({ type })
  }

  const getQueuedDisplayTitle = ({ comment, video }) =>
    comment || (video.startsWith('https://') ? video : video.replace(/.*\//, ''))


  const handleWebsocketMessage = (message) => {
    const data = JSON.parse(message.data)
    onMessage.emit(data)

    switch (data.type) {
      case 'shows': {
        queueTitles = new Set()
        watchingVideo = data.watchingVideo

        queue = data.queue.map(queued => {
          const displayTitle = getQueuedDisplayTitle(queued)
          queueTitles.add(displayTitle)
          return { ...queued, displayTitle }
        })

        data.list.forEach(show => {
          if (queueTitles.has(show.video)) {
            show.isQueued = true
          }
        })
        showList = data.list

        break
      }

      case 'start':
        watchingVideo = data.video
        break

      case 'stop':
        watchingVideo = undefined
        // TODO: only refresh show that stopped
        sendMessage({ type: 'show-list' })
        break

      case 'enqueue': {
        const { video, comment } = data
        const toQueue = { video, comment }
        const displayTitle = getQueuedDisplayTitle(toQueue)
        queueTitles.add(displayTitle)
        toQueue.displayTitle = displayTitle
        queue = [...queue, toQueue]

        showList.some((show, idx) => {
          if (show.video === displayTitle) {
            // weird indexness for svelte :(
            showList[idx].isQueued = true
            return true
          }
        })
        searchResults.some((show, idx) => {
          if (show.title === displayTitle) {
            searchResults[idx].isQueued = true
            return true
          }
        })

        break
      }
    }
  }

  const setSearchResults = newResults => {
    newResults.forEach(result => {
      if (queueTitles.has(result.title)) {
        result.isQueued = true
      }
    })
    searchResults = newResults
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
          watchingVideo = undefined
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

    &.queued {
      background-color: #ffffdd;
    }

    &.watching {
      background-color: #a92dce;
    }
  }

  footer {
    flex-shrink: 1;
    flex-wrap: wrap;
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

  :global(form) {
    min-width: 100%;
  }
</style>

<ul>
  {#if searchResults.length}
    {#each searchResults as result}
      <li
        on:click={() => { startShow(result.video, result.title) }}
        class:watching={watchingVideo === result.video}
        class:queued={result.isQueued}
      >{result.title}</li>
    {/each}
  {:else}
    {#if queueOpen}
      {#each queue as queued}
        <li
          class:watching={watchingVideo === queued.displayTitle || watchingVideo === queued.video}
        >{queued.displayTitle}</li>
      {/each}
    {:else}
      {#each showList as show}
        <li
          on:click={() => { startShow(show.path) }}
          class:watching={watchingVideo === show.video}
          class:queued={show.isQueued}
        >{show.video}</li>
      {/each}
    {/if}
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
    {#if !searchOpen}
      <button on:click={() => setLocation('/search')}><FaSearch /></button>
    {/if}
    {#if watchingVideo}
      <button on:click={() => { sendMessageWithType("volume-down") }}>
        <FaVolumeDown />
      </button>
      <button on:click={() => { sendMessageWithType("volume-up") }}>
        <FaVolumeUp />
      </button>
    {/if}
    {#if searchOpen}
      <Search
        sendMessage={sendMessage}
        onMessage={onMessage}
        onSearchResults={setSearchResults}
      />
    {:else}
      {#if queueOpen}
        <button on:click={() => setLocation('/')}><FaTimes /></button>
      {:else}
        <button on:click={() => setLocation('/queue')}><FaListOl /></button>
      {/if}
    {/if}
  {/if}
</footer>
