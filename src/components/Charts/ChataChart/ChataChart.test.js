import React from 'react'
import { shallow } from 'enzyme'

import ChataChart from './ChataChart'

import { findByTestAttr } from '../../../../test/testUtils'
import { themeConfigDefault, dataConfigDefault } from '../../../props/defaults'

const defaultProps = {
  themeConfig: themeConfigDefault,
  data: [
    {
      cells: [{ value: 50 }, { value: 75 }],
      label: 'label1`',
      origRow: ['label1', 50, 75],
    },
    {
      cells: [{ value: 30 }, { value: 65 }],
      label: 'label2`',
      origRow: ['label2', 30, 65],
    },
  ],
  columns: [{}, {}, {}],
  dataConfig: dataConfigDefault,
  height: 300,
  width: 300,
  type: 'bar',
}

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<ChataChart {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders correctly with required props', () => {
    const wrapper = setup()
    const chartComponent = findByTestAttr(wrapper, 'chata-chart')
    expect(chartComponent.exists()).toBe(true)
  })
})
