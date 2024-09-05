import React from 'react'
import { mount } from 'enzyme'
import { findByTestAttr } from '../../../../test/testUtils'
import { DashboardTile } from './DashboardTile'
import sampleResponses from '../../../../test/responseTestCases'

const sampleTile = {
  key: 'be54870f-57da-4a02-99a8-5d2ea9993084',
  i: 'be54870f-57da-4a02-99a8-5d2ea9993084',
  w: 12,
  h: 5,
  x: 0,
  y: 0,
  query: 'Total online sales by region by year',
  title: '',
  minW: 3,
  minH: 2,
  maxH: 12,
  moved: false,
  static: false,
  skipQueryValidation: false,
  displayType: 'column',
  queryResponse: sampleResponses[10],
  dataConfig: {
    tableConfig: {
      stringColumnIndices: [0, 1],
      stringColumnIndex: 1,
      numberColumnIndices: [2],
      numberColumnIndex: 2,
      legendColumnIndex: 0,
    },
    pivotTableConfig: {
      stringColumnIndices: [0],
      stringColumnIndex: 0,
      numberColumnIndices: [1, 2, 3, 4, 5, 6],
      numberColumnIndex: 1,
    },
  },
}

const setup = (props = {}, state = null) => {
  const setupProps = {
    ...DashboardTile.defaultProps,
    ...props,
  }
  const wrapper = mount(<DashboardTile {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders correctly with required props', () => {
    const wrapper = setup({ tile: sampleTile })
    const dashboardTileComponent = findByTestAttr(wrapper, 'react-autoql-dashboard-tile')
    expect(dashboardTileComponent.exists()).toBe(true)
  })
})
