import React from 'react'
import { mount } from 'enzyme'
import StringAxisSelector from './StringAxisSelector'
import sampleProps from '../chartTestData'
import { findByTestAttr } from '../../../../test/testUtils'

const pivotSampleProps = sampleProps.pivot
const defaultProps = StringAxisSelector.defaultProps

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = mount(
    <svg width='300px' height='300px'>
      <StringAxisSelector {...setupProps}>
        <div data-test='string-axis-selector'>test</div>
      </StringAxisSelector>
    </svg>,
  )
  return wrapper
}

describe('renders correctly', () => {
  test('renders string axis selector if string column provided', () => {
    const wrapper = setup(pivotSampleProps)
    const stringSelector = findByTestAttr(wrapper, 'string-axis-selector')
    expect(stringSelector.exists()).toBe(true)
  })
})

describe('behavior', () => {
  test('calls changeLegendColumnIndex when useLegendHandler is true', () => {
    const changeLegend = jest.fn()
    const changeString = jest.fn()
    const closeSelector = jest.fn()

    const columns = [
      { display_name: 'A', is_visible: true, groupable: true, isStringType: true, index: 0 },
      { display_name: 'B', is_visible: true, groupable: true, isStringType: true, index: 1 },
    ]

    const props = {
      columns,
      numberColumnIndices: [],
      hasSecondAxis: false,
      dateColumnsOnly: false,
      hidden: false,
      isOpen: true,
      popoverParentElement: null,
      positions: ['bottom'],
      align: 'center',
      scale: { column: { index: 0 } },
      closeSelector,
      changeLegendColumnIndex: changeLegend,
      changeStringColumnIndex: changeString,
      useLegendHandler: true,
      axisSelectorRef: () => {},
      chartContainerRef: { clientHeight: 500 },
    }

    const wrapper = mount(
      <svg width='300px' height='300px'>
        <StringAxisSelector {...props}>
          <div data-test='string-axis-selector'>test</div>
        </StringAxisSelector>
      </svg>,
    )

    const instance = wrapper.find(StringAxisSelector).instance()
    const content = instance.renderSelectorContent({})
    const mountedContent = mount(content)

    const firstItem = mountedContent.find('li.string-select-list-item').first()
    firstItem.simulate('click')

    expect(closeSelector).toHaveBeenCalled()
    expect(changeLegend).toHaveBeenCalledWith(0)
    expect(changeString).not.toHaveBeenCalled()
  })
})
