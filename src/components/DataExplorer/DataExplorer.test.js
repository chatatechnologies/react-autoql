import React from 'react'
import { shallow } from 'enzyme'

import { findByTestAttr } from '../../../test/testUtils'
import DataExplorer from './DataExplorer'

const defaultProps = DataExplorer.defaultProps

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<DataExplorer {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders correctly with required props', () => {
    const wrapper = setup()
    const dataExplorerComponent = findByTestAttr(wrapper, 'data-explorer-tab')
    expect(dataExplorerComponent.exists()).toBe(true)
  })
})
