import App, { Context } from 'koa'
import cors from '@koa/cors'
import * as KoaWebsocket from 'koa-websocket'
import { data as xdgData } from 'xdg-basedir'
import { join as pathJoin, basename } from 'path'
import { spawn, exec, ChildProcess } from 'child_process'
import yaml from 'yaml'
import { ensureDir, readFile } from 'fs-extra'

const port = 4920
const defaultShowsDir = `${process.env.HOME}/shows`

let running: ChildProcess | undefined
let paused = false
let watchingVideo: string | undefined

const queueDir = pathJoin(xdgData!, 'master-baby', 'queue')
const queueFile = pathJoin(queueDir, '.videos.yaml')

interface ShowsState {
  showsDir: string
  // TODO: store watch queue
}

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

const basenameOfFile = (urlOrFile: string) => {
  if (urlOrFile.startsWith('https://')) {
    return urlOrFile
  } else {
    return basename(urlOrFile)
  }
}

async function sendShowList(ctxt: Context, showsState: ShowsState) {
  const babiesOutput = await runShell(`babies p -vi ${showsState.showsDir}/*`)
  const shows: Array<{ filename: string; path: string }> = yaml.parse(
    babiesOutput,
  )

  let data = null
  try {
    data = (await readFile(queueFile)).toString()
  } catch (e) {
    // no file
  }

  const queue: Array<{ comment?: string; video: string }> = data
    ? yaml.parse(data)
    : []

  ctxt.websocket.send(
    JSON.stringify({
      type: 'shows',
      watchingVideo,
      paused,
      list: shows.map((show) => ({
        path: basename(show.path),
        video: basename(show.filename),
      })),
      queue,
    }),
  )
}

async function sendSearch(ctxt: Context, terms: string, duration: string) {
  try {
    const babiesOutput = await run(['babies', 'syt', '-d', duration, terms])
    const results = yaml.parse(babiesOutput)

    results.forEach((result: any) => {
      result.video = `https://youtube.com/watch?v=${result.id}`
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

async function spawnBabies(app: KoaWebsocket.App): Promise<void> {
  running = spawn('babies', ['n', queueDir], {
    stdio: ['pipe', 'pipe', 'inherit'],
  })

  let hasShow = false
  let showFinished = false
  running.stdout!.on('data', (data: Buffer) => {
    const lines = data.toString()

    lines
      .trimRight()
      .split('\n')
      .forEach((line) => {
        line = line.trimRight()
        if (!hasShow) {
          paused = false
          hasShow = true
          watchingVideo = basenameOfFile(line)
          broadcast(app, { type: 'start', video: watchingVideo })
        }

        if (line.startsWith('end: ')) {
          const [position, duration] = line.slice(5).split('/')
          showFinished = position === duration
        } else if (line.startsWith('pause: ')) {
          if (line.endsWith('paused')) {
            paused = true
            broadcast(app, { type: 'paused' })
          } else {
            paused = false
            broadcast(app, { type: 'resumed' })
          }
        }
      })
  })

  running.on('exit', () => {
    running = undefined

    if (hasShow) {
      console.log('show finished')
      broadcast(app, {
        type: 'stop',
        video: watchingVideo,
        complete: showFinished,
      })
      watchingVideo = undefined

      if (showFinished) {
        // watch the next show if there is one
        spawnBabies(app)
      }
    }
  })
}

// add show to queue and start watching shows if not already watching
async function enqueueShow(
  app: KoaWebsocket.App,
  showsState: ShowsState,
  path: string,
  comment?: string,
) {
  const showFullPath = path.startsWith('https://')
    ? path
    : pathJoin(showsState.showsDir, path)

  const queueCmd = ['babies', 'e', queueDir, showFullPath]
  if (comment) {
    queueCmd.push('-c', comment)
  }
  const enqueueOutput = await run(queueCmd)
  const enqueueMsg = yaml.parse(enqueueOutput)?.[0]
  if (!enqueueMsg) {
    console.warn('Unexpected output from enqueue command: %O', enqueueOutput)
  } else {
    enqueueMsg.type = 'enqueue'
    broadcast(app, enqueueMsg)
  }

  if (!running) {
    await spawnBabies(app)
  }
}

async function listenToSocket(
  app: KoaWebsocket.App,
  ctxt: Context,
  showsState: ShowsState,
) {
  ctxt.websocket.onmessage = (message) => {
    const payload = JSON.parse(message.data.toString())
    switch (payload.type) {
      case 'enqueue':
        const { path, comment } = payload
        enqueueShow(app, showsState, path, comment)
        break

      case 'resume-playlist':
        spawnBabies(app)
        break

      case 'show-list':
        sendShowList(ctxt, showsState)
        break

      case 'toggle-pause':
        running?.stdin?.write('p\n')
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
  const showsState = {
    showsDir: process.argv[2] || defaultShowsDir,
  }
  const app = KoaWebsocket.default(new App())

  await ensureDir(queueDir)
  app.use(cors())
  app.listen(port, () => {
    console.log(`server listening on http://localhost:${port}`)
  })

  app.ws.use((ctxt, next) => {
    console.debug('got websocket')
    sendShowList(ctxt, showsState)
    listenToSocket(app, ctxt, showsState)
    return next()
  })
}

if (require.main === module) {
  main().catch(console.error)
}
