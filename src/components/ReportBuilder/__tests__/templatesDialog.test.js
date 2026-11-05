import React from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import { matchingTemplates, TemplatesDialog } from '../workspace/TemplatesDialog'
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

// The filter lock's field (RW-351) as a button that picks the lock a test sets: the popover is FilterLockField's own.
const mockLock = { next: [] }
jest.mock('../components/FilterLockField', () => ({
  FilterLockField: (props) => (
    <button type='button' data-test='mock-filter-lock' onClick={() => props.onChange(mockLock.next)}>
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
    expect(await screen.findByTestId('preview-builder')).toHaveTextContent('t2 report')
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
    await screen.findByText('t1 report')
    fireEvent.click(screen.getAllByTestId('reports-templates-item')[1])
    expect(screen.getByTestId('preview-builder')).toHaveTextContent('t2 report')
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
    expect(first).toEqual({ templateId: 't1', id: expect.stringMatching(/^[0-9a-f-]{36}$/) })
    expect(again).toEqual(first)
  })

  it('starts it for the filter lock chosen beside Start report, as another report for another lock', async () => {
    const BROWN = { key: 'household', value: 'Brown Family', filter_type: 'include' }
    const { onStart } = setup({
      enableFilterLocks: true,
      filterLockLabels: { title: 'Households', none: 'All households' },
    })
    await waitFor(() => expect(names()).toHaveLength(3))
    fireEvent.click(screen.getAllByTestId('reports-templates-item')[0])
    await waitFor(() => expect(startButton()).toBeEnabled())
    expect(screen.getByTestId('reports-templates-lock')).toHaveTextContent('HouseholdsAll households')

    await act(async () => fireEvent.click(startButton()))
    mockLock.next = [BROWN]
    fireEvent.click(screen.getByTestId('mock-filter-lock'))
    expect(screen.getByTestId('reports-templates-lock')).toHaveTextContent('Brown Family')
    await act(async () => fireEvent.click(startButton()))

    const [everything, brown] = onStart.mock.calls.map(([call]) => call)
    expect(everything).toEqual({ templateId: 't1', id: expect.stringMatching(/^[0-9a-f-]{36}$/) })
    expect(brown).toEqual({
      templateId: 't1',
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      sessionFilterLocks: [BROWN],
    })
    expect(brown.id).not.toBe(everything.id)
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

    it('starts the report for it once its document is in, or for what’s chosen instead, and says none', async () => {
      const { onStart } = setup({ enableFilterLocks: true, filterLockLabels: LABELS })
      await chooseFirst()
      expect(startButton()).toBeDisabled()
      await act(async () => arrive())
      expect(lockShown()).toHaveTextContent('Brown Family')
      expect(mockBuilder.props.report.sessionFilterLocks).toStrictEqual([BROWN])
      await act(async () => fireEvent.click(startButton()))

      mockLock.next = [NGUYEN]
      fireEvent.click(screen.getByTestId('mock-filter-lock'))
      expect(mockBuilder.props.report.sessionFilterLocks).toStrictEqual([NGUYEN])
      await act(async () => fireEvent.click(startButton()))

      mockLock.next = []
      fireEvent.click(screen.getByTestId('mock-filter-lock'))
      expect(lockShown()).toHaveTextContent('All households')
      expect(mockBuilder.props.report).not.toHaveProperty('sessionFilterLocks')
      await act(async () => fireEvent.click(startButton()))

      const [brown, nguyen, everything] = onStart.mock.calls.map(([call]) => call)
      expect(brown).toEqual({ templateId: 't1', id: expect.any(String), sessionFilterLocks: [BROWN] })
      expect(nguyen).toEqual({ templateId: 't1', id: expect.any(String), sessionFilterLocks: [NGUYEN] })
      expect(everything).toEqual({ templateId: 't1', id: expect.any(String), sessionFilterLocks: [] })
      expect(new Set([brown.id, nguyen.id, everything.id]).size).toBe(3)
    })

    it('goes back to what each template is for when another is chosen', async () => {
      const { onStart } = setup({ enableFilterLocks: true, filterLockLabels: LABELS })
      await chooseFirst()
      await act(async () => arrive())
      fireEvent.click(screen.getAllByTestId('reports-templates-item')[1])
      await waitFor(() => expect(mockBuilder.props.report.title).toBe('t2 report'))
      expect(lockShown()).toHaveTextContent('All households')
      await act(async () => fireEvent.click(startButton()))
      expect(onStart).toHaveBeenLastCalledWith({ templateId: 't2', id: expect.any(String) })

      fireEvent.click(screen.getAllByTestId('reports-templates-item')[0])
      expect(lockShown()).toHaveTextContent('Brown Family')
    })

    it('keeps what was chosen beside Start report while the template’s document came', async () => {
      setup({ enableFilterLocks: true, filterLockLabels: LABELS })
      await chooseFirst()
      mockLock.next = [NGUYEN]
      fireEvent.click(screen.getByTestId('mock-filter-lock'))
      await act(async () => arrive())
      expect(lockShown()).toHaveTextContent('Nguyen Family')
      expect(mockBuilder.props.report.sessionFilterLocks).toStrictEqual([NGUYEN])
    })

    it('starts it as before without enableFilterLocks: shown as the template has it, started without', async () => {
      const { onStart } = setup()
      await chooseFirst()
      await act(async () => arrive())
      expect(mockBuilder.props.report.sessionFilterLocks).toStrictEqual([BROWN])
      await act(async () => fireEvent.click(startButton()))
      expect(onStart).toHaveBeenCalledWith({ templateId: 't1', id: expect.any(String) })
    })
  })

  it('has no filter lock to choose without enableFilterLocks', async () => {
    setup()
    await waitFor(() => expect(names()).toHaveLength(3))
    expect(screen.queryByTestId('reports-templates-lock')).toBeNull()
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
