import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { captureQuestion } from '../run/captureRun'
import { __calls as tilesCalls } from '../workspace/DashboardTilesDialog'
import { NewReportDialog } from '../workspace/NewReportDialog'

// New report: a question is asked once and becomes the first block (marked as asked here, so it can be rerun); a
// dashboard opens its tiles with every one ticked; a blank page is blank. A question on its way when the dialog
// closes is stopped.

jest.mock('../run/captureRun', () => ({ captureQuestion: jest.fn() }))

// The tiles dialog has tests of its own (tilePicker.test.js). Here it's a stand-in that adds one block, or goes back.
jest.mock('../workspace/DashboardTilesDialog', () => {
  const mockReact = require('react')
  const calls = []
  const DashboardTilesDialog = (props) => {
    calls.push(props)
    return mockReact.createElement(
      'div',
      { 'data-test': 'tiles', 'data-initial': props.initialDashboardId, 'data-mode': props.mode },
      mockReact.createElement(
        'button',
        {
          type: 'button',
          onClick: () =>
            props.onAdd([{ id: 'b1', type: 'data' }], { id: props.initialDashboardId, name: 'Firm overview' }),
        },
        'add tiles',
      ),
      mockReact.createElement('button', { type: 'button', onClick: props.onClose }, 'back'),
    )
  }
  return { DashboardTilesDialog, __calls: calls }
})

const ask = captureQuestion
const AUTH = { apiKey: 'k', domain: 'https://example.test', token: 't' }
const CAPTURE = { version: 1, displayType: 'table', data: { rows: [], columns: [] } }
const DASHBOARDS = [
  { id: 'db_1', name: 'Book of business', type: 'CUSTOM', tiles: [] },
  { id: 'db_2', name: 'Firm overview', type: 'CUSTOM', tiles: [] },
]

const dialog = (props = {}) => (
  <NewReportDialog authentication={AUTH} dashboards={DASHBOARDS} onStart={jest.fn()} onClose={jest.fn()} {...props} />
)

const open = (props = {}) => {
  const onStart = jest.fn()
  const onClose = jest.fn()
  const utils = render(dialog({ onStart, onClose, ...props }))
  return { ...utils, onStart, onClose }
}

const question = () => screen.getByLabelText('Question')
const typeQuestion = (text) => fireEvent.change(question(), { target: { value: text } })
const create = () => fireEvent.click(screen.getByRole('button', { name: 'Create report' }))
const chooseDashboard = () => fireEvent.click(screen.getByRole('radio', { name: /Start from a dashboard/ }))

beforeEach(() => {
  ask.mockReset()
  tilesCalls.length = 0
})

describe('NewReportDialog', () => {
  it('starts from a question: asks it once, named after it, marked as asked here', async () => {
    ask.mockResolvedValue({ ok: true, capture: CAPTURE, rows: 10 })
    const autoQLConfig = { projectId: 'p1' }
    const { onStart } = open({ autoQLConfig })
    expect(screen.getByTestId('reports-new-report')).toBeInTheDocument()

    typeQuestion('  aum by household ')
    create()

    await waitFor(() => expect(onStart).toHaveBeenCalledTimes(1))
    expect(ask).toHaveBeenCalledTimes(1)
    expect(ask).toHaveBeenCalledWith({
      query: 'aum by household',
      authentication: AUTH,
      autoQLConfig,
      signal: expect.any(AbortSignal),
    })
    expect(onStart).toHaveBeenCalledWith({
      title: 'aum by household',
      blocks: [
        {
          id: expect.any(String),
          type: 'data',
          width: 'full',
          rows: 10,
          source: { type: 'query', query: 'aum by household' },
          capture: CAPTURE,
          askedHere: true,
        },
      ],
    })
  })

  it('stays open and says why when the question doesn’t answer', async () => {
    ask.mockResolvedValue({ ok: false, reason: 'error', error: { message: 'The query timed out.' } })
    const { onStart } = open()
    typeQuestion('aum by household')
    create()

    expect((await screen.findByRole('alert')).textContent).toBe('That question didn’t run. The query timed out.')
    expect(onStart).not.toHaveBeenCalled()
    expect(question().value).toBe('aum by household')
    expect(screen.getByRole('button', { name: 'Create report' })).toBeEnabled()

    // Changing the question clears it.
    typeQuestion('aum by household and month')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('says why for each way a question can fail', async () => {
    const cases = [
      [{ ok: false, reason: 'no-data' }, 'That question came back with no data to show.'],
      [{ ok: false, reason: 'unsupported' }, 'That answer can’t be kept in a report yet.'],
      [{ ok: false, reason: 'error' }, 'That question didn’t run.'],
      [{ ok: false, reason: 'something new', error: { message: 'Oops.' } }, 'That question didn’t run. Oops.'],
    ]
    for (const [result, message] of cases) {
      ask.mockResolvedValueOnce(result)
      const { unmount } = open()
      typeQuestion('aum by household')
      create()
      expect((await screen.findByRole('alert')).textContent).toBe(message)
      unmount()
    }
  })

  it('says nothing when the question was stopped', async () => {
    ask.mockResolvedValue({ ok: false, reason: 'cancelled' })
    const { onStart } = open()
    typeQuestion('aum by household')
    create()

    await waitFor(() => expect(screen.getByRole('button', { name: 'Create report' })).toBeEnabled())
    expect(ask).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(onStart).not.toHaveBeenCalled()
  })

  it('asks with Enter, once there’s a question to ask', async () => {
    ask.mockResolvedValue({ ok: true, capture: CAPTURE, rows: 25 })
    const { onStart } = open()
    expect(screen.getByRole('button', { name: 'Create report' })).toBeDisabled()

    typeQuestion('   ')
    expect(screen.getByRole('button', { name: 'Create report' })).toBeDisabled()
    fireEvent.keyDown(question(), { key: 'Enter' })
    expect(ask).not.toHaveBeenCalled()

    typeQuestion('aum by household')
    fireEvent.keyDown(question(), { key: 'Enter' })
    await waitFor(() => expect(onStart).toHaveBeenCalledTimes(1))
    expect(ask).toHaveBeenCalledTimes(1)
  })

  it('names the report with as much of a long question as a title can hold, and keeps the question whole', async () => {
    ask.mockResolvedValue({ ok: true, capture: CAPTURE, rows: 25 })
    // Counted as the service counts it, in code points: the emoji that ends the title isn't cut in half.
    const long = `${'a'.repeat(199)}📈📈 by household`
    const { onStart } = open()
    typeQuestion(long)
    create()

    await waitFor(() => expect(onStart).toHaveBeenCalledTimes(1))
    const [{ title, blocks }] = onStart.mock.calls[0]
    expect(title).toBe(`${'a'.repeat(199)}📈`)
    expect(blocks[0].source.query).toBe(long)
  })

  it('puts the cursor in the question on opening, and whenever it’s chosen again', () => {
    open()
    expect(question()).toHaveFocus()

    fireEvent.click(screen.getByRole('radio', { name: /Blank page/ }))
    expect(screen.queryByLabelText('Question')).toBeNull()

    fireEvent.click(screen.getByRole('radio', { name: /Start from a question/ }))
    expect(question()).toHaveFocus()
  })

  it('starts from a dashboard with every tile ticked, named after it', () => {
    const autoQLConfig = { projectId: 'p1' }
    const dataFormatting = { currencyCode: 'CAD' }
    const onTilesChange = jest.fn()
    const { onStart } = open({ autoQLConfig, dataFormatting, onTilesChange })
    chooseDashboard()
    fireEvent.change(screen.getByLabelText('Dashboard'), { target: { value: 'db_2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Choose tiles…' }))

    const tiles = screen.getByTestId('tiles')
    expect(tiles.getAttribute('data-initial')).toBe('db_2')
    expect(tiles.getAttribute('data-mode')).toBe('start')
    // In New report's place, with what it needs to draw the dashboards, and an empty report to check sizes against.
    expect(screen.queryByTestId('reports-new-report')).toBeNull()
    expect(tilesCalls[tilesCalls.length - 1]).toMatchObject({
      authentication: AUTH,
      autoQLConfig,
      dataFormatting,
      dashboards: DASHBOARDS,
      onTilesChange,
      report: { schemaVersion: 1, title: '', blocks: [] },
    })

    // Going back keeps the dashboard chosen.
    fireEvent.click(screen.getByText('back'))
    expect(screen.getByRole('radio', { name: /Start from a dashboard/ })).toBeChecked()
    expect(screen.getByLabelText('Dashboard')).toHaveValue('db_2')
    expect(screen.getByLabelText('Dashboard')).toHaveFocus()

    fireEvent.click(screen.getByRole('button', { name: 'Choose tiles…' }))
    fireEvent.click(screen.getByText('add tiles'))
    expect(onStart).toHaveBeenCalledWith({ title: 'Firm overview', blocks: [{ id: 'b1', type: 'data' }] })
    expect(ask).not.toHaveBeenCalled()
  })

  it('names each dashboard with how many tiles it has, and passes on the host’s own id', () => {
    open({
      dashboards: [
        { id: 'db_1', name: 'Book of business', tiles: [{ i: 'a' }, { i: 'b' }] },
        { id: 7, name: '', tiles: [{ i: 'c' }] },
        { id: 'db_3', name: 'Empty' },
      ],
    })
    chooseDashboard()
    const select = screen.getByLabelText('Dashboard')
    expect(Array.from(select.options).map((option) => option.textContent)).toEqual([
      'Book of business · 2 tiles',
      'Untitled dashboard · 1 tile',
      'Empty · 0 tiles',
    ])

    fireEvent.change(select, { target: { value: '7' } })
    fireEvent.click(screen.getByRole('button', { name: 'Choose tiles…' }))
    expect(tilesCalls[tilesCalls.length - 1].initialDashboardId).toBe(7)
  })

  it('has no dashboard to start from where the host has none', () => {
    open({ dashboards: undefined })
    expect(screen.getAllByRole('radio').map((radio) => radio.closest('label').textContent)).toEqual([
      'Start from a question',
      'Blank page',
    ])
    expect(screen.getByRole('dialog')).toHaveAccessibleDescription('Start from a question or a blank page.')
  })

  it('waits for the dashboards, and says when there are none', () => {
    const { rerender } = render(dialog({ dashboards: null }))
    chooseDashboard()
    expect(screen.getByText('Loading dashboards…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Choose tiles…' })).toBeDisabled()

    rerender(dialog({ dashboards: [] }))
    expect(screen.getByText('You have no dashboards yet.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Choose tiles…' })).toBeDisabled()

    rerender(dialog({ dashboards: DASHBOARDS }))
    expect(screen.getByLabelText('Dashboard')).toHaveValue('db_1')
    expect(screen.getByRole('button', { name: 'Choose tiles…' })).toBeEnabled()
  })

  it('starts a blank page', () => {
    const { onStart } = open()
    fireEvent.click(screen.getByRole('radio', { name: /Blank page/ }))
    create()
    expect(onStart).toHaveBeenCalledWith({ title: '', blocks: [] })
    expect(ask).not.toHaveBeenCalled()
  })

  it('closes with Cancel', () => {
    const { onClose, onStart } = open()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onStart).not.toHaveBeenCalled()
  })

  it('stops a question still on its way when it closes', async () => {
    let signal
    ask.mockImplementation((options) => {
      signal = options?.signal
      return new Promise(() => {})
    })
    const { unmount, onStart } = open()
    typeQuestion('aum by household')
    create()
    expect(await screen.findByRole('button', { name: /Asking…/ })).toBeDisabled()
    expect(question()).toBeDisabled()

    await act(async () => unmount())
    expect(signal.aborted).toBe(true)
    expect(onStart).not.toHaveBeenCalled()
  })
})
