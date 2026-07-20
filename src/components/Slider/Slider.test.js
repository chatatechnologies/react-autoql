import React from 'react'
import { shallow } from 'enzyme'
import Slider from './Slider'

const setup = (props = {}) => {
  return shallow(<Slider {...props} />)
}

describe('Slider', () => {
  describe('rendering', () => {
    test('renders without crashing', () => {
      const wrapper = setup()
      expect(wrapper.find('.react-autoql-slider-wrapper').exists()).toBe(true)
    })

    test('renders min and max labels when provided', () => {
      const wrapper = setup({ minLabel: 'Low', maxLabel: 'High' })
      const labels = wrapper.find('.react-autoql-slider-mark-label')
      expect(labels.at(0).text()).toBe('Low')
      expect(labels.at(1).text()).toBe('High')
    })

    test('falls back to min/max numbers when labels not provided', () => {
      const wrapper = setup({ min: 5, max: 95 })
      const labels = wrapper.find('.react-autoql-slider-mark-label')
      expect(labels.at(0).text()).toBe('5')
      expect(labels.at(1).text()).toBe('95')
    })

    test('renders label text when label prop provided', () => {
      const wrapper = setup({ label: 'Volume' })
      expect(wrapper.find('#react-autoql-slider-label').text()).toBe('Volume')
    })

    test('does not render input by default', () => {
      const wrapper = setup()
      expect(wrapper.find('.react-autoql-slider-input-wrapper').exists()).toBe(false)
    })

    test('renders input when showInput=true', () => {
      const wrapper = setup({ showInput: true, initialValue: 50 })
      expect(wrapper.find('.react-autoql-slider-input-wrapper').exists()).toBe(true)
    })
  })

  describe('state', () => {
    test('initializes state from initialValue', () => {
      const wrapper = setup({ initialValue: 42 })
      const instance = wrapper.instance()
      expect(instance.state.value).toBe(42)
      expect(instance.state.inputValue).toBe(42)
    })

    test('onSliderChange updates value and inputValue', () => {
      const wrapper = setup()
      const instance = wrapper.instance()
      instance.onSliderChange(75)
      expect(instance.state.value).toBe(75)
      expect(instance.state.inputValue).toBe(75)
    })

    test('onInputChange with valid value updates both value and inputValue', () => {
      const wrapper = setup({ min: 0, max: 100, initialValue: 50 })
      const instance = wrapper.instance()
      instance.onInputChange({ target: { value: '80' } })
      expect(instance.state.value).toBe(80)
      expect(instance.state.inputValue).toBe('80')
    })

    test('onInputChange with value below min does not update value', () => {
      const wrapper = setup({ min: 0, max: 100, initialValue: 50 })
      const instance = wrapper.instance()
      instance.onInputChange({ target: { value: '-5' } })
      expect(instance.state.value).toBe(50)
    })

    test('onInputChange with value above max does not update value', () => {
      const wrapper = setup({ min: 0, max: 100, initialValue: 50 })
      const instance = wrapper.instance()
      instance.onInputChange({ target: { value: '150' } })
      expect(instance.state.value).toBe(50)
    })

    test('onInputBlur resets inputValue to current value when mismatched', () => {
      const wrapper = setup({ min: 0, max: 100, initialValue: 50 })
      const instance = wrapper.instance()
      instance.setState({ value: 50, inputValue: '200' })
      instance.onInputBlur()
      expect(instance.state.inputValue).toBe(50)
    })
  })

  describe('onChange callback', () => {
    test('calls onChange immediately when throttle=false and debounce=false', () => {
      const onChange = jest.fn()
      const wrapper = setup({ onChange, throttle: false, debounce: false, initialValue: 10 })
      wrapper.instance().onSliderChange(20)
      wrapper.update()
      expect(onChange).toHaveBeenCalledWith(20)
    })
  })
})
