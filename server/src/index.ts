import App from 'koa'
import cors from '@koa/cors'
import websockify, {
  MiddlewareContext,
  App as WebsocketApp,
} from 'koa-websocket'
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

async function sendMediaList(
  ctxt: MiddlewareContext<any>,
  mediaState: MediaState,
) {
  const babiesOutput = await runShell(`babies p -vim ${mediaState.mediaDir}/*`)
  const media: Array<{
    filename: string
    path: string
    mtime?: string
  }> = yaml.parse(babiesOutput)

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
      playing: playingMedia,
      paused,
      list: media.map((mediaFile) => ({
        path: basename(mediaFile.path),
        location: basename(mediaFile.filename),
        mtime: mediaFile.mtime,
      })),
      queue: queue.map(convertQueueEntry),
    }),
  )
}

async function sendDisplays(ctxt: MiddlewareContext<any>) {
  const babiesOutput = await runShell(`babies gd -v`)
  const output: Array<{
    displays: string[]
    current: string
  }> = yaml.parse(babiesOutput)
  ctxt.websocket.send(JSON.stringify({ type: 'displays', ...output }))
}

async function setDisplay(newDisplay: string) {
  await runShell(`babies sd ${newDisplay}`)
}

async function sendSearch(
  ctxt: MiddlewareContext<any>,
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
        if (result.type === 'track') {
          result.title = `${result.artist} - ${result.album} - ${result.name}`
        } else {
          result.title = `${result.name} - ${result.release_date}`
        }
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

function broadcast(app: WebsocketApp, data: object) {
  const dataStr = JSON.stringify(data)
  app.ws.server?.clients.forEach((client) => {
    client.send(dataStr)
  })
}

const posPrefix = 'pos: '
const startPrefix = 'start: '
const positionPrefix = 'position: '
const endPrefix = 'end: '
const pausePrefix = 'pause: '
const audioPrefix = 'audio: '
const activeAudioPrefix = 'active-audio: '
const subPrefix = 'sub: '
const activeSubPrefix = 'active-sub: '

class MediaInfo {
  activeAudioTrack: string
  audioTracks: Array<readonly [string, string]>
  activeSubTrack: string
  subTracks: Array<readonly [string, string]>
  pos: number
  duration: number

  constructor() {
    this.activeAudioTrack = 'unknown'
    this.audioTracks = []
    this.activeSubTrack = 'unknown'
    this.subTracks = []
    this.pos = 0
    this.duration = 0
  }
}

let mediaInfo = new MediaInfo()

function timeToSeconds(time: string): number {
  const [hours, minutes, seconds] = time.split(':')
  return (
    Math.round(parseFloat(seconds)) +
    parseInt(minutes) * 60 +
    parseInt(hours) * 3_600
  )
}

async function spawnBabies(app: WebsocketApp): Promise<void> {
  running = spawn('babies', ['n', '-p', queueDir], {
    stdio: ['pipe', 'pipe', 'inherit'],
  })

  let mediaFinished = false
  let started = false
  mediaInfo = new MediaInfo()

  running.stdout!.on('data', (data: Buffer) => {
    const lines = data.toString()

    lines
      .trimRight()
      .split('\n')
      .forEach((line) => {
        line = line.trimRight()
        if (line.startsWith(posPrefix)) {
          const value = parseInt(line.slice(posPrefix.length))
          broadcast(app, { type: 'pos', value })
        } else if (line.startsWith(subPrefix)) {
          const subParts = line.slice(subPrefix.length).split(',', 2) as [
            string,
            string,
          ]
          if (
            !mediaInfo.subTracks.find((subTrack) => subTrack[0] === subParts[0])
          ) {
            mediaInfo.subTracks.push(subParts)
          }
        } else if (line.startsWith(activeSubPrefix)) {
          const subParts = line.slice(activeSubPrefix.length).split(',', 2) as [
            string,
            string,
          ]
          if (
            !mediaInfo.subTracks.find((subTrack) => subTrack[0] === subParts[0])
          ) {
            mediaInfo.subTracks.push(subParts)
          }
          mediaInfo.activeSubTrack = subParts[0]
          if (started) {
            broadcast(app, {
              type: 'sid',
              value: mediaInfo.activeSubTrack,
            })
          }
        } else if (line.startsWith(audioPrefix)) {
          const audioParts = line.slice(audioPrefix.length).split(',', 2) as [
            string,
            string,
          ]
          if (
            !mediaInfo.audioTracks.find(
              (audioTrack) => audioTrack[0] === audioParts[0],
            )
          ) {
            mediaInfo.audioTracks.push(audioParts)
          }
        } else if (line.startsWith(activeAudioPrefix)) {
          const audioParts = line
            .slice(activeAudioPrefix.length)
            .split(',', 2) as [string, string]

          if (
            !mediaInfo.audioTracks.find(
              (audioTrack) => audioTrack[0] === audioParts[0],
            )
          ) {
            mediaInfo.audioTracks.push(audioParts)
          }
          mediaInfo.activeAudioTrack = audioParts[0]

          if (started) {
            broadcast(app, {
              type: 'aid',
              value: mediaInfo.activeAudioTrack,
            })
          }
        } else if (line.startsWith(startPrefix)) {
          started = true
          paused = false
          playingMedia = basenameOfFile(line.slice(startPrefix.length))
        } else if (line.startsWith(positionPrefix)) {
          const [position, duration] = line
            .slice(positionPrefix.length)
            .split('/')
          mediaInfo.duration = timeToSeconds(duration)
          mediaInfo.pos = timeToSeconds(position)

          broadcast(app, {
            type: 'start',
            location: playingMedia,
            activeSubTrack: mediaInfo.activeSubTrack,
            subTracks: mediaInfo.subTracks,
            activeAudioTrack: mediaInfo.activeAudioTrack,
            audioTracks: mediaInfo.audioTracks,
            pos: mediaInfo.pos,
            duration: mediaInfo.duration,
          })
        } else if (line.startsWith(endPrefix)) {
          const [position, duration] = line.slice(endPrefix.length).split('/')
          mediaFinished = position === duration
        } else if (line.startsWith(pausePrefix)) {
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

    if (playingMedia) {
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
  app: WebsocketApp,
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

async function dequeueMedia(app: WebsocketApp, media: string[]) {
  try {
    await run(['babies', 'de', queueDir, ...media])
    broadcast(app, { type: 'dequeued', media })

    if (
      running &&
      playingMedia &&
      media.some(
        (dequeueEntry) => basenameOfFile(dequeueEntry) === playingMedia,
      )
    ) {
      // the current media was dequeued, quit it
      running.stdin?.write('q\n')
    }
  } catch (e) {
    console.warn('Error dequeuing media', e)
    broadcast(app, { type: 'dequeued', media: [] })
  }
}

async function listenToSocket(
  app: WebsocketApp,
  ctxt: MiddlewareContext<any>,
  mediaState: MediaState,
) {
  ctxt.websocket.onmessage = (message: any) => {
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

      case 'get-displays':
        sendDisplays(ctxt)
        break

      case 'set-display':
        setDisplay(payload.display)
        break

      case 'toggle-pause':
        running?.stdin?.write('p\n')
        break

      case 'stop':
        running?.stdin?.write('q\n')
        break

      case 'volume-up':
        running?.stdin?.write('0\n')
        break

      case 'volume-down':
        running?.stdin?.write('9\n')
        break

      case 'set-aid':
        running?.stdin?.write(`aid ${payload.value}\n`)
        break

      case 'set-sid':
        running?.stdin?.write(`sid ${payload.value}\n`)
        break

      case 'search':
        const { terms, duration, service } = payload
        sendSearch(ctxt, terms, service, { duration })
        break

      case 'get-media-info':
        if (running) {
          broadcast(app, {
            type: 'media-info',
            activeSubTrack: mediaInfo.activeSubTrack,
            subTracks: mediaInfo.subTracks,
            activeAudioTrack: mediaInfo.activeAudioTrack,
            audioTracks: mediaInfo.audioTracks,
            pos: mediaInfo.pos,
            duration: mediaInfo.duration,
          })
        }
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
  // TODO: why "as any"
  const app = websockify(new App() as any)

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
