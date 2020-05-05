import App, { Context } from 'koa'
import koaStatic from 'koa-static'
import * as KoaWebsocket from 'koa-websocket'
import { join as pathJoin, basename } from 'path'
import { spawn, exec, ChildProcess } from 'child_process'
import yaml from 'yaml'

const port = 4921
const showsDir = `${process.env.HOME}/shows`

let running: ChildProcess | undefined
let watchingPath: string | undefined

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

async function sendShowList(ctxt: Context) {
  const babiesOutput = await run(`babies p -vi ${showsDir}/*`)
  const shows: Array<{ filename: string; path: string }> = yaml.parse(
    babiesOutput,
  )

  ctxt.websocket.send(
    JSON.stringify({
      type: 'shows',
      watchingPath,
      list: shows.map((show) => ({
        path: basename(show.path),
        filename: basename(show.filename),
      })),
    }),
  )
}

function broadcast(app: KoaWebsocket.App, data: object) {
  const dataStr = JSON.stringify(data)
  app.ws.server?.clients.forEach((client) => {
    client.send(dataStr)
  })
}

function watchShow(app: KoaWebsocket.App, path: string) {
  if (path === watchingPath) {
    if (running) {
      // pause/resume
      running?.stdin?.write('p\n')
    }
    return
  }

  const showFullPath = pathJoin(showsDir, path)

  if (running) {
    running.kill()
  }

  broadcast(app, { type: 'start', path })
  watchingPath = path
  running = spawn('babies', ['n', showFullPath], {
    stdio: ['pipe', 'inherit', 'inherit'],
  })

  running.on('exit', () => {
    console.log('show finished')
    broadcast(app, { type: 'stop', path })
    running = undefined
    watchingPath = undefined
  })
}

async function listenToSocket(app: KoaWebsocket.App, ctxt: Context) {
  ctxt.websocket.onmessage = (message) => {
    const payload = JSON.parse(message.data.toString())
    switch (payload.type) {
      case 'watch':
        const { path } = payload
        watchShow(app, path)
        break

      case 'show-list':
        sendShowList(ctxt)
        break

      case 'volume-up':
        running?.stdin?.write('0\n')
        break

      case 'volume-down':
        running?.stdin?.write('9\n')
        break

      default:
        console.warn('Unrecognised message type %O', payload)
    }
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
    sendShowList(ctxt)
    listenToSocket(app, ctxt)
    return next()
  })
}

if (require.main === module) {
  main().catch(console.error)
}
