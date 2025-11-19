import React from 'react'
import { shallow, mount } from 'enzyme'
import { findByTestAttr } from '../../../test/testUtils'
import { QueryOutput } from '../QueryOutput/QueryOutput'
import { OptionsToolbar } from './OptionsToolbar'
import responseTestCases from '../../../test/responseTestCases'

const defaultProps = OptionsToolbar.defaultProps

const setup = (props = {}, queryOutputProps = {}, state = null) => {
  // Create a query output component from the sample response,
  // then pass that into the toolbar component
  let responseRef
  const queryOutputComponent = mount(
    <QueryOutput
      authentication={defaultProps.authentication}
      ref={(r) => {
        responseRef = r
      }}
      queryResponse={responseTestCases[8]}
      {...queryOutputProps}
    />,
  )

  const setupProps = { ...OptionsToolbar.defaultProps, ...props }
  const wrapper = shallow(<OptionsToolbar {...setupProps} responseRef={responseRef} />)

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

describe('filter badge rendering', () => {
  test('shows badge when header filters provided as array', () => {
    // Create a minimal mock responseRef
    const responseRef = {
      getTabulatorHeaderFilters: () => [{ field: '1' }],
      formattedTableParams: { filters: [{ field: '1' }] },
      state: { displayType: 'table' },
      isFilteringTable: () => false,
      toggleTableFilter: () => {},
      changeDisplayType: () => {},
    }

    const wrapper = shallow(<OptionsToolbar {...OptionsToolbar.defaultProps} responseRef={responseRef} />)
    const instance = wrapper.instance()
    const btn = instance.renderFilterBtn()
    const icon = btn.props.children
    expect(icon.props.showBadge).toBe(true)
  })

  test('shows badge when header filters provided as object', () => {
    const responseRef = {
      getTabulatorHeaderFilters: () => ({ 1: { field: '1' } }),
      formattedTableParams: { filters: [{ field: '1' }] },
      state: { displayType: 'table' },
      isFilteringTable: () => false,
      toggleTableFilter: () => {},
      changeDisplayType: () => {},
    }

    const wrapper = shallow(<OptionsToolbar {...OptionsToolbar.defaultProps} responseRef={responseRef} />)
    const instance = wrapper.instance()
    const btn = instance.renderFilterBtn()
    const icon = btn.props.children
    expect(icon.props.showBadge).toBe(true)
  })

  test('does not show badge when no filters', () => {
    const responseRef = {
      getTabulatorHeaderFilters: () => null,
      formattedTableParams: { filters: [] },
      state: { displayType: 'table' },
      isFilteringTable: () => false,
      toggleTableFilter: () => {},
      changeDisplayType: () => {},
    }

    const wrapper = shallow(<OptionsToolbar {...OptionsToolbar.defaultProps} responseRef={responseRef} />)
    const instance = wrapper.instance()
    const btn = instance.renderFilterBtn()
    const icon = btn.props.children
    expect(icon.props.showBadge).toBe(false)
  })
})

// Unit tests for countTabulatorHeaderFilters utility method
describe('countTabulatorHeaderFilters (unit)', () => {
  test('returns 0 for null/undefined', () => {
    const inst = new OptionsToolbar({})
    expect(inst.countTabulatorHeaderFilters(null)).toBe(0)
    expect(inst.countTabulatorHeaderFilters(undefined)).toBe(0)
  })

  test('returns length for arrays', () => {
    const inst = new OptionsToolbar({})
    expect(inst.countTabulatorHeaderFilters([])).toBe(0)
    expect(inst.countTabulatorHeaderFilters([1, 2])).toBe(2)
  })

  test('returns number of keys for objects', () => {
    const inst = new OptionsToolbar({})
    expect(inst.countTabulatorHeaderFilters({})).toBe(0)
    expect(inst.countTabulatorHeaderFilters({ a: 1, b: 2 })).toBe(2)
  })

  test('returns 0 for primitive non-object types', () => {
    const inst = new OptionsToolbar({})
    expect(inst.countTabulatorHeaderFilters('')).toBe(0)
    expect(inst.countTabulatorHeaderFilters('x')).toBe(0)
    expect(inst.countTabulatorHeaderFilters(42)).toBe(0)
    expect(inst.countTabulatorHeaderFilters(true)).toBe(0)
  })
})
