const start = () => {
  const ws = new WebSocket('ws://' + window.location.host)

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
          showList.innerHTML = ''
          const { watching } = data
          data.list.forEach((show) => {
            const li = document.createElement('li')
            li.textContent = show
            if (show === watching) {
              li.className = 'watching'
            }
            showList.appendChild(li)
          })
        }
        break

      case 'start':
        {
          const { show } = data
          Array.from(showList.children).forEach((li) => {
            if (li.textContent === show) {
              li.className = 'watching'
            }
          })
        }
        break

      case 'stop':
        {
          const { show } = data
          Array.from(showList.children).forEach((li) => {
            if (li.textContent === show) {
              li.className = ''
            }
          })
        }
        break

      default:
        console.warn('Got unrecognised message', data)
    }
  }

  showList.onclick = ({ target }) => {
    ws.send(target.textContent)
  }
}

window.onload = start
