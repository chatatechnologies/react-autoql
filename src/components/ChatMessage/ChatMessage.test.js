import React from 'react'
import { shallow } from 'enzyme'

import { testAuthentication } from '../../../test/testData'
import { findByTestAttr } from '../../../test/testUtils'
import ChatMessage from './ChatMessage'

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
      rows: [[148644.9600000001, 1], [111, 1]],
      sql: ['select sum()'],
    },
  },
}

const defaultProps = {
  authentication: testAuthentication,
  response: sampleResponse,
  isResponse: true,
  type: 'data',
}

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<ChatMessage {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders correctly with required props', () => {
    const wrapper = setup()
    const chatMessageComponent = findByTestAttr(wrapper, 'chat-message')
    expect(chatMessageComponent.exists()).toBe(true)
  })
})

describe('column visibility manager', () => {
  describe('does not render col visibility btn when autoqlconfig prop is false', () => {
    const propsWithColVisDisabled = {
      ...defaultProps,
      autoQLConfig: {
        ...defaultProps.autoQLConfig,
        enableColumnVisibilityManager: false,
      },
    }
    const wrapper = setup(propsWithColVisDisabled)
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
  //       type: 'DOLLAR_AMT'
  //     },
  //     {
  //       display_name: 'Test Column',
  //       groupable: false,
  //       is_visible: true,
  //       name: 'test',
  //       type: 'QUANTITY'
  //     }
  //   ]
  //   const wrapper = setup({ ...propsWithColVisEnabled, response })
  //   const colVisibilityBtn = findByTestAttr(wrapper, 'options-toolbar-col-vis')
  //   expect(colVisibilityBtn.exists()).toBe(false)
  // })

  describe('renders col visibility btn for list queries', () => {
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
    const wrapper = setup({
      ...propsWithColVisEnabled,
      response,
    })
    const colVisibilityBtn = findByTestAttr(wrapper, 'options-toolbar-col-vis')
    expect(colVisibilityBtn.exists()).toBe(true)
  })
})
