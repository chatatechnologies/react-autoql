import React from 'react'
import { mount } from 'enzyme'
import TimeAnimationTimeline, { getTimelineMinHeight } from './TimeAnimationTimeline'

const frames = [{ label: 'Jan' }, { label: 'Feb' }, { label: 'Mar' }]
const series = [
  { key: 'revenue', label: 'Revenue', values: [10, 20, 15], color: '#00f', formatValue: (value) => `$${value}` },
  { key: 'units', label: 'Units', values: [3, 1, 2], color: '#0f0', formatValue: (value) => `${value}` },
]

const setup = (props = {}) =>
  mount(
    <svg>
      <TimeAnimationTimeline
        x={0}
        y={0}
        width={400}
        height={200}
        frames={frames}
        series={series}
        frameIndex={1}
        onSeek={() => {}}
        {...props}
      />
    </svg>,
  )

const getLineYs = (wrapper) =>
  wrapper.find('path.time-animation-timeline-line').map((path) =>
    path
      .prop('d')
      .match(/[\d.]+,[\d.]+/g)
      .map((point) => Number(point.split(',')[1])),
  )

describe('TimeAnimationTimeline', () => {
  test('one line chart: every line shares it, each on its own vertical scale', () => {
    // Under the title (22) and a legend row per series (2 x 15), 6px down: the chart runs from 58 to 186
    const [revenueYs, unitsYs] = getLineYs(setup())
    // Each line's highest value reaches the top, even though Revenue is ~10x Units
    expect(Math.min(...revenueYs)).toBeCloseTo(58)
    expect(Math.min(...unitsYs)).toBeCloseTo(58)
  })

  test('the legend shows each series in its color', () => {
    const swatches = setup().find('g.time-animation-timeline-legend-row rect')
    expect(swatches.map((swatch) => swatch.prop('fill'))).toEqual(['#00f', '#0f0'])
  })

  test('the lines are drawn without filled areas', () => {
    expect(setup().find('path.time-animation-timeline-area')).toHaveLength(0)
  })

  test('one area covers the whole chart for picking a period', () => {
    const onSeek = jest.fn()
    const hits = setup({ onSeek }).find('rect.time-animation-timeline-hit')
    expect(hits).toHaveLength(1)
    expect(hits.prop('height')).toBe(186 - 58)
    hits.simulate('pointerdown')
    expect(onSeek).toHaveBeenCalledWith(0)
  })

  test('the legend shows each name and its value in the current period', () => {
    const wrapper = setup()
    expect(wrapper.find('text.time-animation-timeline-label').map((text) => text.text())).toEqual(['Revenue', 'Units'])
    expect(wrapper.find('text.time-animation-timeline-value').map((text) => text.text())).toEqual(['$20', '1'])
  })

  test('one marker runs across the chart, with a dot on each line', () => {
    const wrapper = setup()
    expect(wrapper.find('g.time-animation-timeline-marker line')).toHaveLength(1)
    expect(wrapper.find('circle.time-animation-timeline-dot')).toHaveLength(2)
  })

  test('the minimum height fits the legend and a readable chart', () => {
    expect(getTimelineMinHeight(1)).toBeLessThan(getTimelineMinHeight(4))
  })
})
