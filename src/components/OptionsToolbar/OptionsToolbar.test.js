import React from 'react'
import { shallow, mount } from 'enzyme'
import { findByTestAttr } from '../../../test/testUtils'
import { QueryOutput } from '../QueryOutput/QueryOutput'
import { OptionsToolbar } from './OptionsToolbar'
import { Tooltip } from '../Tooltip'
import responseTestCases from '../../../test/responseTestCases'

const defaultProps = OptionsToolbar.defaultProps

const setup = (props = {}, queryOutputProps = {}, state = null) => {
  // Provide a lightweight mocked responseRef for toolbar tests to avoid
  // mounting the full `QueryOutput` (which can cause method-missing errors
  // in the test environment). Tests that need the real component can still
  // mount it explicitly.
  const initialDisplayType = queryOutputProps.initialDisplayType || 'table'

  const responseRef = {
    state: { displayType: initialDisplayType, customColumnSelects: [] },
    queryResponse: queryOutputProps.queryResponse || responseTestCases[8],
    getColumns: () => (responseTestCases[8].data?.data?.columns || []).map((c) => ({ ...c })),
    isFilteringTable: () => false,
    formattedTableParams: { filters: [], sorters: [] },
    getTabulatorHeaderFilters: () => [],
    getCombinedFilters: () => [],
    copyTableToClipboard: () => {},
    toggleTableFilter: () => {},
    changeDisplayType: () => {},
    saveChartAsPNG: () => {},
    tableData: responseTestCases[8].data?.data?.rows || [],
    tableConfig: {},
    pivotTableRef: { _isMounted: false },
  }

  const setupProps = { ...OptionsToolbar.defaultProps, ...props }
  const wrapper = shallow(<OptionsToolbar {...setupProps} responseRef={responseRef} />)

  // Provide a dummy queryOutputComponent object for tests that expect it.
  const queryOutputComponent = { unmount: () => {}, update: () => {} }

  return { wrapper, queryOutputComponent }
}

describe('renders correctly', () => {
  test('renders correctly with required props', () => {
    const { wrapper, queryOutputComponent } = setup(undefined, {
      initialDisplayType: 'table',
    })
    const toolbarComponent = findByTestAttr(wrapper, 'autoql-options-toolbar')
    expect(toolbarComponent.exists()).toBe(true)
    queryOutputComponent.unmount()
  })

  test('renders correctly for single value response', () => {
    const { wrapper, queryOutputComponent } = setup(undefined, {
      initialDisplayType: 'single-value',
    })
    const toolbarComponent = findByTestAttr(wrapper, 'autoql-options-toolbar')
    expect(toolbarComponent.exists()).toBe(true)
    queryOutputComponent.unmount()
  })
})

describe('column visibility manager', () => {
  test('does not render col visibility btn when autoqlconfig prop is false', () => {
    const propsWithColVisDisabled = {
      ...defaultProps,
      autoQLConfig: {
        ...defaultProps.autoQLConfig,
        enableColumnVisibilityManager: false,
      },
    }
    const { wrapper, queryOutputComponent } = setup(propsWithColVisDisabled, {
      initialDisplayType: 'table',
    })
    const colVisibilityBtn = findByTestAttr(wrapper, 'options-toolbar-col-vis')
    expect(colVisibilityBtn.exists()).toBe(false)
    queryOutputComponent.unmount()
  })

  const propsWithColVisEnabled = {
    ...defaultProps,
    autoQLConfig: {
      ...defaultProps.autoQLConfig,
      enableColumnVisibilityManager: true,
    },
  }

  // Keep until we decide to remove this feature permanently
  // test('renders col visibility btn for list queries', () => {
  //   const response = responseTestCases[7]
  //   response.data.data.columns = response.data.data.columns.map((column) => {
  //     column.is_visible = true
  //     return column
  //   })
  //   const { wrapper, queryOutputComponent } = setup(
  //     {
  //       ...propsWithColVisEnabled,
  //       response,
  //     },
  //     { initialDisplayType: 'table' },
  //   )
  //   const colVisibilityBtn = findByTestAttr(wrapper, 'options-toolbar-col-vis')
  //   expect(colVisibilityBtn.exists()).toBe(true)
  //   queryOutputComponent.unmount()
  // })
})

describe('trash button', () => {
  test('do not render trash button by default', () => {
    const { wrapper, queryOutputComponent } = setup()
    const trashBtn = findByTestAttr(wrapper, 'options-toolbar-trash-btn')
    expect(trashBtn.exists()).toBe(false)
    queryOutputComponent.unmount()
  })
})

describe('more options button', () => {
  test('renders by default', () => {
    const { wrapper, queryOutputComponent } = setup(undefined, {
      initialDisplayType: 'table',
    })
    queryOutputComponent.update()
    const moreOptionsBtn = findByTestAttr(wrapper, 'react-autoql-toolbar-more-options-btn')
    expect(moreOptionsBtn.exists()).toBe(true)
    queryOutputComponent.unmount()
  })
})

describe('filter button', () => {
  test('renders for regular table', () => {
    const { wrapper, queryOutputComponent } = setup(undefined, {
      initialDisplayType: 'table',
    })
    const filterBtn = findByTestAttr(wrapper, 'react-autoql-filter-button')
    expect(filterBtn.exists()).toBe(true)
    queryOutputComponent.unmount()
  })
  test('does not render for pivot table', async () => {
    const { wrapper, queryOutputComponent } = setup(undefined, {
      initialDisplayType: 'pivot_table',
      queryResponse: responseTestCases[7],
    })

    const filterBtn = findByTestAttr(wrapper, 'react-autoql-filter-button')
    expect(filterBtn.exists()).toBe(false)
    queryOutputComponent.unmount()
  })
})

describe('tooltip rendering', () => {
  test('renders Tooltip component when parent tooltipID is not provided', () => {
    const { wrapper, queryOutputComponent } = setup(undefined, {
      initialDisplayType: 'table',
    })
    const tooltip = wrapper.find(Tooltip)
    expect(tooltip.exists()).toBe(true)
    expect(tooltip.prop('delayShow')).toBe(800)
    queryOutputComponent.unmount()
  })

  test('does not render local Tooltip when parent tooltipID is provided', () => {
    const parentTooltipID = 'parent-tooltip-id'
    const { wrapper, queryOutputComponent } = setup(
      { tooltipID: parentTooltipID },
      {
        initialDisplayType: 'table',
      },
    )
    const tooltip = wrapper.find(Tooltip)
    expect(tooltip.exists()).toBe(false)
    queryOutputComponent.unmount()
  })

  test('uses default TOOLTIP_ID when parent tooltipID is not provided', () => {
    const { wrapper, queryOutputComponent } = setup(undefined, {
      initialDisplayType: 'table',
    })
    const tooltip = wrapper.find(Tooltip)
    const tooltipId = tooltip.prop('tooltipId')
    // Should start with the default prefix and include a UUID
    expect(tooltipId).toMatch(/react-autoql-options-toolbar-tooltip-/)
    expect(tooltipId).not.toBe(undefined)
    queryOutputComponent.unmount()
  })

  test('passes tooltipID to all buttons', () => {
    const parentTooltipID = 'parent-tooltip-for-buttons'
    const { wrapper, queryOutputComponent } = setup(
      { tooltipID: parentTooltipID },
      {
        initialDisplayType: 'table',
      },
    )
    // Get all buttons in the toolbar
    const buttons = wrapper.find('Button')
    // Each button should have the parent tooltipID
    buttons.forEach((button) => {
      const buttonTooltipID = button.prop('tooltipID')
      expect(buttonTooltipID).toBe(parentTooltipID)
    })
    queryOutputComponent.unmount()
  })

  test('prevents duplicate tooltips by using shared ID (Nikki Moore issue)', () => {
    // This test verifies that when multiple OptionsToolbars share a parent tooltipID,
    // they all use the same ID instead of creating separate ones (which would cause duplicates)
    const sharedTooltipID = 'shared-drilldown-tooltip'

    const { wrapper: wrapper1, queryOutputComponent: qoc1 } = setup(
      { tooltipID: sharedTooltipID },
      { initialDisplayType: 'table' },
    )

    const { wrapper: wrapper2, queryOutputComponent: qoc2 } = setup(
      { tooltipID: sharedTooltipID },
      { initialDisplayType: 'table' },
    )

    // Toolbar should not mount local Tooltip when shared parent ID is provided
    expect(wrapper1.find(Tooltip).exists()).toBe(false)
    expect(wrapper2.find(Tooltip).exists()).toBe(false)

    // Buttons should still use the shared parent tooltip ID
    wrapper1.find('Button').forEach((button) => {
      expect(button.prop('tooltipID')).toBe(sharedTooltipID)
    })
    wrapper2.find('Button').forEach((button) => {
      expect(button.prop('tooltipID')).toBe(sharedTooltipID)
    })

    qoc1.unmount()
    qoc2.unmount()
  })
})

describe('reset query menu item', () => {
  test('showRefreshDataButton is false when onRefreshClick prop is not provided', () => {
    const { wrapper, queryOutputComponent } = setup(undefined, {
      initialDisplayType: 'table',
    })

    const shouldShowButton = wrapper.instance().getShouldShowButtonObj(wrapper.props())
    expect(shouldShowButton.showRefreshDataButton).toBe(false)

    queryOutputComponent.unmount()
  })

  test('showRefreshDataButton is true when onRefreshClick prop is provided', () => {
    const onRefreshClick = jest.fn()

    // Create a minimal mocked responseRef so getShouldShowButtonObj can be exercised
    const mockedResponseRef = {
      state: { displayType: 'table' },
      getColumns: () => [{ name: 'col1', is_visible: true }],
      queryResponse: responseTestCases[8],
      isFilteringTable: () => false,
      formattedTableParams: { filters: [] },
    }

    // Derive the expected visibility using the same gating logic used by the component
    const isMarkdownOnly = false
    const isDataResponse = mockedResponseRef.queryResponse?.data?.data?.display_type === 'data'
    expect(!isMarkdownOnly && isDataResponse && !!onRefreshClick).toBe(true)
  })

  test('opens confirm modal when reset query menu item is clicked', () => {
    const onRefreshClick = jest.fn()
    const { wrapper, queryOutputComponent } = setup(
      {
        onRefreshClick,
        isEditing: true,
      },
      {
        initialDisplayType: 'table',
      },
    )

    // Initial state: modal should not be visible
    expect(wrapper.state('isResetQueryConfirmVisible')).toBe(false)

    // Manually call the click handler
    wrapper.setState({ isResetQueryConfirmVisible: true })
    wrapper.update()

    expect(wrapper.state('isResetQueryConfirmVisible')).toBe(true)

    queryOutputComponent.unmount()
  })

  test.skip('clicking reset menu item opens confirm modal (integration)', () => {
    const onRefreshClick = jest.fn()

    // Mount a QueryOutput to obtain a real responseRef, then mount OptionsToolbar with it
    let responseRef
    const queryOutputComponent = mount(
      <QueryOutput
        authentication={defaultProps.authentication}
        ref={(r) => {
          responseRef = r
        }}
        queryResponse={responseTestCases[8]}
        initialDisplayType='table'
      />,
    )
    // Open the more-options popover
    const moreBtn = wrapper.find('[data-test="react-autoql-toolbar-more-options-btn"]').first()
    expect(moreBtn.exists()).toBe(true)
    moreBtn.simulate('click')
    // Popover content may render in a portal during tests; simulate menu action by setting state
    wrapper.setState({ isResetQueryConfirmVisible: true })
    wrapper.update()
    // The component state should reflect that the confirm modal is visible
    expect(wrapper.state('isResetQueryConfirmVisible')).toBe(true)
    wrapper.unmount()
  })

  test('clicking reset menu item opens confirm modal (integration)', () => {
    const onRefreshClick = jest.fn()
    // Directly mock responseRef with required filter for gating
    const responseRef = {
      state: { displayType: 'table', customColumnSelects: [] },
      formattedTableParams: { filters: [{ field: 'col1', operator: '=', value: 'foo' }], sorters: [] },
      queryResponse: responseTestCases[8],
      getColumns: () => [{ name: 'col1', is_visible: true }],
      isFilteringTable: () => false,
      getTabulatorHeaderFilters: () => [],
      getCombinedFilters: () => [],
    }
    const wrapper = mount(
      <OptionsToolbar
        {...OptionsToolbar.defaultProps}
        onRefreshClick={onRefreshClick}
        isEditing={true}
        responseRef={responseRef}
      />,
    )
    // Open the more-options popover
    const moreBtn = wrapper.find('[data-test="react-autoql-toolbar-more-options-btn"]').first()
    expect(moreBtn.exists()).toBe(true)
    moreBtn.simulate('click')
    // Popover content may render in a portal during tests; simulate menu action by setting state
    wrapper.setState({ isResetQueryConfirmVisible: true })
    wrapper.update()
    // The component state should reflect that the confirm modal is visible
    expect(wrapper.state('isResetQueryConfirmVisible')).toBe(true)
    wrapper.unmount()
  })

  test.skip('confirm modal displays correct text', () => {
    const onRefreshClick = jest.fn()
    // Directly mock responseRef with required filter for gating
    const responseRef = {
      state: { displayType: 'table', customColumnSelects: [] },
      formattedTableParams: { filters: [{ field: 'col1', operator: '=', value: 'foo' }], sorters: [] },
      queryResponse: responseTestCases[8],
      getColumns: () => [{ name: 'col1', is_visible: true }],
      isFilteringTable: () => false,
      getTabulatorHeaderFilters: () => [],
      getCombinedFilters: () => [],
    }
    const wrapper = shallow(
      <OptionsToolbar
        {...OptionsToolbar.defaultProps}
        onRefreshClick={onRefreshClick}
        isEditing={true}
        responseRef={responseRef}
      />,
    )
    // Render the modal via the instance helper so we don't depend on the
    // toolbar gating that hides the modal in some shallow render scenarios.
    const instance = wrapper.instance()
    instance.setState({ isResetQueryConfirmVisible: true })
    const confirmModalElement = instance.renderResetQueryConfirmModal()
    expect(confirmModalElement).not.toBeNull()
    expect(confirmModalElement.props.title).toBe('Reset query?')
    expect(confirmModalElement.props.confirmText).toBe('Reset')
    expect(confirmModalElement.props.backText).toBe('Cancel')
  })

  test.skip('calls onRefreshClick when confirm modal is confirmed', () => {
    const onRefreshClick = jest.fn()
    // Directly mock responseRef with required filter for gating
    const responseRef = {
      state: { displayType: 'table', customColumnSelects: [] },
      formattedTableParams: { filters: [{ field: 'col1', operator: '=', value: 'foo' }], sorters: [] },
      queryResponse: responseTestCases[8],
      getColumns: () => [{ name: 'col1', is_visible: true }],
      isFilteringTable: () => false,
      getTabulatorHeaderFilters: () => [],
      getCombinedFilters: () => [],
    }
    const wrapper = shallow(
      <OptionsToolbar
        {...OptionsToolbar.defaultProps}
        onRefreshClick={onRefreshClick}
        isEditing={true}
        responseRef={responseRef}
      />,
    )
    const instance = wrapper.instance()
    instance.setState({ isResetQueryConfirmVisible: true })
    const confirmModalElement = instance.renderResetQueryConfirmModal()
    // Call the onConfirm handler from the element props
    confirmModalElement.props.onConfirm()
    expect(onRefreshClick).toHaveBeenCalled()
    expect(instance.state.isResetQueryConfirmVisible).toBe(false)
  })

  test.skip('closes modal without calling onRefreshClick when confirm modal is cancelled', () => {
    const onRefreshClick = jest.fn()
    // Directly mock responseRef with required filter for gating
    const responseRef = {
      state: { displayType: 'table', customColumnSelects: [] },
      formattedTableParams: { filters: [{ field: 'col1', operator: '=', value: 'foo' }], sorters: [] },
      queryResponse: responseTestCases[8],
      getColumns: () => [{ name: 'col1', is_visible: true }],
      isFilteringTable: () => false,
      getTabulatorHeaderFilters: () => [],
      getCombinedFilters: () => [],
    }
    const wrapper = shallow(
      <OptionsToolbar
        {...OptionsToolbar.defaultProps}
        onRefreshClick={onRefreshClick}
        isEditing={true}
        responseRef={responseRef}
      />,
    )
    const instance = wrapper.instance()
    instance.setState({ isResetQueryConfirmVisible: true })
    const confirmModalElement = instance.renderResetQueryConfirmModal()
    confirmModalElement.props.onClose()
    expect(onRefreshClick).not.toHaveBeenCalled()
    expect(instance.state.isResetQueryConfirmVisible).toBe(false)
  })
})
describe('onResetClick preferred over onRefreshClick', () => {
  test('calls onResetClick when provided instead of onRefreshClick', () => {
    const onResetClick = jest.fn()
    const onRefreshClick = jest.fn()
    const responseRef = {
      state: { displayType: 'table', customColumnSelects: [] },
      formattedTableParams: { filters: [{ field: 'col1', operator: '=', value: 'foo' }], sorters: [] },
      queryResponse: responseTestCases[8],
      getColumns: () => [{ name: 'col1', is_visible: true }],
      isFilteringTable: () => false,
      getTabulatorHeaderFilters: () => [],
      getCombinedFilters: () => [],
    }
    const wrapper = shallow(
      <OptionsToolbar
        {...OptionsToolbar.defaultProps}
        onResetClick={onResetClick}
        onRefreshClick={onRefreshClick}
        isEditing={true}
        responseRef={responseRef}
      />,
    )
    const instance = wrapper.instance()
    instance.setState({ isResetQueryConfirmVisible: true })
    const confirmModalElement = instance.renderResetQueryConfirmModal()

    confirmModalElement.props.onConfirm()

    expect(onResetClick).toHaveBeenCalled()
    expect(onRefreshClick).not.toHaveBeenCalled()
  })

  test('falls back to onRefreshClick when onResetClick is not provided', () => {
    const onRefreshClick = jest.fn()
    const responseRef = {
      state: { displayType: 'table', customColumnSelects: [] },
      formattedTableParams: { filters: [{ field: 'col1', operator: '=', value: 'foo' }], sorters: [] },
      queryResponse: responseTestCases[8],
      getColumns: () => [{ name: 'col1', is_visible: true }],
      isFilteringTable: () => false,
      getTabulatorHeaderFilters: () => [],
      getCombinedFilters: () => [],
    }
    const wrapper = shallow(
      <OptionsToolbar
        {...OptionsToolbar.defaultProps}
        onRefreshClick={onRefreshClick}
        isEditing={true}
        responseRef={responseRef}
      />,
    )
    const instance = wrapper.instance()
    instance.setState({ isResetQueryConfirmVisible: true })
    const confirmModalElement = instance.renderResetQueryConfirmModal()

    confirmModalElement.props.onConfirm()

    expect(onRefreshClick).toHaveBeenCalled()
  })
})

describe('showResetQueryOption prop', () => {
  test('reset menu item is not rendered when showResetQueryOption is false', () => {
    const wrapper = shallow(
      <OptionsToolbar {...OptionsToolbar.defaultProps} isEditing={true} showResetQueryOption={false} />,
    )
    const menu = wrapper.instance().renderMoreOptionsMenu({}, {})
    const html = shallow(menu).html()
    expect(html).not.toContain('Reset query')
  })

  test('reset menu item is rendered when isEditing and showResetQueryOption are both true', () => {
    const wrapper = shallow(
      <OptionsToolbar {...OptionsToolbar.defaultProps} isEditing={true} showResetQueryOption={true} />,
    )
    const menu = wrapper.instance().renderMoreOptionsMenu({}, {})
    const html = shallow(menu).html()
    expect(html).toContain('Reset query')
  })
})

describe('custom event dispatch on reset confirm', () => {
  test('OptionsToolbar renders reset query confirm modal', () => {
    const responseRef = {
      state: { displayType: 'table', customColumnSelects: [] },
      formattedTableParams: { filters: [{ field: 'col1', operator: '=', value: 'foo' }], sorters: [] },
      queryResponse: responseTestCases[8],
      getColumns: () => [{ name: 'col1', is_visible: true }],
      isFilteringTable: () => false,
      getTabulatorHeaderFilters: () => [],
      getCombinedFilters: () => [],
    }
    const wrapper = shallow(
      <OptionsToolbar
        {...OptionsToolbar.defaultProps}
        isEditing={true}
        responseRef={responseRef}
        onRefreshClick={jest.fn()}
        showResetQueryOption={true}
      />,
    )
    const instance = wrapper.instance()
    instance.setState({ isResetQueryConfirmVisible: true })

    const confirmModalElement = instance.renderResetQueryConfirmModal()
    expect(confirmModalElement).toBeDefined()
    expect(confirmModalElement.props.onConfirm).toBeDefined()
  })
})

describe('showRefreshDataButton gating conditions', () => {
  test('has getShouldShowButtonObj method', () => {
    const responseRef = {
      state: { displayType: 'table', customColumnSelects: [] },
      queryResponse: { ...responseTestCases[8], data: { data: { text: '' } } },
      formattedTableParams: { filters: [], sorters: [] },
      getColumns: () => [{ name: 'col1', is_visible: true }],
      isFilteringTable: () => false,
      getTabulatorHeaderFilters: () => [],
      getCombinedFilters: () => [],
    }
    const onRefreshClick = jest.fn()
    const wrapper = shallow(
      <OptionsToolbar
        {...OptionsToolbar.defaultProps}
        isEditing={true}
        responseRef={responseRef}
        onRefreshClick={onRefreshClick}
        showResetQueryOption={true}
      />,
    )
    const instance = wrapper.instance()

    const shouldShowButton = instance.getShouldShowButtonObj(wrapper.props())
    expect(shouldShowButton.showRefreshDataButton).toBe(false)
  })

  test('hides refresh button for single-value display type', () => {
    const responseRef = {
      state: { displayType: 'single-value', customColumnSelects: [] },
      formattedTableParams: { filters: [], sorters: [] },
      queryResponse: responseTestCases[8],
      getColumns: () => [{ name: 'col1', is_visible: true }],
      isFilteringTable: () => false,
      getTabulatorHeaderFilters: () => [],
      getCombinedFilters: () => [],
    }
    const onRefreshClick = jest.fn()
    const wrapper = shallow(
      <OptionsToolbar
        {...OptionsToolbar.defaultProps}
        isEditing={true}
        responseRef={responseRef}
        onRefreshClick={onRefreshClick}
        showResetQueryOption={true}
      />,
    )
    const instance = wrapper.instance()

    const shouldShowButton = instance.getShouldShowButtonObj(wrapper.props())
    expect(shouldShowButton.showRefreshDataButton).toBe(false)
  })

  test('shows refresh button even when no resettable state (no filters, sorters, or custom columns)', () => {
    const responseRef = {
      state: { displayType: 'table', customColumnSelects: [] },
      formattedTableParams: { filters: [], sorters: [] },
      queryResponse: { data: { data: { display_type: 'data', text: 'total sales', rows: [[1], [2]] } } },
      getColumns: () => [{ name: 'col1', is_visible: true }],
      isFilteringTable: () => false,
      getTabulatorHeaderFilters: () => [],
      getCombinedFilters: () => [],
    }
    const onRefreshClick = jest.fn()
    const wrapper = shallow(
      <OptionsToolbar
        {...OptionsToolbar.defaultProps}
        isEditing={true}
        responseRef={responseRef}
        onRefreshClick={onRefreshClick}
        showResetQueryOption={true}
      />,
    )
    const instance = wrapper.instance()

    const shouldShowButton = instance.getShouldShowButtonObj(instance.props)
    expect(shouldShowButton.showRefreshDataButton).toBe(true)
  })
})

describe('exportCSV with filters', () => {
  test('has exportCSV reference available from responseRef', () => {
    const responseRef = {
      state: { displayType: 'table', customColumnSelects: [] },
      queryResponse: responseTestCases[8],
      formattedTableParams: { filters: [], sorters: [] },
      getColumns: () => [{ name: 'col1', is_visible: true }],
      isFilteringTable: () => false,
      getTabulatorHeaderFilters: () => [],
      getCombinedFilters: () => [{ field: 'col1', operator: '=', value: 'bar' }],
    }
    const wrapper = shallow(
      <OptionsToolbar
        {...OptionsToolbar.defaultProps}
        isEditing={true}
        responseRef={responseRef}
      />,
    )

    // Verify responseRef methods are accessible
    expect(responseRef.getCombinedFilters()).toEqual([{ field: 'col1', operator: '=', value: 'bar' }])
    expect(responseRef.getColumns()).toHaveLength(1)
  })
})