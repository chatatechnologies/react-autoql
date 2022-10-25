import React from 'react'
import { shallow, render, mount, html } from 'enzyme'

import { findByTestAttr, ignoreConsoleErrors } from '../../../test/testUtils'
import Steps from './Steps'
import { currentEventLoopEnd } from '../../js/Util'

const defaultProps = {
  steps: [{}, {}],
}

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<Steps {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders correctly with required props', () => {
    const wrapper = setup()
    const stepsComponent = findByTestAttr(wrapper, 'react-autoql-steps')
    expect(stepsComponent.exists()).toBe(true)
  })

  test('renders nothing if no steps are provided', () => {
    ignoreConsoleErrors(() => {
      const wrapper = setup({ steps: undefined })
      const stepsComponent = findByTestAttr(wrapper, 'react-autoql-steps')
      expect(stepsComponent.exists()).toBe(false)
    })
  })

  test('renders nothing if steps array is empty', () => {
    ignoreConsoleErrors(() => {
      const wrapper = setup({ steps: [] })
      const stepsComponent = findByTestAttr(wrapper, 'react-autoql-steps')
      expect(stepsComponent.exists()).toBe(false)
    })
  })

  test('does not use activeStep prop if its invalid', () => {
    ignoreConsoleErrors(async () => {
      const wrapper = setup({ initialActiveStep: 'invalidStep' })
      wrapper.update()
      await currentEventLoopEnd()
      expect(wrapper.state(['activeStep'])).toBe(0)
    })
  })

  test('sets activeStep if prop is provided and valid', () => {
    const wrapper = setup({ initialActiveStep: 1 })
    expect(wrapper.state(['activeStep'])).toBe(1)
  })

  test('increments step when nextStep is called', () => {
    const wrapper = setup()
    wrapper.instance().nextStep()
    expect(wrapper.state(['activeStep'])).toBe(1)
  })

  test('changes active step when title is clicked', () => {
    const wrapper = setup()
    const secondStepTitleElement = findByTestAttr(wrapper, 'react-autoql-step-title-1')
    secondStepTitleElement.simulate('click')
    expect(wrapper.state(['activeStep'])).toBe(1)
  })

  test('onStepClick prop is called when step is clicked', () => {
    const onClick = jest.fn()
    const wrapper = setup({ steps: [{ onClick }, { onClick }] })
    const secondStepTitleElement = findByTestAttr(wrapper, 'react-autoql-step-title-1')
    secondStepTitleElement.simulate('click')
    expect(onClick).toHaveBeenCalled()
  })

  test('first step content is visible by default when collapsible is true', () => {
    const wrapper = setup({ collapsible: true })
    const stepContainer = findByTestAttr(wrapper, 'react-autoql-step-container-0')
    expect(stepContainer.hasClass('active')).toBe(true)
  })

  test('first step content does not have active class if collapsible is false', () => {
    const wrapper = setup({ collapsible: false })
    const stepContainer = findByTestAttr(wrapper, 'react-autoql-step-container-0')
    expect(stepContainer.hasClass('active')).toBe(false)
  })

  test('collapses on click when prop is set to true', () => {
    const wrapper = setup({ collapsible: true, steps: [{ complete: true }, { complete: true }, { complete: true }] })
    const secondStepTitleElement = findByTestAttr(wrapper, 'react-autoql-step-title-1')
    secondStepTitleElement.simulate('click')
    const stepContainer = findByTestAttr(wrapper, 'react-autoql-step-container-0')
    expect(stepContainer.hasClass('active')).toBe(false)
  })
})
