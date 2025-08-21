import React from 'react'
import { shallow } from 'enzyme'

import { findByTestAttr } from '../../../test/testUtils'
import { Dashboard } from './Dashboard'

const defaultProps = Dashboard.defaultProps

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<Dashboard {...setupProps} />).dive()
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders correctly with required props', () => {
    const wrapper = setup()
    const dashboardComponent = findByTestAttr(wrapper, 'react-autoql-dashboard')
    expect(dashboardComponent.exists()).toBe(true)
  })
})

describe('refresh layout', () => {
  test('refreshLayout fires window resize event', () => {
    const spy = jest.fn()
    window.addEventListener('resize', spy)

    const wrapper = setup()
    wrapper.instance().refreshLayout()

    window.removeEventListener('resize', spy)
    expect(spy).toHaveBeenCalled()
  })
})

describe('Dashboard.setParamsForTile', () => {
  let wrapper, instance, mockDebouncedOnChange

  beforeEach(() => {
    mockDebouncedOnChange = jest.fn()
    wrapper = setup()
    instance = wrapper.instance()
    instance.debouncedOnChange = mockDebouncedOnChange

    instance.getMostRecentTiles = jest.fn(() => [{ i: 'tile-1', name: 'old-name', tableFilters: [], query: 'q1' }])
  })

  test('should update multiple params including tableFilters', () => {
    const params = { name: 'new-name', tableFilters: ['f1'] }

    instance.setParamsForTile(params, 'tile-1')

    const updatedTiles = mockDebouncedOnChange.mock.calls[0][0]

    expect(updatedTiles[0]).toMatchObject({
      i: 'tile-1',
      name: 'new-name',
      tableFilters: ['f1'],
    })
  })
})
