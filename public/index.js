const pathToFilename = new Map()
const filenameToPath = new Map()

const start = () => {
  const ws = new WebSocket('ws://' + window.location.host)

  const sendMessage = (message) => {
    ws.send(JSON.stringify(message))
  }

  let closed = false
  const showList = document.querySelector('#shows')

  const timeoutAttempt = setTimeout(() => {
    if (!closed) {
      console.log('took too long to open websocket, trying again')
      closed = true
      ws.close()
      start()
    }
  }, 1000)

  ws.onopen = () => {
    if (closed) {
      console.log('ignoring duplicate websocket connection')
      ws.close()
    } else {
      clearTimeout(timeoutAttempt)
      console.log('got websocket')
    }
  }

  ws.onclose = () => {
    if (!closed) {
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

          const { watchingPath } = data
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
        }
        break

      case 'stop':
        {
          const filename = pathToFilename.get(data.path)
          Array.from(showList.children).forEach((li) => {
            if (li.textContent === filename) {
              li.className = ''
            }
          })
          // TODO: only refresh show that stopped
          sendMessage({ type: 'showList' })
        }
        break

      default:
        console.warn('Got unrecognised message', data)
    }
  }

  showList.onclick = ({ target }) => {
    const path = filenameToPath.get(target.textContent)
    sendMessage({ type: 'watch', path })
  }
}

window.onload = start
