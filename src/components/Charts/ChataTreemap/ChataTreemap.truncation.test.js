import React from 'react'
import { mount } from 'enzyme'
import ChataTreemap from './ChataTreemap'

// Separate file so the lower leaf limit doesn't affect the other treemap tests
jest.mock('autoql-fe-utils', () => ({ ...jest.requireActual('autoql-fe-utils'), MAX_TREEMAP_LEAVES: 2 }))

const columns = [
  { name: 'sales.region', display_name: 'Region', type: 'STRING', is_visible: true, groupable: true },
  { name: 'sales.product', display_name: 'Product', type: 'STRING', is_visible: true, groupable: true },
  { name: 'sales.amount', display_name: 'Amount', type: 'DOLLAR_AMT', is_visible: true, isNumberType: true },
]

const data = [
  ['East', 'A', 25],
  ['West', 'A', 20],
  ['East', 'B', 5],
  ['West', 'C', 0],
]

describe('ChataTreemap with truncated data', () => {
  test('% of Total is out of every group, not just the ones shown', () => {
    const wrapper = mount(
      <svg>
        <ChataTreemap
          columns={columns}
          data={data}
          width={600}
          height={400}
          initialChartControls={{ treemapGroupColumnIndices: [0, 1], treemapValueColumnIndex: 2 }}
        />
      </svg>,
    )

    expect(wrapper.find('g.treemap-leaf')).toHaveLength(2)
    const eastA = wrapper.find('g.treemap-leaf').filterWhere((node) => node.key()?.endsWith('East|||A'))
    const tooltip = eastA.find('rect').prop('data-tooltip-html')
    expect(tooltip).toContain('% of Total:</strong> 50.0%') // 25 of 50, not 25 of the 45 shown
    expect(tooltip).toContain('1 row with zero, negative or empty Amount not included')
    wrapper.unmount()
  })
})
