import React from 'react'
import renderer from 'react-test-renderer'
import { ChatDrawer } from '../..'

it('renders correctly', () => {
  const tree = renderer.create(<ChatDrawer />).toJSON()
})
