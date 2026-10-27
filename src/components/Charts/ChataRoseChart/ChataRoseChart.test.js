import React from 'react'
import { mount } from 'enzyme'
import { act } from 'react-dom/test-utils'
import { MAX_ROSE_CATEGORIES } from 'autoql-fe-utils'
import { findByTestAttr } from '../../../../test/testUtils'
import ChataRoseChart, { getRoseMaxCategories, placeRoseLabels } from './ChataRoseChart'
import SankeyColumnSelector from '../ChataSankeyDiagram/SankeyColumnSelector'
import { SANKEY_VALUE_COUNT_SENTINEL } from '../chartPropHelpers'

const columns = [
  { name: 'crypto.asset', display_name: 'Asset', type: 'STRING', is_visible: true },
  { name: 'crypto.exchange', display_name: 'Exchange', type: 'STRING', is_visible: true },
  { name: 'crypto.volume', display_name: 'Volume', type: 'QUANTITY', is_visible: true, isNumberType: true },
  { name: 'crypto.change', display_name: 'Change', type: 'QUANTITY', is_visible: true, isNumberType: true },
]

const data = [
  ['BTC', 'X', 10, 2],
  ['ETH', 'X', 6, -3],
  ['SOL', 'Y', 4, 1],
  ['BTC', 'Y', 5, 0],
]

const setup = (props = {}) =>
  mount(
    <svg>
      <ChataRoseChart
        columns={columns}
        data={data}
        width={600}
        height={400}
        autoQLConfig={{ enableDrilldowns: true }}
        {...props}
      />
    </svg>,
  )

const getWedges = (wrapper) => wrapper.find('path.rose-wedge')
const getSelector = (wrapper, title) =>
  wrapper.find(SankeyColumnSelector).filterWhere((s) => s.prop('pathTitle') === title)

describe('ChataRoseChart', () => {
  test('renders one wedge per category for a single value column', () => {
    const wrapper = setup()
    expect(findByTestAttr(wrapper, 'react-autoql-rose').exists()).toBe(true)
    expect(getWedges(wrapper)).toHaveLength(3)
  })

  test('stacks a wedge segment per value column, skipping zero segments', () => {
    const wrapper = setup({ initialChartControls: { roseValueColumnIndices: [2, 3] } })
    // BTC 15 + 2, ETH 6 + -3, SOL 4 + 1
    expect(getWedges(wrapper)).toHaveLength(6)
  })

  test('uses the persisted category column', () => {
    const wrapper = setup({ initialChartControls: { roseCategoryColumnIndex: 1 } })
    expect(getWedges(wrapper)).toHaveLength(2)
  })

  test('falls back to defaults for invalid persisted indices', () => {
    const wrapper = setup({ initialChartControls: { roseCategoryColumnIndex: 99, roseValueColumnIndices: [0, 99] } })
    expect(getWedges(wrapper)).toHaveLength(3)
    expect(getSelector(wrapper, 'Values').prop('pathColumnIndices')).toEqual([2])
  })

  test('fills negative values with the negative gradient', () => {
    const wrapper = setup({ initialChartControls: { roseValueColumnIndices: [3] } })
    const fills = getWedges(wrapper).map((w) => w.prop('fill'))
    expect(fills.filter((fill) => fill.includes('-negative'))).toHaveLength(1)
  })

  test('saves picks through onChartControlsChange', () => {
    const onChartControlsChange = jest.fn()
    const wrapper = setup({ onChartControlsChange, initialChartControls: { showAverageLine: true } })
    act(() => getSelector(wrapper, 'Values').prop('onPathChange')([2, 3]))
    wrapper.update()
    expect(onChartControlsChange).toHaveBeenCalledWith({ showAverageLine: true, roseValueColumnIndices: [2, 3] })
    act(() => getSelector(wrapper, 'Category').prop('onPathChange')([1]))
    expect(onChartControlsChange).toHaveBeenLastCalledWith(expect.objectContaining({ roseCategoryColumnIndex: 1 }))
  })

  test('offers Count only for list queries', () => {
    const listWrapper = setup()
    expect(getSelector(listWrapper, 'Values').prop('pathColumnOptionIndices')).toContain(SANKEY_VALUE_COUNT_SENTINEL)

    const groupedColumns = columns.map((col) => ({ ...col, groupable: !col.isNumberType }))
    const aggregatedColumns = groupedColumns.slice(0, 1).concat(groupedColumns.slice(2))
    const groupedWrapper = setup({
      columns: aggregatedColumns,
      data: [
        ['BTC', 1, 2],
        ['ETH', 3, 4],
        ['SOL', 5, 6],
      ],
    })
    expect(getSelector(groupedWrapper, 'Values').prop('pathColumnOptionIndices')).not.toContain(
      SANKEY_VALUE_COUNT_SENTINEL,
    )
  })

  test('escapes tooltip html and shows each layer and the total', () => {
    const wrapper = setup({
      data: [['<b>BTC</b>', 'X', 10, 2], ...data.slice(1)],
      initialChartControls: { roseValueColumnIndices: [2, 3] },
    })
    const html = getWedges(wrapper).first().prop('data-tooltip-html')
    expect(html).toContain('&lt;b&gt;BTC&lt;/b&gt;')
    expect(html).toContain('Volume:')
    expect(html).toContain('Change:')
    expect(html).toContain('Total:')
  })

  test('drills down with a group-by on grouped data', () => {
    const onChartClick = jest.fn()
    const groupedColumns = [{ ...columns[0], groupable: true }, columns[2]]
    const wrapper = setup({
      onChartClick,
      columns: groupedColumns,
      data: [
        ['BTC', 1],
        ['ETH', 2],
        ['SOL', 3],
      ],
    })
    getWedges(wrapper).at(1).simulate('click')
    expect(onChartClick).toHaveBeenCalledWith({
      groupBys: [{ name: 'crypto.asset', drill_down: undefined, value: 'ETH', operator: '=' }],
      activeKey: expect.any(String),
    })
  })

  test('drills down with a filter row on list queries', () => {
    const onChartClick = jest.fn()
    const wrapper = setup({ onChartClick })
    getWedges(wrapper).at(1).simulate('click')
    expect(onChartClick).toHaveBeenCalledWith({
      stringColumnIndices: [0],
      rows: [['ETH', undefined, undefined, undefined]],
      activeKey: expect.any(String),
    })
  })

  test('does not drill down when drilldowns are disabled or on the Other wedge', () => {
    const onChartClick = jest.fn()
    setup({ onChartClick, autoQLConfig: { enableDrilldowns: false } })
      .find('path.rose-wedge')
      .first()
      .simulate('click')

    const manyRows = Array.from({ length: MAX_ROSE_CATEGORIES + 2 }, (_, i) => [`A${i}`, 'X', i + 1, 0])
    const wrapper = setup({ onChartClick, data: manyRows })
    getWedges(wrapper).last().simulate('click')
    expect(onChartClick).not.toHaveBeenCalled()
  })

  test('combines extra categories into Other and shows a warning', () => {
    const manyRows = Array.from({ length: MAX_ROSE_CATEGORIES + 2 }, (_, i) => [`A${i}`, 'X', i + 1, 0])
    const wrapper = setup({ data: manyRows })
    // 600x400 with short labels leaves a 176px radius, which fits 17 wedges
    expect(getWedges(wrapper)).toHaveLength(17)
    expect(getWedges(wrapper).last().hasClass('rose-wedge-other')).toBe(true)
    expect(wrapper.find('DataLimitWarning').exists()).toBe(true)
  })

  test('draws a reasonably sized Other to scale', () => {
    // 17 wedges fit: the 16 values of 10 keep their own, and the three 5s make an Other of 15 (1.5x the biggest)
    const rows = [
      ...Array.from({ length: 16 }, (_, i) => [`A${i}`, 'X', 10, 0]),
      ...Array.from({ length: 3 }, (_, i) => [`B${i}`, 'X', 5, 0]),
    ]
    const other = getWedges(setup({ data: rows })).last()
    expect(other.hasClass('rose-wedge-other')).toBe(true)
    expect(other.prop('strokeDasharray')).toBeUndefined()
    expect(other.prop('data-tooltip-html')).not.toContain('Not drawn to scale')
  })

  test('caps a huge Other at twice the biggest real wedge, marked as not to scale', () => {
    const manyRows = Array.from({ length: 40 }, (_, i) => [`A${i}`, 'X', 10, 0])
    const wrapper = setup({ data: manyRows })
    const other = getWedges(wrapper).last()
    expect(other.prop('strokeDasharray')).toBeDefined()
    expect(other.prop('data-tooltip-html')).toContain('Not drawn to scale')
    expect(getWedges(wrapper).first().prop('strokeDasharray')).toBeUndefined()
  })

  test('explains an empty chart when there is no number column', () => {
    const wrapper = setup({
      columns: columns.slice(0, 2).map((col) => ({ ...col, groupable: true })),
      data: [['BTC', 'X']],
    })
    expect(getWedges(wrapper)).toHaveLength(0)
    expect(wrapper.find('text.rose-empty-message').exists()).toBe(true)
  })

  test('explains instead of drawing a full circle when the category has one value', () => {
    const wrapper = setup({
      data: data.map((row) => ['BTC', ...row.slice(1)]),
      initialChartControls: { roseCategoryColumnIndex: 0 },
    })
    expect(getWedges(wrapper)).toHaveLength(0)
    expect(wrapper.find('text.rose-empty-message').text()).toBe(
      'Only one Asset value (BTC). Pick a different category.',
    )
  })

  test('disables single-value columns in the Category picker', () => {
    const wrapper = setup({ data: data.map((row) => [row[0], 'X', row[2], row[3]]) })
    expect(getSelector(wrapper, 'Category').prop('disabledPathColumnIndices')).toEqual([1])
  })

  test('uses the empty space beside a height-limited rose for long labels', () => {
    const longName = 'Alexander K. Kingsley-Whitmore' // 30 characters, wider than the space reserved for labels
    const wrapper = setup({ width: 1200, height: 400, data: [[longName, 'X', 10, 0], ...data.slice(1)] })
    expect(wrapper.find('text.rose-label').map((label) => label.text())).toContain(longName)
  })

  test('a truncated label shows its full name in a tooltip; a label shown in full has none', () => {
    const longName = 'Alexander K. Kingsley-Whitmore'
    const wrapper = setup({
      width: 400,
      height: 400,
      chartTooltipID: 'chart-tooltip',
      data: [[longName, 'X', 10, 0], ...data.slice(1)],
    })
    const labels = wrapper.find('text.rose-label')
    const truncated = labels.filterWhere((label) => label.text().endsWith('…'))
    expect(truncated).toHaveLength(1)
    expect(longName.startsWith(truncated.text().slice(0, -1))).toBe(true)
    expect(truncated.prop('data-tooltip-id')).toBe('chart-tooltip')
    expect(truncated.prop('data-tooltip-content')).toBe(longName)
    // Labels sit in a group that ignores the mouse; a truncated one has to opt back in to be hovered
    expect(truncated.prop('style')).toEqual(expect.objectContaining({ pointerEvents: 'auto' }))

    const full = labels.filterWhere((label) => label.text() === 'ETH')
    expect(full.prop('data-tooltip-content')).toBeUndefined()
  })

  test('a number column can be the category, one wedge per value, smallest first', () => {
    const wrapper = setup({
      data: [
        ['BTC', 'X', 3, 1],
        ['ETH', 'X', 1, 1],
        ['SOL', 'Y', 2, 1],
        ['ADA', 'Y', 3, 1],
      ],
      initialChartControls: { roseCategoryColumnIndex: 2, roseValueColumnIndices: [3] },
    })
    expect(getSelector(wrapper, 'Category').prop('pathColumnOptionIndices')).toEqual([0, 1, 2, 3])
    // Wedges go around the circle in value order (labels are emitted in placement order instead)
    const wedgeCategories = getWedges(wrapper).map((wedge) => wedge.prop('data-tooltip-html').split('<br/>')[0])
    expect(wedgeCategories).toEqual([
      '<strong>Volume:</strong> 1',
      '<strong>Volume:</strong> 2',
      '<strong>Volume:</strong> 3',
    ])
  })

  test('a number category with many values is split into ranges that drill down with a between filter', () => {
    const onChartClick = jest.fn()
    const rows = Array.from({ length: 200 }, (_, i) => [`A${i}`, 'X', i * 5, 1])
    const wrapper = setup({
      data: rows,
      onChartClick,
      initialChartControls: { roseCategoryColumnIndex: 2, roseValueColumnIndices: [3] },
    })
    const labels = wrapper.find('text.rose-label').map((label) => label.text())
    expect(labels[0]).toMatch(/^0 – \d+$/)
    expect(wrapper.find('DataLimitWarning').exists()).toBe(false)

    getWedges(wrapper).first().simulate('click')
    const [{ filters }] = onChartClick.mock.calls[0]
    expect(filters).toEqual([
      { name: 'crypto.volume', operator: 'between', value: expect.stringMatching(/^0,\d+$/), column_type: 'QUANTITY' },
    ])
  })

  test('draws nothing, not an empty message, when there is no room', () => {
    const wrapper = setup({ width: 1, height: 1 })
    expect(getWedges(wrapper)).toHaveLength(0)
    expect(wrapper.find('text.rose-empty-message').exists()).toBe(false)
  })
})

describe('getRoseMaxCategories', () => {
  test('fits fewer wedges on smaller charts, between 8 and MAX_ROSE_CATEGORIES', () => {
    expect(getRoseMaxCategories(20)).toBe(8)
    expect(getRoseMaxCategories(158)).toBe(15)
    expect(getRoseMaxCategories(1000)).toBe(MAX_ROSE_CATEGORIES)
  })
})

describe('placeRoseLabels', () => {
  const label = (key, x, y, priority, textAnchor = 'start') => ({ key, x, y, width: 50, textAnchor, priority })

  test('keeps the higher-priority label when two overlap', () => {
    const placed = placeRoseLabels([label('small', 0, 0, 1), label('big', 10, 2, 5)])
    expect(placed.map((l) => l.key)).toEqual(['big'])
  })

  test('keeps labels that do not overlap', () => {
    const placed = placeRoseLabels([label('a', 0, 0, 1), label('b', 0, 30, 2), label('c', 100, 0, 3)])
    expect(placed.map((l) => l.key).sort()).toEqual(['a', 'b', 'c'])
  })

  test('accounts for the text anchor', () => {
    // 'end' label spans -50..0, 'start' label spans 5..55: no overlap
    const placed = placeRoseLabels([label('left', 0, 0, 1, 'end'), label('right', 5, 0, 2, 'start')])
    expect(placed).toHaveLength(2)
  })
})
