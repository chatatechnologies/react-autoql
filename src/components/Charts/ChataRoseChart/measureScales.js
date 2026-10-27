import { scaleLinear } from 'd3-scale'
import { SANKEY_VALUE_COUNT_SENTINEL } from '../chartPropHelpers'

// "Measures" mode: each wedge is a number column (eg. Revenue, COGS, Profit) and the rose shows one
// period at a time. The columns can be in very different units, so each is put on a common scale.
export const ROSE_SCALES = ['normalized', 'minmax', 'linear', 'log']
export const DEFAULT_ROSE_SCALE = 'normalized'
export const ROSE_SCALE_LABELS = { normalized: 'Normalized', minmax: 'Min–max', linear: 'Linear', log: 'Log' }

const MAX_TICKS = 4

// The measure's value in one period: its rows summed (or counted). Null when the period has no value.
const getFrameMeasureValue = (rows, columnIndex) => {
  if (columnIndex === SANKEY_VALUE_COUNT_SENTINEL) {
    return rows.length ? rows.length : null
  }
  let sum = null
  rows.forEach((row) => {
    const value = row?.[columnIndex]
    const number = value === null || value === undefined || value === '' ? NaN : Number(value)
    if (Number.isFinite(number)) {
      sum = (sum ?? 0) + number
    }
  })
  return sum
}

const getStats = (values) => {
  const finite = values.filter((value) => value !== null)
  if (!finite.length) {
    return { mean: 0, std: 0, min: 0, max: 0 }
  }
  const mean = finite.reduce((sum, value) => sum + value, 0) / finite.length
  const variance = finite.reduce((sum, value) => sum + (value - mean) ** 2, 0) / finite.length
  return { mean, std: Math.sqrt(variance), min: Math.min(...finite), max: Math.max(...finite) }
}

// A signed number drawn as the wedge: its length is the magnitude, and negative is drawn in red.
// - normalized: standard deviations from the measure's average over all periods (a z-score)
// - minmax: where the period sits between the measure's lowest (0) and highest (1) period
// - linear: the value itself, on one scale shared by every measure
// - log: log10(1 + |value|) with the value's sign, so small measures stay visible beside big ones
export const scaleMeasureValue = (value, stats, scale) => {
  switch (scale) {
    case 'normalized':
      return stats.std > 0 ? (value - stats.mean) / stats.std : 0
    case 'minmax':
      return stats.max > stats.min ? (value - stats.min) / (stats.max - stats.min) : 0.5
    case 'log':
      return Math.sign(value) * Math.log10(1 + Math.abs(value))
    default:
      return value
  }
}

// One set of categories per frame, in the shape the rose draws: one category per measure, holding its
// scaled value as a single layer. Stats come from every period, so each period is judged against the
// rest, and domainMax covers every period so wedge sizes compare from one period to the next.
export const buildMeasureFrames = (frames, measureColumnIndices, scale) => {
  const valuesByMeasure = measureColumnIndices.map((columnIndex) =>
    frames.map((frame) => getFrameMeasureValue(frame.rows || [], columnIndex)),
  )
  const stats = valuesByMeasure.map(getStats)

  let domainMax = 0
  const builtFrames = frames.map((frame, frameIndex) => ({
    key: frame.key,
    categories: measureColumnIndices.map((columnIndex, measureIndex) => {
      const measureValue = valuesByMeasure[measureIndex][frameIndex]
      const scaled = measureValue === null ? 0 : scaleMeasureValue(measureValue, stats[measureIndex], scale)
      domainMax = Math.max(domainMax, Math.abs(scaled))
      return {
        key: `measure:${columnIndex}`,
        rawValue: null,
        measureColumnIndex: columnIndex,
        measureIndex,
        measureValue,
        stats: stats[measureIndex],
        values: [scaled],
        total: scaled,
      }
    }),
  }))

  return { frames: builtFrames, stats, domainMax }
}

// Ring positions (as magnitudes on the wedge scale) and their labels for each scale
export const getMeasureScaleTicks = (scale, domainMax, formatValue = (value) => `${value}`) => {
  if (!(domainMax > 0)) {
    return []
  }

  if (scale === 'minmax') {
    return [0.25, 0.5, 0.75, 1].map((tick) => ({ magnitude: tick, label: `${tick * 100}%` }))
  }

  if (scale === 'log') {
    // Powers of ten that fit, thinned to at most MAX_TICKS
    const powers = []
    for (let power = 1; Math.log10(1 + 10 ** power) <= domainMax; power++) {
      powers.push(power)
    }
    const step = Math.ceil(powers.length / MAX_TICKS)
    return powers
      .filter((_, i) => (powers.length - 1 - i) % step === 0)
      .map((power) => ({ magnitude: Math.log10(1 + 10 ** power), label: formatValue(10 ** power) }))
  }

  const ticks = scaleLinear()
    .domain([0, domainMax])
    .ticks(MAX_TICKS)
    .filter((tick) => tick > 0)
  return ticks.map((tick) => ({
    magnitude: tick,
    label: scale === 'normalized' ? `${tick}σ` : formatValue(tick),
  }))
}
