import React from 'react'
import { shallow, mount } from 'enzyme'

import { findByTestAttr } from '../../../test/testUtils'
import { QueryOutput } from '../QueryOutput/QueryOutput'
import VizToolbar from './VizToolbar'

import responseTestCases from '../../../test/responseTestCases'

var responseRef
var toolbarRef

const defaultProps = VizToolbar.defaultProps

const setup = ({ props = {}, queryOutputProps = {}, state = null } = {}) => {
  const setupProps = { ...defaultProps, ...props }
  const queryOutputWrapper = mount(
    <QueryOutput
      ref={(r) => {
        responseRef = r
      }}
      {...queryOutputProps}
    />,
  )
  queryOutputWrapper.mount()
  const wrapper = shallow(<VizToolbar ref={(r) => (toolbarRef = r)} responseRef={responseRef} {...setupProps} />)
  wrapper.setState({})

  if (state) {
    wrapper.setState(state)
  }
  return { wrapper, queryOutputWrapper }
}

describe('renders correctly', () => {
  test('does not render if no queryOutput ref is provided', () => {
    const wrapper = shallow(<VizToolbar {...defaultProps} />)
    const toolbarComponent = findByTestAttr(wrapper, 'viz-toolbar')
    expect(toolbarComponent.exists()).toBe(false)
  })

  test('renders correctly with valid supportedDisplayTypes and display type', () => {
    const { wrapper } = setup({
      queryOutputProps: {
        queryResponse: responseTestCases[8],
      },
    })
    const toolbarComponent = findByTestAttr(wrapper, 'viz-toolbar')
    expect(toolbarComponent.exists()).toBe(true)
  })
  test('renders correcly even if initial display type in queryOutput is invalid', () => {
    const { wrapper } = setup({
      queryOutputProps: {
        initialDisplayType: 'test-display-type',
        queryResponse: responseTestCases[8],
      },
    })
    const toolbarButtons = findByTestAttr(wrapper, 'viz-toolbar-button')
    expect(toolbarButtons.length).toBe(5)
  })
})
