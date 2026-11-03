import React from 'react'
import { mount } from 'enzyme'
import { act } from 'react-dom/test-utils'
import ChataRoseChart from './ChataRoseChart'
import RoseSettingsControl from './RoseSettingsControl'
import SankeyColumnSelector from '../ChataSankeyDiagram/SankeyColumnSelector'
import { TimeAnimationControl, TimeAnimationTimeline } from '../TimeAnimation'
import { SANKEY_VALUE_COUNT_SENTINEL } from '../chartPropHelpers'

const dateColumn = { name: 'fin.date', display_name: 'Date', type: 'DATE', precision: 'DAY', is_visible: true }
const measureColumns = [
  { name: 'fin.revenue', display_name: 'Revenue', type: 'DOLLAR_AMT', is_visible: true },
  { name: 'fin.cogs', display_name: 'COGS', type: 'DOLLAR_AMT', is_visible: true },
  { name: 'fin.profit', display_name: 'Profit', type: 'DOLLAR_AMT', is_visible: true },
]
const columns = [dateColumn, ...measureColumns]

// Four days. On the last one, revenue (50) is below its average (125), COGS (80) above its average (65)
const data = [
  ['2024-01-01T00:00:00.000Z', 100, 50, 50],
  ['2024-01-02T00:00:00.000Z', 200, 60, 140],
  ['2024-01-03T00:00:00.000Z', 150, 70, 80],
  ['2024-01-04T00:00:00.000Z', 50, 80, -30],
]

const setup = (props = {}) =>
  mount(
    <svg>
      <ChataRoseChart
        columns={columns}
        data={data}
        width={800}
        height={400}
        autoQLConfig={{ enableDrilldowns: true }}
        {...props}
      />
    </svg>,
  )

const getWedges = (wrapper) => wrapper.find('path.rose-wedge')
const getWedge = (wrapper, measure) =>
  getWedges(wrapper).filterWhere((wedge) => wedge.prop('data-tooltip-html').startsWith(`<strong>${measure}`))
const getSettings = (wrapper) => wrapper.find(RoseSettingsControl)
const getMeasurePicker = (wrapper) =>
  wrapper.find(SankeyColumnSelector).filterWhere((selector) => selector.prop('pathTitle') === 'Measures')
const getTickLabels = (wrapper) => wrapper.find('text.rose-tick-label').map((text) => text.text())

describe('ChataRoseChart measures mode', () => {
  test('is the default with a date column and 3+ number columns: one wedge per measure, latest period', () => {
    const wrapper = setup()
    expect(getSettings(wrapper).prop('mode')).toBe('measures')
    expect(getWedges(wrapper)).toHaveLength(3)
    expect(getWedge(wrapper, 'Revenue').prop('data-tooltip-html')).toContain('$50.00')
    expect(wrapper.find(TimeAnimationTimeline).prop('frameIndex')).toBe(3)
  })

  // Whatever decides the wedges uses the rose wedge icon; layers means the series stacked in a wedge
  test('the measures picker uses the wedge icon, since each measure is a wedge', () => {
    expect(getMeasurePicker(setup()).prop('pathIconType')).toBe('rose')
  })

  test('in values mode the category picker uses the wedge icon and the values picker uses layers', () => {
    const wrapper = setup({ initialChartControls: { roseMode: 'values' } })
    const getIcon = (title) =>
      wrapper
        .find(SankeyColumnSelector)
        .filterWhere((selector) => selector.prop('pathTitle') === title)
        .prop('pathIconType')
    expect(getSettings(wrapper).prop('mode')).toBe('values')
    expect(getIcon('Category')).toBe('rose')
    expect(getIcon('Values')).toBe('layers')
  })

  test('identifier columns are left out of the default measures, but can still be picked', () => {
    const idColumn = { name: 'fin.customer_key', display_name: 'Customer Key', type: 'QUANTITY', is_visible: true }
    const wrapper = setup({ columns: [...columns, idColumn], data: data.map((row, i) => [...row, 1000 + i]) })
    expect(getMeasurePicker(wrapper).prop('pathColumnIndices')).toEqual([1, 2, 3])
    expect(getMeasurePicker(wrapper).prop('pathColumnOptionIndices')).toContain(4)
  })

  test('identifiers do not count towards opening in measures mode', () => {
    const idColumns = [
      { name: 'fin.customer_key', display_name: 'Customer Key', type: 'QUANTITY', is_visible: true },
      { name: 'fin.order_number', display_name: 'Order Number', type: 'QUANTITY', is_visible: true },
    ]
    const wrapper = setup({
      columns: [dateColumn, measureColumns[0], ...idColumns],
      data: data.map((row, i) => [row[0], row[1], 1000 + i, 5000 + i]),
    })
    expect(getSettings(wrapper).prop('mode')).toBe('values')
  })

  // The rose is the focus: the timeline is compact, beside it, and the two are placed as one group
  const getRoseExtent = (wrapper) => {
    const centerX = Number(
      wrapper
        .find('g.rose-plot')
        .prop('transform')
        .match(/translate\(([\d.]+)/)[1],
    )
    const outerRadius = Math.max(...wrapper.find('.rose-grid circle').map((circle) => circle.prop('r')))
    // Each label's edges, from its anchor and its (estimated) width
    const labelEdges = wrapper.find('text.rose-label').map((label) => {
      const width = label.text().length * 11 * 0.6
      const anchor = label.prop('textAnchor')
      const left = centerX + label.prop('x') - (anchor === 'end' ? width : anchor === 'middle' ? width / 2 : 0)
      return { left, right: left + width }
    })
    return {
      left: Math.min(centerX - outerRadius, ...labelEdges.map((edge) => edge.left)),
      right: Math.max(centerX + outerRadius, ...labelEdges.map((edge) => edge.right)),
    }
  }

  test('the timeline is only as tall as its lines need, centred beside the rose', () => {
    const timeline = setup().find(TimeAnimationTimeline)
    expect(timeline.prop('height')).toBeLessThan(390)
    // Centred on the rose, which is centred in the 390px below the top margin
    expect(timeline.prop('y') + timeline.prop('height') / 2).toBeCloseTo(10 + 390 / 2)
  })

  test('the timeline sits just past the rose, and the two are centred together', () => {
    const wrapper = setup()
    const timeline = wrapper.find(TimeAnimationTimeline)
    const rose = getRoseExtent(wrapper)
    // 16px between the rose's labels and the timeline (labels are estimated, so allow a few px)
    expect(timeline.prop('x') - rose.right).toBeGreaterThanOrEqual(16)
    expect(timeline.prop('x') - rose.right).toBeLessThan(24)
    // The same room either side of the group, in the 753px left of the buttons
    const leftRoom = rose.left
    const rightRoom = 753 - (timeline.prop('x') + timeline.prop('width'))
    expect(Math.abs(leftRoom - rightRoom)).toBeLessThan(8)
  })

  test('each measure has its own color in the timeline', () => {
    const series = setup().find(TimeAnimationTimeline).prop('series')
    expect(new Set(series.map((item) => item.color)).size).toBe(3)
  })

  test('hovering a wedge does not single anything out', () => {
    const wrapper = setup()
    act(() => {
      getWedge(wrapper, 'COGS').simulate('mouseenter')
    })
    wrapper.update()
    expect(wrapper.find(TimeAnimationTimeline).prop('highlightedKey')).toBeUndefined()
    expect(wrapper.find('path.rose-wedge-dimmed')).toHaveLength(0)
  })

  test('is not the default without a date column', () => {
    const wrapper = setup({
      columns: [{ name: 'dept', display_name: 'Dept', type: 'STRING', is_visible: true }, ...measureColumns],
      data: data.map((row, i) => [`D${i}`, ...row.slice(1)]),
    })
    expect(getSettings(wrapper).prop('mode')).toBe('values')
  })

  test('keeps a saved mode and switches modes from the settings, saving the choice', () => {
    const onChartControlsChange = jest.fn()
    const wrapper = setup({ initialChartControls: { roseMode: 'values' }, onChartControlsChange })
    expect(getSettings(wrapper).prop('mode')).toBe('values')
    expect(getMeasurePicker(wrapper).exists()).toBe(false)

    act(() => getSettings(wrapper).prop('onModeChange')('measures'))
    wrapper.update()
    expect(onChartControlsChange).toHaveBeenLastCalledWith(expect.objectContaining({ roseMode: 'measures' }))
    expect(getMeasurePicker(wrapper).exists()).toBe(true)
    expect(getWedges(wrapper)).toHaveLength(3)
  })

  // Measures are told apart by their position and labels, so color only says positive or negative
  test('normalized: wedges are blue above the average and red below it, with rings in standard deviations', () => {
    const wrapper = setup()
    // On the last day Revenue is below its average and COGS above
    expect(getWedge(wrapper, 'Revenue').prop('fill')).toContain('-negative')
    expect(getWedge(wrapper, 'COGS').prop('fill')).toContain('-positive')
    // COGS on the last day: 80, against a daily average of 65 that usually varies by about 11
    expect(getWedge(wrapper, 'COGS').prop('data-tooltip-html')).toContain(
      '<strong>COGS:</strong> $80.00<br/><strong>Date:</strong> Jan 4, 2024<br/>1.3× its usual variation above its daily average of $65.00<br/>Typical range: $53.82 – $76.18',
    )
    expect(wrapper.find('circle.rose-average-ring').exists()).toBe(false)
    expect(getTickLabels(wrapper).every((label) => label.endsWith('σ'))).toBe(true)
  })

  test('every positive measure wedge is the same color', () => {
    const wrapper = setup({ initialChartControls: { roseScale: 'minmax' } })
    const fills = getWedges(wrapper).map((wedge) => wedge.prop('fill'))
    expect(new Set(fills).size).toBe(1)
    expect(fills[0]).toContain('-positive')
  })

  test('changing the scale redraws and saves it', () => {
    const onChartControlsChange = jest.fn()
    const wrapper = setup({ onChartControlsChange })
    act(() => getSettings(wrapper).prop('onScaleChange')('minmax'))
    wrapper.update()
    expect(onChartControlsChange).toHaveBeenLastCalledWith(expect.objectContaining({ roseScale: 'minmax' }))
    // The outer ring is 100%; its label is left off like every chart's edge label
    expect(getTickLabels(wrapper)).toEqual(['25%', '50%', '75%'])
    // COGS is at its highest on the last day; nothing is below zero on a min-max scale
    expect(getWedge(wrapper, 'COGS').prop('data-tooltip-html')).toContain(
      '100% of the way from its lowest ($50.00) to its highest ($80.00): its highest period',
    )
    expect(getWedges(wrapper).filterWhere((wedge) => wedge.prop('fill').includes('-negative'))).toHaveLength(0)
  })

  test('offers Count for list queries, and never the column being stepped through', () => {
    const wrapper = setup()
    const options = getMeasurePicker(wrapper).prop('pathColumnOptionIndices')
    expect(options).toEqual([SANKEY_VALUE_COUNT_SENTINEL, 1, 2, 3])
  })

  test('saves measure picks', () => {
    const onChartControlsChange = jest.fn()
    const wrapper = setup({ onChartControlsChange })
    act(() => getMeasurePicker(wrapper).prop('onPathChange')([1, 3]))
    wrapper.update()
    expect(onChartControlsChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ roseMeasureColumnIndices: [1, 3] }),
    )
    expect(getWedges(wrapper)).toHaveLength(2)
  })

  test('without a date column, asks for a column to step through, which can be any column', () => {
    const roundColumn = { name: 'game.round', display_name: 'Round', type: 'QUANTITY', is_visible: true }
    const wrapper = setup({
      columns: [roundColumn, ...measureColumns],
      data: data.map((row, i) => [i + 1, ...row.slice(1)]),
      initialChartControls: { roseMode: 'measures' },
    })
    expect(wrapper.find('text.rose-empty-message').text()).toBe('Pick a column to step through in the time settings')

    const animation = wrapper.find(TimeAnimationControl).prop('animation')
    expect(animation.columnOptionIndices).toEqual([0, 1, 2, 3])
    act(() => animation.updateSettings({ columnIndex: 0 }))
    wrapper.update()

    // Round is now what's stepped through, so it's no longer a measure
    expect(getMeasurePicker(wrapper).prop('pathColumnOptionIndices')).not.toContain(0)
    expect(getWedges(wrapper)).toHaveLength(3)
    expect(
      wrapper
        .find(TimeAnimationTimeline)
        .prop('frames')
        .map((frame) => frame.rawValue),
    ).toEqual([1, 2, 3, 4])
  })

  test("a measure wedge's tooltip says a click opens every row in the period", () => {
    expect(getWedge(setup(), 'Profit').prop('data-tooltip-html')).toContain(
      '<em>Click to see all rows for Jan 4, 2024</em>',
    )
    // No hint when a click wouldn't do anything
    const noDrilldowns = setup({ autoQLConfig: { enableDrilldowns: false } })
    expect(getWedge(noDrilldowns, 'Profit').prop('data-tooltip-html')).not.toContain('Click to see')
  })

  test('a measure wedge drills into the period being shown', () => {
    const onChartClick = jest.fn()
    const wrapper = setup({ onChartClick })
    getWedge(wrapper, 'Profit').simulate('click')
    expect(onChartClick).toHaveBeenCalledWith({
      filters: [expect.objectContaining({ name: 'fin.date', operator: 'between' })],
      activeKey: expect.any(String),
    })
  })

  test('the timeline has one line per measure in its own units, and no close button', () => {
    const wrapper = setup()
    const timeline = wrapper.find(TimeAnimationTimeline)
    expect(timeline.prop('series').map((series) => series.label)).toEqual(['Revenue', 'COGS', 'Profit'])
    expect(timeline.prop('series')[0].values).toEqual([100, 200, 150, 50])
    expect(timeline.prop('onClose')).toBeUndefined()
  })

  test('Measures is unavailable with fewer than two measures', () => {
    const wrapper = setup({
      columns: [dateColumn, { ...measureColumns[0], groupable: false }, { name: 'x', type: 'STRING', groupable: true }],
      data: data.map((row) => [row[0], row[1], 'a']),
      initialChartControls: { roseMode: 'measures' },
    })
    expect(getSettings(wrapper).prop('mode')).toBe('values')
    expect(getSettings(wrapper).prop('measuresDisabledReason')).toBe('Needs at least 2 number columns')
  })
})

describe('ChataRoseChart measures mode with dates that cannot be grouped into periods', () => {
  // Grouped (aggregated) queries keep the query's own date precision, and only some precisions can be
  // regrouped into periods. Each distinct date then becomes its own period.
  test.each([
    ['grouped by hour', { precision: 'DATE_HOUR', groupable: true }],
    ['grouped, with no precision', { precision: undefined, groupable: true }],
  ])('%s: steps through each date value', (_, dateProps) => {
    const groupedColumns = [{ ...dateColumn, ...dateProps }, ...measureColumns]
    const wrapper = setup({ columns: groupedColumns })
    expect(wrapper.find('text.rose-empty-message').exists()).toBe(false)
    expect(getWedges(wrapper)).toHaveLength(3)
    expect(wrapper.find(TimeAnimationTimeline).prop('frames')).toHaveLength(4)
  })

  test('says which column has nothing to step through when no row has a value in it', () => {
    const wrapper = setup({ data: data.map((row) => [null, ...row.slice(1)]) })
    expect(wrapper.find('text.rose-empty-message').text()).toBe('No Date values to step through')
  })

  test('on a wide chart the timeline stays a modest width, and the rose is as tall as the chart allows', () => {
    const wide = setup({ width: 1600, height: 400 })
    expect(wide.find(TimeAnimationTimeline).prop('width')).toBeLessThanOrEqual(300)
    expect(Math.max(...wide.find('.rose-grid circle').map((c) => c.prop('r')))).toBe((400 - 10) / 2 - 11 - 8)
  })
})
