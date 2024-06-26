import React from 'react'
import { shallow } from 'enzyme'

import { findByTestAttr } from '../../../test/testUtils'
import SpeechToTextButton from './SpeechToTextButton'

const defaultProps = {}

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<SpeechToTextButton {...setupProps} />).dive()
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders correctly with required props', () => {
    const wrapper = setup({ browserSupportsSpeechRecognition: true })
    const speechToTextButtonComponent = findByTestAttr(wrapper, 'speech-to-text-btn')
    expect(speechToTextButtonComponent.exists()).toBe(true)
  })
})
