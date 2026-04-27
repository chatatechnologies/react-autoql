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

describe('Dashboard.resetTile', () => {
  test('clears filters and calls processTile when tile has a query', () => {
    const wrapper = setup()
    const instance = wrapper.instance()

    // Mock tiles with a query and an i identifier
    const tiles = [
      { i: 'tile-1', query: 'SELECT 1', tableFilters: ['f1'], orders: ['o1'], key: 'tile-1' },
    ]

    instance.getMostRecentTiles = jest.fn(() => tiles)

    // Spy on debouncedOnChange to capture the tiles and call callbacks immediately
    const debouncedSpy = jest.fn((updatedTiles, saveInLog, callbackArray) => {
      // call any callbacks synchronously for test
      if (Array.isArray(callbackArray)) {
        callbackArray.forEach((cb) => cb && cb())
      }
      return Promise.resolve()
    })

    instance.debouncedOnChange = debouncedSpy

    // Provide a tileRef with processTile spy
    const processTile = jest.fn()
    instance.tileRefs = { 'tile-1': { processTile } }

    // Call resetTile
    instance.resetTile('tile-1')

    // Expect debouncedOnChange called with updated tiles that have cleared filters/orders
    expect(debouncedSpy).toHaveBeenCalled()
    const updated = debouncedSpy.mock.calls[0][0]
    expect(updated[0].tableFilters).toEqual([])
    expect(updated[0].orders).toEqual([])
    // processTile should be called by the callback
    expect(processTile).toHaveBeenCalled()
  })
})
