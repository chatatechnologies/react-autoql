import React from 'react'
import renderer from 'react-test-renderer'
import { ChatDrawer } from '../..'
import { exportAllDeclaration } from '@babel/types'

it('renders correctly', () => {
  const tree = renderer.create(<ChatDrawer />).toJSON()
  expect(tree).toMatchSnapshot()
})
