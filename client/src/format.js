export const shortenTime = (time) =>
  time.replace(/^0:0*(:0*)?/, '').replace(/\.\d+$/, '')

export const secondsToTime = (totalSeconds) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(totalSeconds / 60) - hours * 60;
  const seconds = Math.round(totalSeconds % 60);
  if (hours) {
    return `${hours}:${minutes}:${seconds}`
  } else if (minutes) {
    return `${minutes}:${seconds}`
  } else {
    return seconds.toString()
  }
}
