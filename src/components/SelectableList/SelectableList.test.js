import React from 'react'
import { shallow } from 'enzyme'

import { findByTestAttr } from '../../../test/testUtils'
import SelectableList from './SelectableList'

const sampleProps = {
  columns: ['Category', 'Visible'],
  items: [
    { content: 'category 1' },
    { content: 'category 2' },
    { content: 'category 3' },
    { content: 'category 4' },
  ],
}

const setup = (props = {}, state = null) => {
  const setupProps = { ...props }
  const wrapper = shallow(<SelectableList {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('default props', () => {
  test('should have default onChange', () => {
    expect(SelectableList.defaultProps.onChange).toBeDefined()
  })
  test('should have default onSelect', () => {
    expect(SelectableList.defaultProps.onSelect).toBeDefined()
  })
})

describe('renders correctly', () => {
  test('renders correctly with no props', () => {
    const wrapper = setup()
    const listComponent = findByTestAttr(wrapper, 'selectable-list')
    expect(listComponent.exists()).toBe(true)
  })

  describe('renders sample list correctly', () => {
    const wrapper = setup(sampleProps)
    const listComponent = findByTestAttr(wrapper, 'selectable-list')

    test('renders column headers', () => {
      const headers = findByTestAttr(
        listComponent,
        'selectable-list-column-header'
      )
      expect(headers.length).toBe(2)
    })

    test('renders column header checkbox', () => {
      const headerCheckbox = findByTestAttr(
        listComponent,
        'selectable-list-column-header-checkbox'
      )
      expect(headerCheckbox.exists()).toBe(true)
    })

    test('renders row names', () => {
      const rowNames = findByTestAttr(
        listComponent,
        'selectable-list-item-content'
      )
      expect(rowNames.length).toBe(4)
    })

    test('renders item checkboxes', () => {
      const rowCheckboxes = findByTestAttr(
        listComponent,
        'selectable-list-item-checkbox'
      )
      expect(rowCheckboxes.length).toBe(4)
    })
  })
})

test('event does not propagate when user clicks on list', () => {
  const wrapper = setup(sampleProps)
  const mockFn = jest.fn()
  const listComponent = findByTestAttr(wrapper, 'selectable-list')
  listComponent.simulate('click', { stopPropagation: mockFn })
  expect(mockFn).toHaveBeenCalled()
})

describe('selection works as expected', () => {
  test('single click selection works as expected', () => {
    const wrapper = setup(sampleProps)
    const firstItem = findByTestAttr(wrapper, 'selectable-list-item-2')
    firstItem.simulate('click', { stopPropagation: () => {} })
    expect(wrapper.state(['selected'])).toEqual([2])
  })

  describe('multi select with shift works as expected', () => {
    test('regular click then shift click item in forward direction', () => {
      const wrapper = setup(sampleProps)
      const firstItem = findByTestAttr(wrapper, 'selectable-list-item-1')
      firstItem.simulate('click', { stopPropagation: () => {} })
      const secondItem = findByTestAttr(wrapper, 'selectable-list-item-3')
      secondItem.simulate('click', {
        shiftKey: true,
        stopPropagation: () => {},
      })
      expect(wrapper.state(['selected'])).toEqual([1, 2, 3])
    })

    test('regular click then shift click in backwards direction', () => {
      const wrapper = setup(sampleProps)
      const firstItem = findByTestAttr(wrapper, 'selectable-list-item-3')
      firstItem.simulate('click', { stopPropagation: () => {} })
      const secondItem = findByTestAttr(wrapper, 'selectable-list-item-1')
      secondItem.simulate('click', {
        shiftKey: true,
        stopPropagation: () => {},
      })
      expect(wrapper.state(['selected'])).toEqual([1, 2, 3])
    })

    test('shift click as first click', () => {
      const wrapper = setup(sampleProps)
      const firstItem = findByTestAttr(wrapper, 'selectable-list-item-3')
      firstItem.simulate('click', {
        shiftKey: true,
        stopPropagation: () => {},
      })
      expect(wrapper.state(['selected'])).toEqual([3])
    })
  })

  describe('multi select with ctrl works as expected', () => {
    test('select items that were not previously selected', () => {
      const wrapper = setup(sampleProps)
      const firstItem = findByTestAttr(wrapper, 'selectable-list-item-1')
      firstItem.simulate('click', { stopPropagation: () => {} })
      const secondItem = findByTestAttr(wrapper, 'selectable-list-item-3')
      secondItem.simulate('click', {
        ctrlKey: true,
        stopPropagation: () => {},
      })

      expect(wrapper.state(['selected'])).toEqual([1, 3])
    })

    test('unselect item that was previously selected', () => {
      const wrapper = setup(sampleProps)
      const firstItem = findByTestAttr(wrapper, 'selectable-list-item-1')
      firstItem.simulate('click', { stopPropagation: () => {} })
      const secondItem = findByTestAttr(wrapper, 'selectable-list-item-1')
      secondItem.simulate('click', {
        ctrlKey: true,
        stopPropagation: () => {},
      })

      expect(wrapper.state(['selected'])).toEqual([])
    })
  })
})

describe('checkboxes work correctly', () => {
  test('single check works as expected', () => {
    const wrapper = setup(sampleProps, { selected: [] })
    const spy = jest.spyOn(wrapper.instance(), 'onCheckboxChange')

    const item = findByTestAttr(wrapper, 'selectable-list-item-1')
    item
      .find('Checkbox')
      .props()
      .onChange()

    expect(spy).toHaveBeenCalledTimes(1)
  })

  describe('multi check works as expected - partially selected', () => {
    let itemList = sampleProps.items
    const onChangeCallback = jest.fn()
    const wrapper = setup(
      {
        ...sampleProps,
        onChange: onChangeCallback,
      },
      { selected: [0, 2] }
    )

    wrapper
      .instance()
      .onCheckboxChange({ stopPropagation: () => {} }, itemList[0], itemList, 0)

    test('should invoke onChange callback', () => {
      expect(onChangeCallback).toBeCalled()
    })

    test('items were checked', () => {
      const checkedItems = itemList.map((item) => item.checked)
      expect(checkedItems).toEqual([true, undefined, true, undefined])
    })
  })

  describe('multi check works as expected - all unselected', () => {
    let itemList = sampleProps.items.map((item) => ({ ...item, checked: true }))
    const onChangeCallback = jest.fn()
    const wrapper = setup(
      {
        ...sampleProps,
        onChange: onChangeCallback,
      },
      { selected: [0, 1, 2, 3] }
    )
    wrapper
      .instance()
      .onCheckboxChange({ stopPropagation: () => {} }, itemList[0], itemList, 0)

    test('onChange callback was called', () => {
      expect(onChangeCallback).toBeCalled()
    })

    test('items were checked', () => {
      const checkedItems = itemList.map((item) => item.checked)
      expect(checkedItems).toEqual([false, false, false, false])
    })
  })

  describe('select all works', () => {
    let itemList = sampleProps.items
    const wrapper = setup(sampleProps, { selected: [0] })
    const onChangeCallback = jest.fn()

    test('onchange callback is invoked', () => {
      const spy = jest.spyOn(wrapper.instance(), 'onSelectAllCheckboxChange')
      const checkbox = findByTestAttr(wrapper, 'selectable-list-header').find(
        'Checkbox'
      )
      checkbox.props().onChange()
      expect(spy).toHaveBeenCalledTimes(1)
    })

    test('all are checked', () => {
      wrapper
        .instance()
        .onSelectAllCheckboxChange({ stopPropagation: () => {} }, itemList)

      const checkedItems = itemList.map((item) => item.checked)
      expect(checkedItems).toEqual([true, true, true, true])
    })
  })

  describe('deselect all works', () => {
    test('all are unchecked if all are already currently checked', () => {
      let itemList = sampleProps.items.map((item) => ({
        ...item,
        checked: true,
      }))
      const wrapper = setup(sampleProps)
      wrapper
        .instance()
        .onSelectAllCheckboxChange({ stopPropagation: () => {} }, itemList)

      const checkedItems = itemList.map((item) => item.checked)
      expect(checkedItems).toEqual([false, false, false, false])
    })

    test('unselect all class method works', () => {
      const wrapper = setup(sampleProps, { selected: [0, 2, 3] })
      wrapper.instance().unselectAll()
      expect(wrapper.state(['selected'])).toEqual([])
    })
  })
})
