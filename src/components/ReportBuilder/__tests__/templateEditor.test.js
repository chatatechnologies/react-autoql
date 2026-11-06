import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { TemplateEditor, templateDocumentOf } from '../workspace/TemplateEditor'
import { fetchReportCategories, ReportsApiError } from '../run/reportsApi'
import {
  discardTemplateDraft,
  fetchManagedTemplate,
  publishTemplate,
  saveTemplateDraft,
  updateTemplate,
} from '../run/templatesApi'
import { captureQuestion } from '../run/captureRun'

// A template opened from Manage templates › Edit: the whole of it in the builder, its questions asked on the admin's
// data to show how its reports will look, and saved only with Save — into a draft, or kept apart from a published
// template until it's published (RW-361).

jest.mock('../run/captureRun', () => ({ captureQuestion: jest.fn() }))
jest.mock('../run/reportsApi', () => ({
  ...jest.requireActual('../run/reportsApi'),
  fetchReportCategories: jest.fn(),
}))
jest.mock('../run/templatesApi', () => ({
  ...jest.requireActual('../run/templatesApi'),
  fetchManagedTemplate: jest.fn(),
  updateTemplate: jest.fn(),
  saveTemplateDraft: jest.fn(),
  discardTemplateDraft: jest.fn(),
  publishTemplate: jest.fn(),
}))

// The builder is a stand-in that shows what it was given and hands back edits.
const mockBuilder = { props: null }
jest.mock('../ReportBuilder', () => ({
  ReportBuilder: (props) => {
    mockBuilder.props = props
    return <div data-test='builder' data-readonly={props.readOnly || undefined} />
  },
}))

const AUTH = { apiKey: 'k', domain: 'https://example.test', token: 't' }
const CONFIG = { enableDrilldowns: true }
const BROWN = [{ key: 'household', value: 'Brown Family', filter_type: 'include' }]
const answerTo = (query) => ({
  version: 1,
  capturedAt: '2026-11-05T18:00:00Z',
  displayType: 'table',
  data: { columns: [{ name: 'aum' }], rows: [[1]], count_rows: 1 },
  config: { query },
})
const question = (id, rest = {}) => ({
  id,
  type: 'data',
  rows: 25,
  source: { type: 'query', query: `question ${id}` },
  ...rest,
})
const DOCUMENT = {
  schemaVersion: 1,
  title: 'Monthly review',
  page: {},
  sessionFilterLocks: BROWN,
  blocks: [{ id: 'h1', type: 'heading', text: 'Overview' }, question('d1'), question('d2', { askedHere: true })],
}
const template = (rest = {}) => ({
  id: 'tp1',
  scope: 'ORGANIZATION',
  organizationId: 'org',
  title: 'Monthly review',
  description: 'One for each household',
  categoryId: 'c1',
  tags: ['Monthly'],
  status: 'DRAFT',
  updatedAt: '2026-11-05T15:00:00Z',
  report: DOCUMENT,
  ...rest,
})

const open = async (props = {}) => {
  const onClose = jest.fn()
  const ref = React.createRef()
  render(
    <TemplateEditor
      ref={ref}
      authentication={AUTH}
      templateId='tp1'
      title='Monthly review'
      builderProps={{ authentication: AUTH, autoQLConfig: CONFIG }}
      onClose={onClose}
      {...props}
    />,
  )
  return { onClose, ref }
}

// Opened, with every question answered.
const openFilled = async (props) => {
  const opened = await open(props)
  await waitFor(() => expect(mockBuilder.props?.readOnly).toBe(false))
  return opened
}

const button = (test) => screen.getByTestId(`reports-template-editor-${test}`)
const click = (test) => act(async () => fireEvent.click(button(test)))
const editTitle = (title) => act(() => mockBuilder.props.onChange({ ...mockBuilder.props.report, title }))

beforeEach(() => {
  jest.clearAllMocks()
  mockBuilder.props = null
  fetchReportCategories.mockResolvedValue([{ id: 'c1', scope: 'ORGANIZATION', organizationId: 'org', name: 'Reviews' }])
  fetchManagedTemplate.mockResolvedValue(template())
  captureQuestion.mockImplementation(async ({ query }) => ({ ok: true, capture: answerTo(query) }))
  updateTemplate.mockImplementation(async ({ id, title }) => template({ id, title }))
  saveTemplateDraft.mockImplementation(async ({ id }) => template({ id, status: 'PUBLISHED', hasDraft: true }))
  publishTemplate.mockResolvedValue(null)
  discardTemplateDraft.mockResolvedValue(undefined)
})

describe('templateDocumentOf', () => {
  it('leaves out the answers, and makes every question one its reports can ask again', () => {
    const report = {
      ...DOCUMENT,
      blocks: [
        DOCUMENT.blocks[0],
        question('d1', { capture: answerTo('question d1') }),
        { ...question('d2'), capture: { queryResponse: { data: 1 } } },
        { id: 'd3', type: 'data', rows: 25, analysis: { queryResponse: { rows: [] }, focus: 'Fees' } },
      ],
    }
    const document = templateDocumentOf(report)
    expect(document.blocks[0]).toEqual(DOCUMENT.blocks[0])
    expect(document.blocks[1]).toEqual(question('d1', { askedHere: true }))
    expect(document.blocks[2]).toEqual(question('d2', { askedHere: true }))
    expect(document.blocks[3]).toEqual({ id: 'd3', type: 'data', rows: 25, analysis: { focus: 'Fees' } })
    expect(document.sessionFilterLocks).toEqual(BROWN)
    expect(report.blocks[1].capture).toBeTruthy()
  })
})

describe('TemplateEditor', () => {
  it('opens the template in the builder, its questions asked on the admin’s data, read-only until they’re answered', async () => {
    const answers = []
    captureQuestion.mockImplementation(
      (ask) => new Promise((resolve) => answers.push(() => resolve({ ok: true, capture: answerTo(ask.query) }))),
    )
    await open()
    await waitFor(() => expect(mockBuilder.props).not.toBeNull())

    expect(mockBuilder.props.readOnly).toBe(true)
    expect(mockBuilder.props.dataFill).toEqual({ state: 'filling' })
    expect(mockBuilder.props.autoQLConfig).toBe(CONFIG)
    expect(button('fill')).toHaveTextContent(
      'Asking its questions on your data, to show how its reports will look: 0 of 2',
    )
    expect(captureQuestion).toHaveBeenCalledTimes(2)
    expect(captureQuestion).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'question d1',
        authentication: AUTH,
        autoQLConfig: CONFIG,
        filters: BROWN,
        rerun: { kept: undefined, displayType: undefined },
      }),
    )
    // Nothing can be changed meanwhile.
    expect(button('save')).toBeDisabled()
    expect(button('publish')).toBeDisabled()
    expect(button('name')).toBeDisabled()

    await act(async () => answers.forEach((answer) => answer()))
    expect(mockBuilder.props.readOnly).toBe(false)
    expect(mockBuilder.props.dataFill).toBeNull()
    expect(mockBuilder.props.report.blocks[1].capture).toEqual(answerTo('question d1'))
    // Every question can be asked again here, as in the reports started from it.
    expect(mockBuilder.props.report.blocks.filter((block) => block.askedHere).map((block) => block.id)).toEqual([
      'd1',
      'd2',
    ])
    expect(button('fill')).toHaveTextContent('The template doesn’t keep the answers.')
    expect(button('name')).toHaveTextContent('Monthly review')
    expect(screen.getByText('Draft')).toBeInTheDocument()
    expect(button('close')).toHaveTextContent('Close')
    expect(button('save')).toBeDisabled()
    expect(updateTemplate).not.toHaveBeenCalled()
  })

  it('says which questions couldn’t be answered, for the builder to show', async () => {
    captureQuestion.mockImplementation(async ({ query }) =>
      query === 'question d2'
        ? { ok: false, reason: 'error', error: { message: 'The query failed' } }
        : { ok: true, capture: answerTo(query) },
    )
    await openFilled()
    expect(mockBuilder.props.dataFill).toEqual({
      state: 'filled',
      errors: { d2: { reason: 'query_failed', message: 'The query failed' } },
    })
    expect(button('fill')).toHaveTextContent(
      '1 of 2 questions were answered. Select the others to see why, and Rerun them.',
    )
  })

  it('saves a draft’s changes into it, without the answers shown', async () => {
    await openFilled()
    editTitle('Monthly client review')
    expect(button('close')).toHaveTextContent('Cancel')
    await click('save')

    expect(updateTemplate).toHaveBeenCalledWith({
      authentication: AUTH,
      id: 'tp1',
      title: 'Monthly review',
      description: 'One for each household',
      categoryId: 'c1',
      tags: ['Monthly'],
      document: {
        ...DOCUMENT,
        title: 'Monthly client review',
        blocks: [DOCUMENT.blocks[0], question('d1', { askedHere: true }), question('d2', { askedHere: true })],
      },
    })
    expect(saveTemplateDraft).not.toHaveBeenCalled()
    expect(button('saved')).toHaveTextContent('Saved. Publish it in Manage templates, or here')
    expect(button('close')).toHaveTextContent('Close')
    expect(button('save')).toBeDisabled()
    // What's shown keeps its answers.
    expect(mockBuilder.props.report.blocks[1].capture).toBeTruthy()
  })

  it('renames it by its name, and changes its details in Details…, all saved with Save', async () => {
    await openFilled()
    fireEvent.click(button('name'))
    fireEvent.change(button('name-input'), { target: { value: 'Unused' } })
    fireEvent.keyDown(button('name-input'), { key: 'Escape' })
    expect(button('name')).toHaveTextContent('Monthly review')
    expect(button('save')).toBeDisabled()

    fireEvent.click(button('name'))
    fireEvent.change(button('name-input'), { target: { value: ' Monthly household review ' } })
    fireEvent.keyDown(button('name-input'), { key: 'Enter' })
    expect(button('name')).toHaveTextContent('Monthly household review')

    fireEvent.click(button('details'))
    expect(screen.getByTestId('reports-template-title')).toHaveValue('Monthly household review')
    fireEvent.change(screen.getByTestId('reports-template-description'), { target: { value: '' } })
    fireEvent.change(screen.getByTestId('reports-template-tags'), { target: { value: 'Monthly, AUM' } })
    fireEvent.click(button('details-apply'))
    expect(screen.queryByTestId('reports-template-editor-details-dialog')).toBeNull()

    await click('save')
    expect(updateTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Monthly household review',
        description: null,
        categoryId: 'c1',
        tags: ['Monthly', 'AUM'],
      }),
    )
  })

  it('turns down details the service wouldn’t take before keeping them', async () => {
    await openFilled()
    fireEvent.click(button('details'))
    const tags = Array.from({ length: 21 }, (_, i) => `t${i}`).join(',')
    fireEvent.change(screen.getByTestId('reports-template-tags'), { target: { value: tags } })
    fireEvent.click(button('details-apply'))
    expect(screen.getByText('These details can’t be used: a template can carry up to 20 tags.')).toBeInTheDocument()
    expect(button('save')).toBeDisabled()
  })

  it('publishes a draft, saving what’s changed first, then goes back to Manage templates', async () => {
    const { onClose } = await openFilled()
    editTitle('Monthly client review')
    await click('publish')

    expect(updateTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'tp1', document: expect.objectContaining({ title: 'Monthly client review' }) }),
    )
    expect(publishTemplate).toHaveBeenCalledWith({ authentication: AUTH, id: 'tp1' })
    expect(updateTemplate.mock.invocationCallOrder[0]).toBeLessThan(publishTemplate.mock.invocationCallOrder[0])
    expect(onClose).toHaveBeenCalled()
  })

  it('says why a change wasn’t saved, naming a block a template can’t keep', async () => {
    updateTemplate.mockRejectedValueOnce(
      new ReportsApiError({ status: 422, code: 'REPORT_TEMPLATE_BLOCK_NOT_PORTABLE', details: { blockId: 'd1' } }),
    )
    const { onClose } = await openFilled()
    editTitle('Monthly client review')
    await click('save')
    expect(button('error')).toHaveTextContent(
      'The template wasn’t saved: “question d1” has no question a template can keep — give it one, or remove it.',
    )
    expect(button('close')).toHaveTextContent('Cancel')

    publishTemplate.mockRejectedValueOnce(new ReportsApiError({ status: 409, code: 'REPORT_LIMIT_EXCEEDED' }))
    await click('publish')
    expect(button('error')).toHaveTextContent(
      'The template wasn’t published: a published template can have up to 50 data blocks.',
    )
    expect(onClose).not.toHaveBeenCalled()
    // Saved before the publish was turned down.
    expect(button('close')).toHaveTextContent('Close')
  })

  it('asks before leaving with changes that aren’t saved', async () => {
    const { onClose } = await openFilled()
    editTitle('Monthly client review')
    fireEvent.click(button('close'))
    expect(screen.getByText('Leave without saving?')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
    expect(screen.queryByText('Leave without saving?')).toBeNull()
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.click(button('close'))
    fireEvent.click(button('leave-confirm'))
    expect(onClose).toHaveBeenCalled()
    expect(updateTemplate).not.toHaveBeenCalled()
  })

  it('leaves at once with nothing to save', async () => {
    const { onClose } = await openFilled()
    fireEvent.click(button('close'))
    expect(onClose).toHaveBeenCalled()
  })

  it('saves with ⌘S from the workspace, and says whether there’s anything to save', async () => {
    const { ref } = await openFilled()
    expect(ref.current.hasUnsaved()).toBe(false)
    ref.current.saveNow()
    expect(updateTemplate).not.toHaveBeenCalled()

    editTitle('Monthly client review')
    expect(ref.current.hasUnsaved()).toBe(true)
    await act(async () => ref.current.saveNow())
    expect(updateTemplate).toHaveBeenCalledTimes(1)
    expect(ref.current.hasUnsaved()).toBe(false)
  })

  describe('a published template, whose changes are kept apart from it until they’re published (RW-361)', () => {
    it('saves them apart, and publishes them in place of it as it was', async () => {
      fetchManagedTemplate.mockResolvedValue(template({ status: 'PUBLISHED', hasDraft: false, draft: null }))
      const { onClose } = await openFilled()
      expect(screen.getByText('Published')).toBeInTheDocument()
      expect(button('publish')).toHaveTextContent('Publish changes')
      expect(button('publish')).toBeDisabled()
      expect(screen.queryByTestId('reports-template-editor-changes')).toBeNull()

      editTitle('Monthly client review')
      await click('save')
      expect(saveTemplateDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          authentication: AUTH,
          id: 'tp1',
          title: 'Monthly review',
          document: expect.objectContaining({ title: 'Monthly client review' }),
        }),
      )
      expect(updateTemplate).not.toHaveBeenCalled()
      expect(button('saved')).toHaveTextContent('Reports are started from the template as it’s published')
      expect(button('changes')).toHaveTextContent('Unpublished changes')
      expect(button('discard')).toBeEnabled()

      await click('publish')
      expect(publishTemplate).toHaveBeenCalledWith({ authentication: AUTH, id: 'tp1' })
      expect(saveTemplateDraft).toHaveBeenCalledTimes(1)
      expect(onClose).toHaveBeenCalled()
    })

    it('opens the changes it has waiting, and discards them once asked', async () => {
      fetchManagedTemplate.mockResolvedValue(
        template({
          status: 'PUBLISHED',
          hasDraft: true,
          draft: {
            title: 'Monthly review (new)',
            description: '',
            categoryId: null,
            tags: [],
            report: { ...DOCUMENT, title: 'Monthly review, new layout' },
            updatedAt: '2026-11-05T17:00:00Z',
          },
        }),
      )
      const { onClose } = await openFilled()
      expect(button('name')).toHaveTextContent('Monthly review (new)')
      expect(mockBuilder.props.report.title).toBe('Monthly review, new layout')
      expect(button('changes')).toHaveTextContent('Unpublished changes')
      expect(button('publish')).toBeEnabled()

      fireEvent.click(button('discard'))
      expect(screen.getByText('Discard the unpublished changes?')).toBeInTheDocument()
      await click('discard-confirm')
      expect(discardTemplateDraft).toHaveBeenCalledWith({ authentication: AUTH, id: 'tp1' })
      expect(onClose).toHaveBeenCalled()
    })

    it('shows one read-only where they can’t be kept apart from it', async () => {
      fetchManagedTemplate.mockResolvedValue(template({ status: 'PUBLISHED' }))
      await open()
      await waitFor(() => expect(button('fill')).toHaveTextContent('The template doesn’t keep the answers.'))
      expect(mockBuilder.props.readOnly).toBe(true)
      expect(screen.getByText('This template is published. Unpublish it in Manage templates to edit it.')).toBeTruthy()
      expect(button('publish')).toBeDisabled()
      expect(button('details')).toBeDisabled()
    })
  })

  it('says when the template couldn’t be opened, and tries again', async () => {
    fetchManagedTemplate.mockRejectedValueOnce(new ReportsApiError({ status: 404, code: 'REPORT_TEMPLATE_NOT_FOUND' }))
    await open()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This template couldn’t be opened: the template no longer exists (it may have been deleted).',
    )
    expect(button('name')).toHaveTextContent('Monthly review')
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Try again' })))
    await waitFor(() => expect(mockBuilder.props?.readOnly).toBe(false))
  })

  it('stops asking its questions once it’s closed', async () => {
    const signals = []
    captureQuestion.mockImplementation(({ signal }) => {
      signals.push(signal)
      return new Promise(() => {})
    })
    const view = render(<TemplateEditor authentication={AUTH} templateId='tp1' builderProps={{}} onClose={jest.fn()} />)
    await waitFor(() => expect(signals).toHaveLength(2))
    view.unmount()
    expect(signals.every((signal) => signal.aborted)).toBe(true)
  })
})
