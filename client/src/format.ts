export const shortenTime = (time: string) =>
  time.replace(/^0:0*(:0*)?/, '').replace(/\.\d+$/, '')

export const secondsToTime = (totalSeconds: number) => {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = (Math.floor(totalSeconds / 60) - hours * 60)
    .toString()
    .padStart(2, '0')
  const seconds = Math.round(totalSeconds % 60)
    .toString()
    .padStart(2, '0')
  if (hours) {
    return `${hours}:${minutes}:${seconds}`
  } else if (minutes) {
    return `${minutes}:${seconds}`
  } else {
    return seconds.toString()
  }
}
