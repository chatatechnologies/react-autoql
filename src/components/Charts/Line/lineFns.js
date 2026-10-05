// Maximum control point offset (as a fraction of the segment's x length).
// 1/3 is the most curvature a cubic can have while still being overshoot-safe.
const MAX_SMOOTHING = 1 / 3

// How far (in px) the curve is allowed to bulge past its data points. A couple
// of pixels keeps peaks and valleys looking rounded and smooth, while staying
// small enough that it can never read as a real value on the chart - e.g. a
// drop to 0 will not appear to go negative.
const DEFAULT_OVERSHOOT_TOLERANCE = 2.5

const slopeBetween = (a, b) => {
  const dx = b[0] - a[0]
  if (dx === 0) {
    return 0
  }
  return (b[1] - a[1]) / dx
}

/**
 * Tangents (dy/dx) for a smooth cubic through `points`.
 *
 * Starts from the Catmull-Rom tangent, which is what makes the line look
 * smooth, then limits its magnitude so the curve cannot swing past its data
 * points by more than `tolerance` pixels. The limit is the Fritsch-Carlson
 * monotone bound (3 * the smaller adjacent slope, and 0 at a peak/valley)
 * plus the slack that `tolerance` buys us.
 */
export const getSmoothTangents = (points, smoothing, tolerance) => {
  const secants = []
  for (let i = 0; i < points.length - 1; i++) {
    secants.push(slopeBetween(points[i], points[i + 1]))
  }

  return points.map((point, i) => {
    if (i === 0) {
      return secants[0]
    }

    if (i === points.length - 1) {
      return secants[secants.length - 1]
    }

    const prev = secants[i - 1]
    const next = secants[i]
    const cardinal = slopeBetween(points[i - 1], points[i + 1])

    // No overshoot is possible within this bound. At a peak or valley
    // (slopes with opposite signs, or a flat run) that bound is 0.
    const monotoneLimit = prev * next <= 0 ? 0 : 3 * Math.min(Math.abs(prev), Math.abs(next))

    // A control point sits `tangent * dx * smoothing` away in y, and the curve
    // stays inside its control points, so this much extra tangent can only
    // bulge the curve by `tolerance` px at most
    const widestSegment = Math.max(Math.abs(point[0] - points[i - 1][0]), Math.abs(points[i + 1][0] - point[0]))
    const slack = widestSegment ? tolerance / (smoothing * widestSegment) : 0

    return Math.sign(cardinal) * Math.min(Math.abs(cardinal), monotoneLimit + slack)
  })
}

export const lineCommand = (xy) => `L ${xy.join(',')}`

export const svgPathD = (points, command, smoothing) => {
  const d = points.reduce(
    (acc, xy, i, a) => (i === 0 ? `M ${xy.join(',')}` : `${acc} ${command(xy, i, a, smoothing)}`),
    '',
  )
  return d
}

/**
 * Build a smoothed SVG path that stays within a couple of pixels of its data
 * points - no swinging below a drop to 0, or above a peak.
 *
 * `smoothing` is the control point offset as a fraction of segment width
 * (0 = straight segments, 1/3 = as curvy as an overshoot-safe cubic gets).
 * `overshootTolerance` is how many px of rounding to allow at peaks and
 * valleys. Points may run left to right or right to left (as the reversed
 * bottom edge of a stacked area does).
 */
export const createSVGPath = (points, smoothing, overshootTolerance = DEFAULT_OVERSHOOT_TOLERANCE) => {
  if (!points?.length) {
    return ''
  }

  if (points.length === 1) {
    return `M ${points[0].join(',')}`
  }

  if (!smoothing) {
    return svgPathD(points, lineCommand)
  }

  const t = Math.min(smoothing, MAX_SMOOTHING)
  const tangents = getSmoothTangents(points, t, overshootTolerance)

  let d = `M ${points[0].join(',')}`

  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i]
    const [x1, y1] = points[i + 1]
    const dx = (x1 - x0) * t

    // Straight line if the two points share an x position - there is no
    // horizontal room to curve into and the tangents are meaningless
    if (dx === 0) {
      d += ` ${lineCommand(points[i + 1])}`
      continue
    }

    const cp1 = [x0 + dx, y0 + tangents[i] * dx]
    const cp2 = [x1 - dx, y1 - tangents[i + 1] * dx]

    d += ` C ${cp1.join(',')} ${cp2.join(',')} ${x1},${y1}`
  }

  return d
}
