import React from 'react'
import { render } from '@testing-library/react'
import Icon from './Icon'

describe('RTL - ', () => {
  test('renders correctly with required props', () => {
    const { getByTestId } = render(<Icon type='edit' />)
    const iconComponent = getByTestId('react-autoql-icon')
    expect(iconComponent).toBeTruthy()
  })

  // An unknown type renders an empty span, so the case is what draws the star
  test('draws the star', () => {
    const { getByTestId } = render(<Icon type='star' />)
    expect(getByTestId('react-autoql-icon').querySelector('svg')).toBeTruthy()
  })
})
