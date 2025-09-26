import React from 'react'
import { shallow, mount } from 'enzyme'
import _cloneDeep from 'lodash.clonedeep'
import { findByTestAttr } from '../../../test/testUtils'
import { QueryOutput } from '../..'
import { QueryOutput as QueryOutputWithoutTheme } from '../../components/QueryOutput/QueryOutput'
import testCases from '../../../test/responseTestCases'

const defaultProps = QueryOutput.defaultProps

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<QueryOutput {...setupProps} />).dive()
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('test each response case', () => {
  for (let i = 0; i < testCases.length; i++) {
    describe(`renders correctly: response index ${i}`, () => {
      test('renders correctly with only token prop', () => {
        const wrapper = shallow(<QueryOutput queryResponse={testCases[i]} />).dive()
        const responseComponent = findByTestAttr(wrapper, 'query-response-wrapper')
        expect(responseComponent.exists()).toBe(true)
      })
      test(`renders correctly with default props: response index ${i}`, () => {
        const wrapper = setup({
          queryResponse: testCases[i],
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

describe('supported display types', () => {
  test('support charts even for 1 row of data', async () => {
    const queryResponse = _cloneDeep(testCases[8])
    queryResponse.data.data.rows = [queryResponse?.data?.data?.rows[0]]
    const queryOutput = mount(<QueryOutputWithoutTheme queryResponse={queryResponse} />)
    const supportedDisplayTypes = queryOutput.instance().getCurrentSupportedDisplayTypes()
    expect(supportedDisplayTypes).toEqual(['table', 'column', 'bar'])
    queryOutput.unmount()
  })
})

describe('test table edge cases', () => {
  describe('all columns initially hidden then visibility changed', () => {
    const testCaseHiddenColumns = _cloneDeep(testCases[8])
    testCaseHiddenColumns.data.data.columns = testCaseHiddenColumns.data.data.columns.map((column) => {
      return {
        ...column,
        is_visible: false,
      }
    })
    test('columns hidden message shows when all columns are hidden', () => {
      const queryOutput = mount(<QueryOutput queryResponse={testCaseHiddenColumns} initialDisplayType='text' />)

      const hiddenColMessage = findByTestAttr(queryOutput, 'columns-hidden-message')
      expect(hiddenColMessage.exists()).toBe(true)
      queryOutput.unmount()
    })
    describe('display type is updated when column visibility is changed', () => {
      const queryOutputVisible = mount(<QueryOutput queryResponse={testCaseHiddenColumns} />)

      test('display type is text if all columns hidden', () => {
        const displayType = queryOutputVisible.find(QueryOutputWithoutTheme).instance().state.displayType

        expect(displayType).toBe('text')
      })

      test('display type is table after columns are unhidden', () => {
        const newColumns = _cloneDeep(testCases[8].data.data.columns)

        queryOutputVisible.find(QueryOutputWithoutTheme).instance().updateColumns(newColumns)

        const displayType = queryOutputVisible.find(QueryOutputWithoutTheme).instance().state.displayType

        queryOutputVisible.unmount()
        expect(displayType).toBe('table')
      })
    })
  })
})
