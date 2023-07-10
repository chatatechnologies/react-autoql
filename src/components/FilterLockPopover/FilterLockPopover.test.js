import React from 'react'
import { shallow, mount } from 'enzyme'

import { checkProps, findByTestAttr, ignoreConsoleErrors } from '../../../test/testUtils'
import { currentEventLoopEnd } from '../../js/Util'
import FilterLockPopover from './FilterLockPopover'
import FilterLockPopoverContent from './FilterLockPopoverContent'

import * as queryService from '../../js/queryService'
import filterResponse from '../../../test/sampleFiltersResponse.json'
import sampleVLResponse from '../../../test/sampleVLAutocompleteResponse.json'

queryService.fetchFilters = jest.fn().mockResolvedValue(filterResponse)
queryService.unsetFilterFromAPI = jest.fn().mockResolvedValue(filterResponse)
queryService.fetchVLAutocomplete = jest.fn().mockResolvedValue(sampleVLResponse)

const defaultProps = FilterLockPopoverContent.defaultProps
const sampleAuth = {
  apiKey: 'testKey',
  domain: 'http://www.test.com',
  token: 'rand0mtok3n',
}

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, authentication: sampleAuth, ...props }
  const wrapper = mount(<FilterLockPopoverContent {...setupProps} />)

  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('popover container renders correctly', () => {
  test('renders correctly with only token prop', () => {
    ignoreConsoleErrors(async () => {
      const wrapper = await shallow(<FilterLockPopover authentication={{ token: 'token' }} />)
      expect(wrapper.exists()).toBe(true)
    })
  })

  test('renders correctly with default props', () => {
    const wrapper = setup()
    expect(wrapper.exists()).toBe(true)
  })
  test('renders correctly when no children provided', () => {
    const mounted = mount(<FilterLockPopover {...defaultProps} authentication={sampleAuth} />)
    expect(mounted.exists()).toBe(true)
    mounted.unmount()
  })
  test('renders correctly with children', () => {
    const mounted = mount(
      <FilterLockPopover {...defaultProps} authentication={sampleAuth}>
        <button>button!</button>
      </FilterLockPopover>,
    )
    expect(mounted.exists()).toBe(true)
    mounted.unmount()
  })
})

describe('props', () => {
  test('does not throw warning with expected props', () => {
    checkProps(FilterLockPopover, defaultProps)
  })

  describe('isOpen', () => {
    test('renders correctly with isOpen false', () => {
      const wrapper = setup({ isOpen: false })
      expect(wrapper.instance().props.isOpen).toBe(false)
      wrapper.unmount()
    })
    test('renders correctly with isOpen true', () => {
      const wrapper = setup({ isOpen: true })
      expect(wrapper.instance().props.isOpen).toBe(true)
      wrapper.unmount()
    })
  })
})

describe('saving indicator renders when', () => {
  const setupSavingIndicatorTest = () => {
    const wrapper = setup({
      isOpen: true,
      initialFilters: filterResponse.data.data.data,
    })
    const instance = wrapper.instance()
    jest.spyOn(instance, 'showSavingIndicator')
    return { wrapper, instance }
  }

  const getFirstPersistToggle = (wrapper) => {
    const firstFilterInList = findByTestAttr(wrapper, 'react-autoql-filter-list-item').first()
    const persistToggleWrapper = findByTestAttr(firstFilterInList, 'react-autoql-filter-lock-persist-toggle')
    const persistToggle = findByTestAttr(persistToggleWrapper, 'react-autoql-checkbox')
    return persistToggle
  }

  test('filter added', async () => {
    const { wrapper, instance } = setupSavingIndicatorTest()
    await currentEventLoopEnd()
    wrapper.update()
    instance.setFilter({
      key: 'VENDOR_0_DISPLAYNAME_VALUE_LABEL',
      value: 'Organization of Outstanding Events',
      show_message: 'Vendor Name',
      filter_type: 'include',
      lock_flag: 1,
    })
    wrapper.update()
    const savingIndicator = findByTestAttr(wrapper, 'filter-locking-saving-indicator')
    expect(savingIndicator.exists()).toBe(true)
    wrapper.unmount()
  })
  test('filter removed', async () => {
    const { wrapper, instance } = setupSavingIndicatorTest()
    await currentEventLoopEnd() // Wait for componentDidMount to fetch filters
    wrapper.update()

    const deleteBtn = findByTestAttr(wrapper, 'react-autoql-remove-filter-icon').first()
    deleteBtn.simulate('click')
    const savingIndicator = findByTestAttr(wrapper, 'filter-locking-saving-indicator')
    expect(savingIndicator.exists()).toBe(true)
    wrapper.unmount()
  })
  describe('filters updated', () => {
    const { wrapper, instance } = setupSavingIndicatorTest()

    test('showSavingIndicator invoked only once when persist toggled on', async () => {
      await currentEventLoopEnd() // Wait for componentDidMount to fetch filters
      wrapper.update()
      const persistToggle = getFirstPersistToggle(wrapper)
      persistToggle.simulate('change', { target: { checked: false } })
      expect(instance.showSavingIndicator).toHaveBeenCalledTimes(1)
    })
    test('saving indicator rendered when persist toggled on', () => {
      const savingIndicator = findByTestAttr(wrapper, 'filter-locking-saving-indicator')
      expect(savingIndicator.exists()).toBe(true)
      wrapper.setState({ isSaving: false })
    })
    test('showSavingIndicator invoked only once when persist toggled off', async () => {
      const persistToggle = getFirstPersistToggle(wrapper)
      persistToggle.simulate('change', { target: { checked: true } })
      expect(instance.showSavingIndicator).toHaveBeenCalledTimes(2) // 2 times in total now
    })
    test('saving indicator rendered when persist toggled off', () => {
      const savingIndicator = findByTestAttr(wrapper, 'filter-locking-saving-indicator')
      expect(savingIndicator.exists()).toBe(true)
      wrapper.setState({ isSaving: false })
    })
    test('do not show saving indicator if toggle didnt change on click', () => {
      const includeExcludeToggle = findByTestAttr(wrapper, 'include-exclude-toggle-group').first()

      const excludeBtn = includeExcludeToggle.findWhere((node) => {
        return node.hasClass('react-autoql-radio-btn') && node.text() === 'INCLUDE'
      })

      excludeBtn.simulate('click')
      const savingIndicator = findByTestAttr(wrapper, 'filter-locking-saving-indicator')
      expect(savingIndicator.hasClass('hidden')).toBe(true)
    })
    test('show saving indicator when exclude toggled', () => {
      const includeExcludeToggle = findByTestAttr(wrapper, 'include-exclude-toggle-group').first()

      const excludeBtn = includeExcludeToggle.findWhere((node) => {
        return node.hasClass('react-autoql-radio-btn') && node.text() === 'EXCLUDE'
      })

      excludeBtn.simulate('click')
      const savingIndicator = findByTestAttr(wrapper, 'filter-locking-saving-indicator')
      expect(savingIndicator.exists()).toBe(true)
      wrapper.setState({ isSaving: false })
    })
    test('include toggled', async () => {
      const includeExcludeToggle = findByTestAttr(wrapper, 'include-exclude-toggle-group').first()

      const excludeBtn = includeExcludeToggle.findWhere((node) => {
        return node.hasClass('react-autoql-radio-btn') && node.text() === 'INCLUDE'
      })

      excludeBtn.simulate('click')
      const savingIndicator = findByTestAttr(wrapper, 'filter-locking-saving-indicator')
      expect(savingIndicator.exists()).toBe(true)
      wrapper.unmount()
    })
  })
})
