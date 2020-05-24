export const shortenTime = (time) =>
  time.replace(/^0:0*(:0*)?/, '').replace(/\.\d+$/, '')
