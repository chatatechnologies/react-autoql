import React from 'react'
import { shallow } from 'enzyme'

import { findByTestAttr } from '../../../test/testUtils'
import VizToolbar from './VizToolbar'

const defaultProps = {
  onDisplayTypeChange: () => {}
}

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<VizToolbar {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders correctly with valid supportedDisplayTypes and display type', () => {
    const wrapper = setup({
      supportedDisplayTypes: ['bar', 'column', 'line'],
      displayType: 'bar'
    })
    const toolbarComponent = findByTestAttr(wrapper, 'viz-toolbar')
    expect(toolbarComponent.exists()).toBe(true)
  })
  test('does not render if supportedDisplayTypes length is 1', () => {
    const wrapper = setup({
      supportedDisplayTypes: ['bar'],
      displayType: 'bar'
    })
    const toolbarComponent = findByTestAttr(wrapper, 'viz-toolbar')
    expect(toolbarComponent.exists()).toBe(false)
  })
  test('does not render if supportedDisplayTypes length is 0', () => {
    const wrapper = setup({
      supportedDisplayTypes: [],
      displayType: 'bar'
    })
    const toolbarComponent = findByTestAttr(wrapper, 'viz-toolbar')
    expect(toolbarComponent.exists()).toBe(false)
  })
  test('does not render if display type is not in supported display types', () => {
    const wrapper = setup({
      supportedDisplayTypes: ['bar', 'line'],
      displayType: 'something-else'
    })
    const toolbarComponent = findByTestAttr(wrapper, 'viz-toolbar')
    expect(toolbarComponent.exists()).toBe(false)
  })
  test('does not render if display type is not provided', () => {
    const wrapper = setup({
      supportedDisplayTypes: ['table', 'heatmap', 'line'],
      displayType: undefined
    })
    const toolbarComponent = findByTestAttr(wrapper, 'viz-toolbar')
    expect(toolbarComponent.exists()).toBe(false)
  })
  test('does not render button if icon is not available for that display type', () => {
    const wrapper = setup({
      supportedDisplayTypes: [
        'table',
        'heatmap',
        'line',
        'something',
        'nothing',
        'piechartz'
      ],
      displayType: 'table'
    })
    const toolbarButtons = findByTestAttr(wrapper, 'viz-toolbar-button')
    expect(toolbarButtons.length).toBe(2)
  })
})
