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
