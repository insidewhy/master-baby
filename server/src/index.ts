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

const runShell = (cmd: string) =>
  new Promise<string>((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        reject(stderr)
      } else {
        resolve(stdout)
      }
    })
  })

const run = (cmdAndArgs: string[]) =>
  new Promise<string>((resolve, reject) => {
    const proc = spawn(cmdAndArgs[0], cmdAndArgs.slice(1))
    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (data) => {
      stdout += data
    })
    proc.stderr.on('data', (data) => {
      stderr += data
    })

    proc.on('exit', (code) => {
      if (!code) {
        resolve(stdout)
      } else {
        reject(stderr)
      }
    })
  })

async function sendShowList(ctxt: Context, showsDir: string) {
  const babiesOutput = await runShell(`babies p -vi ${showsDir}/*`)
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

async function sendSearch(ctxt: Context, terms: string, duration: string) {
  try {
    const babiesOutput = await run(['babies', 'syt', '-d', duration, terms])
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
  } catch (e) {
    ctxt.websocket.send(
      JSON.stringify({
        type: 'search-results',
        results: [],
      }),
    )
  }
}

function broadcast(app: KoaWebsocket.App, data: object) {
  const dataStr = JSON.stringify(data)
  app.ws.server?.clients.forEach((client) => {
    client.send(dataStr)
  })
}

function watchShow(
  app: KoaWebsocket.App,
  path: string,
  showsDir: string,
  comment?: string,
) {
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

  const babiesArgs = ['n', showFullPath]
  if (comment) {
    babiesArgs.push('-c', comment)
  }
  const thisRun = (running = spawn('babies', babiesArgs, {
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
        const { path, comment } = payload
        watchShow(app, path, showsDir, comment)
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
        const { terms, duration } = payload
        sendSearch(ctxt, terms, duration)
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
