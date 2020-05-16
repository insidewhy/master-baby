<script>
  import { EventEmitter } from 'event-emitters'
  import FaListOl from 'svelte-icons/fa/FaListOl.svelte'
  import FaVolumeDown from 'svelte-icons/fa/FaVolumeDown.svelte'
  import FaVolumeUp from 'svelte-icons/fa/FaVolumeUp.svelte'
  import FaSearch from 'svelte-icons/fa/FaSearch.svelte'
  import FaTimes from 'svelte-icons/fa/FaTimes.svelte'
  import FaPause from 'svelte-icons/fa/FaPause.svelte'
  import FaPlay from 'svelte-icons/fa/FaPlay.svelte'

  import QueuedVideo from './QueuedVideo.svelte'
  import QueueControls from './QueueControls.svelte'
  import Search from './Search.svelte'
  import Loading from './Loading.svelte'
  import { onLocationChange, setLocation } from './location.js'

  let ws
  let watchingVideo
  let showList = []
  let queue = []
  let queueTitles
  let queueSelections = new Set()
  const onMessage = new EventEmitter()

  // search binds
  let searchOpen = false
  let queueOpen = false
  let paused = false
  let searchResults = []

  onLocationChange(({ path }) => {
    searchOpen = path === '/search'
    const nextQueueOpen = path === '/queue'
    if (! queueOpen && nextQueueOpen) {
      queueSelections = new Set()
    }
    queueOpen = nextQueueOpen
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

  const handlePlay = () => {
    if (! watchingVideo) {
      sendMessageWithType('resume-playlist')
    } else {
      sendMessageWithType('toggle-pause')
    }
  }

  const processTime = (time) =>
    time.replace(/^0:0*:?/, '').replace(/\.\d+$/, '')

  const processQueueEntry = (queueEntry) => {
    const { comment, video } = queueEntry
    const displayTitle = comment || (video.startsWith('https://') ? video : video.replace(/.*\//, ''))
    queueTitles.add(displayTitle)

    if (queueEntry.duration) {
      queueEntry.duration = processTime(queueEntry.duration)
      if (queueEntry.viewings) {
        const position = queueEntry.viewings[queueEntry.viewings.length - 1].end
        if (position) {
          queueEntry.position = processTime(position.replace(/.* /, ''))
        }
        delete queueEntry.viewings
      }
    }

    return { ...queueEntry, displayTitle }
  }

  const updateShowQueueState = () => {
    showList.forEach(show => {
      if (queueTitles.has(show.video)) {
        show.isQueued = true
      } else {
        show.isQueued = false
      }
    })
  }

  const updateSearchResultQueueState = () => {
    searchResults.forEach(result => {
      result.isQueued = queueTitles.has(result.title)
    })
  }

  const handleWebsocketMessage = (message) => {
    const data = JSON.parse(message.data)
    onMessage.emit(data)

    switch (data.type) {
      case 'shows': {
        queueTitles = new Set()
        watchingVideo = data.watchingVideo
        paused = data.paused
        queue = data.queue.map(processQueueEntry)
        showList = data.list
        updateShowQueueState()
        break
      }

      case 'start':
        watchingVideo = data.video
        break

      case 'paused':
        paused = true
        break

      case 'resumed':
        paused = false
        break

      case 'stop':
        watchingVideo = undefined
        // TODO: only refresh show that stopped
        sendMessage({ type: 'show-list' })
        break

      case 'enqueued': {
        const { type, ...queueEntry } = data
        const newEntry = processQueueEntry(queueEntry)
        queue = [...queue, newEntry]

        showList.some((show, idx) => {
          if (show.video === newEntry.displayTitle) {
            // weird indexness for svelte :(
            showList[idx].isQueued = true
            return true
          }
        })
        searchResults.some((show, idx) => {
          if (show.title === newEntry.displayTitle) {
            searchResults[idx].isQueued = true
            return true
          }
        })

        break
      }

      case 'dequeued': {
        const { videos } = data
        const videosSet = new Set(videos)
        queueTitles = new Set()
        queue = queue.filter(queued => {
          if (videosSet.has(queued.video)) {
            return false
          } else {
            queueTitles.add(queued.displayTitle)
            return true
          }
        })
        updateShowQueueState()
        updateSearchResultQueueState()
        break
      }
    }
  }

  const setSearchResults = newResults => {
    searchResults = newResults
    updateSearchResultQueueState()
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

    :global(> li) {
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
  }

  footer {
    flex-shrink: 1;
    flex-wrap: wrap;
    align-items: center;
    border-top: solid 1px #aaa;
    padding: 0 1rem;

    :global(button) {
      height: 4.5rem;
      width: 4.5rem;
      padding: 0.7rem;
      flex-grow: 1;
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
        <QueuedVideo
          watching={watchingVideo === queued.displayTitle || watchingVideo === queued.video}
          queued={queued}
          bind:queueSelections={queueSelections}
        />
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
  {#if queueSelections.size}
    <QueueControls
      onMessage={onMessage}
      sendMessage={sendMessage}
      bind:selections={queueSelections}
    />
  {/if}
  {#if !ws}
    <Loading />
  {:else}
    {#if ! watchingVideo || paused}
      <button on:click={() => handlePlay()}><FaPlay /></button>
    {:else}
      <button on:click={() => sendMessageWithType('toggle-pause')}><FaPause /></button>
    {/if}
    {#if watchingVideo}
      <button on:click={() => { sendMessageWithType("volume-down") }}>
        <FaVolumeDown />
      </button>
      <button on:click={() => { sendMessageWithType("volume-up") }}>
        <FaVolumeUp />
      </button>
    {/if}
    {#if !searchOpen}
      <button on:click={() => setLocation('/search')}><FaSearch /></button>
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
