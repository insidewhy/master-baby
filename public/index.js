const pathToFilename = new Map()
const filenameToPath = new Map()

let isSetup = false
let showList
let watchingPath
let openedWs
let loadingEl
let controlsEl
const watchingDisable = []

const sendMessage = (ws, message) => {
  if (ws) {
    ws.send(JSON.stringify(message))
  }
}

const setDisableState = (disabled) => {
  watchingDisable.forEach((node) => {
    node.disabled = disabled
  })
}

const setup = () => {
  if (isSetup) return
  isSetup = true
  showList = document.querySelector('#shows')

  showList.onclick = ({ target }) => {
    const path = filenameToPath.get(target.textContent)
    sendMessage(openedWs, { type: 'watch', path })
  }

  const volumeUp = document.querySelector('#volume-up')
  const volumeDown = document.querySelector('#volume-down')

  volumeUp.onclick = () => {
    sendMessage(openedWs, { type: 'volume-up' })
  }

  volumeDown.onclick = () => {
    sendMessage(openedWs, { type: 'volume-down' })
  }

  watchingDisable.length = 0
  watchingDisable.push(volumeUp, volumeDown)
  setDisableState(true)
}

const start = () => {
  const ws = new WebSocket('ws://' + window.location.host)

  let closed = false

  const timeoutAttempt = setTimeout(() => {
    if (!closed) {
      console.log('took too long to open websocket, trying again')
      closed = true
      ws.close()
    }
  }, 1000)

  ws.onopen = () => {
    loadingEl.style.display = 'none'
    controlsEl.style.display = 'flex'
    if (closed) {
      console.log('ignoring duplicate websocket connection')
      ws.close()
    } else {
      clearTimeout(timeoutAttempt)
      console.log('got websocket')
      openedWs = ws
      setup()
    }
  }

  ws.onclose = () => {
    loadingEl.style.display = 'flex'
    controlsEl.style.display = 'none'
    if (!closed) {
      if (ws === openedWs) {
        openedWs = undefined
      }
      setDisableState(true)
      console.log('websocket closed, trying again')
      setTimeout(start, 1000)
      closed = true
    }
  }

  ws.onmessage = (message) => {
    const data = JSON.parse(message.data)
    switch (data.type) {
      case 'shows':
        {
          filenameToPath.clear()
          pathToFilename.clear()
          showList.innerHTML = ''

          watchingPath = data.watchingPath
          if (watchingPath) {
            setDisableState(false)
          }

          data.list.forEach(({ path, filename }) => {
            filenameToPath.set(filename, path)
            pathToFilename.set(path, filename)

            const li = document.createElement('li')
            li.textContent = filename
            if (path === watchingPath) {
              li.className = 'watching'
            }
            showList.appendChild(li)
          })
        }
        break

      case 'start':
        {
          const filename = pathToFilename.get(data.path)
          Array.from(showList.children).forEach((li) => {
            if (li.textContent === filename) {
              li.className = 'watching'
            }
          })
          setDisableState(false)
        }
        break

      case 'stop':
        {
          watchingPath = undefined
          const filename = pathToFilename.get(data.path)
          Array.from(showList.children).forEach((li) => {
            if (li.textContent === filename) {
              li.className = ''
            }
          })
          // TODO: only refresh show that stopped
          sendMessage(ws, { type: 'show-list' })
          setDisableState(true)
        }
        break

      default:
        console.warn('Got unrecognised message', data)
    }
  }
}

window.onload = () => {
  loadingEl = document.querySelector('#loading')
  controlsEl = document.querySelector('#controls')
  start()
}
