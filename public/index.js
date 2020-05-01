const start = () => {
  const ws = new WebSocket("ws://" + window.location.host)

  const showsList = document.querySelector('#shows')

  ws.onopen = () => {
    console.log('got websocket')
  }

  ws.onmessage = (message) => {
    const data = JSON.parse(message.data)
    if (data.type === 'shows') {
      data.list.forEach(show => {
        const li = document.createElement('li')
        li.textContent = show
        showsList.appendChild(li)
      })
    }
  }

  showsList.onclick = ({ target }) => {
    ws.send(target.textContent)
  }
}

window.onload = start

