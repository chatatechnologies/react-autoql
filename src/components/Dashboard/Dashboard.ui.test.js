import React from 'react'
import { shallow } from 'enzyme'
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

describe('Dashboard UI restoration methods', () => {
  let wrapper, instance

  beforeEach(() => {
    wrapper = setup()
    instance = wrapper.instance()
    instance.tileRefs = {
      tile1: {
        state: {
          responseRef: {
            tableRef: {
              hideAllHeaderFilters: jest.fn(),
            },
          },
        },
        restoreTileUIState: jest.fn(),
      },
      tile2: {
        state: {
          responseRef: {
            tableRef: {
              hideAllHeaderFilters: jest.fn(),
            },
          },
        },
        restoreTileUIState: jest.fn(),
      },
    }
  })

  test('restoreAllHeaderFilters calls hideAllHeaderFilters on all tileRefs', () => {
    instance.restoreAllHeaderFilters()
    expect(instance.tileRefs.tile1.state.responseRef.tableRef.hideAllHeaderFilters).toHaveBeenCalled()
    expect(instance.tileRefs.tile2.state.responseRef.tableRef.hideAllHeaderFilters).toHaveBeenCalled()
  })

  test('restoreAllTileUIState calls restoreTileUIState on all tileRefs', () => {
    instance.restoreAllTileUIState()
    expect(instance.tileRefs.tile1.restoreTileUIState).toHaveBeenCalled()
    expect(instance.tileRefs.tile2.restoreTileUIState).toHaveBeenCalled()
  })

  test('getRestoredTiles returns tiles with restored displayType properties', () => {
    instance.state.uneditedDashboardTiles = [
      { key: 'tile1', displayType: 'table', secondDisplayType: 'bar', secondDisplayPercentage: 50 },
      { key: 'tile2', displayType: 'text', secondDisplayType: 'column', secondDisplayPercentage: 30 },
    ]
    instance.getMostRecentTiles = jest.fn(() => [
      { key: 'tile1', displayType: 'chart', secondDisplayType: 'pie', secondDisplayPercentage: 10 },
      { key: 'tile2', displayType: 'map', secondDisplayType: 'scatter', secondDisplayPercentage: 20 },
    ])
    const restored = instance.getRestoredTiles()
    expect(restored[0]).toMatchObject({
      key: 'tile1',
      displayType: 'table',
      secondDisplayType: 'bar',
      secondDisplayPercentage: 50,
    })
    expect(restored[1]).toMatchObject({
      key: 'tile2',
      displayType: 'text',
      secondDisplayType: 'column',
      secondDisplayPercentage: 30,
    })
  })
})
