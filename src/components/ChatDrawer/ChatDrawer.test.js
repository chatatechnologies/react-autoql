import React from 'react'
import renderer from 'react-test-renderer'
import { ChatDrawer } from '../..'
import { exportAllDeclaration } from '@babel/types'

import { configure, shallow, mount, render } from 'enzyme'
import Adapter from 'enzyme-adapter-react-16'

configure({ adapter: new Adapter() })

it('renders correctly', () => {
  const wrapper = shallow(<ChatDrawer />)
  expect(wrapper).toMatchSnapshot()
})
