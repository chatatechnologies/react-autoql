import React from 'react'
import { mount } from 'enzyme'
import { DisplayTypes } from 'autoql-fe-utils'
import { QueryOutput } from '../QueryOutput'
import { featureToggles } from '../../../js/featureToggles'
import { installGetBBoxMock, uninstallGetBBoxMock } from '../../../../test/utils/getBBoxShim'

beforeAll(() => installGetBBoxMock())
afterAll(() => {
  uninstallGetBBoxMock()
  featureToggles.rose = false
})

// List query a rose can draw: one wedge per Region, sized by Sales
const columns = [
  { name: 'region', display_name: 'Region', type: 'STRING', is_visible: true, index: 0 },
  { name: 'product', display_name: 'Product', type: 'STRING', is_visible: true, index: 1 },
  { name: 'sales', display_name: 'Sales', type: 'DOLLAR_AMT', is_visible: true, index: 2 },
]
const rows = [
  ['East', 'Bolts', 10],
  ['West', 'Nuts', 20],
  ['East', 'Nuts', 30],
  ['North', 'Bolts', 5],
  ['West', 'Bolts', 15],
]
const response = {
  data: {
    reference_id: '1.1.200',
    data: { text: 'all sales', display_type: 'data', query_id: 'q1', row_limit: 500, count_rows: 5, rows, columns },
  },
}

const setup = (props = {}) => {
  const wrapper = mount(<QueryOutput authentication={{}} queryResponse={response} {...props} />)
  return { wrapper, inst: wrapper.instance() }
}

describe('rose feature toggle', () => {
  test('rose is not a supported display type when the toggle is off', () => {
    featureToggles.rose = false
    const { wrapper, inst } = setup()

    expect(inst.getCurrentSupportedDisplayTypes()).not.toContain(DisplayTypes.ROSE)
    wrapper.unmount()
  })

  test('a saved rose display type falls back when the toggle is off', () => {
    featureToggles.rose = false
    const { wrapper, inst } = setup({ initialDisplayType: DisplayTypes.ROSE })

    expect(inst.state.displayType).not.toBe(DisplayTypes.ROSE)
    wrapper.unmount()
  })

  test('rose is offered when the toggle is on', () => {
    featureToggles.rose = true
    const { wrapper, inst } = setup({ initialDisplayType: DisplayTypes.ROSE })

    expect(inst.getCurrentSupportedDisplayTypes()).toContain(DisplayTypes.ROSE)
    expect(inst.state.displayType).toBe(DisplayTypes.ROSE)
    wrapper.unmount()
  })
})
