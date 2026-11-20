import React from 'react'
import { render, fireEvent, act } from '@testing-library/react'
import {
  DataExplorerTypes,
  fetchDataExplorerAutocomplete,
  fetchSubjectListV2,
  runQueryValidation,
} from 'autoql-fe-utils'

import { TopicSearchPanel, filterTopics, withValueLabel } from './TopicSearch'

jest.mock('autoql-fe-utils', () => ({
  ...jest.requireActual('autoql-fe-utils'),
  fetchDataExplorerAutocomplete: jest.fn(),
  fetchSubjectListV2: jest.fn(),
  runQueryValidation: jest.fn(),
}))

jest.mock('../DataExplorer/SampleQueryList', () => (props) => (
  <div data-test='sample-query-list' data-search-text={props.searchText} />
))

class Topic {
  constructor(context, displayName) {
    this.context = context
    this.displayName = displayName
    this.type = 'SUBJECT'
  }
  isAggSeed() {
    return false
  }
}

const topics = [new Topic('wallets', 'Wallets'), new Topic('transfers', 'Transfers'), new Topic('fees', 'Transfer fees')]

const renderPanel = (props = {}) => {
  const handlers = { onSelect: jest.fn(), onTopicSelect: jest.fn(), onSearchText: jest.fn(), onClose: jest.fn() }
  const utils = render(<TopicSearchPanel topics={topics} query='' {...handlers} {...props} />)
  return { ...utils, ...handlers }
}

beforeEach(() => {
  jest.useFakeTimers()
  localStorage.clear()
  fetchDataExplorerAutocomplete.mockReset()
  fetchSubjectListV2.mockReset()
  runQueryValidation.mockReset()
})
afterEach(() => jest.useRealTimers())

describe('helpers', () => {
  test('filterTopics matches anywhere in the name, ignoring case', () => {
    expect(filterTopics(topics, 'TRANSFER').map((t) => t.context)).toEqual(['transfers', 'fees'])
    expect(filterTopics(topics, '  ')).toBe(topics)
  })

  test('withValueLabel keeps the topic a topic', () => {
    const narrowed = withValueLabel(topics[0], { canonical: 'c' })
    expect(narrowed.isAggSeed()).toBe(false)
    expect(narrowed.valueLabel).toEqual({ canonical: 'c' })
    expect(topics[0].valueLabel).toBeUndefined()
  })
})

describe('results while typing', () => {
  test('lists every topic before anything is typed', () => {
    const { getByText } = renderPanel()
    topics.forEach((topic) => expect(getByText(topic.displayName)).toBeTruthy())
  })

  test('LLM projects filter the topic list and never call the autocomplete', () => {
    const { queryByText, getByText } = renderPanel({ query: 'fee', searchValues: false })
    act(() => jest.runAllTimers())
    expect(getByText('Transfer fees')).toBeTruthy()
    expect(queryByText('Wallets')).toBeNull()
    expect(fetchDataExplorerAutocomplete).not.toHaveBeenCalled()
  })

  test('other projects search values through the autocomplete', async () => {
    const value = { type: DataExplorerTypes.VL_TYPE, displayName: 'Acme', valueLabel: { canonical: 'acme' } }
    fetchDataExplorerAutocomplete.mockResolvedValue([value])

    const { findByText, onSelect } = renderPanel({ query: 'acm', searchValues: true })
    act(() => jest.runAllTimers())

    fireEvent.click(await findByText('Acme'))
    expect(fetchDataExplorerAutocomplete.mock.calls[0][0]).toMatchObject({ suggestion: 'acm' })
    expect(onSelect).toHaveBeenCalledWith(value)
  })

  test('offers sample queries for the text itself only when allowed', () => {
    const allowed = renderPanel({ query: 'fees', searchValues: false, allowTextSearch: true })
    expect(allowed.queryByText('Sample queries for', { exact: false })).not.toBeNull()
    allowed.unmount()

    const notAllowed = renderPanel({ query: 'fees', searchValues: false, allowTextSearch: false })
    expect(notAllowed.queryByText('Sample queries for', { exact: false })).toBeNull()
  })

  test('remembers what was picked as a recent search', () => {
    const token = `x.${btoa(JSON.stringify({ user_id: 'u', project_id: 'p' }))}.y`
    const first = renderPanel({ authentication: { token } })
    fireEvent.click(first.getByText('Wallets'))
    first.unmount()

    const { getByText } = renderPanel({ authentication: { token } })
    expect(getByText('Recent')).toBeTruthy()
  })
})

describe('after picking a value', () => {
  test('lists the topics that hold it, and opens one narrowed to the value', async () => {
    fetchSubjectListV2.mockResolvedValue([{ subject: 'transfers' }, { subject: 'unknown' }])
    const valueLabel = { canonical: 'acme', column_name: 'wallet', keyword: 'Acme' }

    const { findByText, queryByText, onTopicSelect } = renderPanel({
      selection: { type: DataExplorerTypes.VL_TYPE, displayName: 'Acme', valueLabel },
    })

    fireEvent.click(await findByText('Transfers'))
    expect(queryByText('Wallets')).toBeNull()
    expect(fetchSubjectListV2.mock.calls[0][0]).toMatchObject({ valueLabel: 'acme' })
    expect(onTopicSelect.mock.calls[0][0]).toMatchObject({ context: 'transfers', valueLabel })
  })
})

describe('after picking the text itself', () => {
  test('shows sample queries for it when it needs no correction', async () => {
    runQueryValidation.mockResolvedValue({ data: { data: { replacements: [] } } })
    renderPanel({ selection: { type: DataExplorerTypes.TEXT_TYPE, displayName: 'fees' } })
    await act(async () => {})

    expect(runQueryValidation.mock.calls[0][0]).toMatchObject({ text: 'fees' })
    // The mocked list is marked with data-test, which getByTestId doesn't read
    expect(document.querySelector('[data-test="sample-query-list"]').getAttribute('data-search-text')).toBe('fees')
  })

  test('skips the spelling check when asked to', () => {
    renderPanel({ selection: { type: DataExplorerTypes.TEXT_TYPE, displayName: 'fees', skipValidation: true } })
    expect(runQueryValidation).not.toHaveBeenCalled()
    expect(document.querySelector('[data-test="sample-query-list"]')).not.toBeNull()
  })
})
