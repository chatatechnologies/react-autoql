const line = (a, b) => {
  const lenX = b[0] - a[0]
  const lenY = b[1] - a[1]
  return {
    length: Math.sqrt(Math.pow(lenX, 2) + Math.pow(lenY, 2)),
    angle: Math.atan2(lenY, lenX),
  }
}

const controlPoint = (current, previous, next, reverse, smoothing = 0.2) => {
  let p = previous
  let n = next
  if (!previous || !next) {
    p = current
    n = current
  }

  const o = line(p, n)
  const angle = o.angle + (reverse ? Math.PI : 0)
  const length = o.length * smoothing
  const x = current[0] + Math.cos(angle) * length
  const y = current[1] + Math.sin(angle) * length
  return [x, y]
}

export const bezierCommand = (xy, i, a, smoothing) => {
  const cps = controlPoint(a[i - 1], a[i - 2], xy, false, smoothing)
  const cpe = controlPoint(xy, a[i - 1], a[i + 1], true, smoothing)
  return `C ${cps.join(',')} ${cpe.join(',')} ${xy.join(',')}`
}

export const lineCommand = (xy) => `L ${xy.join(',')}`

export const svgPathD = (points, command, smoothing) => {
  const d = points.reduce(
    (acc, xy, i, a) => (i === 0 ? `M ${xy.join(',')}` : `${acc} ${command(xy, i, a, smoothing)}`),
    '',
  )
  return d
}

export const createSVGPath = (points, smoothing) => {
  if (!smoothing) {
    return svgPathD(points, lineCommand)
  }
  return svgPathD(points, bezierCommand, smoothing)
}
