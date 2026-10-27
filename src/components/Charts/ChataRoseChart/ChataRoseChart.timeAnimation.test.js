import React from 'react'
import { mount } from 'enzyme'
import { act } from 'react-dom/test-utils'
import ChataRoseChart from './ChataRoseChart'
import { TimeAnimationControl, TimeAnimationTimeline } from '../TimeAnimation'

const columns = [
  { name: 'sales.region', display_name: 'Region', type: 'STRING', is_visible: true },
  { name: 'sales.date', display_name: 'Sale Date', type: 'DATE', precision: 'DAY', is_visible: true },
  { name: 'sales.amount', display_name: 'Amount', type: 'QUANTITY', is_visible: true },
]

// January: East 10, West 5. February: nothing. March: East 7, North 2.
const data = [
  ['East', '2024-01-10T00:00:00.000Z', 10],
  ['West', '2024-01-20T00:00:00.000Z', 5],
  ['East', '2024-03-02T00:00:00.000Z', 7],
  ['North', '2024-03-05T00:00:00.000Z', 2],
]

const setup = (props = {}) =>
  mount(
    <svg>
      <ChataRoseChart
        columns={columns}
        data={data}
        width={700}
        height={400}
        autoQLConfig={{ enableDrilldowns: true }}
        initialChartControls={{ timeAnimation: { grouping: 'MONTH' } }}
        {...props}
      />
    </svg>,
  )

const clickPlay = (wrapper) => {
  act(() => {
    wrapper.find('rect.time-animation-play-button-rect').simulate('click')
  })
  wrapper.update()
}

const seek = (wrapper, frameIndex) => {
  act(() => {
    wrapper.find(TimeAnimationTimeline).prop('onSeek')(frameIndex)
  })
  wrapper.update()
}

// One frame at a time: each frame's timer is only scheduled once the previous frame has rendered
const advanceFrames = (wrapper, count) => {
  for (let i = 0; i < count; i++) {
    act(() => {
      jest.advanceTimersByTime(700)
    })
  }
  wrapper.update()
}

const getWedgeFor = (wrapper, region) =>
  wrapper.find('path.rose-wedge').filterWhere((wedge) => wedge.key() === `${JSON.stringify(region)}|0`)

describe('ChataRoseChart time animation', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  test('shows the play control for data with a date column, and no timeline until played', () => {
    const wrapper = setup()
    expect(wrapper.find(TimeAnimationControl).find('g.time-animation-control').exists()).toBe(true)
    expect(wrapper.find(TimeAnimationTimeline).exists()).toBe(false)
  })

  test('no play control without a date column', () => {
    const wrapper = setup({ columns: [columns[0], { ...columns[1], type: 'STRING' }, columns[2]] })
    expect(wrapper.find('g.time-animation-control').exists()).toBe(false)
  })

  test('playing shows one period at a time, keeping every category in place', () => {
    const wrapper = setup()
    clickPlay(wrapper)

    const timeline = wrapper.find(TimeAnimationTimeline)
    expect(timeline.prop('frames').map((frame) => frame.label)).toEqual(['January 2024', 'February 2024', 'March 2024'])
    // Sparkline: total Amount per month
    expect(timeline.prop('series').map((series) => series.values)).toEqual([[15, 0, 9]])
    expect(timeline.prop('frameIndex')).toBe(0)

    // Every category of the full data has a wedge, North just has no size in January
    expect(wrapper.find('path.rose-wedge')).toHaveLength(3)
    expect(getWedgeFor(wrapper, 'East').prop('data-tooltip-html')).toContain('January 2024')
    expect(getWedgeFor(wrapper, 'East').prop('data-tooltip-html')).toContain('10')

    act(() => {
      jest.advanceTimersByTime(700)
    })
    wrapper.update()
    expect(wrapper.find(TimeAnimationTimeline).prop('frameIndex')).toBe(1)
  })

  test('the timeline sits beside the rose on a wide chart and under it on a narrow one', () => {
    const wide = setup()
    clickPlay(wide)
    expect(wide.find(TimeAnimationTimeline).prop('x')).toBeGreaterThan(0)

    const narrow = setup({ width: 400 })
    clickPlay(narrow)
    expect(narrow.find(TimeAnimationTimeline).prop('x')).toBe(0)
    expect(narrow.find(TimeAnimationTimeline).prop('width')).toBeGreaterThan(300)
  })

  test('loops by default, and stops at the last period when looping is off', () => {
    const wrapper = setup({ initialChartControls: { timeAnimation: { grouping: 'MONTH', loop: false } } })
    clickPlay(wrapper)
    advanceFrames(wrapper, 5)
    expect(wrapper.find(TimeAnimationTimeline).prop('frameIndex')).toBe(2)
    expect(wrapper.find('rect.time-animation-play-button-rect').prop('data-tooltip-content')).toMatch(/^Play/)

    const looping = setup()
    clickPlay(looping)
    advanceFrames(looping, 3)
    expect(looping.find(TimeAnimationTimeline).prop('frameIndex')).toBe(0)
  })

  test('running totals add up the periods so far', () => {
    const wrapper = setup({ initialChartControls: { timeAnimation: { grouping: 'MONTH', cumulative: true } } })
    clickPlay(wrapper)
    expect(wrapper.find(TimeAnimationTimeline).prop('series')[0].values).toEqual([15, 15, 24])
  })

  test('closing the timeline goes back to all of the data', () => {
    const wrapper = setup()
    clickPlay(wrapper)
    act(() => {
      wrapper.find(TimeAnimationTimeline).prop('onClose')()
    })
    wrapper.update()
    expect(wrapper.find(TimeAnimationTimeline).exists()).toBe(false)
    expect(getWedgeFor(wrapper, 'East').prop('data-tooltip-html')).not.toContain('2024')
  })

  test('saves settings under timeAnimation, keeping the other chart controls', () => {
    const onChartControlsChange = jest.fn()
    const wrapper = setup({
      initialChartControls: { roseCategoryColumnIndex: 0, timeAnimation: { grouping: 'MONTH' } },
      onChartControlsChange,
    })
    act(() => {
      wrapper.find(TimeAnimationControl).prop('animation').updateSettings({ speed: 2 })
    })
    expect(onChartControlsChange).toHaveBeenCalledWith({
      roseCategoryColumnIndex: 0,
      timeAnimation: { columnIndex: 1, grouping: 'MONTH', speed: 2, loop: true, cumulative: false },
    })
  })

  test('a drilldown while showing a period is limited to that period', () => {
    const onChartClick = jest.fn()
    const wrapper = setup({ onChartClick })
    clickPlay(wrapper)
    seek(wrapper, 2)

    act(() => {
      getWedgeFor(wrapper, 'East').simulate('click')
    })

    expect(onChartClick).toHaveBeenCalledWith(
      expect.objectContaining({
        stringColumnIndices: [0],
        extraFilters: [
          {
            name: 'sales.date',
            operator: 'between',
            value: '2024-03-01T00:00:00.000Z,2024-03-31T23:59:59.999Z',
            column_type: 'DATE',
          },
        ],
      }),
    )
  })

  test('grouped data drills down by the category and the period together', () => {
    const groupedColumns = [
      { ...columns[0], groupable: true },
      { ...columns[1], precision: 'MONTH', groupable: true },
      { ...columns[2], is_visible: true },
    ]
    const grouped = [
      ['East', '2024-01-01T00:00:00.000Z', 10],
      ['West', '2024-01-01T00:00:00.000Z', 5],
      ['East', '2024-02-01T00:00:00.000Z', 7],
    ]
    const onChartClick = jest.fn()
    const wrapper = setup({ columns: groupedColumns, data: grouped, onChartClick, initialChartControls: {} })
    clickPlay(wrapper)

    act(() => {
      getWedgeFor(wrapper, 'East').simulate('click')
    })

    expect(onChartClick.mock.calls[0][0].groupBys).toEqual([
      { name: 'sales.region', drill_down: undefined, value: 'East', operator: '=' },
      { name: 'sales.date', drill_down: undefined, value: '2024-01-01T00:00:00.000Z' },
    ])
  })

  test('the sparkline has a line per value column, each in its own units', () => {
    const twoValueColumns = [
      ...columns,
      { name: 'sales.units', display_name: 'Units', type: 'QUANTITY', is_visible: true },
    ]
    const twoValueData = data.map((row, i) => [...row, i + 1])
    const wrapper = setup({
      columns: twoValueColumns,
      data: twoValueData,
      initialChartControls: { roseValueColumnIndices: [2, 3], timeAnimation: { grouping: 'MONTH' } },
    })
    clickPlay(wrapper)

    const series = wrapper.find(TimeAnimationTimeline).prop('series')
    expect(series.map(({ label }) => label)).toEqual(['Amount', 'Units'])
    expect(series.map(({ values }) => values)).toEqual([
      [15, 0, 9],
      [3, 0, 7],
    ])
    expect(series[0].color).not.toEqual(series[1].color)
    expect(wrapper.find('path.time-animation-timeline-line')).toHaveLength(2)
    expect(wrapper.find('circle.time-animation-timeline-dot')).toHaveLength(2)
    // One line chart, each line on its own scale, so both peaks reach the top of the chart
    const getYs = (path) =>
      path
        .prop('d')
        .match(/[\d.]+,[\d.]+/g)
        .map((point) => Number(point.split(',')[1]))
    const [amountYs, unitsYs] = wrapper.find('path.time-animation-timeline-line').map(getYs)
    expect(Math.min(...amountYs)).toBeCloseTo(Math.min(...unitsYs))
    expect(wrapper.find('rect.time-animation-timeline-hit')).toHaveLength(1)
  })

  test('playback tweens last the whole frame; a picked frame eases in quickly', () => {
    const wrapper = setup()
    clickPlay(wrapper)
    expect(wrapper.find(TimeAnimationTimeline).prop('tweenDuration')).toBe(700)
    expect(wrapper.find(TimeAnimationTimeline).prop('ease')(0.25)).toBe(0.25)

    seek(wrapper, 1)
    expect(wrapper.find(TimeAnimationTimeline).prop('tweenDuration')).toBe(300)
    expect(wrapper.find(TimeAnimationTimeline).prop('ease')(0.25)).toBeLessThan(0.25)
  })

  test('a date category column is not offered as the time to play over', () => {
    const dateOnly = [{ ...columns[1] }, columns[2]]
    const wrapper = setup({ columns: dateOnly, data: data.map((row) => [row[1], row[2]]) })
    expect(wrapper.find('g.time-animation-control').exists()).toBe(false)
  })
})
