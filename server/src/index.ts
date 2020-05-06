import App, { Context } from 'koa'
import cors from '@koa/cors'
import * as KoaWebsocket from 'koa-websocket'
import { join as pathJoin, basename } from 'path'
import { spawn, exec, ChildProcess } from 'child_process'
import yaml from 'yaml'

const port = 4920
const defaultShowsDir = `${process.env.HOME}/shows`

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

async function sendShowList(ctxt: Context, showsDir: string) {
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

async function sendSearch(ctxt: Context, searchTerms: string) {
  const babiesOutput = await run(`babies syt ${searchTerms}`)
  const results = yaml.parse(babiesOutput)

  results.forEach((result: any) => {
    result.url = `https://youtube.com/watch?v=${result.id}`
    delete result.id
  })

  ctxt.websocket.send(
    JSON.stringify({
      type: 'search-results',
      results,
    }),
  )
}

function broadcast(app: KoaWebsocket.App, data: object) {
  const dataStr = JSON.stringify(data)
  app.ws.server?.clients.forEach((client) => {
    client.send(dataStr)
  })
}

function watchShow(app: KoaWebsocket.App, path: string, showsDir: string) {
  if (path === watchingPath) {
    if (running) {
      // pause/resume
      running?.stdin?.write('p\n')
    }
    return
  }

  const showFullPath = path.startsWith('https://')
    ? path
    : pathJoin(showsDir, path)

  if (running) {
    running.stdin?.write('q\n')
  }

  broadcast(app, { type: 'start', path })
  watchingPath = path
  const thisRun = (running = spawn('babies', ['n', showFullPath], {
    stdio: ['pipe', 'inherit', 'inherit'],
  }))

  running.on('exit', () => {
    if (running === thisRun) {
      console.log('show finished')
      broadcast(app, { type: 'stop', path })
      running = undefined
      watchingPath = undefined
    } else {
      console.log('switched shows')
    }
  })
}

async function listenToSocket(
  app: KoaWebsocket.App,
  ctxt: Context,
  showsDir: string,
) {
  ctxt.websocket.onmessage = (message) => {
    const payload = JSON.parse(message.data.toString())
    switch (payload.type) {
      case 'watch':
        const { path } = payload
        watchShow(app, path, showsDir)
        break

      case 'show-list':
        sendShowList(ctxt, showsDir)
        break

      case 'volume-up':
        running?.stdin?.write('0\n')
        break

      case 'volume-down':
        running?.stdin?.write('9\n')
        break

      case 'search':
        const { searchTerms } = payload
        sendSearch(ctxt, searchTerms)
        break

      default:
        console.warn('Unrecognised message type %O', payload)
    }
  }
}

async function main(): Promise<void> {
  const showsDir = process.argv[2] || defaultShowsDir
  const app = KoaWebsocket.default(new App())
  app.use(cors())
  app.listen(port, () => {
    console.log(`server listening on http://localhost:${port}`)
  })

  app.ws.use((ctxt, next) => {
    console.debug('got websocket')
    sendShowList(ctxt, showsDir)
    listenToSocket(app, ctxt, showsDir)
    return next()
  })
}

if (require.main === module) {
  main().catch(console.error)
}
