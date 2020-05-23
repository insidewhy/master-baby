import App, { Context } from 'koa'
import cors from '@koa/cors'
import * as KoaWebsocket from 'koa-websocket'
import { data as xdgData } from 'xdg-basedir'
import { join as pathJoin, basename } from 'path'
import { spawn, exec, ChildProcess } from 'child_process'
import yaml from 'yaml'
import { ensureDir, readFile } from 'fs-extra'

const port = 4920
const defaultMediaDir = `${process.env.HOME}/shows`

let running: ChildProcess | undefined
let paused = false
let playingMedia: string | undefined

const queueDir = pathJoin(xdgData!, 'master-baby', 'queue')
const queueFile = pathJoin(queueDir, '.videos.yaml')

interface MediaState {
  mediaDir: string
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

interface BabiesQueueEntry {
  title?: string
  duration?: string
  video?: string
  audio?: string
  viewings?: unknown[]
}
interface MasterBabyQueueEntry {
  title?: string
  duration?: string
  location: string
  sessions?: unknown[]
}

function convertQueueEntry({
  video,
  audio,
  title,
  viewings,
  duration,
}: BabiesQueueEntry): MasterBabyQueueEntry {
  const converted: MasterBabyQueueEntry = { location: (video || audio)! }
  if (title) {
    converted.title = title
  }
  if (viewings) {
    converted.sessions = viewings
  }
  if (duration) {
    converted.duration = duration
  }
  return converted
}

async function sendMediaList(ctxt: Context, mediaState: MediaState) {
  const babiesOutput = await runShell(`babies p -vi ${mediaState.mediaDir}/*`)
  const media: Array<{ filename: string; path: string }> = yaml.parse(
    babiesOutput,
  )

  let data = null
  try {
    data = (await readFile(queueFile)).toString()
  } catch (e) {
    // no file
  }

  const queue: BabiesQueueEntry[] = data ? yaml.parse(data) : []

  ctxt.websocket.send(
    JSON.stringify({
      type: 'media',
      playingMedia,
      paused,
      list: media.map((mediaFile) => ({
        path: basename(mediaFile.path),
        location: basename(mediaFile.filename),
      })),
      queue: queue.map(convertQueueEntry),
    }),
  )
}

async function sendSearch(
  ctxt: Context,
  terms: string,
  service: string,
  { duration }: { duration: string },
) {
  try {
    const searchYoutube = service === 'youtube'

    const babiesOutput = searchYoutube
      ? await run(['babies', 'syt', '-d', duration, terms])
      : await run(['babies', 'ss', terms])

    const results = yaml.parse(babiesOutput)

    if (searchYoutube) {
      results.forEach((result: any) => {
        result.location = `https://youtube.com/watch?v=${result.id}`
        delete result.id
      })
    } else {
      results.forEach((result: any) => {
        result.location = result.uri
        delete result.uri
        result.title = `${result.artist} - ${result.album} - ${result.name}`
      })
    }

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

  let hasMedia = false
  let mediaFinished = false
  running.stdout!.on('data', (data: Buffer) => {
    const lines = data.toString()

    lines
      .trimRight()
      .split('\n')
      .forEach((line) => {
        line = line.trimRight()
        if (line.startsWith('start: ')) {
          if (!hasMedia) {
            paused = false
            hasMedia = true
            playingMedia = basenameOfFile(line.slice(7))
            broadcast(app, { type: 'start', location: playingMedia })
          }
        }

        if (line.startsWith('end: ')) {
          const [position, duration] = line.slice(5).split('/')
          mediaFinished = position === duration
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

    if (hasMedia) {
      console.log('media finished')
      broadcast(app, {
        type: 'stop',
        location: playingMedia,
        complete: mediaFinished,
      })
      playingMedia = undefined

      if (mediaFinished) {
        // watch the next media if there is one
        spawnBabies(app)
      }
    }
  })
}

// add media to queue and start watching media if not already watching
async function enqueueMedia(
  app: KoaWebsocket.App,
  mediaState: MediaState,
  path: string,
  title?: string,
) {
  const mediaFullPath =
    path.startsWith('https://') || path.startsWith('spotify:')
      ? path
      : pathJoin(mediaState.mediaDir, path)

  const queueCmd = ['babies', 'e', queueDir, mediaFullPath]
  if (title) {
    queueCmd.push('-t', title)
  }
  const enqueueOutput = await run(queueCmd)
  const queueEntry = yaml.parse(enqueueOutput)?.[0]
  if (queueEntry) {
    broadcast(app, { type: 'enqueued', media: convertQueueEntry(queueEntry) })
  }

  if (!running) {
    await spawnBabies(app)
  }
}

async function dequeueMedia(app: KoaWebsocket.App, media: string[]) {
  try {
    await run(['babies', 'de', queueDir, ...media])
    broadcast(app, { type: 'dequeued', media })

    if (running && playingMedia && media.includes(playingMedia)) {
      // the current media was dequeued, quit it
      running.stdin?.write('q\n')
    }
  } catch (e) {
    console.warn('Error dequeuing media', e)
    broadcast(app, { type: 'dequeued', media: [] })
  }
}

async function listenToSocket(
  app: KoaWebsocket.App,
  ctxt: Context,
  mediaState: MediaState,
) {
  ctxt.websocket.onmessage = (message) => {
    const payload = JSON.parse(message.data.toString())
    switch (payload.type) {
      case 'enqueue':
        const { path, title } = payload
        enqueueMedia(app, mediaState, path, title)
        break

      case 'dequeue':
        const { media } = payload
        dequeueMedia(app, media)
        break

      case 'resume-playlist':
        spawnBabies(app)
        break

      case 'media-list':
        sendMediaList(ctxt, mediaState)
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
        const { terms, duration, service } = payload
        sendSearch(ctxt, terms, service, { duration })
        break

      default:
        console.warn('Unrecognised message type %O', payload)
    }
  }
}

async function main(): Promise<void> {
  const mediaState = {
    mediaDir: process.argv[2] || defaultMediaDir,
  }
  const app = KoaWebsocket.default(new App())

  await ensureDir(queueDir)
  app.use(cors())
  app.listen(port, () => {
    console.log(`server listening on http://localhost:${port}`)
  })

  app.ws.use((ctxt, next) => {
    console.debug('got websocket')
    sendMediaList(ctxt, mediaState)
    listenToSocket(app, ctxt, mediaState)
    return next()
  })
}

if (require.main === module) {
  main().catch(console.error)
}
