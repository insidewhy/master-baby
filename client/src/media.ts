export interface MediaSession {
  end: string
}

export interface Media {
  displayTitle: string
  location: string
  position: string
  duration: string
  title?: string
  sessions: MediaSession[]
  isQueued: boolean
  mtime?: number
  path: string
}

export interface MediaInfo {
  activeAudioTrack: string
  audioTracks: Array<[string, string]>
  activeSubTrack: string
  subTracks: Array<[string, string]>
  pos: number
  duration: number
}

// audio/sub tracks
export const getDefaultMediaInfo = (): MediaInfo => ({
  activeAudioTrack: 'unknown',
  audioTracks: [],
  activeSubTrack: 'unknown',
  subTracks: [],
  pos: 0,
  duration: 0,
})
