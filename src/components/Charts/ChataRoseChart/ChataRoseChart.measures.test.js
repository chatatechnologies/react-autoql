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

// Steps into one period, as the timeline does (the latest, unless another is given)
const goToPeriod = (wrapper, frameIndex) => {
  const animation = wrapper.find(TimeAnimationControl).prop('animation')
  act(() => animation.goToFrame(frameIndex ?? animation.frames.length - 1))
  wrapper.update()
  return wrapper
}
const setupInPeriod = (props) => goToPeriod(setup(props))

const getWedges = (wrapper) => wrapper.find('path.rose-wedge')
const getWedge = (wrapper, measure) => {
  const columnIndex = columns.findIndex((column) => column.display_name === measure)
  return getWedges(wrapper).filterWhere((wedge) => wedge.key() === `measure:${columnIndex}|0`)
}
const getSettings = (wrapper) => wrapper.find(RoseSettingsControl)
const getMeasurePicker = (wrapper) =>
  wrapper.find(SankeyColumnSelector).filterWhere((selector) => selector.prop('pathTitle') === 'Measures')
const getTickLabels = (wrapper) => wrapper.find('text.rose-tick-label').map((text) => text.text())

describe('ChataRoseChart measures mode', () => {
  test('is the default with a date column and 3+ number columns: one wedge per measure', () => {
    const wrapper = setup()
    expect(getSettings(wrapper).prop('mode')).toBe('measures')
    expect(getWedges(wrapper)).toHaveLength(3)
  })

  // Opens on the latest period, since the default scale compares periods
  test('opens on the latest period, on the normalized scale', () => {
    const wrapper = setup()
    expect(wrapper.find(TimeAnimationTimeline).prop('frameIndex')).toBe(3)
    expect(getWedge(wrapper, 'Revenue').prop('data-tooltip-html')).toContain('<strong>Revenue:</strong> $50.00')
    expect(getSettings(wrapper).prop('scale')).toBe('normalized')
    expect(getSettings(wrapper).prop('periodScalesDisabledReason')).toBeUndefined()
  })

  // AQLP-1099: closing the timeline shows the totals of all of the data
  const closeTimeline = (wrapper) => {
    act(() => wrapper.find(TimeAnimationTimeline).prop('onClose')())
    wrapper.update()
    return wrapper
  }

  test('closing the timeline shows the totals on the actual-values scale; normalized and range stay clickable', () => {
    const wrapper = closeTimeline(setup())
    expect(wrapper.find(TimeAnimationTimeline).exists()).toBe(false)
    // Revenue over the four days: 100 + 200 + 150 + 50
    const tooltip = getWedge(wrapper, 'Revenue').prop('data-tooltip-html')
    expect(tooltip).toContain('<strong>Revenue:</strong> $500.00')
    expect(tooltip).not.toContain('<strong>Date:</strong>')
    expect(getTickLabels(wrapper).some((label) => label.endsWith('σ'))).toBe(false)
    expect(getSettings(wrapper).prop('scale')).toBe('linear')
    expect(getSettings(wrapper).prop('periodScalesDisabledReason')).toBeUndefined()
    expect(getSettings(wrapper).prop('showsAllData')).toBe(true)
  })

  test('picking a scale that compares periods while showing the totals shows the latest period', () => {
    const wrapper = closeTimeline(setup())
    act(() => getSettings(wrapper).prop('onScaleChange')('minmax'))
    wrapper.update()
    expect(wrapper.find(TimeAnimationTimeline).prop('frameIndex')).toBe(3)
    expect(getSettings(wrapper).prop('scale')).toBe('minmax')
  })

  test('switching to measures opens on the latest period', () => {
    const wrapper = setup({ initialChartControls: { roseMode: 'values' } })
    expect(wrapper.find(TimeAnimationTimeline).exists()).toBe(false)
    act(() => getSettings(wrapper).prop('onModeChange')('measures'))
    wrapper.update()
    expect(wrapper.find(TimeAnimationTimeline).prop('frameIndex')).toBe(3)
  })

  test('playing over time splits the data into periods on the saved scale, and closing goes back', () => {
    const wrapper = goToPeriod(closeTimeline(setup()))
    expect(wrapper.find(TimeAnimationTimeline).prop('frameIndex')).toBe(3)
    expect(getWedge(wrapper, 'Revenue').prop('data-tooltip-html')).toContain('$50.00')
    expect(getSettings(wrapper).prop('scale')).toBe('normalized')
    expect(getSettings(wrapper).prop('periodScalesDisabledReason')).toBeUndefined()

    act(() => wrapper.find(TimeAnimationTimeline).prop('onClose')())
    wrapper.update()
    expect(wrapper.find(TimeAnimationTimeline).exists()).toBe(false)
    expect(getWedge(wrapper, 'Revenue').prop('data-tooltip-html')).toContain('$500.00')
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
    const timeline = setupInPeriod().find(TimeAnimationTimeline)
    expect(timeline.prop('height')).toBeLessThan(390)
    // Centred on the rose, which is centred in the 390px below the top margin
    expect(timeline.prop('y') + timeline.prop('height') / 2).toBeCloseTo(10 + 390 / 2)
  })

  test('the timeline sits just past the rose, and the two are centred together', () => {
    const wrapper = setupInPeriod()
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
    const series = setupInPeriod().find(TimeAnimationTimeline).prop('series')
    expect(new Set(series.map((item) => item.color)).size).toBe(3)
  })

  test('hovering a wedge does not single anything out', () => {
    const wrapper = setupInPeriod()
    act(() => {
      getWedge(wrapper, 'COGS').simulate('mouseenter')
    })
    wrapper.update()
    expect(wrapper.find(TimeAnimationTimeline).prop('highlightedKey')).toBeUndefined()
    expect(wrapper.find('path.rose-wedge-dimmed')).toHaveLength(0)
  })

  // AQLP-1097: the whole rose is one row (the period), so it's hovered and drilled into as one, but each
  // wedge's tooltip is only about its own measure
  test('the whole rose is hovered as one, and a tooltip shows only the hovered measure', () => {
    const wrapper = setupInPeriod()
    expect(wrapper.find('g.rose-wedges-measures').find('path.rose-wedge')).toHaveLength(3)
    const tooltip = getWedge(wrapper, 'Revenue').prop('data-tooltip-html')
    expect(tooltip.startsWith('<strong>Revenue:</strong> $50.00<br/><strong>Date:</strong> Jan 4, 2024')).toBe(true)
    expect(tooltip).not.toContain('COGS')
    expect(tooltip).not.toContain('Profit')
  })

  test('clicking a wedge makes the whole rose active for that period', () => {
    const onChartClick = jest.fn()
    const wrapper = setupInPeriod({ onChartClick })
    getWedge(wrapper, 'Profit').simulate('click')
    wrapper.update()
    expect(getWedges(wrapper).filterWhere((wedge) => wedge.hasClass('active'))).toHaveLength(3)
    // Another period isn't the one drilled into
    goToPeriod(wrapper, 0)
    expect(getWedges(wrapper).filterWhere((wedge) => wedge.hasClass('active'))).toHaveLength(0)
  })

  test('without a period to drill into, wedges do not look clickable', () => {
    const wrapper = closeTimeline(setup())
    expect(wrapper.find('g.rose-wedges-no-drilldown').exists()).toBe(true)
    expect(getWedge(setupInPeriod(), 'Revenue').prop('data-tooltip-html')).toContain('Click to see')
    expect(setupInPeriod().find('g.rose-wedges-no-drilldown').exists()).toBe(false)
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

  // AQLP-1095: each measure has its timeline color, and a wedge below its average is hatched
  test('normalized: each measure in its own color, hatched below its average, with rings in standard deviations', () => {
    const wrapper = setupInPeriod()
    const timelineColors = wrapper
      .find(TimeAnimationTimeline)
      .prop('series')
      .map((series) => series.color)
    const gradientColor = (wedge) =>
      wrapper
        .find(`radialGradient#${wedge.prop('fill').match(/url\(#(.+)\)/)[1]}`)
        .find('stop')
        .first()
        .prop('stopColor')
    expect(['Revenue', 'COGS', 'Profit'].map((measure) => gradientColor(getWedge(wrapper, measure)))).toEqual(
      timelineColors,
    )
    // On the last day Revenue is below its average and COGS above
    expect(getWedge(wrapper, 'Revenue').prop('mask')).toContain('hatch')
    expect(getWedge(wrapper, 'COGS').prop('mask')).toBeUndefined()
    expect(wrapper.find('g.rose-hatch-key').text()).toBe('Below average')
    // COGS on the last day: 80, against a daily average of 65 that usually varies by about 11
    expect(getWedge(wrapper, 'COGS').prop('data-tooltip-html')).toContain(
      '<strong>COGS:</strong> $80.00<br/><strong>Date:</strong> Jan 4, 2024<br/>1.3× its usual variation above its daily average of $65.00<br/>Typical range: $53.82 – $76.18',
    )
    expect(wrapper.find('circle.rose-average-ring').exists()).toBe(false)
    expect(getTickLabels(wrapper).every((label) => label.endsWith('σ'))).toBe(true)
  })

  // The key doesn't come and go during playback: it shows if any period has a hatched wedge
  test('the hatch key stays while showing a period with no hatched wedges', () => {
    // On actual values, only Profit on the last day (-30) is negative
    const wrapper = goToPeriod(setup({ initialChartControls: { roseScale: 'linear' } }), 0)
    expect(getWedges(wrapper).filterWhere((wedge) => !!wedge.prop('mask'))).toHaveLength(0)
    expect(wrapper.find('g.rose-hatch-key').text()).toBe('Negative')
  })

  test('with the timeline beside the rose, the hatch key sits under the timeline, lined up with its legend', () => {
    const wrapper = setupInPeriod()
    const timeline = wrapper.find(TimeAnimationTimeline)
    const key = wrapper.find('g.rose-hatch-key')
    expect(key.closest('g.rose-plot').exists()).toBe(false)
    expect(key.prop('transform')).toBe(
      `translate(${timeline.prop('x') + 6}, ${timeline.prop('y') + timeline.prop('height') + 8})`,
    )
  })

  test('each measure wedge has its own color, and none is hatched on a min-max scale', () => {
    const wrapper = setupInPeriod({ initialChartControls: { roseScale: 'minmax' } })
    expect(new Set(getWedges(wrapper).map((wedge) => wedge.prop('fill'))).size).toBe(3)
    expect(getWedges(wrapper).filterWhere((wedge) => !!wedge.prop('mask'))).toHaveLength(0)
    expect(wrapper.find('g.rose-hatch-key').exists()).toBe(false)
  })

  test('changing the scale redraws and saves it', () => {
    const onChartControlsChange = jest.fn()
    const wrapper = setupInPeriod({ onChartControlsChange })
    act(() => getSettings(wrapper).prop('onScaleChange')('minmax'))
    wrapper.update()
    expect(onChartControlsChange).toHaveBeenLastCalledWith(expect.objectContaining({ roseScale: 'minmax' }))
    // The outer ring is 100%; its label is left off like every chart's edge label
    expect(getTickLabels(wrapper)).toEqual(['25%', '50%', '75%'])
    // COGS is at its highest on the last day; nothing is below zero on a min-max scale
    expect(getWedge(wrapper, 'COGS').prop('data-tooltip-html')).toContain(
      '100% of the way from its lowest ($50.00) to its highest ($80.00): its highest period',
    )
    expect(getWedges(wrapper).filterWhere((wedge) => !!wedge.prop('mask'))).toHaveLength(0)
  })

  test('offers Count for list queries, and never the column being stepped through', () => {
    const wrapper = setupInPeriod()
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

  // AQLP-1094: with no date column, the first column that can be stepped through is picked, so the
  // chart isn't blank until one is picked by hand
  test('without a date column, steps through the first number column, which can be changed', () => {
    const roundColumn = { name: 'game.round', display_name: 'Round', type: 'QUANTITY', is_visible: true }
    const wrapper = setup({
      columns: [roundColumn, ...measureColumns],
      data: data.map((row, i) => [i + 1, ...row.slice(1)]),
      initialChartControls: { roseMode: 'measures' },
    })
    expect(wrapper.find('text.rose-empty-message').exists()).toBe(false)

    const animation = wrapper.find(TimeAnimationControl).prop('animation')
    expect(animation.columnOptionIndices).toEqual([0, 1, 2, 3])
    expect(animation.settings.columnIndex).toBe(0)

    // Round is what's stepped through, so it's not a measure
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
    expect(getWedge(setupInPeriod(), 'Profit').prop('data-tooltip-html')).toContain(
      '<em>Click to see all rows for Jan 4, 2024</em>',
    )
    // No hint when a click wouldn't do anything
    const noDrilldowns = setupInPeriod({ autoQLConfig: { enableDrilldowns: false } })
    expect(getWedge(noDrilldowns, 'Profit').prop('data-tooltip-html')).not.toContain('Click to see')
  })

  test('a measure wedge drills into the period being shown', () => {
    const onChartClick = jest.fn()
    const wrapper = setupInPeriod({ onChartClick })
    getWedge(wrapper, 'Profit').simulate('click')
    expect(onChartClick).toHaveBeenCalledWith({
      filters: [expect.objectContaining({ name: 'fin.date', operator: 'between' })],
      activeKey: expect.any(String),
    })
  })

  test('the timeline has one line per measure in its own units, and a close button', () => {
    const wrapper = setupInPeriod()
    const timeline = wrapper.find(TimeAnimationTimeline)
    expect(timeline.prop('series').map((series) => series.label)).toEqual(['Revenue', 'COGS', 'Profit'])
    expect(timeline.prop('series')[0].values).toEqual([100, 200, 150, 50])
    expect(timeline.prop('onClose')).toEqual(expect.any(Function))
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
    const wrapper = setupInPeriod({ columns: groupedColumns })
    expect(wrapper.find('text.rose-empty-message').exists()).toBe(false)
    expect(getWedges(wrapper)).toHaveLength(3)
    expect(wrapper.find(TimeAnimationTimeline).prop('frames')).toHaveLength(4)
  })

  test('with no values in the date column, shows the totals and has nothing to play over', () => {
    const wrapper = setup({ data: data.map((row) => [null, ...row.slice(1)]) })
    expect(getWedges(wrapper)).toHaveLength(3)
    expect(wrapper.find(TimeAnimationControl).prop('animation').isAvailable).toBe(false)
  })

  test('on a wide chart the timeline stays a modest width, and the rose is as tall as the chart allows', () => {
    const wide = setupInPeriod({ width: 1600, height: 400 })
    expect(wide.find(TimeAnimationTimeline).prop('width')).toBeLessThanOrEqual(300)
    expect(Math.max(...wide.find('.rose-grid circle').map((c) => c.prop('r')))).toBe((400 - 10) / 2 - 11 - 8)
  })
})
