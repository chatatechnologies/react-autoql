import React from 'react'
import { shallow, mount } from 'enzyme'

import { findByTestAttr } from '../../../test/testUtils'
import { QueryOutput } from '../QueryOutput/QueryOutput'
import { Tooltip } from '../Tooltip'
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
    expect(toolbarButtons.length).toBe(4)
  })
})

describe('tooltip rendering', () => {
  test('renders Tooltip in normal render() path', () => {
    const { wrapper } = setup({
      queryOutputProps: {
        queryResponse: responseTestCases[8],
      },
    })
    const tooltip = wrapper.find(Tooltip)
    expect(tooltip.exists()).toBe(true)
    expect(tooltip.prop('delayShow')).toBe(800)
  })

  test('renders Tooltip in compact renderCompact() path', () => {
    const { wrapper } = setup({
      props: { compact: true },
      queryOutputProps: {
        queryResponse: responseTestCases[8],
      },
    })
    const tooltip = wrapper.find(Tooltip)
    expect(tooltip.exists()).toBe(true)
    expect(tooltip.prop('delayShow')).toBe(800)
  })

  test('does not render local Tooltip when parent tooltipID is provided in normal render path', () => {
    const parentTooltipID = 'parent-viz-toolbar-tooltip'
    const { wrapper } = setup({
      props: { tooltipID: parentTooltipID },
      queryOutputProps: {
        queryResponse: responseTestCases[8],
      },
    })
    const tooltip = wrapper.find(Tooltip)
    expect(tooltip.exists()).toBe(false)
  })

  test('does not render local Tooltip when parent tooltipID is provided in renderCompact() path', () => {
    const parentTooltipID = 'parent-viz-toolbar-tooltip-compact'
    const { wrapper } = setup({
      props: { compact: true, tooltipID: parentTooltipID },
      queryOutputProps: {
        queryResponse: responseTestCases[8],
      },
    })
    const tooltip = wrapper.find(Tooltip)
    expect(tooltip.exists()).toBe(false)
  })

  test('uses default tooltip ID when parent tooltipID is not provided', () => {
    const { wrapper } = setup({
      queryOutputProps: {
        queryResponse: responseTestCases[8],
      },
    })
    const tooltip = wrapper.find(Tooltip)
    const tooltipId = tooltip.prop('tooltipId')
    // Should match the default pattern
    expect(tooltipId).toMatch(/react-autoql-viz-toolbar-tooltip-/)
  })

  test('passes tooltipID to all buttons', () => {
    const parentTooltipID = 'parent-tooltip-for-viz-buttons'
    const { wrapper } = setup({
      props: { tooltipID: parentTooltipID },
      queryOutputProps: {
        queryResponse: responseTestCases[8],
      },
    })
    // Get all buttons in the toolbar
    const buttons = wrapper.find('Button')
    // Each button should have the parent tooltipID
    buttons.forEach((button) => {
      const buttonTooltipID = button.prop('tooltipID')
      expect(buttonTooltipID).toBe(parentTooltipID)
    })
  })

  test('prevents duplicate tooltips in drilldown scenario (Nikki Moore issue)', () => {
    // This test simulates the drilldown modal scenario where both OptionsToolbar
    // and VizToolbar are rendered in the same modal, sharing a parent tooltipID
    const sharedDrilldownTooltipID = 'shared-drilldown-viz-tooltip'

    const { wrapper: vizWrapper } = setup({
      props: { tooltipID: sharedDrilldownTooltipID },
      queryOutputProps: { queryResponse: responseTestCases[8] },
    })

    expect(vizWrapper.find(Tooltip).exists()).toBe(false)

    // Verify both render paths use the same ID when parent prop is provided
    const { wrapper: compactWrapper } = setup({
      props: { compact: true, tooltipID: sharedDrilldownTooltipID },
      queryOutputProps: { queryResponse: responseTestCases[8] },
    })

    expect(compactWrapper.find(Tooltip).exists()).toBe(false)

    // Buttons should still consume the shared parent tooltip ID
    vizWrapper.find('Button').forEach((button) => {
      expect(button.prop('tooltipID')).toBe(sharedDrilldownTooltipID)
    })
    compactWrapper.find('Button').forEach((button) => {
      expect(button.prop('tooltipID')).toBe(sharedDrilldownTooltipID)
    })
  })
})
