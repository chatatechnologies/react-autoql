import React from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import { batchMinutes, matchingTemplates, TemplatesDialog } from '../workspace/TemplatesDialog'
import { fetchReportCategories, fetchReportTemplate, fetchReportTemplates, ReportsApiError } from '../run/reportsApi'

// New report › Start from a template: the templates published for the data source, searched by title and narrowed by
// category and tags, the one chosen shown as it prints, and the report started from it under an id kept for a retry.

jest.mock('../run/reportsApi', () => ({
  ...jest.requireActual('../run/reportsApi'),
  fetchReportTemplates: jest.fn(),
  fetchReportTemplate: jest.fn(),
  fetchReportCategories: jest.fn(),
}))

// The preview is the builder itself, tested on its own: here a stand-in that shows what it was given.
const mockBuilder = { props: null }
jest.mock('../ReportBuilder', () => ({
  ReportBuilder: (props) => {
    mockBuilder.props = props
    return <div data-test='preview-builder'>{props.report?.title}</div>
  },
}))

// The filter lock's field (RW-351) as a button that picks the lock a test sets, saying what its own button would
// (data-change): the popover is FilterLockField's own.
const mockLock = { next: [] }
jest.mock('../components/FilterLockField', () => ({
  FilterLockField: (props) => (
    <button
      type='button'
      data-test='mock-filter-lock'
      data-change={props.labels?.change || 'Change…'}
      disabled={props.disabled}
      onClick={() => props.onChange(mockLock.next)}
    >
      {props.locks?.length ? props.locks.map((lock) => lock.value).join(', ') : props.labels?.none}
    </button>
  ),
}))

const AUTH = { apiKey: 'k', domain: 'https://example.test', token: 't' }
const template = (id, title, rest = {}) => ({
  id,
  scope: 'ORGANIZATION',
  organizationId: 'org',
  title,
  description: '',
  categoryId: null,
  tags: [],
  status: 'PUBLISHED',
  databaseModel: 'wealth',
  sizeBytes: 10,
  publishedAt: '',
  createdAt: '',
  updatedAt: '',
  ...rest,
})
const TEMPLATES = [
  template('t1', 'Household review', { categoryId: 'c1', tags: ['Quarterly'], description: 'Each household’s AUM' }),
  template('t2', 'New accounts', { categoryId: 'c2', tags: ['Monthly'] }),
  template('t3', 'Quarterly fees', { tags: ['Quarterly', 'Fees'], scope: 'INTEGRATOR', organizationId: null }),
]
const CATEGORIES = [
  { id: 'c2', scope: 'ORGANIZATION', organizationId: 'org', name: 'Onboarding' },
  { id: 'c1', scope: 'INTEGRATOR', organizationId: null, name: 'Client reviews' },
]

const setup = (props = {}) => {
  const onStart = jest.fn(() => Promise.resolve())
  const onClose = jest.fn()
  render(
    <TemplatesDialog
      authentication={AUTH}
      previewProps={{ branding: { name: 'Northwind' }, enableBranding: true }}
      onStart={onStart}
      onClose={onClose}
      {...props}
    />,
  )
  return { onStart, onClose }
}

const names = () => screen.queryAllByTestId('reports-templates-item').map((radio) => radio.closest('label').textContent)
const startButton = () => screen.getByTestId('reports-templates-start')
// Who the report is for, under the templates: 'all', 'some' or 'each'.
const forOption = (key) => screen.getByTestId(`reports-templates-for-${key}`)
// The footer: its buttons, and the line beside them.
const footerButtons = () =>
  within(startButton().parentElement)
    .getAllByRole('button')
    .map((button) => button.textContent)
const status = () => startButton().parentElement.querySelector('[role="status"]')

beforeEach(() => {
  jest.clearAllMocks()
  mockBuilder.props = null
  mockLock.next = []
  fetchReportTemplates.mockResolvedValue({ templates: TEMPLATES, page: 1, pageSize: 200, totalPages: 1, totalItems: 3 })
  fetchReportCategories.mockResolvedValue(CATEGORIES)
  fetchReportTemplate.mockImplementation(async ({ id }) => ({
    ...TEMPLATES.find((t) => t.id === id),
    report: { schemaVersion: 1, title: `${id} report`, page: {}, blocks: [] },
  }))
})

describe('TemplatesDialog', () => {
  it('lists the templates published for the data source, with their category and tags', async () => {
    setup()
    expect(screen.getByText('Loading templates…')).toBeInTheDocument()
    await waitFor(() => expect(names()).toHaveLength(3))
    expect(fetchReportTemplates).toHaveBeenCalledWith(
      expect.objectContaining({ authentication: AUTH, page: 1, pageSize: 200, orderBy: 'title', order: 'asc' }),
    )
    expect(names()[0]).toBe('Household reviewEach household’s AUMClient reviews · Quarterly')
    // Categories A to Z, and every tag the templates carry.
    const category = screen.getByTestId('reports-templates-category')
    expect(
      within(category)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['All categories', 'Client reviews', 'Onboarding'])
    const tags = within(screen.getByRole('group', { name: 'Tags' })).getAllByRole('button')
    expect(tags.map((tag) => tag.textContent)).toEqual(['Fees', 'Monthly', 'Quarterly'])
  })

  it('asks for every page of templates', async () => {
    fetchReportTemplates
      .mockResolvedValueOnce({ templates: TEMPLATES.slice(0, 2), totalPages: 2 })
      .mockResolvedValueOnce({ templates: TEMPLATES.slice(2), totalPages: 2 })
    setup()
    await waitFor(() => expect(names()).toHaveLength(3))
    expect(fetchReportTemplates.mock.calls[1][0]).toMatchObject({ page: 2 })
  })

  it('searches by title, and narrows by category and by any of the tags pressed', async () => {
    setup()
    await waitFor(() => expect(names()).toHaveLength(3))

    fireEvent.change(screen.getByTestId('reports-templates-search'), { target: { value: 'QUARTERLY' } })
    expect(names()).toEqual(['Quarterly feesQuarterly · Fees'])
    fireEvent.change(screen.getByTestId('reports-templates-search'), { target: { value: '' } })

    fireEvent.change(screen.getByTestId('reports-templates-category'), { target: { value: 'c2' } })
    expect(names()).toEqual(['New accountsOnboarding · Monthly'])
    fireEvent.change(screen.getByTestId('reports-templates-category'), { target: { value: '' } })

    const tag = (name) => within(screen.getByRole('group', { name: 'Tags' })).getByRole('button', { name })
    fireEvent.click(tag('Fees'))
    expect(tag('Fees')).toHaveAttribute('aria-pressed', 'true')
    expect(names()).toHaveLength(1)
    fireEvent.click(tag('Monthly'))
    expect(names()).toHaveLength(2)

    fireEvent.change(screen.getByTestId('reports-templates-search'), { target: { value: 'nothing like it' } })
    expect(screen.getByText('No templates match.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(names()).toHaveLength(3)
  })

  it('shows the one chosen as it prints, its data blocks waiting for data', async () => {
    setup()
    await waitFor(() => expect(names()).toHaveLength(3))
    expect(startButton()).toBeDisabled()
    expect(screen.getByText('Choose a template to see it here.')).toBeInTheDocument()

    fireEvent.click(screen.getAllByTestId('reports-templates-item')[1])
    // Titled with the template's name, as its reports are: its document keeps the title of the report it was saved from.
    expect(await screen.findByTestId('preview-builder')).toHaveTextContent('New accounts')
    expect(mockBuilder.props).toMatchObject({
      readOnly: true,
      dataFill: { state: 'template' },
      authentication: AUTH,
      branding: { name: 'Northwind' },
      enableBranding: true,
    })
    expect(fetchReportTemplate).toHaveBeenCalledWith(expect.objectContaining({ id: 't2' }))
    expect(startButton()).not.toBeDisabled()

    // Chosen again later, it's shown from what was fetched.
    fireEvent.click(screen.getAllByTestId('reports-templates-item')[0])
    await waitFor(() => expect(screen.getByTestId('preview-builder')).toHaveTextContent('Household review'))
    fireEvent.click(screen.getAllByTestId('reports-templates-item')[1])
    expect(screen.getByTestId('preview-builder')).toHaveTextContent('New accounts')
    expect(fetchReportTemplate).toHaveBeenCalledTimes(2)
  })

  it('starts the report, and tries again under the same id when the start failed', async () => {
    const { onStart } = setup()
    await waitFor(() => expect(names()).toHaveLength(3))
    fireEvent.click(screen.getAllByTestId('reports-templates-item')[0])

    onStart.mockRejectedValueOnce(new ReportsApiError({ status: 0 }))
    await act(async () => fireEvent.click(startButton()))
    expect(screen.getByText('The report wasn’t started: couldn’t reach the server.')).toBeInTheDocument()

    await act(async () => fireEvent.click(startButton()))
    expect(onStart).toHaveBeenCalledTimes(2)
    const [first, again] = onStart.mock.calls.map(([call]) => call)
    expect(first).toEqual({
      templateId: 't1',
      title: 'Household review',
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
    })
    expect(again).toEqual(first)
  })

  it('starts it for whom it’s chosen for under the templates, as another report for another lock', async () => {
    const BROWN = { key: 'household', value: 'Brown Family', filter_type: 'include' }
    const { onStart } = setup({
      enableFilterLocks: true,
      filterLockLabels: { title: 'Households', none: 'All households' },
    })
    await waitFor(() => expect(names()).toHaveLength(3))
    fireEvent.click(screen.getAllByTestId('reports-templates-item')[0])
    await waitFor(() => expect(startButton()).toBeEnabled())
    // Under the templates, each saying what it makes: everything (the host's word for none), or the households picked.
    // Without onStartEach, there's no report for each.
    const choices = screen.getByRole('radiogroup', { name: 'Households' })
    expect(
      within(choices)
        .getAllByRole('radio')
        .map((radio) => radio.closest('label').textContent),
    ).toEqual(['All householdsOne report across all of them', 'Specific householdsOne report for the ones you pick'])
    expect(forOption('all')).toBeChecked()
    expect(footerButtons()).toEqual(['Back', 'Start report'])
    expect(status().textContent).toBe('')
    await act(async () => fireEvent.click(startButton()))

    // Specific households, with none picked yet: it says so, Change… is Pick…, and there's nothing to start.
    fireEvent.click(forOption('some'))
    expect(screen.getByTestId('mock-filter-lock')).toHaveTextContent('None picked yet')
    expect(screen.getByTestId('mock-filter-lock')).toHaveAttribute('data-change', 'Pick…')
    expect(startButton()).toBeDisabled()
    mockLock.next = [BROWN]
    fireEvent.click(screen.getByTestId('mock-filter-lock'))
    expect(screen.getByTestId('mock-filter-lock')).toHaveTextContent('Brown Family')
    expect(screen.getByTestId('mock-filter-lock')).toHaveAttribute('data-change', 'Change…')
    expect(mockBuilder.props.report.sessionFilterLocks).toStrictEqual([BROWN])
    await act(async () => fireEvent.click(startButton()))

    // Everything again, the same report as before; the households picked are kept, should they be chosen again.
    fireEvent.click(forOption('all'))
    expect(screen.queryByTestId('mock-filter-lock')).toBeNull()
    expect(mockBuilder.props.report).not.toHaveProperty('sessionFilterLocks')
    await act(async () => fireEvent.click(startButton()))
    fireEvent.click(forOption('some'))
    expect(screen.getByTestId('mock-filter-lock')).toHaveTextContent('Brown Family')

    const [everything, brown, everythingAgain] = onStart.mock.calls.map(([call]) => call)
    expect(everythingAgain).toEqual(everything)
    expect(everything).toEqual({
      templateId: 't1',
      title: 'Household review',
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
    })
    expect(brown).toEqual({
      templateId: 't1',
      title: 'Household review',
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      sessionFilterLocks: [BROWN],
    })
    expect(brown.id).not.toBe(everything.id)
  })

  it('has Manage templates beside the templates’ title, and only Back and Start under them', async () => {
    const onManage = jest.fn()
    setup({ onManage })
    await waitFor(() => expect(names()).toHaveLength(3))
    expect(screen.getByRole('heading', { name: 'Templates' })).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('reports-templates-manage'))
    expect(onManage).toHaveBeenCalled()
    expect(footerButtons()).toEqual(['Back', 'Start report'])
  })

  describe('a template made for a filter lock (its document has one)', () => {
    const BROWN = { key: 'household', value: 'Brown Family', filter_type: 'include' }
    const NGUYEN = { key: 'household', value: 'Nguyen Family', filter_type: 'include' }
    const LABELS = { title: 'Households', none: 'All households' }
    // t1's document comes when a test says (`arrive`), made for Brown; the others' at once, without a lock.
    let arrive
    beforeEach(() => {
      fetchReportTemplate.mockImplementation(({ id }) => {
        const report = { schemaVersion: 1, title: `${id} report`, page: {}, blocks: [] }
        const kept = { ...TEMPLATES.find((t) => t.id === id), report }
        if (id !== 't1') {
          return Promise.resolve(kept)
        }
        return new Promise((resolve) => {
          arrive = () => resolve({ ...kept, report: { ...report, sessionFilterLocks: [BROWN] } })
        })
      })
    })
    const chooseFirst = async () => {
      await waitFor(() => expect(names()).toHaveLength(3))
      fireEvent.click(screen.getAllByTestId('reports-templates-item')[0])
    }
    const lockShown = () => screen.getByTestId('reports-templates-lock')

    it('starts the report for it once its document is in, or for what’s chosen instead, or for everything', async () => {
      const { onStart } = setup({ enableFilterLocks: true, filterLockLabels: LABELS })
      await chooseFirst()
      expect(startButton()).toBeDisabled()
      await act(async () => arrive())
      expect(forOption('some')).toBeChecked()
      expect(lockShown()).toHaveTextContent('Brown Family')
      expect(mockBuilder.props.report.sessionFilterLocks).toStrictEqual([BROWN])
      await act(async () => fireEvent.click(startButton()))

      mockLock.next = [NGUYEN]
      fireEvent.click(screen.getByTestId('mock-filter-lock'))
      expect(mockBuilder.props.report.sessionFilterLocks).toStrictEqual([NGUYEN])
      await act(async () => fireEvent.click(startButton()))

      // None picked: nothing to start until one is, or everything is chosen.
      mockLock.next = []
      fireEvent.click(screen.getByTestId('mock-filter-lock'))
      expect(lockShown()).toHaveTextContent('None picked yet')
      expect(startButton()).toBeDisabled()
      fireEvent.click(forOption('all'))
      expect(mockBuilder.props.report).not.toHaveProperty('sessionFilterLocks')
      await act(async () => fireEvent.click(startButton()))

      const [brown, nguyen, everything] = onStart.mock.calls.map(([call]) => call)
      const started = { templateId: 't1', title: 'Household review', id: expect.any(String) }
      expect(brown).toEqual({ ...started, sessionFilterLocks: [BROWN] })
      expect(nguyen).toEqual({ ...started, sessionFilterLocks: [NGUYEN] })
      expect(everything).toEqual({ ...started, sessionFilterLocks: [] })
      expect(new Set([brown.id, nguyen.id, everything.id]).size).toBe(3)
    })

    it('goes back to what each template is for when another is chosen', async () => {
      const { onStart } = setup({ enableFilterLocks: true, filterLockLabels: LABELS })
      await chooseFirst()
      await act(async () => arrive())
      fireEvent.click(screen.getAllByTestId('reports-templates-item')[1])
      await waitFor(() => expect(mockBuilder.props.report.title).toBe('New accounts'))
      expect(forOption('all')).toBeChecked()
      expect(screen.queryByTestId('mock-filter-lock')).toBeNull()
      await act(async () => fireEvent.click(startButton()))
      expect(onStart).toHaveBeenLastCalledWith({ templateId: 't2', title: 'New accounts', id: expect.any(String) })

      fireEvent.click(screen.getAllByTestId('reports-templates-item')[0])
      expect(forOption('some')).toBeChecked()
      expect(lockShown()).toHaveTextContent('Brown Family')
    })

    it('keeps the households picked under the templates while the template’s document came', async () => {
      setup({ enableFilterLocks: true, filterLockLabels: LABELS })
      await chooseFirst()
      fireEvent.click(forOption('some'))
      mockLock.next = [NGUYEN]
      fireEvent.click(screen.getByTestId('mock-filter-lock'))
      await act(async () => arrive())
      expect(lockShown()).toHaveTextContent('Nguyen Family')
      expect(mockBuilder.props.report.sessionFilterLocks).toStrictEqual([NGUYEN])
    })

    it('keeps everything, chosen while the template’s document came', async () => {
      setup({ enableFilterLocks: true, filterLockLabels: LABELS })
      await chooseFirst()
      fireEvent.click(forOption('some'))
      fireEvent.click(forOption('all'))
      await act(async () => arrive())
      expect(forOption('all')).toBeChecked()
      expect(mockBuilder.props.report).not.toHaveProperty('sessionFilterLocks')
    })

    it('starts it as before without enableFilterLocks: shown as the template has it, started without', async () => {
      const { onStart } = setup()
      await chooseFirst()
      await act(async () => arrive())
      expect(mockBuilder.props.report.sessionFilterLocks).toStrictEqual([BROWN])
      await act(async () => fireEvent.click(startButton()))
      expect(onStart).toHaveBeenCalledWith({ templateId: 't1', title: 'Household review', id: expect.any(String) })
    })

    it('starts it under the template’s name before its document is in, where it can be started then', async () => {
      const { onStart } = setup()
      await chooseFirst()
      expect(startButton()).toBeEnabled()
      await act(async () => fireEvent.click(startButton()))
      expect(onStart).toHaveBeenCalledWith({ templateId: 't1', title: 'Household review', id: expect.any(String) })
      await act(async () => arrive())
    })
  })

  describe('a report for each of the households picked, without the host’s list (RW-353)', () => {
    const lock = (value, filterType = 'include') => ({ key: 'household', value, filter_type: filterType })
    const BROWN = lock('Brown Family')
    const NGUYEN = lock('Nguyen Family')
    const open = async (props = {}) => {
      const opened = setup({
        enableFilterLocks: true,
        filterLockLabels: { title: 'Households', none: 'All households' },
        onStartEach: jest.fn(() => Promise.resolve()),
        ...props,
      })
      await waitFor(() => expect(names()).toHaveLength(3))
      fireEvent.click(screen.getAllByTestId('reports-templates-item')[0])
      await waitFor(() => expect(startButton()).toBeEnabled())
      return opened
    }
    const pick = (locks) => {
      mockLock.next = locks
      fireEvent.click(screen.getByTestId('mock-filter-lock'))
    }

    it('starts each under an id of its own, the same when it tries again', async () => {
      const onStartEach = jest
        .fn()
        .mockRejectedValueOnce(new ReportsApiError({ status: 0 }))
        .mockResolvedValue(undefined)
      const { onStart } = await open({ onStartEach })
      fireEvent.click(forOption('each'))
      expect(screen.getByTestId('mock-filter-lock')).toHaveTextContent('None picked yet')
      expect(startButton()).toBeDisabled()
      pick([BROWN, NGUYEN])
      expect(startButton()).toHaveTextContent('Start 2 reports')
      expect(status()).toHaveTextContent('About a minute. Keep this page open while they’re made.')

      // It asks first (RW-371).
      await act(async () => fireEvent.click(startButton()))
      expect(onStartEach).not.toHaveBeenCalled()
      await act(async () => fireEvent.click(startButton()))
      expect(screen.getByText('The report wasn’t started: couldn’t reach the server.')).toBeInTheDocument()
      await act(async () => fireEvent.click(startButton()))
      await act(async () => fireEvent.click(startButton()))

      expect(onStart).not.toHaveBeenCalled()
      const [first, again] = onStartEach.mock.calls.map(([call]) => call)
      expect(first).toEqual({
        templateId: 't1',
        title: 'Household review',
        starts: [
          { id: expect.stringMatching(/^[0-9a-f-]{36}$/), lock: BROWN },
          { id: expect.stringMatching(/^[0-9a-f-]{36}$/), lock: NGUYEN },
        ],
      })
      expect(first.starts[0].id).not.toBe(first.starts[1].id)
      expect(again).toEqual(first)
    })

    it('starts one report for all of those picked under Specific households, kept when Each is chosen', async () => {
      const onStartEach = jest.fn()
      const { onStart } = await open({ onStartEach })
      fireEvent.click(forOption('some'))
      pick([BROWN, NGUYEN])
      expect(startButton()).toHaveTextContent('Start report')
      expect(status().textContent).toBe('')
      await act(async () => fireEvent.click(startButton()))
      expect(onStartEach).not.toHaveBeenCalled()
      expect(onStart).toHaveBeenCalledWith({
        templateId: 't1',
        title: 'Household review',
        id: expect.any(String),
        sessionFilterLocks: [BROWN, NGUYEN],
      })

      fireEvent.click(forOption('each'))
      expect(screen.getByTestId('mock-filter-lock')).toHaveTextContent('Brown Family, Nguyen Family')
      expect(startButton()).toHaveTextContent('Start 2 reports')
    })

    it('won’t start a report for each with a household left out, and says why', async () => {
      await open()
      fireEvent.click(forOption('each'))
      pick([BROWN, lock('Nguyen Family', 'exclude')])
      expect(startButton()).toBeDisabled()
      expect(status()).toHaveTextContent('A report for each can’t be made for excluded households. Remove them.')
      // As one report, it can be.
      fireEvent.click(forOption('some'))
      expect(startButton()).toBeEnabled()
      expect(status().textContent).toBe('')
    })

    it('isn’t offered without onStartEach', async () => {
      await open({ onStartEach: undefined })
      expect(screen.queryByTestId('reports-templates-for-each')).toBeNull()
    })

    it('starts at most 50 at once', async () => {
      await open({ onStartEach: jest.fn() })
      fireEvent.click(forOption('each'))
      pick(Array.from({ length: 51 }, (_, i) => lock(`Household ${i}`)))
      expect(startButton()).toBeDisabled()
      expect(status()).toHaveTextContent('Up to 50 reports can be started at once. Pick fewer.')
      pick(Array.from({ length: 50 }, (_, i) => lock(`Household ${i}`)))
      expect(startButton()).toBeEnabled()
      expect(startButton()).toHaveTextContent('Start 50 reports')
      expect(status()).toHaveTextContent('About 4 minutes. Keep this page open while they’re made.')
    })
  })

  describe('a report for each household in the host’s list (RW-371)', () => {
    const LABELS = { title: 'Households', none: 'All households' }
    const NAMES = ['Nguyen Family', 'Brown Family', 'Brown Family', '  ', 'Adeyemi Family']
    const open = async (props = {}) => {
      const onStartEach = jest.fn(() => Promise.resolve())
      const opened = setup({
        enableFilterLocks: true,
        filterLockLabels: LABELS,
        onStartEach,
        loadFilterLockSuggestions: jest.fn(async () => NAMES),
        ...props,
      })
      await waitFor(() => expect(names()).toHaveLength(3))
      fireEvent.click(screen.getAllByTestId('reports-templates-item')[0])
      await waitFor(() => expect(startButton()).toBeEnabled())
      return { ...opened, onStartEach }
    }
    const count = () => screen.queryByTestId('reports-templates-for-count')
    const editList = () => screen.queryByTestId('reports-templates-edit-list')
    const ticked = () =>
      within(screen.getByTestId('reports-templates-pick'))
        .getAllByRole('checkbox')
        .map((box) => box.checked)
    const pickAll = () => screen.getByTestId('reports-templates-pick-all')

    it('is every household in the host’s list, started by name once it’s asked', async () => {
      const { onStartEach, onStart } = await open()
      expect(
        within(screen.getByRole('radiogroup', { name: 'Households' }))
          .getAllByRole('radio')
          .map((radio) => radio.closest('label').textContent),
      ).toEqual([
        'All householdsOne report across all of them',
        'Specific householdsOne report for the ones you pick',
        'Each householdA separate report for each',
      ])
      expect(count()).toBeNull()
      fireEvent.click(forOption('each'))
      // Each once, without the blank one; and the preview is the template's, for none of them.
      expect(count()).toHaveTextContent('3 of 3 get a report')
      expect(editList()).toHaveTextContent('Edit list…')
      expect(startButton()).toHaveTextContent('Start 3 reports')
      expect(status()).toHaveTextContent('About a minute. Keep this page open while they’re made.')
      expect(mockBuilder.props.report).not.toHaveProperty('sessionFilterLocks')

      fireEvent.click(startButton())
      expect(onStartEach).not.toHaveBeenCalled()
      expect(status()).toHaveTextContent('Make 3 reports? It takes about a minute, and this page has to stay open.')
      expect(footerButtons()).toEqual(['Cancel', 'Make 3 reports'])
      expect(forOption('all')).toBeDisabled()
      expect(editList()).toBeDisabled()
      fireEvent.click(screen.getByTestId('reports-templates-confirm-cancel'))
      expect(status()).toHaveTextContent('About a minute. Keep this page open while they’re made.')
      expect(footerButtons()).toEqual(['Back', 'Start 3 reports'])
      expect(onStartEach).not.toHaveBeenCalled()

      fireEvent.click(startButton())
      await act(async () => fireEvent.click(startButton()))
      expect(onStart).not.toHaveBeenCalled()
      expect(onStartEach).toHaveBeenCalledWith({
        templateId: 't1',
        title: 'Household review',
        starts: ['Adeyemi Family', 'Brown Family', 'Nguyen Family'].map((name) => ({
          id: expect.stringMatching(/^[0-9a-f-]{36}$/),
          name,
        })),
      })
      const ids = onStartEach.mock.calls[0][0].starts.map((start) => start.id)
      expect(new Set(ids).size).toBe(3)
    })

    it('unticks any in the list shown in the preview’s place, or every one to tick a few', async () => {
      await open()
      fireEvent.click(forOption('each'))
      fireEvent.click(editList())
      expect(editList()).toHaveAttribute('aria-expanded', 'true')
      expect(ticked()).toEqual([true, true, true])
      expect(pickAll()).toHaveTextContent('Untick all')
      fireEvent.change(screen.getByTestId('reports-templates-pick-search'), { target: { value: 'brown' } })
      expect(ticked()).toHaveLength(1)
      fireEvent.click(screen.getByRole('checkbox', { name: 'Brown Family' }))
      expect(screen.getByTestId('reports-templates-pick')).toHaveTextContent(
        '2 of 3 get a report. Untick any that shouldn’t.',
      )
      expect(pickAll()).toHaveTextContent('Tick all')
      fireEvent.click(screen.getByTestId('reports-templates-pick-done'))
      expect(screen.queryByTestId('reports-templates-pick')).toBeNull()
      expect(count()).toHaveTextContent('2 of 3 get a report')
      expect(startButton()).toHaveTextContent('Start 2 reports')

      // Every one ticked again, then none, then one.
      fireEvent.click(editList())
      fireEvent.click(pickAll())
      expect(ticked()).toEqual([true, true, true])
      fireEvent.click(pickAll())
      expect(ticked()).toEqual([false, false, false])
      expect(startButton()).toBeDisabled()
      fireEvent.click(screen.getByRole('checkbox', { name: 'Nguyen Family' }))
      expect(startButton()).toHaveTextContent('Start 1 report')
      expect(status()).toHaveTextContent('About a minute. Keep this page open while it’s made.')

      // Another choice closes the list; chosen again, a report for each keeps what's unticked.
      fireEvent.click(forOption('all'))
      expect(screen.queryByTestId('reports-templates-pick')).toBeNull()
      expect(startButton()).toHaveTextContent('Start report')
      expect(status().textContent).toBe('')
      fireEvent.click(forOption('each'))
      expect(count()).toHaveTextContent('1 of 3 get a report')
      expect(screen.queryByTestId('reports-templates-pick')).toBeNull()
    })

    it('says how many are below what’s in sight, and Show more scrolls down to them', async () => {
      await open()
      fireEvent.click(forOption('each'))
      fireEvent.click(editList())
      // jsdom lays nothing out: rows 30px high, in a list 60px high, so two of the three are in sight.
      const list = within(screen.getByTestId('reports-templates-pick')).getByRole('list')
      let scrolled = 0
      Object.defineProperty(list, 'clientHeight', { configurable: true, value: 60 })
      Object.defineProperty(list, 'scrollTop', {
        configurable: true,
        get: () => scrolled,
        set: (value) => {
          scrolled = value
        },
      })
      Array.from(list.children).forEach((item, i) => {
        Object.defineProperty(item, 'offsetTop', { configurable: true, value: i * 30 })
        Object.defineProperty(item, 'offsetHeight', { configurable: true, value: 30 })
      })
      fireEvent.scroll(list)
      await waitFor(() => expect(screen.getByTestId('reports-templates-pick-more')).toHaveTextContent('1 more below'))

      fireEvent.click(screen.getByTestId('reports-templates-pick-more'))
      expect(scrolled).toBeGreaterThan(0)
      expect(screen.queryByTestId('reports-templates-pick-more')).toBeNull()

      // Scrolled back up, it says so again.
      scrolled = 0
      fireEvent.scroll(list)
      await waitFor(() => expect(screen.getByTestId('reports-templates-pick-more')).toBeInTheDocument())
    })

    it('says when there are more than the host’s limit, and won’t start; none for no limit', async () => {
      const many = Array.from({ length: 51 }, (_, i) => `Household ${i}`)
      await open({ batchLimit: 2 })
      fireEvent.click(forOption('each'))
      expect(startButton()).toBeDisabled()
      expect(status()).toHaveTextContent('Up to 2 reports can be started at once. Pick fewer.')
      cleanup()

      await open({ loadFilterLockSuggestions: jest.fn(async () => many) })
      fireEvent.click(forOption('each'))
      expect(status()).toHaveTextContent('Up to 50 reports can be started at once. Pick fewer.')
      cleanup()

      await open({ batchLimit: null, loadFilterLockSuggestions: jest.fn(async () => many) })
      fireEvent.click(forOption('each'))
      expect(startButton()).toBeEnabled()
      expect(startButton()).toHaveTextContent('Start 51 reports')
      expect(status()).toHaveTextContent('About 4 minutes. Keep this page open while they’re made.')
    })

    it('says the list is loading, and won’t start until it’s in', async () => {
      let give
      await open({
        loadFilterLockSuggestions: jest.fn(
          () =>
            new Promise((resolve) => {
              give = resolve
            }),
        ),
      })
      fireEvent.click(forOption('each'))
      expect(count()).toHaveTextContent('Loading the list…')
      expect(editList()).toBeNull()
      expect(startButton()).toBeDisabled()
      await act(async () => give(NAMES))
      expect(count()).toHaveTextContent('3 of 3 get a report')
      expect(startButton()).toBeEnabled()
    })

    it('is for the households picked without the host’s list, or where it couldn’t be loaded', async () => {
      await open({ loadFilterLockSuggestions: undefined })
      fireEvent.click(forOption('each'))
      expect(screen.getByTestId('mock-filter-lock')).toHaveTextContent('None picked yet')
      expect(editList()).toBeNull()
      cleanup()

      await open({ loadFilterLockSuggestions: jest.fn(() => Promise.reject(new Error('no list'))) })
      fireEvent.click(forOption('each'))
      await waitFor(() => expect(screen.getByTestId('mock-filter-lock')).toBeInTheDocument())
      expect(editList()).toBeNull()
    })

    it('is for the list, whatever was picked under Specific households', async () => {
      await open()
      fireEvent.click(forOption('some'))
      mockLock.next = [{ key: 'household', value: 'Nguyen Family', filter_type: 'exclude' }]
      fireEvent.click(screen.getByTestId('mock-filter-lock'))
      fireEvent.click(forOption('each'))
      expect(startButton()).toBeEnabled()
      expect(status()).toHaveTextContent('About a minute. Keep this page open while they’re made.')
    })

    it('stays chosen from one template to the next', async () => {
      await open()
      fireEvent.click(forOption('each'))
      fireEvent.click(screen.getAllByTestId('reports-templates-item')[1])
      await waitFor(() => expect(mockBuilder.props.report.title).toBe('New accounts'))
      expect(forOption('each')).toBeChecked()
      expect(startButton()).toHaveTextContent('Start 3 reports')
    })

    it('says about how long a batch takes: to the minute under ten, to five above', () => {
      expect(batchMinutes(2)).toBe(1)
      expect(batchMinutes(40)).toBe(3)
      expect(batchMinutes(173)).toBe(15)
      expect(batchMinutes(500)).toBe(40)
    })
  })

  it('has nothing to choose who it’s for without enableFilterLocks, nor a title over the templates alone', async () => {
    setup()
    await waitFor(() => expect(names()).toHaveLength(3))
    expect(screen.queryByTestId('reports-templates-lock')).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Templates' })).toBeNull()
  })

  it('says when there are no templates, and when they couldn’t be loaded', async () => {
    fetchReportTemplates.mockResolvedValueOnce({ templates: [], totalPages: 1 })
    const { unmount } = render(<TemplatesDialog authentication={AUTH} onStart={jest.fn()} onClose={jest.fn()} />)
    expect(await screen.findByText('No templates have been published for this data source yet.')).toBeInTheDocument()
    unmount()

    fetchReportTemplates.mockRejectedValueOnce(new ReportsApiError({ status: 500 }))
    setup()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Templates couldn’t be loaded: the server had a problem.',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(names()).toHaveLength(3))
  })

  it('goes back to New report', async () => {
    const { onClose } = setup()
    await waitFor(() => expect(names()).toHaveLength(3))
    fireEvent.click(screen.getByTestId('reports-templates-back'))
    expect(onClose).toHaveBeenCalled()
  })
})

describe('matchingTemplates', () => {
  it('keeps all of them with nothing to narrow by, and matches a tag as it’s spelled', () => {
    expect(matchingTemplates(TEMPLATES)).toHaveLength(3)
    expect(matchingTemplates(TEMPLATES, { q: '  ', categoryId: '', tags: [] })).toHaveLength(3)
    expect(matchingTemplates(TEMPLATES, { tags: ['quarterly'] })).toHaveLength(0)
  })
})
