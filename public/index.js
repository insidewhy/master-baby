const start = () => {
  const ws = new WebSocket('ws://' + window.location.host)

  let ignore = false
  const showList = document.querySelector('#shows')

  const timeoutAttempt = setTimeout(() => {
    if (!ignore) {
      console.log('took too long to open websocket, trying again')
      ignore = true
      ws.close()
      start()
    }
  }, 1000)

  ws.onopen = () => {
    if (ignore) {
      console.log('ignoring duplicate websocket connection')
      ws.close()
    } else {
      clearTimeout(timeoutAttempt)
      console.log('got websocket')
    }
  }

  ws.onclose = () => {
    if (!ignore) {
      console.log('websocket closed, trying again')
      setTimeout(start, 1000)
      ignore = true
    }
  }

  ws.onmessage = (message) => {
    const data = JSON.parse(message.data)
    showList.innerHTML = ''
    if (data.type === 'shows') {
      data.list.forEach((show) => {
        const li = document.createElement('li')
        li.textContent = show
        showList.appendChild(li)
      })
    }
  }

  showList.onclick = ({ target }) => {
    ws.send(target.textContent)
  }
}

window.onload = start
