import React from 'react'
import { shallow } from 'enzyme'

import { findByTestAttr } from '../../../test/testUtils'
import Spinner from './Spinner'

describe('renders correctly', () => {
  test('renders without crashing', () => {
    const wrapper = shallow(<Spinner />)
    const spinnerComponent = findByTestAttr(wrapper, 'chata-spinner')
    expect(spinnerComponent.exists()).toBe(true)
  })
})
