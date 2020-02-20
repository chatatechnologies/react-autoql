import React from 'react'
import { shallow } from 'enzyme'

import { findByTestAttr } from '../../../../test/testUtils'
import DashboardTile from './DashboardTile'

const defaultProps = {
  tile: {},
  demo: true,
  debug: false,
  test: false,
  enableQueryValidation: true,
  isEditing: false,
  dataFormatting: {},
  titleColor: '#000',
  deleteTile: () => {}
}

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<DashboardTile {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders correctly with required props', () => {
    const wrapper = setup()
    const dashboardTileComponent = findByTestAttr(
      wrapper,
      'chata-dashboard-tile'
    )
    expect(dashboardTileComponent.exists()).toBe(true)
  })
})
