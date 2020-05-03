import App, { Context } from 'koa'
import koaStatic from 'koa-static'
import * as KoaWebsocket from 'koa-websocket'
import { join as pathJoin, basename } from 'path'
import { spawn, exec, ChildProcess } from 'child_process'
import yaml from 'yaml'

const port = 4921
const showsDir = `${process.env.HOME}/shows`

let running: ChildProcess | undefined
let watching: string | undefined

const run = (cmd: string) =>
  new Promise<string>((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        reject(stderr)
      } else {
        resolve(stdout)
      }
    })
  })

async function sendShows(ctxt: Context) {
  const babiesOutput = await run(`babies p -vi ${showsDir}/*`)
  const shows: Array<{ filename: string; path: string }> = yaml.parse(
    babiesOutput,
  )

  ctxt.websocket.send(
    JSON.stringify({
      type: 'shows',
      watching,
      list: shows.map((show) => basename(show.path)),
    }),
  )
}

function broadcast(app: KoaWebsocket.App, data: object) {
  const dataStr = JSON.stringify(data)
  app.ws.server?.clients.forEach((client) => {
    client.send(dataStr)
  })
}

function watchShow(app: KoaWebsocket.App, show: string) {
  const showFullPath = pathJoin(showsDir, show)

  if (running) {
    running.kill()
  }

  broadcast(app, { type: 'start', show })
  watching = show
  running = spawn('babies', ['n', showFullPath], {
    stdio: 'inherit',
  })

  running.on('exit', () => {
    console.log('show finished')
    broadcast(app, { type: 'stop', show })
    running = undefined
    watching = undefined
  })
}

async function listenToSocket(app: KoaWebsocket.App, ctxt: Context) {
  ctxt.websocket.onmessage = (message) => {
    const show = message.data.toString()
    watchShow(app, show)
  }
}

async function main(): Promise<void> {
  const app = KoaWebsocket.default(new App())
  app.use(koaStatic(pathJoin(__dirname, '..', '/public')))
  app.listen(port, () => {
    console.log(`server listening on http://localhost:${port}`)
  })

  app.ws.use((ctxt, next) => {
    console.debug('got websocket')
    sendShows(ctxt)
    listenToSocket(app, ctxt)
    return next()
  })
}

if (require.main === module) {
  main().catch(console.error)
}
