import React from 'react'
import { shallow, mount } from 'enzyme'
import renderer from 'react-test-renderer'

import { findByTestAttr, checkProps } from '../../../test/testUtils'
import { QueryOutput } from '../..'
import testCases from './responseTestCases'

const defaultProps = {
  supportedDisplayTypes: [],
  supportsSuggestions: true,
  isQueryRunning: false,
  tableBorderColor: undefined,
  displayType: undefined,
  queryInputRef: undefined,
  onSuggestionClick: undefined,
  processDrilldown: () => {},
}

const createMockResponse = responseBody => {
  return {
    data: responseBody,
  }
}

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<QueryOutput {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('test each response case', () => {
  for (let i = 0; i < testCases.length; i++) {
    describe(`renders correctly: response index ${i}`, () => {
      test('renders correctly with only token prop', () => {
        const wrapper = shallow(
          <QueryOutput response={createMockResponse(testCases[i])} />
        )
        const responseComponent = findByTestAttr(
          wrapper,
          'query-response-wrapper'
        )
        expect(responseComponent.exists()).toBe(true)
      })
      test(`renders correctly with default props: response index ${i}`, () => {
        const wrapper = setup({
          response: createMockResponse(testCases[i]),
        })
        expect(wrapper.exists()).toBe(true)
      })
    })

    // describe('props', () => {
    //   test('does not throw warning with expected props', () => {
    //     checkProps(QueryOutput, defaultProps)
    //   })
    //   describe('showMask', () => {
    //     test('showMask false does not show mask on drawer open', () => {})
    //     test('showMask true shows mask on drawer open', () => {})
    //   })
    // })
  }
})
