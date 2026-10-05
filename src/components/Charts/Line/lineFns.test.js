import { createSVGPath } from './lineFns'

const SMOOTHING = 1 / 3

// Walk the path's cubic segments and return the min/max y the curve actually
// reaches, plus how far it strays outside each segment's own endpoints
const measurePath = (d) => {
  const nums = d.match(/-?\d+(\.\d+)?(e-?\d+)?/g).map(Number)

  let start = [nums[0], nums[1]]
  let i = 2
  let overshoot = 0
  let maxY = -Infinity
  let minY = Infinity

  while (i + 5 < nums.length + 1) {
    const cp1 = [nums[i], nums[i + 1]]
    const cp2 = [nums[i + 2], nums[i + 3]]
    const end = [nums[i + 4], nums[i + 5]]

    const low = Math.min(start[1], end[1])
    const high = Math.max(start[1], end[1])

    for (let t = 0; t <= 1; t += 0.002) {
      const m = 1 - t
      const y = m ** 3 * start[1] + 3 * m * m * t * cp1[1] + 3 * m * t * t * cp2[1] + t ** 3 * end[1]
      overshoot = Math.max(overshoot, y - high, low - y)
      maxY = Math.max(maxY, y)
      minY = Math.min(minY, y)
    }

    start = end
    i += 6
  }

  return { overshoot, maxY, minY }
}

// yScale stand-in: value 0 sits on the axis at y = 200, value 100 at y = 0
const toVertices = (values) => values.map((value, index) => [index * 40, 200 - value * 2])

describe('createSVGPath', () => {
  it('returns straight line commands when smoothing is 0', () => {
    expect(createSVGPath(toVertices([10, 20]), 0)).toBe('M 0,180 L 40,160')
  })

  it('handles empty and single point series', () => {
    expect(createSVGPath([], SMOOTHING)).toBe('')
    expect(createSVGPath([[5, 10]], SMOOTHING)).toBe('M 5,10')
  })

  it('smooths the line with cubic curves', () => {
    expect(createSVGPath(toVertices([10, 50, 20]), SMOOTHING)).toContain('C')
  })

  it('does not dip below zero when a high value drops to a run of zeros', () => {
    const d = createSVGPath(toVertices([80, 95, 100, 0, 0, 0, 0, 20]), SMOOTHING)

    // The axis (value 0) is at y = 200 - anything past it reads as negative
    expect(measurePath(d).maxY).toBeLessThan(202.5)
  })

  it('keeps a flat run flat', () => {
    const d = createSVGPath(toVertices([0, 0, 0, 0]), SMOOTHING)

    const { minY, maxY } = measurePath(d)
    expect(maxY).toBeCloseTo(200)
    expect(minY).toBeCloseTo(200)
  })

  it('never strays more than the overshoot tolerance past its data points', () => {
    const series = [
      [100, 0, 0, 0],
      [0, 0, 100, 0, 0],
      [5, 100, 5, 100, 5],
      [1, 2, 3, 2, 1, 50, 0, 0, 3],
      [0, 100],
    ]

    series.forEach((values) => {
      const vertices = toVertices(values)

      // Left to right, and right to left as a stacked area's bottom edge runs
      expect(measurePath(createSVGPath(vertices, SMOOTHING)).overshoot).toBeLessThan(2.5)
      expect(measurePath(createSVGPath([...vertices].reverse(), SMOOTHING)).overshoot).toBeLessThan(2.5)
    })
  })

  it('draws a straight segment between points that share an x position', () => {
    expect(
      createSVGPath(
        [
          [0, 10],
          [0, 80],
          [40, 20],
        ],
        SMOOTHING,
      ),
    ).toContain('L 0,80')
  })
})
