import React from 'react'
import { shallow } from 'enzyme'

import { findByTestAttr } from '../../../test/testUtils'
import ColumnVisibilityModal from './ColumnVisibilityModal'

const defaultProps = {
  columns: [],
}

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<ColumnVisibilityModal {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders correctly with required props', () => {
    const wrapper = setup()
    const columnVisibilityModalComponent = findByTestAttr(wrapper, 'column-visibility-modal')
    expect(columnVisibilityModalComponent.exists()).toBe(true)
  })
})
