import React from 'react'
import { shallow, mount } from 'enzyme'
import _cloneDeep from 'lodash.clonedeep'
import { findByTestAttr } from '../../../test/testUtils'
import { QueryOutput } from '../..'
import testCases from '../../../test/responseTestCases'

const defaultProps = QueryOutput.defaultProps

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
        const wrapper = shallow(<QueryOutput queryResponse={testCases[i]} />)
        const responseComponent = findByTestAttr(
          wrapper,
          'query-response-wrapper'
        )
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

describe('test table edge cases', () => {
  describe('all columns initially hidden then visibility changed', () => {
    test('columns hidden message shows when all columns are hidden', () => {
      const testCaseHiddenColumns = _cloneDeep(testCases[8])
      testCaseHiddenColumns.data.data.columns = testCaseHiddenColumns.data.data.columns.map(
        (column) => {
          return {
            ...column,
            is_visible: false,
          }
        }
      )

      const queryOutput = mount(
        <QueryOutput queryResponse={testCaseHiddenColumns} displayType="text" />
      )

      const hiddenColMessage = findByTestAttr(
        queryOutput,
        'columns-hidden-message'
      )
      expect(hiddenColMessage.exists()).toBe(true)
      queryOutput.unmount()
    })
    test('column headers are visible when column visibility is updated', () => {
      const queryOutputVisible = mount(
        <QueryOutput queryResponse={testCases[8]} displayType="table" />
      )
      const idBeforeUpdate = queryOutputVisible.instance().tableID

      const newColumns = _cloneDeep(testCases[8].data.data.columns)
      newColumns[0].is_visible = false
      queryOutputVisible.instance().updateColumns(newColumns)
      const idAfterUpdate = queryOutputVisible.instance().tableID

      const didIdChange =
        idBeforeUpdate && idAfterUpdate && idBeforeUpdate !== idAfterUpdate

      queryOutputVisible.unmount()
      expect(didIdChange).toBe(true)
    })
  })
})
