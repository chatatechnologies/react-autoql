import React from 'react'
import { shallow } from 'enzyme'

import RuleSimple from '../RuleSimple'

// The builder now runs its queries at the same full page size as a normal query.
const BUILDER_PAGE_SIZE = 50000
const DATA_MESSENGER_PAGE_SIZE = 50000

const buildQueryResponse = ({ text, queryId, pageSize = DATA_MESSENGER_PAGE_SIZE, rows }) => ({
  data: { data: { text, query_id: queryId, rows, fe_req: { page_size: pageSize } } },
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

  it('pins the freshly re-run id when editing an alert, since the builder runs at full page size', () => {
    const wrapper = buildWrapper({
      initialData: [{ id: '1', term_value: 'total revenue', condition: 'EXISTS', query_id: 'q-stored' }],
    })
    wrapper.setState({
      firstQueryResult: buildQueryResponse({
        text: 'total revenue',
        queryId: 'q-rerun',
        pageSize: BUILDER_PAGE_SIZE,
      }),
    })

    expect(wrapper.instance().getTermQueryId(0)).toBe('q-rerun')
  })

  it('refuses to pin an id from a run below the evaluation page size', () => {
    // Consumers can set dataPageSize themselves; SQL stored against such a run carries a
    // page limit smaller than the Logic Engine evaluates with.
    const wrapper = buildWrapper({
      initialData: [{ id: '1', term_value: 'total revenue', condition: 'EXISTS' }],
    })
    wrapper.setState({
      firstQueryResult: buildQueryResponse({ text: 'total revenue', queryId: 'q-small', pageSize: 500 }),
    })

    expect(wrapper.instance().getTermQueryId(0)).toBeUndefined()
  })

  it('falls back to the stored id when the live response is not pinnable', () => {
    const wrapper = buildWrapper({
      initialData: [{ id: '1', term_value: 'total revenue', condition: 'EXISTS', query_id: 'q-stored' }],
    })
    wrapper.setState({
      firstQueryResult: buildQueryResponse({ text: 'total revenue', queryId: 'q-small', pageSize: 500 }),
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

describe('RuleSimple trimResponseRows', () => {
  const buildRows = (count) => Array.from({ length: count }, (_, i) => [i])

  it('trims a large response down to the preview limit', () => {
    const instance = buildWrapper().instance()
    const response = buildQueryResponse({ text: 'q', queryId: 'q1', rows: buildRows(10000) })

    const trimmed = instance.trimResponseRows(response)

    expect(trimmed.data.data.rows).toHaveLength(20)
    expect(trimmed.data.data.rows[0]).toEqual([0])
  })

  it('preserves everything else on the response, including the page size', () => {
    const instance = buildWrapper().instance()
    const response = buildQueryResponse({ text: 'q', queryId: 'q1', rows: buildRows(500) })

    const trimmed = instance.trimResponseRows(response)

    expect(trimmed.data.data.query_id).toBe('q1')
    expect(trimmed.data.data.text).toBe('q')
    expect(trimmed.data.data.fe_req.page_size).toBe(DATA_MESSENGER_PAGE_SIZE)
  })

  it('does not mutate the original response', () => {
    const instance = buildWrapper().instance()
    const response = buildQueryResponse({ text: 'q', queryId: 'q1', rows: buildRows(100) })

    instance.trimResponseRows(response)

    expect(response.data.data.rows).toHaveLength(100)
  })

  it('leaves a response at or under the limit untouched', () => {
    const instance = buildWrapper().instance()
    const response = buildQueryResponse({ text: 'q', queryId: 'q1', rows: buildRows(3) })

    expect(instance.trimResponseRows(response)).toBe(response)
  })

  it('handles responses with no rows', () => {
    const instance = buildWrapper().instance()
    expect(instance.trimResponseRows(undefined)).toBeUndefined()
    expect(instance.trimResponseRows({ data: { data: {} } })).toEqual({ data: { data: {} } })
  })
})
