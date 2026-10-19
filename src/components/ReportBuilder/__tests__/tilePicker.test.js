import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { __stub as stub } from '../../Dashboard'
import { DashboardTilesDialog } from '../workspace/DashboardTilesDialog'

// The tiles dialog lists a dashboard's tiles in reading order, lets a tile be ticked once its answer is on screen
// (never one a report can't hold), and adds what the dashboard captures for the ticked ones — each a Data block with
// its tile as the source. react-autoql's Dashboard is a stand-in here that "loads" its tiles when it mounts (unless
// told not to) and captures what it's asked for.

jest.mock('../../Dashboard', () => {
  const mockReact = require('react')
  // Every stand-in mounted, newest last; whether one answers its tiles as it mounts; and what a tile's capture comes
  // back as, by key, when not a one-row table.
  const shared = { mounted: [], answerOnMount: true, results: {} }
  const answered = (tile) => ({
    ...tile,
    queryResponse: tile.queryResponse || { data: { data: { rows: [['A', 1]] } } },
  })

  class Dashboard extends mockReact.Component {
    executeCachedDashboard = jest.fn(() => Promise.resolve())

    captureTilesForReport = jest.fn(({ tileKeys }) =>
      tileKeys.map((key) => {
        const tile = this.props.tiles.find((t) => String(t.key ?? t.i) === String(key))
        return {
          tileKey: key,
          dashboardId: this.props.dashboardId,
          title: tile?.title || tile?.query || '',
          query: tile?.query ?? '',
          displayType: tile?.displayType,
          result: shared.results[key] || {
            ok: true,
            capture: {
              capturedAt: 'now',
              displayType: 'table',
              data: { rows: [['A', 1]], count_rows: 1 },
              // What a block must never carry into a report.
              queryResponse: { live: true },
            },
          },
        }
      }),
    )

    componentDidMount() {
      shared.mounted.push(this)
      if (shared.answerOnMount) {
        this.props.onChange?.(this.props.tiles.map((tile) => (tile.query ? answered(tile) : tile)))
      }
    }

    render() {
      return mockReact.createElement('div', { 'data-test': 'dashboard', 'data-dashboard': this.props.dashboardId })
    }
  }

  return { Dashboard, __stub: shared }
})

const AUTH = { apiKey: 'k', domain: 'https://example.test', token: 't' }
const REPORT = { schemaVersion: 1, title: 'Q3', page: {}, blocks: [] }
const ANSWER = { data: { data: { rows: [['A', 1]] } } }

const dashboard = (id, overrides = {}) => ({
  id,
  name: 'Firm overview',
  type: 'CUSTOM',
  tiles: [
    { i: 'b', key: 'b', x: 6, y: 0, w: 6, h: 5, query: 'sales', title: 'Sales', displayType: 'column' },
    { i: 'c', key: 'c', x: 0, y: 5, w: 12, h: 5, query: 'flows', title: 'Flows', displayType: 'sankey' },
    { i: 'a', key: 'a', x: 0, y: 0, w: 6, h: 5, query: 'aum', title: 'AUM', displayType: 'table' },
    { i: 'e', key: 'e', x: 0, y: 10, w: 12, h: 5, query: '', title: '', displayType: 'table' },
  ],
  ...overrides,
})

const dialog = (props = {}) => (
  <DashboardTilesDialog
    authentication={AUTH}
    dashboards={[dashboard(props.initialDashboardId ?? 'db_1')]}
    report={REPORT}
    onAdd={jest.fn()}
    onClose={jest.fn()}
    {...props}
  />
)

const open = (props = {}) => {
  const onAdd = jest.fn()
  const onClose = jest.fn()
  const utils = render(dialog({ onAdd, onClose, ...props }))
  return { ...utils, onAdd, onClose }
}

const boxes = () => screen.getAllByRole('checkbox')
const labels = () => boxes().map((box) => box.closest('label')?.textContent)
const ticks = () => boxes().map((box) => box.checked)
const status = () => screen.getByRole('status')

// The newest Dashboard reports an answer for the tile with this key.
const answer = (key) => {
  const latest = stub.mounted[stub.mounted.length - 1]
  act(() => latest.props.onChange(latest.props.tiles.map((t) => (t.key === key ? { ...t, queryResponse: ANSWER } : t))))
}

afterEach(() => {
  stub.mounted.length = 0
  stub.answerOnMount = true
  stub.results = {}
})

describe('DashboardTilesDialog', () => {
  it('lists the tiles in reading order, and only offers what a report can hold', async () => {
    open()
    await waitFor(() => expect(boxes()[0]).not.toBeDisabled())
    expect(screen.getByTestId('reports-tile-picker')).toBeInTheDocument()
    expect(labels()).toEqual([
      'AUM',
      'Sales',
      'FlowsPivot tables, network graphs, Sankey charts and treemaps can’t be added yet',
      'UntitledNo question',
    ])
    expect(boxes().map((box) => box.disabled)).toEqual([false, false, true, true])
    // Adding ticks none of them to begin with.
    expect(ticks()).toEqual([false, false, false, false])
    expect(screen.getByRole('button', { name: 'Add tiles' })).toBeDisabled()
    // One dashboard: nothing to choose between.
    expect(screen.queryByLabelText('Dashboard')).toBeNull()
  })

  it('adds what the dashboard captures for the ticked tiles, each with its tile as the source', async () => {
    const { onAdd } = open()
    await waitFor(() => expect(boxes()[0]).not.toBeDisabled())
    fireEvent.click(boxes()[1])
    fireEvent.click(boxes()[0])
    fireEvent.click(screen.getByRole('button', { name: 'Add 2 tiles' }))

    expect(stub.mounted[0].captureTilesForReport).toHaveBeenCalledWith({
      tileKeys: ['a', 'b'],
      maxTableRows: 100,
      maxChartRows: 2000,
    })
    expect(onAdd).toHaveBeenCalledTimes(1)
    const [blocks, from] = onAdd.mock.calls[0]
    expect(from.id).toBe('db_1')
    expect(blocks.map((block) => block.source.tileKey)).toEqual(['a', 'b'])
    expect(blocks[0]).toMatchObject({
      type: 'data',
      source: { type: 'tile', dashboardId: 'db_1', snapshot: { dashboardName: 'Firm overview', tileTitle: 'AUM' } },
    })
    // Never a live query response.
    blocks.forEach((block) => expect(block.capture).not.toHaveProperty('queryResponse'))
  })

  it('ticks every tile it can as they load when starting a report', async () => {
    const { onAdd } = open({ mode: 'start', initialDashboardId: 'db_start' })
    expect(screen.getByText('Start from a dashboard')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add 2 tiles' })).toBeInTheDocument())
    expect(ticks()).toEqual([true, true, false, false])
    fireEvent.click(screen.getByRole('button', { name: 'Add 2 tiles' }))
    expect(onAdd).toHaveBeenCalledTimes(1)
  })

  it('stops ticking tiles as they load once the ticks are changed', () => {
    stub.answerOnMount = false
    open({ mode: 'start' })
    answer('a')
    expect(ticks()).toEqual([true, false, false, false])

    fireEvent.click(boxes()[0])
    answer('b')
    expect(ticks()).toEqual([false, false, false, false])
    expect(screen.getByRole('button', { name: 'Add tiles' })).toBeDisabled()

    fireEvent.click(boxes()[1])
    expect(screen.getByRole('button', { name: 'Add 1 tile' })).toBeEnabled()
  })

  it('won’t add past what a report can hold', async () => {
    const huge = { ...REPORT, blocks: [{ id: 'x', type: 'text', text: 'x'.repeat(4.6 * 1024 * 1024) }] }
    const { onAdd } = open({ report: huge, initialDashboardId: 'db_big' })
    await waitFor(() => expect(boxes()[0]).not.toBeDisabled())
    fireEvent.click(boxes()[0])
    fireEvent.click(screen.getByRole('button', { name: 'Add 1 tile' }))
    expect(screen.getByText(/more than a report can hold/)).toBeInTheDocument()
    expect(status()).toHaveTextContent('With these tiles the report would be 4.6 MB')
    expect(status()).toHaveAttribute('data-tone', 'error')
    expect(onAdd).not.toHaveBeenCalled()
  })

  it('says which tiles couldn’t be added, and adds none of them', async () => {
    stub.results.a = { ok: false, reason: 'loading' }
    stub.results.b = { ok: false, reason: 'too-large', rowCount: 4200 }
    const { onAdd } = open()
    await waitFor(() => expect(boxes()[0]).not.toBeDisabled())
    fireEvent.click(boxes()[0])
    fireEvent.click(boxes()[1])
    fireEvent.click(screen.getByRole('button', { name: 'Add 2 tiles' }))

    expect(status()).toHaveTextContent(
      '“AUM”: This tile hasn’t finished loading. “Sales”: This chart draws 4,200 rows — more than a report keeps (2,000).',
    )
    expect(status()).toHaveAttribute('data-tone', 'error')
    expect(onAdd).not.toHaveBeenCalled()

    // Changing the ticks clears it.
    fireEvent.click(boxes()[1])
    expect(status().textContent).toBe('')
    expect(status()).not.toHaveAttribute('data-tone')
  })

  it('answers the dashboard’s tiles once it’s drawn, and hands each answer to the host', async () => {
    const onTilesChange = jest.fn()
    open({ onTilesChange })
    await waitFor(() => expect(boxes()[0]).not.toBeDisabled())

    expect(stub.mounted).toHaveLength(1)
    expect(stub.mounted[0].executeCachedDashboard).toHaveBeenCalledTimes(1)
    expect(onTilesChange).toHaveBeenCalledTimes(1)
    const [id, tiles] = onTilesChange.mock.calls[0]
    expect(id).toBe('db_1')
    expect(tiles.map((tile) => [tile.key, !!tile.queryResponse])).toEqual([
      ['b', true],
      ['c', true],
      ['a', true],
      ['e', false],
    ])
    // The Dashboard is drawn with them from then on.
    expect(stub.mounted[0].props.tiles).toBe(tiles)
  })

  it('shows the answers the host already has, without asking for them again', () => {
    stub.answerOnMount = false
    // Every tile with a question has its answer; the one without a question can't have one.
    const tiles = dashboard('db_1').tiles.map((tile) => (tile.query ? { ...tile, queryResponse: ANSWER } : tile))
    open({ dashboards: [dashboard('db_1', { tiles })] })

    expect(stub.mounted[0].props.tiles).toBe(tiles)
    expect(stub.mounted[0].executeCachedDashboard).not.toHaveBeenCalled()
    expect(boxes().map((box) => box.disabled)).toEqual([false, false, true, true])
  })

  it('counts the tiles still loading, which can’t be ticked yet', () => {
    stub.answerOnMount = false
    open()
    expect(status()).toHaveTextContent('2 tiles are still loading.')
    expect(labels()).toEqual([
      'AUMLoading…',
      'SalesLoading…',
      'FlowsPivot tables, network graphs, Sankey charts and treemaps can’t be added yet',
      'UntitledNo question',
    ])
    expect(boxes().map((box) => box.disabled)).toEqual([true, true, true, true])

    answer('a')
    expect(status()).toHaveTextContent('1 tile is still loading.')
    expect(boxes()[0]).toBeEnabled()

    answer('b')
    expect(status().textContent).toBe('')
  })

  it('says a tile’s answer has no data to add', () => {
    stub.answerOnMount = false
    open()
    const latest = stub.mounted[0]
    act(() =>
      latest.props.onChange(
        latest.props.tiles.map((t) => (t.key === 'a' ? { ...t, queryResponse: { data: { message: 'Error' } } } : t)),
      ),
    )
    expect(labels()[0]).toBe('AUMNo data to add')
    expect(boxes()[0]).toBeDisabled()
  })

  it('offers the host’s other dashboards, each starting afresh, and keeps what each has answered', async () => {
    const onTilesChange = jest.fn()
    const other = {
      id: 'db_2',
      name: '',
      type: 'PROJECT',
      tiles: [{ i: 'z', key: 'z', x: 0, y: 0, w: 6, h: 5, query: 'aum by advisor', title: 'By advisor' }],
    }
    open({ dashboards: [dashboard('db_1'), other], onTilesChange })
    await waitFor(() => expect(boxes()[0]).not.toBeDisabled())
    fireEvent.click(boxes()[0])

    const select = screen.getByLabelText('Dashboard')
    expect(Array.from(select.options).map((option) => option.textContent)).toEqual([
      'Firm overview',
      'Untitled dashboard',
    ])
    expect(select).toHaveValue('db_1')

    fireEvent.change(select, { target: { value: 'db_2' } })
    expect(labels()).toEqual(['By advisor'])
    expect(stub.mounted).toHaveLength(2)
    expect(stub.mounted[1].props).toMatchObject({ dashboardId: 'db_2', isProjectDashboard: true })
    expect(stub.mounted[1].executeCachedDashboard).toHaveBeenCalledTimes(1)
    // The ticks start again.
    expect(ticks()).toEqual([false])
    expect(screen.getByRole('button', { name: 'Add tiles' })).toBeDisabled()

    // Back to the first, which has its answers already: nothing is asked again.
    fireEvent.change(select, { target: { value: 'db_1' } })
    expect(stub.mounted).toHaveLength(3)
    expect(stub.mounted[2].executeCachedDashboard).not.toHaveBeenCalled()
    expect(boxes().map((box) => box.disabled)).toEqual([false, false, true, true])
    expect(onTilesChange.mock.calls.map(([id]) => id)).toEqual(['db_1', 'db_2', 'db_1'])
  })

  it('starts with the dashboard asked for, and with its select focused', async () => {
    const other = { ...dashboard('db_2'), name: 'Book of business' }
    open({ dashboards: [dashboard('db_1'), other], initialDashboardId: 'db_2' })
    const select = screen.getByLabelText('Dashboard')
    expect(select).toHaveValue('db_2')
    expect(select).toHaveFocus()
    expect(stub.mounted[0].props).toMatchObject({ dashboardId: 'db_2', title: 'Book of business' })
  })

  it('draws the dashboard read-only, with the host’s settings', () => {
    const autoQLConfig = { projectId: 'p1', enableDrilldowns: false }
    const dataFormatting = { currencyCode: 'CAD' }
    open({ autoQLConfig, dataFormatting })
    expect(stub.mounted[0].props).toMatchObject({
      authentication: AUTH,
      autoQLConfig,
      dataFormatting,
      dashboardId: 'db_1',
      title: 'Firm overview',
      isProjectDashboard: false,
      isEditing: false,
      isEditable: false,
      showToolbar: false,
      enableSlicers: false,
      executeOnMount: false,
      executeOnStopEditing: false,
      enableAutoRefresh: true,
      enableDynamicCharting: true,
      preferRegularTableInitialDisplayType: true,
      enableMagicWand: false,
    })
  })

  it('waits for the dashboards, and says when there are none or a dashboard has no tiles', () => {
    const { rerender } = render(dialog({ dashboards: null }))
    expect(screen.getByText('Loading dashboards…')).toBeInTheDocument()
    expect(stub.mounted).toHaveLength(0)

    rerender(dialog({ dashboards: [] }))
    expect(screen.getByText('You have no dashboards yet.')).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.queryByText('This dashboard has no tiles.')).toBeNull()

    rerender(dialog({ dashboards: [dashboard('db_1', { tiles: [] })] }))
    expect(screen.getByText('This dashboard has no tiles.')).toBeInTheDocument()
    expect(stub.mounted[0].executeCachedDashboard).not.toHaveBeenCalled()
  })

  it('closes without adding anything', () => {
    const { onAdd, onClose } = open()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onAdd).not.toHaveBeenCalled()
  })
})
