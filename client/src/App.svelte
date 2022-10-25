<script lang="ts">
  import { EventEmitter } from 'event-emitters'
  import FaListOl from 'svelte-icons/fa/FaListOl.svelte'
  import FaVolumeDown from 'svelte-icons/fa/FaVolumeDown.svelte'
  import FaVolumeUp from 'svelte-icons/fa/FaVolumeUp.svelte'
  import FaCog from 'svelte-icons/fa/FaCog.svelte'
  import FaSearch from 'svelte-icons/fa/FaSearch.svelte'
  import FaTimes from 'svelte-icons/fa/FaTimes.svelte'
  import FaPause from 'svelte-icons/fa/FaPause.svelte'
  import FaPlay from 'svelte-icons/fa/FaPlay.svelte'
  import FaStop from 'svelte-icons/fa/FaStop.svelte'

  import QueuedMedia from './QueuedMedia.svelte'
  import QueueControls from './QueueControls.svelte'
  import Search from './Search.svelte'
  import Settings from './Settings.svelte'
  import Loading from './Loading.svelte'
  import MediaPosition from './MediaPosition.svelte'
  import { onLocationChange, setLocation } from './location'
  import { shortenTime, secondsToTime } from './format'
  import { getDefaultMediaInfo, type Media } from './media'

  interface IncomingMessage {
    type: string;
    data: string;
  }

  let ws: WebSocket
  let playingMedia: string
  let startMediaPosition: { duration: string, position: string }
  let mediaList: Media[] = []
  let queue = []
  let queueTitles: Set<string>
  let queueSelections = new Set<string>()
  // youtube or spotify
  let searchService = 'youtube'
  const onMessage = new EventEmitter<any>()

  // search binds
  let searchOpen = false
  let queueOpen = false
  let settingsOpen = false
  let paused = false
  let searchResults = []
  let sortOrder = window.localStorage.getItem('sortOrder') ?? 'location'

  let mediaInfo = getDefaultMediaInfo()

  onLocationChange(({ path }) => {
    searchOpen = path === '/search'
    settingsOpen = path === '/settings'
    const nextQueueOpen = path === '/queue'
    if (! queueOpen && nextQueueOpen) {
      queueSelections = new Set()
    }
    queueOpen = nextQueueOpen
  })

  const sendMessage = (message: object) => {
    if (ws) {
      ws.send(JSON.stringify(message))
    }
  }

  const getMediaInfo = () => {
    if (playingMedia && !mediaInfo.subTracks.length && !mediaInfo.audioTracks.length) {
      sendMessage({ type: 'get-media-info' })
    }
  }

  $: playingMedia, getMediaInfo()

  const startMedia = (path: string, title?: string) => {
    const message: { type: string, path: string, title?: string } = { type: 'enqueue', path }
    if (title) {
      message.title = title
    }
    sendMessage(message)
  }

  const sendMessageWithType = (type: string) => {
    sendMessage({ type })
  }

  const handlePlay = () => {
    if (! playingMedia) {
      sendMessageWithType('resume-playlist')
    } else {
      sendMessageWithType('toggle-pause')
    }
  }

  const processQueueEntry = (media: Media) => {
    const { title, location } = media
    const displayTitle = title || (location.startsWith('https://') ? location : location.replace(/.*\//, ''))
    queueTitles.add(displayTitle)

    if (media.duration) {
      media.duration = shortenTime(media.duration)
      if (media.sessions) {
        const position = media.sessions[media.sessions.length - 1].end
        if (position) {
          // remove everything before the " at "
          media.position = shortenTime(position.replace(/.* /, ''))
        }
        delete media.sessions
      }
    }

    return { ...media, displayTitle }
  }

  const updateMediaQueueState = () => {
    mediaList.forEach(media => {
      if (queueTitles.has(media.location)) {
        media.isQueued = true
      } else {
        media.isQueued = false
      }
    })
  }

  const updateSearchResultQueueState = () => {
    searchResults.forEach(result => {
      result.isQueued = queueTitles.has(result.title)
    })
  }

  // ignore stuff at the beginning of line between square brackets, it's usually the
  // subgroup or studio
  const getLocationSortKey = (location: string) => location.replace(/\[[^\]]+\]\s+/, '').toLowerCase()

  const compareLocations = (a: Media, b: Media) => {
    const aLocation = getLocationSortKey(a.location)
    const bLocation = getLocationSortKey(b.location)
    return aLocation < bLocation ? -1 : 1
  }

  const sortMediaList = (mediaList: Media[]) => {
    if (sortOrder === 'mtime') {
      return mediaList.sort((a, b) => {
        if (a.mtime) {
          return b.mtime ? b.mtime - a.mtime : -1
        } else if (b.mtime) {
          return -1
        } else {
          return compareLocations(a, b)
        }
      })
    } else {
      return mediaList.sort(compareLocations)
    }
  }

  let prevSortOrder = sortOrder
  const updateSortOrder = () => {
    if (prevSortOrder !== sortOrder) {
      prevSortOrder = sortOrder
      window.localStorage.setItem('sortOrder', sortOrder)
      mediaList = sortMediaList(mediaList)
    }
  }

  $: sortOrder, updateSortOrder()

  const handleWebsocketMessage = (message: IncomingMessage) => {
    const data = JSON.parse(message.data)
    onMessage.emit(data)

    switch (data.type) {
      case 'pos':
        mediaInfo.pos = data.value
        break

      case 'media':
        queueTitles = new Set()
        playingMedia = data.playing
        paused = data.paused
        queue = data.queue.map(processQueueEntry)
        mediaList = sortMediaList(data.list)
        updateMediaQueueState()
        break

      case 'start':
        playingMedia = data.location

        startMediaPosition = {
          position: secondsToTime(data.pos),
          duration: secondsToTime(data.duration),
        }
        if (
          queue.some(queued => {
            if (queued.location === playingMedia) {
              queued.position = startMediaPosition.position
              queued.duration = startMediaPosition.duration
              return true
            }
          })
        ) {
          queue = queue
        }

      case 'media-info':
        mediaInfo.activeAudioTrack = data.activeAudioTrack
        mediaInfo.activeSubTrack = data.activeSubTrack
        mediaInfo.audioTracks = data.audioTracks
        mediaInfo.subTracks = data.subTracks
        mediaInfo.duration = data.duration
        mediaInfo.pos = data.pos
        break

      case 'aid':
        mediaInfo.activeAudioTrack = data.value
        break

      case 'sid':
        mediaInfo.activeSubTrack = data.value
        break

      case 'paused':
        paused = true
        break

      case 'resumed':
        paused = false
        break

      case 'stop':
        playingMedia = undefined
        startMediaPosition = undefined
        mediaInfo = getDefaultMediaInfo()
        // TODO: only refresh media that stopped
        sendMessage({ type: 'media-list' })
        break

      case 'enqueued': {
        const { media } = data
        const newEntry = processQueueEntry(media)
        queue = [...queue, newEntry]

        mediaList.some((media, idx) => {
          if (media.location === newEntry.displayTitle) {
            // weird indexness for svelte :(
            mediaList[idx].isQueued = true
            return true
          }
        })
        searchResults.some((media, idx) => {
          if (media.title === newEntry.displayTitle) {
            searchResults[idx].isQueued = true
            return true
          }
        })

        break
      }

      case 'dequeued': {
        const { media } = data
        const mediaSet = new Set(media)
        queueTitles = new Set()
        queue = queue.filter(queued => {
          if (mediaSet.has(queued.location)) {
            return false
          } else {
            queueTitles.add(queued.displayTitle)
            return true
          }
        })
        updateMediaQueueState()
        updateSearchResultQueueState()
        break
      }
    }
  }

  const setSearchResults = (newResults: unknown[]) => {
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
          playingMedia = undefined
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

<style lang="scss">
  ul {
    flex-grow: 1;
    width: 100%;
    list-style: none;
    flex-direction: column;
    overflow-y: scroll;

    > :global(li) {
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

    > :global(li .duration) {
      margin-left: auto;
      white-space: nowrap;
      padding-left: 0.7em;
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
        on:click={() => { startMedia(result.location, result.title) }}
        class:watching={playingMedia === result.location}
        class:queued={result.isQueued}
      >{result.title}</li>
    {/each}
  {:else}
    {#if queueOpen}
      {#each queue as queued}
        <QueuedMedia
          watching={playingMedia === queued.displayTitle || playingMedia === queued.location}
          queued={queued}
          bind:queueSelections={queueSelections}
        />
      {/each}
    {:else}
      {#each mediaList as media}
        <li
          on:click={() => { startMedia(media.path) }}
          class:watching={playingMedia === media.location}
          class:queued={media.isQueued}
        >
          <span>{media.location}</span>
          {#if playingMedia === media.location && startMediaPosition}
            <span class="duration">
              {#if startMediaPosition.position}
                {startMediaPosition.position} /
              {/if}

              {startMediaPosition.duration}
            </span>
          {/if}
      {/each}
    {/if}
  {/if}
</ul>
<footer>
  {#if playingMedia}
    <MediaPosition
      {sendMessage}
      pos={mediaInfo.pos}
      duration={mediaInfo.duration}
    />
  {/if}
  {#if queueSelections.size}
    <QueueControls
      {onMessage}
      {sendMessage}
      bind:selections={queueSelections}
    />
  {/if}
  {#if !ws}
    <Loading />
  {:else}
    {#if settingsOpen}
      <Settings
        bind:sortOrder
        bind:mediaInfo
        {onMessage}
        {sendMessage}
       />
    {/if}
    {#if !searchOpen}
      {#if ! playingMedia || paused}
        <button on:click={() => handlePlay()}><FaPlay /></button>
      {:else}
        <button on:click={() => sendMessageWithType('toggle-pause')}><FaPause /></button>
      {/if}
      {#if playingMedia}
        <button on:click={() => { sendMessageWithType("stop") }}>
          <FaStop />
        </button>
        <button on:click={() => { sendMessageWithType("volume-down") }}>
          <FaVolumeDown />
        </button>
        <button on:click={() => { sendMessageWithType("volume-up") }}>
          <FaVolumeUp />
        </button>
      {/if}
      <button on:click={() => setLocation('/search', { service: searchService })}><FaSearch /></button>
    {/if}
    {#if searchOpen}
      <Search
        bind:searchService={searchService}
        {sendMessage}
        {onMessage}
        onSearchResults={setSearchResults}
      />
    {:else}
      {#if queueOpen}
        <button on:click={() => setLocation('/')}><FaTimes /></button>
      {:else}
        <button on:click={() => setLocation('/queue')}><FaListOl /></button>
      {/if}
      {#if settingsOpen}
        <button on:click={() => setLocation('/')}><FaTimes /></button>
      {:else}
        <button on:click={() => setLocation('/settings')}><FaCog /></button>
      {/if}
    {/if}
  {/if}
</footer>
