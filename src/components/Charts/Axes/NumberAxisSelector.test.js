import React from 'react'
import { mount } from 'enzyme'
import NumberAxisSelector from './NumberAxisSelector'
import { installGetBBoxMock, uninstallGetBBoxMock } from '../../../../test/utils/getBBoxShim'
import sampleProps from '../chartTestData'
import { findByTestAttr } from '../../../../test/testUtils'
beforeAll(() => installGetBBoxMock())
afterAll(() => uninstallGetBBoxMock())

const pivotSampleProps = sampleProps.pivot
const defaultProps = NumberAxisSelector.defaultProps

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = mount(
    <svg width='300px' height='300px'>
      <NumberAxisSelector {...setupProps}>
        <div data-test='number-axis-selector'>test</div>
      </NumberAxisSelector>
    </svg>,
  )
  return wrapper
}

describe('renders correctly', () => {
  test('renders number axis selector if number column provided', () => {
    const wrapper = setup(pivotSampleProps)
    const numberSelector = findByTestAttr(wrapper, 'number-axis-selector')
    expect(numberSelector.exists()).toBe(true)
  })
})
