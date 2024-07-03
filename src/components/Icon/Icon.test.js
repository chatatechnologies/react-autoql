import React from 'react'
import { render } from '@testing-library/react'
import Icon from './Icon'

describe('RTL - ', () => {
  test('renders correctly with required props', () => {
    const { getByTestId } = render(<Icon type='edit' />)
    const iconComponent = getByTestId('react-autoql-icon')
    expect(iconComponent).toBeTruthy()
  })
})
