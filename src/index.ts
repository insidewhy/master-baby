import App, { Context } from 'koa'
import koaStatic from 'koa-static'
import websockify from 'koa-websocket'
import { join as pathJoin } from 'path'
import { readdir } from 'fs-extra'
import { spawn, ChildProcess } from 'child_process'

const port = 4921
const showsDir = `${process.env.HOME}/shows`

let running: ChildProcess | undefined

async function sendShows(ctxt: Context) {
  const shows = await readdir(showsDir)
  ctxt.websocket.send(
    JSON.stringify({
      type: 'shows',
      list: shows.filter(
        (show) => !show.startsWith('.') && !show.startsWith('doit'),
      ),
    }),
  )
}

async function listenToSocket(ctxt: Context) {
  ctxt.websocket.onmessage = (message) => {
    const show = pathJoin(showsDir, message.data.toString())

    if (running) {
      running.kill()
    } else {
      running = spawn('babies', ['n', show], {
        stdio: 'inherit',
      })

      running.on('exit', () => {
        console.log('show finished')
        running = undefined
      })
    }
    console.log('TODO: show', show)
    // TODO: show show
  }
}

async function main(): Promise<void> {
  const app = websockify(new App())
  app.use(koaStatic(pathJoin(__dirname, '..', '/public')))
  app.listen(port, () => {
    console.log(`server listening on http://localhost:${port}`)
  })

  app.ws.use((ctxt, next) => {
    console.debug('got websocket')
    sendShows(ctxt)
    listenToSocket(ctxt)
    return next()
  })
}

if (require.main === module) {
  main().catch(console.error)
}
