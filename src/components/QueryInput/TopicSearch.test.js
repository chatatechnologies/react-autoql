import React from 'react'
import { render, fireEvent, act } from '@testing-library/react'
import { DataExplorerTypes, fetchDataExplorerAutocomplete, fetchSubjectListV2 } from 'autoql-fe-utils'

import { TopicSearchPanel } from './TopicSearch'

jest.mock('autoql-fe-utils', () => ({
  ...jest.requireActual('autoql-fe-utils'),
  fetchDataExplorerAutocomplete: jest.fn(),
  fetchSubjectListV2: jest.fn(),
}))

// Stand-ins that show what they were given. The preview reports a small table as
// soon as it mounts, as the real one does once its fetch returns.
const preview = {
  data: { data: { columns: [{ name: 'wallet', type: 'STRING' }], rows: [['Acme'], ['Globex']] } },
}
jest.mock('../DataExplorer/DataPreview', () => {
  const { useEffect } = require('react')
  return (props) => {
    useEffect(() => props.onDataPreview(preview), [])
    return (
      <button
        data-test='data-preview'
        data-subject={props.subject?.context}
        onClick={() => props.onColumnSelection([0])}
      >
        preview
      </button>
    )
  }
})
jest.mock('../DataExplorer/SampleQueryList', () => (props) => (
  <div
    data-test='sample-query-list'
    data-context={props.context}
    data-value-label={props.valueLabel?.canonical ?? ''}
    data-columns={JSON.stringify(props.columns ?? null)}
  />
))
jest.mock('../FieldSelector', () => () => <div data-test='field-selector' />)
jest.mock('../Select', () => ({
  Select: ({ value, options, onChange }) => (
    <select data-test='context-select' value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}))

class Topic {
  constructor(context, displayName) {
    this.context = context
    this.displayName = displayName
    this.type = 'SUBJECT'
  }
}

const topics = [new Topic('wallets', 'Wallets'), new Topic('transfers', 'Transfers')]
const $ = (selector) => document.querySelector(`[data-test="${selector}"]`)

const renderPanel = (props = {}) => {
  const handlers = { onSelect: jest.fn(), onBack: jest.fn(), onClose: jest.fn() }
  const utils = render(<TopicSearchPanel topics={topics} query='' showSampleQueries {...handlers} {...props} />)
  return { ...utils, ...handlers }
}

beforeEach(() => {
  jest.useFakeTimers()
  localStorage.clear()
  fetchDataExplorerAutocomplete.mockReset()
  fetchSubjectListV2.mockReset()
})
afterEach(() => jest.useRealTimers())

describe('results', () => {
  test('list every topic before anything is typed, with nothing for Enter to pick', () => {
    const resultsRef = { current: undefined }
    const { getByText } = renderPanel({ resultsRef })
    topics.forEach((topic) => expect(getByText(topic.displayName)).toBeTruthy())
    expect(fetchDataExplorerAutocomplete).not.toHaveBeenCalled()
    expect(resultsRef.current.firstResult).toBeUndefined()
  })

  test('are the topics and values the autocomplete relates to the text, and nothing else', async () => {
    const value = { type: DataExplorerTypes.VL_TYPE, displayName: 'Acme', valueLabel: { canonical: 'acme' } }
    fetchDataExplorerAutocomplete.mockResolvedValue([topics[1], value])
    const resultsRef = { current: undefined }

    const { findByText, queryByText, onSelect } = renderPanel({ query: 'ac', resultsRef })
    act(() => jest.runAllTimers())

    fireEvent.click(await findByText('Acme'))
    expect(fetchDataExplorerAutocomplete.mock.calls[0][0]).toMatchObject({ suggestion: 'ac' })
    expect(queryByText('Sample queries', { exact: false })).toBeNull()
    expect(resultsRef.current.firstResult).toBe(topics[1])
    expect(onSelect).toHaveBeenCalledWith(value)
    expect($('sample-query-list')).toBeNull()
  })

  test('remember what was picked as a recent search', () => {
    const token = `x.${btoa(JSON.stringify({ user_id: 'u', project_id: 'p' }))}.y`
    const first = renderPanel({ authentication: { token } })
    fireEvent.click(first.getByText('Wallets'))
    first.unmount()

    expect(renderPanel({ authentication: { token } }).getByText('Recent')).toBeTruthy()
  })
})

describe('a picked topic', () => {
  test('shows its data preview and sample queries on two tabs', () => {
    const { getByRole, onBack } = renderPanel({ selection: topics[1] })

    expect($('data-preview').getAttribute('data-subject')).toBe('transfers')
    expect($('data-preview').parentElement.hidden).toBe(false)
    expect($('sample-query-list').closest('[hidden]')).not.toBeNull()

    fireEvent.click(getByRole('tab', { name: 'Sample queries' }))
    expect($('data-preview').parentElement.hidden).toBe(true)
    expect($('sample-query-list').closest('[hidden]')).toBeNull()
    expect($('sample-query-list').getAttribute('data-context')).toBe('transfers')

    fireEvent.click(getByRole('button', { name: 'Back to results' }))
    expect(onBack).toHaveBeenCalled()
  })

  test('fields picked in the preview narrow the sample queries, with example values', () => {
    renderPanel({ selection: topics[1] })
    expect(JSON.parse($('sample-query-list').getAttribute('data-columns'))).toBeNull()

    fireEvent.click($('data-preview'))
    expect(JSON.parse($('sample-query-list').getAttribute('data-columns'))).toEqual({ wallet: { value: 'Acme' } })
  })

  test('shows only the preview, with no tabs, when the project has no sample queries', () => {
    const { queryByRole } = renderPanel({ selection: topics[1], showSampleQueries: false })
    expect($('data-preview')).not.toBeNull()
    expect(queryByRole('tab')).toBeNull()
    expect($('sample-query-list')).toBeNull()
  })
})

describe('a picked value', () => {
  const value = {
    type: DataExplorerTypes.VL_TYPE,
    displayName: 'Acme',
    valueLabel: { canonical: 'acme', column_name: 'customer', keyword: 'Acme' },
  }

  test('lets you pick which of its topics to look at, the first by default', async () => {
    fetchSubjectListV2.mockResolvedValue([{ subject: 'transfers' }, { subject: 'unknown' }, { subject: 'wallets' }])
    renderPanel({ selection: value })
    await act(async () => {})

    expect(fetchSubjectListV2.mock.calls[0][0]).toMatchObject({ valueLabel: 'acme' })
    const options = [...$('context-select').options].map((option) => option.value)
    expect(options).toEqual(['transfers', 'wallets'])
    expect($('data-preview').getAttribute('data-subject')).toBe('transfers')

    fireEvent.change($('context-select'), { target: { value: 'wallets' } })
    expect($('data-preview').getAttribute('data-subject')).toBe('wallets')
  })

  test('narrows the sample queries to the value', async () => {
    fetchSubjectListV2.mockResolvedValue([{ subject: 'transfers' }])
    renderPanel({ selection: value })
    await act(async () => {})

    expect($('sample-query-list').getAttribute('data-value-label')).toBe('acme')
    expect(JSON.parse($('sample-query-list').getAttribute('data-columns'))).toEqual({ customer: { value: 'Acme' } })
  })

  test('says so when no topic holds it', async () => {
    fetchSubjectListV2.mockResolvedValue([])
    const { findByText } = renderPanel({ selection: value })
    expect(await findByText('No topics hold this value')).toBeTruthy()
  })
})
