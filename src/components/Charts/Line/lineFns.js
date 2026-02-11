const line = (a, b) => {
  const lenX = b[0] - a[0]
  const lenY = b[1] - a[1]
  return {
    length: Math.sqrt(Math.pow(lenX, 2) + Math.pow(lenY, 2)),
    angle: Math.atan2(lenY, lenX),
  }
}

const controlPoint = (current, previous, next, reverse, smoothing = 0.2) => {
  const c = current
  let p = previous
  let n = next

  if (!p) {p = current}
  if (!n) {n = current}

  const pn = line(p, n)
  const pc = line(p, c)
  const cn = line(c, n)

  // If there is a big discrepency between the distance to the
  // current point from the previous and next points, the smoothed
  // line could turn non-cartesian so we want to choose the segment
  // with the shortest distance and use that for both pc and cn (multiply by 2)
  if (pn.length > cn.length * 2) {
    pn.length = cn.length * 2
  } else if (pn.length > pc.length * 2) {
    pn.length = pc.length * 2
  }

  const angle = pn.angle + (reverse ? Math.PI : 0)
  const length = pn.length * smoothing
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
