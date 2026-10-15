import React from 'react'
import { mount } from 'enzyme'
import { findByTestAttr } from '../../../../test/testUtils'
import ChataTreemap, { aggregateTreemapLeaves, buildTreemapTree, TREEMAP_VALUE_COUNT_SENTINEL } from './ChataTreemap'

const columns = [
  { name: 'sales.region', display_name: 'Region', type: 'STRING', is_visible: true, groupable: true },
  { name: 'sales.product', display_name: 'Product', type: 'STRING', is_visible: true, groupable: true },
  { name: 'sales.amount', display_name: 'Amount', type: 'DOLLAR_AMT', is_visible: true, isNumberType: true },
]

const data = [
  ['East', 'A', 10],
  ['East', 'B', 5],
  ['East', 'A', 15],
  ['West', 'A', 20],
  ['West', 'C', 0],
  ['West', 'D', -3],
]

const setup = (props = {}) =>
  mount(
    <svg>
      <ChataTreemap
        columns={columns}
        data={data}
        width={600}
        height={400}
        autoQLConfig={{ enableDrilldowns: true }}
        {...props}
      />
    </svg>,
  )

describe('aggregateTreemapLeaves', () => {
  test('sums values per group combination, drops non-positive values, sorts descending', () => {
    const leaves = aggregateTreemapLeaves(data, [0, 1], 2)
    expect(leaves).toEqual([
      { rawValues: ['East', 'A'], value: 25 },
      { rawValues: ['West', 'A'], value: 20 },
      { rawValues: ['East', 'B'], value: 5 },
    ])
  })

  test('counts rows when the count sentinel is the value column', () => {
    const leaves = aggregateTreemapLeaves(data, [0], TREEMAP_VALUE_COUNT_SENTINEL)
    expect(leaves).toEqual([
      { rawValues: ['East'], value: 3 },
      { rawValues: ['West'], value: 3 },
    ])
  })

  test('ignores null rows', () => {
    expect(aggregateTreemapLeaves([null, ['East', 'A', 1]], [0, 1], 2)).toHaveLength(1)
  })
})

describe('buildTreemapTree', () => {
  test('nests leaves by group level and records the drilldown path', () => {
    const leaves = aggregateTreemapLeaves(data, [0, 1], 2)
    const tree = buildTreemapTree(leaves, [0, 1], (value) => value)

    expect(tree.children.map((child) => child.name)).toEqual(['East', 'West'])
    const east = tree.children[0]
    expect(east.children.map((child) => [child.name, child.value])).toEqual([
      ['A', 25],
      ['B', 5],
    ])
    expect(east.children[1].path).toEqual([
      { columnIndex: 0, rawValue: 'East' },
      { columnIndex: 1, rawValue: 'B' },
    ])
  })

  test('labels empty group values as (Blank)', () => {
    const tree = buildTreemapTree([{ rawValues: [null], value: 1 }], [0], (value) => value)
    expect(tree.children[0].name).toBe('(Blank)')
  })
})

describe('ChataTreemap', () => {
  test('renders one box per leaf and per parent group', () => {
    const wrapper = setup()
    expect(findByTestAttr(wrapper, 'react-autoql-treemap').exists()).toBe(true)
    expect(wrapper.find('g.treemap-leaf')).toHaveLength(3)
    expect(wrapper.find('g.treemap-parent')).toHaveLength(2)
  })

  test('uses persisted group columns from initialChartControls', () => {
    const wrapper = setup({ initialChartControls: { treemapGroupColumnIndices: [1] } })
    expect(wrapper.find('g.treemap-leaf')).toHaveLength(2) // A and B
    expect(wrapper.find('g.treemap-parent')).toHaveLength(0)
  })

  test('sizes boxes by row count when Count is the persisted value', () => {
    const wrapper = setup({ initialChartControls: { treemapValueColumnIndex: TREEMAP_VALUE_COUNT_SENTINEL } })
    // West/C and West/D have non-positive amounts but still count as rows
    expect(wrapper.find('g.treemap-leaf')).toHaveLength(5)
  })

  test('drills down with the clicked box group-by path', () => {
    const onChartClick = jest.fn()
    const wrapper = setup({ onChartClick })

    const westA = wrapper.find('g.treemap-leaf').filterWhere((node) => node.key()?.endsWith('West|||A'))
    westA.find('rect.treemap-leaf-rect').simulate('click')

    expect(onChartClick).toHaveBeenCalledWith({
      groupBys: [
        { name: 'sales.region', drill_down: undefined, value: 'West', operator: '=' },
        { name: 'sales.product', drill_down: undefined, value: 'A', operator: '=' },
      ],
      activeKey: 'treemap-root|||West|||A',
    })
  })

  test('uses filters instead of group-bys when a path column is not groupable (eg. list queries)', () => {
    const onChartClick = jest.fn()
    const listColumns = columns.map((col) => ({ ...col, groupable: false }))
    const wrapper = setup({ onChartClick, columns: listColumns })

    const westA = wrapper.find('g.treemap-leaf').filterWhere((node) => node.key()?.endsWith('West|||A'))
    westA.find('rect.treemap-leaf-rect').simulate('click')

    const row = ['West', 'A', undefined]
    expect(onChartClick).toHaveBeenCalledWith({
      stringColumnIndices: [0, 1],
      rows: [row, row],
      activeKey: 'treemap-root|||West|||A',
    })
  })

  test('does not drill down when drilldowns are disabled', () => {
    const onChartClick = jest.fn()
    const wrapper = setup({ onChartClick, autoQLConfig: { enableDrilldowns: false } })
    wrapper.find('g.treemap-leaf').first().find('rect.treemap-leaf-rect').simulate('click')
    expect(onChartClick).not.toHaveBeenCalled()
  })
})
