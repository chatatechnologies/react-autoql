import {
  ROSE_SCALE_LABELS,
  buildMeasureFrames,
  describeMeasureValue,
  getMeasureScaleTicks,
  scaleMeasureValue,
} from './measureScales'
import { SANKEY_VALUE_COUNT_SENTINEL } from '../chartPropHelpers'

// Two measures (columns 1 and 2) over four periods
const frames = [
  { key: 'jan', rows: [['jan', 10, 100]] },
  {
    key: 'feb',
    rows: [
      ['feb', 20, 100],
      ['feb', 0, 100],
    ],
  },
  { key: 'mar', rows: [['mar', 30, -100]] },
  { key: 'apr', rows: [] },
]

describe('scaleMeasureValue', () => {
  const stats = { mean: 20, std: 10, min: 0, max: 40 }

  test('normalized is the distance from the average in standard deviations', () => {
    expect(scaleMeasureValue(35, stats, 'normalized')).toBe(1.5)
    expect(scaleMeasureValue(5, stats, 'normalized')).toBe(-1.5)
    expect(scaleMeasureValue(5, { ...stats, std: 0 }, 'normalized')).toBe(0)
  })

  test('min-max is where the value sits between the lowest and highest period', () => {
    expect(scaleMeasureValue(10, stats, 'minmax')).toBe(0.25)
    expect(scaleMeasureValue(40, stats, 'minmax')).toBe(1)
    // Every period the same: neither low nor high
    expect(scaleMeasureValue(7, { ...stats, min: 7, max: 7 }, 'minmax')).toBe(0.5)
  })

  test('linear is the value itself and log keeps the sign', () => {
    expect(scaleMeasureValue(-12, stats, 'linear')).toBe(-12)
    expect(scaleMeasureValue(99, stats, 'log')).toBeCloseTo(2)
    expect(scaleMeasureValue(-99, stats, 'log')).toBeCloseTo(-2)
    expect(scaleMeasureValue(0, stats, 'log')).toBe(0)
  })
})

describe('buildMeasureFrames', () => {
  test('one category per measure per frame, summing the frame rows', () => {
    const { frames: built } = buildMeasureFrames(frames, [1, 2], 'linear')
    expect(built).toHaveLength(4)
    expect(built[1].categories.map((c) => c.measureColumnIndex)).toEqual([1, 2])
    expect(built[1].categories.map((c) => c.measureValue)).toEqual([20, 200])
    expect(built[1].categories.map((c) => c.values[0])).toEqual([20, 200])
  })

  test('periods with no rows have no value and draw empty', () => {
    const { frames: built } = buildMeasureFrames(frames, [1], 'normalized')
    expect(built[3].categories[0].measureValue).toBeNull()
    expect(built[3].categories[0].values[0]).toBe(0)
  })

  test('stats come from every period with a value, and the domain covers every period', () => {
    const { stats, domainMax } = buildMeasureFrames(frames, [1], 'normalized')
    expect(stats[0]).toMatchObject({ mean: 20, min: 10, max: 30 })
    // 10, 20, 30: population std is about 8.16, so the extremes are about 1.22 from the average
    expect(domainMax).toBeCloseTo(10 / Math.sqrt(200 / 3))
  })

  test('counts rows for the count sentinel', () => {
    const { frames: built } = buildMeasureFrames(frames, [SANKEY_VALUE_COUNT_SENTINEL], 'linear')
    expect(built.map((frame) => frame.categories[0].measureValue)).toEqual([1, 2, 1, null])
  })
})

describe('getMeasureScaleTicks', () => {
  test('normalized ticks are in standard deviations', () => {
    expect(getMeasureScaleTicks('normalized', 2.2).map((t) => t.label)).toEqual(['0.5σ', '1σ', '1.5σ', '2σ'])
  })

  test('min-max ticks are percentages of the range', () => {
    expect(getMeasureScaleTicks('minmax', 1).map((t) => t.label)).toEqual(['25%', '50%', '75%', '100%'])
  })

  test('log ticks are powers of ten, labelled with the value', () => {
    const ticks = getMeasureScaleTicks('log', Math.log10(1 + 50000), (value) => `${value}`)
    expect(ticks.map((t) => t.label)).toEqual(['10', '100', '1000', '10000'])
    ticks.forEach((tick) => expect(tick.magnitude).toBeCloseTo(Math.log10(1 + Number(tick.label))))
  })

  test('linear ticks use the formatter', () => {
    const ticks = getMeasureScaleTicks('linear', 400, (value) => `$${value}`)
    expect(ticks.map((t) => t.label)).toEqual(['$100', '$200', '$300', '$400'])
  })
})

describe('describeMeasureValue', () => {
  const formatValue = (value) => `$${value.toFixed(2)}`
  // Average 65, typically 10 either side, lowest 50, highest 80
  const stats = { mean: 65, std: 10, min: 50, max: 80 }
  const describe_ = (scale, value, grouping = 'DAY') =>
    describeMeasureValue({ scale, value, stats, grouping, formatValue }).map(({ text }) => text)

  test('z-score: how far from the average in usual variations, with the typical range in real units', () => {
    expect(describe_('normalized', 78)).toEqual([
      '1.3× its usual variation above its daily average of $65.00',
      'Typical range: $55.00 – $75.00',
    ])
    expect(describe_('normalized', 50, 'MONTH')[0]).toBe('1.5× its usual variation below its monthly average of $65.00')
  })

  test('z-score: says "average" alone when the periods are not dates grouped by day, month and so on', () => {
    expect(describe_('normalized', 78, null)[0]).toBe('1.3× its usual variation above its average of $65.00')
  })

  test('z-score: a measure that never changes is at its average', () => {
    const flat = { mean: 65, std: 0, min: 65, max: 65 }
    expect(describeMeasureValue({ scale: 'normalized', value: 65, stats: flat, formatValue })[0].text).toBe(
      'The same in every period ($65.00)',
    )
  })

  test('range: how far from its lowest to its highest, naming the extremes', () => {
    expect(describe_('minmax', 65)).toEqual(['50% of the way from its lowest ($50.00) to its highest ($80.00)'])
    expect(describe_('minmax', 80)).toEqual([
      '100% of the way from its lowest ($50.00) to its highest ($80.00): its highest period',
    ])
    expect(describe_('minmax', 50)[0]).toMatch(/: its lowest period$/)
  })

  test('actual values need no explanation; log scale warns that lengths are not proportional', () => {
    expect(describe_('linear', 78)).toEqual([])
    expect(describeMeasureValue({ scale: 'log', value: 78, stats, formatValue })).toEqual([
      { text: "Log scale: lengths aren't proportional", isNote: true },
    ])
  })
})

test('scale names say what each one shows', () => {
  expect(ROSE_SCALE_LABELS).toEqual({
    normalized: 'Normalized (z-score)',
    minmax: 'Range (min–max)',
    linear: 'Actual values',
    log: 'Actual values (log scale)',
  })
})
