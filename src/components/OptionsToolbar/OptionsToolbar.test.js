import React from 'react'
import { shallow, mount, exists } from 'enzyme'

import { testAuthentication } from '../../../test/testData'
import { autoQLConfigDefault } from '../../props/defaults'
import { findByTestAttr } from '../../../test/testUtils'

import OptionsToolbar from './OptionsToolbar'
import { QueryOutputWithoutTheme } from '../QueryOutput/QueryOutput'

var responseRef

const sampleResponse = {
  data: {
    message: 'Success',
    reference_id: '1.1.210',
    data: {
      columns: [
        {
          display_name: 'Amount (Sum)',
          groupable: false,
          is_visible: true,
          name: 'sum(generalledger.amount)',
          type: 'DOLLAR_AMT',
        },
        {
          display_name: 'Test Column',
          groupable: false,
          is_visible: true,
          name: 'test',
          type: 'QUANTITY',
        },
      ],
      display_type: 'data',
      interpretation:
        "Amount (Sum), lower of Classification of 'revenue', and, Date greater than or equal '2020-05-01T00:00:00.000Z', and, Date below '2020-05-31T23:59:59.000Z'",
      query_id: 'q_uwOMur9eTtSxyKh_GSI1bQ',
      rows: [
        [148644.9600000001, 1],
        [111, 1],
      ],
      sql: ['select sum()'],
    },
  },
}

const defaultProps = OptionsToolbar.defaultProps

const setup = (props = {}, queryOutputProps = {}, state = null) => {
  // Create a query output component from the sample response,
  // then pass that into the toolbar component
  const queryOutputComponent = mount(
    <QueryOutputWithoutTheme
      authentication={defaultProps.authentication}
      ref={(r) => {
        responseRef = r
      }}
      queryResponse={sampleResponse}
      {...queryOutputProps}
    />
  )
  queryOutputComponent.mount()

  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(
    <OptionsToolbar {...setupProps} responseRef={responseRef} />
  )

  return wrapper
}

describe('renders correctly', () => {
  test('renders correctly with required props', () => {
    const wrapper = setup(undefined, { displayType: 'table' })
    const toolbarComponent = findByTestAttr(wrapper, 'autoql-options-toolbar')
    expect(toolbarComponent.exists()).toBe(true)
  })

  test('renders correctly for single value response', () => {
    const wrapper = setup(undefined, { displayType: 'single-value' })
    const toolbarComponent = findByTestAttr(wrapper, 'autoql-options-toolbar')
    expect(toolbarComponent.exists()).toBe(true)
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
    const wrapper = setup(propsWithColVisDisabled, { displayType: 'table' })
    const colVisibilityBtn = findByTestAttr(wrapper, 'options-toolbar-col-vis')
    expect(colVisibilityBtn.exists()).toBe(false)
  })

  const propsWithColVisEnabled = {
    ...defaultProps,
    autoQLConfig: {
      ...defaultProps.autoQLConfig,
      enableColumnVisibilityManager: true,
    },
  }

  // describe('does not render col visibility btn for aggregation queries', () => {
  //   const response = { ...sampleResponse }
  //   response.data.data.columns = [
  //     {
  //       display_name: 'Amount (Sum)',
  //       groupable: true,
  //       is_visible: true,
  //       name: 'sum(generalledger.amount)',
  //       type: 'DOLLAR_AMT',
  //     },
  //     {
  //       display_name: 'Test Column',
  //       groupable: false,
  //       is_visible: true,
  //       name: 'test',
  //       type: 'QUANTITY',
  //     },
  //   ]
  //   const wrapper = setup({ ...propsWithColVisEnabled, response })
  //   const colVisibilityBtn = findByTestAttr(wrapper, 'options-toolbar-col-vis')
  //   expect(colVisibilityBtn.exists()).toBe(false)
  // })

  test('renders col visibility btn for list queries', () => {
    const response = { ...sampleResponse }
    response.data.data.columns = [
      {
        display_name: 'Amount (Sum)',
        groupable: false,
        is_visible: true,
        name: 'sum(generalledger.amount)',
        type: 'DOLLAR_AMT',
      },
      {
        display_name: 'Test Column',
        groupable: false,
        is_visible: true,
        name: 'test',
        type: 'QUANTITY',
      },
    ]
    const wrapper = setup(
      {
        ...propsWithColVisEnabled,
        response,
      },
      { displayType: 'table' }
    )
    const colVisibilityBtn = findByTestAttr(wrapper, 'options-toolbar-col-vis')
    expect(colVisibilityBtn.exists()).toBe(true)
  })
})

describe('trash button', () => {
  test('do not render trash button by default', () => {
    const wrapper = setup()
    const trashBtn = findByTestAttr(wrapper, 'options-toolbar-trash-btn')
    expect(trashBtn.exists()).toBe(false)
  })
})

describe('more options button', () => {
  test('renders by default', () => {
    const wrapper = setup(undefined, { displayType: 'table' })
    const moreOptionsBtn = findByTestAttr(
      wrapper,
      'react-autoql-toolbar-more-options-btn'
    )
    expect(moreOptionsBtn.exists()).toBe(true)
  })
})
