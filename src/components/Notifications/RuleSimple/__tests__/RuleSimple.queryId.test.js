import React from 'react'
import { shallow } from 'enzyme'

import RuleSimple from '../RuleSimple'

const FULL_PAGE_SIZE = 50000

const buildQueryResponse = ({ text, queryId, pageSize = FULL_PAGE_SIZE }) => ({
  data: { data: { text, query_id: queryId, fe_req: { page_size: pageSize } } },
})

// DataAlertModal starts a new alert with an empty expression, so initialData is [] until the
// alert has been saved once.
const buildWrapper = ({ initialData = [], ...props } = {}) =>
  shallow(<RuleSimple initialData={initialData} {...props} />, { disableLifecycleMethods: true })

describe('RuleSimple query_id pinning', () => {
  it('pins the id of the query the alert was built from', () => {
    const queryResponse = buildQueryResponse({ text: 'total revenue', queryId: 'q-live' })
    const wrapper = buildWrapper({ queryResponse })
    wrapper.setState({ firstQueryResult: queryResponse })

    expect(wrapper.instance().getTermQueryId(0)).toBe('q-live')
  })

  it('drops the pin when the query text no longer matches the response', () => {
    const queryResponse = buildQueryResponse({ text: 'total revenue', queryId: 'q-live' })
    const wrapper = buildWrapper({ queryResponse })
    wrapper.setState({ firstQueryResult: queryResponse, inputValue: 'total revenue last month' })

    expect(wrapper.instance().getTermQueryId(0)).toBeUndefined()
  })

  it('does not pin an id from the two row re-run used when editing an alert', () => {
    const wrapper = buildWrapper({
      initialData: [{ id: '1', term_value: 'total revenue', condition: 'EXISTS' }],
    })
    wrapper.setState({
      firstQueryResult: buildQueryResponse({ text: 'total revenue', queryId: 'q-rerun', pageSize: 2 }),
    })

    expect(wrapper.instance().getTermQueryId(0)).toBeUndefined()
  })

  it('carries the stored id forward when editing an alert without changing the query', () => {
    const wrapper = buildWrapper({
      initialData: [{ id: '1', term_value: 'total revenue', condition: 'EXISTS', query_id: 'q-stored' }],
    })
    wrapper.setState({
      firstQueryResult: buildQueryResponse({ text: 'total revenue', queryId: 'q-rerun', pageSize: 2 }),
    })

    expect(wrapper.instance().getTermQueryId(0)).toBe('q-stored')
  })

  it('drops the stored id when the query text is edited', () => {
    const wrapper = buildWrapper({
      initialData: [{ id: '1', term_value: 'total revenue', condition: 'EXISTS', query_id: 'q-stored' }],
    })
    wrapper.setState({ inputValue: 'total revenue by month' })

    expect(wrapper.instance().getTermQueryId(0)).toBeUndefined()
  })

  it('resolves the second comparison term independently of the first', () => {
    const wrapper = buildWrapper({
      initialData: [
        { id: '1', term_value: 'total revenue', condition: 'GREATER_THAN', query_id: 'q-first' },
        { id: '2', term_value: 'total expenses', term_type: 'QUERY', query_id: 'q-second' },
      ],
    })

    expect(wrapper.instance().getTermQueryId(0)).toBe('q-first')
    expect(wrapper.instance().getTermQueryId(1)).toBe('q-second')
  })
})
