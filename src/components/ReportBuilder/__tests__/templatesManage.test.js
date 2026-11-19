import React from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import { SaveAsTemplateDialog } from '../workspace/SaveAsTemplateDialog'
import { ManageTemplatesDialog, questionPlacement } from '../workspace/ManageTemplatesDialog'
import { detailsProblem, parseTags } from '../workspace/templateDetails'
import { REPORTS_STRINGS } from '../workspace/reportsStrings'
import { fetchReportCategories, ReportsApiError } from '../run/reportsApi'
import {
  createTemplateCategory,
  createTemplateFromReport,
  deleteTemplate,
  deleteTemplateCategory,
  discardTemplateDraft,
  fetchManagedCategories,
  fetchManagedTemplate,
  fetchManagedTemplates,
  publishTemplate,
  renameTemplateCategory,
  saveTemplateDraft,
  unpublishTemplate,
  updateTemplate,
} from '../run/templatesApi'

// Save as template, and Manage templates: what an organization's admins do with its templates and categories.

jest.mock('../run/reportsApi', () => ({
  ...jest.requireActual('../run/reportsApi'),
  fetchReportCategories: jest.fn(),
}))
jest.mock('../run/templatesApi', () => ({
  ...jest.requireActual('../run/templatesApi'),
  createTemplateFromReport: jest.fn(),
  fetchManagedTemplates: jest.fn(),
  fetchManagedTemplate: jest.fn(),
  fetchManagedCategories: jest.fn(),
  updateTemplate: jest.fn(),
  saveTemplateDraft: jest.fn(),
  discardTemplateDraft: jest.fn(),
  publishTemplate: jest.fn(),
  unpublishTemplate: jest.fn(),
  deleteTemplate: jest.fn(),
  createTemplateCategory: jest.fn(),
  renameTemplateCategory: jest.fn(),
  deleteTemplateCategory: jest.fn(),
}))

const AUTH = { apiKey: 'k', domain: 'https://example.test', token: 't' }
const REPORT = {
  schemaVersion: 1,
  title: 'Q3 book review',
  page: {},
  blocks: [{ id: 'b7', type: 'data', source: { type: 'query', query: 'aum by household' } }],
}
const ORG_CATEGORY = { id: 'c1', scope: 'ORGANIZATION', organizationId: 'org', name: 'Reviews' }
const SHARED_CATEGORY = { id: 'c0', scope: 'INTEGRATOR', organizationId: null, name: 'Annual' }
const template = (id, title, rest = {}) => ({
  id,
  scope: 'ORGANIZATION',
  organizationId: 'org',
  title,
  description: '',
  categoryId: null,
  tags: [],
  status: 'DRAFT',
  updatedAt: '2026-10-27T15:00:00Z',
  ...rest,
})

beforeEach(() => {
  jest.clearAllMocks()
  fetchReportCategories.mockResolvedValue([ORG_CATEGORY, SHARED_CATEGORY])
  fetchManagedCategories.mockResolvedValue([ORG_CATEGORY])
})

describe('parseTags', () => {
  it('splits on commas, trims, and keeps each tag once whatever its case', () => {
    expect(parseTags(' Quarterly, AUM ,, quarterly,Fees ')).toEqual(['Quarterly', 'AUM', 'Fees'])
    expect(parseTags('')).toEqual([])
  })
})

describe('detailsProblem', () => {
  const details = (rest) => ({ title: 'Quarterly review', description: '', categoryId: '', tags: '', ...rest })
  const E = REPORTS_STRINGS.errors

  it('counts a description by character, as the service does: an emoji is one', () => {
    expect(detailsProblem(details({ description: '📈'.repeat(1024) }))).toBeNull()
    expect(detailsProblem(details({ description: '📈'.repeat(1025) }))).toBe(E.templateNameInvalid)
  })

  it('says a tag is too long, not the title', () => {
    expect(detailsProblem(details({ tags: `Quarterly, ${'a'.repeat(81)}` }))).toBe(E.templateTagInvalid)
    expect(detailsProblem(details({ tags: 'a'.repeat(80) }))).toBeNull()
  })
})

describe('SaveAsTemplateDialog', () => {
  const open = (props = {}) => {
    const flush = jest.fn(() => Promise.resolve(true))
    const onClose = jest.fn()
    const onManage = jest.fn()
    render(
      <SaveAsTemplateDialog
        authentication={AUTH}
        reportId='r1'
        report={REPORT}
        flush={flush}
        onClose={onClose}
        onManage={onManage}
        {...props}
      />,
    )
    return { flush, onClose, onManage }
  }
  const save = () => act(async () => fireEvent.click(screen.getByTestId('reports-save-as-template-save')))
  // What a test here gives the template reads and writes stays with it.
  afterEach(() => {
    fetchManagedTemplate.mockReset()
    updateTemplate.mockReset()
  })

  it('says first that what it keeps can still name clients, and starts from the report’s title', async () => {
    open()
    expect(screen.getByText(/Remove any client names before you save/)).toBeInTheDocument()
    expect(screen.getByTestId('reports-template-title')).toHaveValue('Q3 book review')
    await waitFor(() =>
      expect(within(screen.getByTestId('reports-template-category')).getAllByRole('option')).toHaveLength(3),
    )
  })

  it('says nothing before the fields with enableFilterLocks, whatever the report is for', async () => {
    open({
      enableFilterLocks: true,
      report: { ...REPORT, sessionFilterLocks: [{ key: 'household', value: 'Brown Family', filter_type: 'include' }] },
    })
    expect(screen.queryByText(/Remove any client names/)).toBeNull()
    expect(screen.queryByText(/Brown Family/)).toBeNull()
    expect(screen.getByTestId('reports-template-title')).toHaveValue('Q3 book review')
    await waitFor(() =>
      expect(within(screen.getByTestId('reports-template-category')).getAllByRole('option')).toHaveLength(3),
    )
  })

  it('warns about client names without enableFilterLocks, whatever the report is for', async () => {
    open({
      report: { ...REPORT, sessionFilterLocks: [{ key: 'household', value: 'Brown Family', filter_type: 'include' }] },
    })
    expect(screen.getByText(/Remove any client names before you save/)).toBeInTheDocument()
    await waitFor(() =>
      expect(within(screen.getByTestId('reports-template-category')).getAllByRole('option')).toHaveLength(3),
    )
  })

  it('saves the report first, then makes the draft from it with the details given', async () => {
    createTemplateFromReport.mockResolvedValue(template('tp1', 'Quarterly review'))
    const { flush, onManage } = open()
    fireEvent.change(screen.getByTestId('reports-template-title'), { target: { value: ' Quarterly review ' } })
    fireEvent.change(screen.getByTestId('reports-template-tags'), { target: { value: 'Quarterly, AUM' } })
    await waitFor(() => expect(screen.getByTestId('reports-template-category')).toBeInTheDocument())
    fireEvent.change(screen.getByTestId('reports-template-category'), { target: { value: 'c1' } })
    await save()

    expect(flush).toHaveBeenCalled()
    expect(createTemplateFromReport).toHaveBeenCalledWith({
      authentication: AUTH,
      reportId: 'r1',
      title: 'Quarterly review',
      description: undefined,
      categoryId: 'c1',
      tags: ['Quarterly', 'AUM'],
    })
    expect(screen.getByTestId('reports-save-as-template-saved')).toHaveTextContent(
      '“Quarterly review” is saved as a draft.',
    )
    fireEvent.click(screen.getByTestId('reports-save-as-template-manage'))
    expect(onManage).toHaveBeenCalled()
  })

  it('marks every question in the draft as one its reports can ask again, as a report doesn’t', async () => {
    createTemplateFromReport.mockResolvedValue(template('tp1', 'Quarterly review'))
    const document = {
      ...REPORT,
      blocks: [
        { id: 'b7', type: 'data', source: { type: 'query', query: 'aum by household' } },
        { id: 'b8', type: 'data', source: { type: 'query', query: 'cash by account' }, askedHere: true },
        { id: 'h1', type: 'heading', text: 'Q3' },
      ],
    }
    fetchManagedTemplate.mockResolvedValue({ ...template('tp1', 'Quarterly review'), report: document })
    updateTemplate.mockResolvedValue(template('tp1', 'Quarterly review'))
    open()
    await save()

    expect(fetchManagedTemplate).toHaveBeenCalledWith({ authentication: AUTH, id: 'tp1' })
    expect(updateTemplate).toHaveBeenCalledWith({
      authentication: AUTH,
      id: 'tp1',
      document: { ...document, blocks: [{ ...document.blocks[0], askedHere: true }, ...document.blocks.slice(1)] },
    })
    expect(screen.getByTestId('reports-save-as-template-saved')).toBeInTheDocument()
  })

  it('changes nothing in a draft whose questions are marked already, and keeps one marking couldn’t reach', async () => {
    createTemplateFromReport.mockResolvedValue(template('tp1', 'Quarterly review'))
    fetchManagedTemplate.mockResolvedValueOnce({
      ...template('tp1', 'Quarterly review'),
      report: { ...REPORT, blocks: [{ ...REPORT.blocks[0], askedHere: true }] },
    })
    open()
    await save()
    expect(updateTemplate).not.toHaveBeenCalled()
    expect(screen.getByTestId('reports-save-as-template-saved')).toBeInTheDocument()
  })

  it('titles its pages with the name it’s saved under, where AutoQL copied the report’s', async () => {
    createTemplateFromReport.mockResolvedValue(template('tp1', 'Household Report'))
    // Its questions marked already: only its title is changed.
    const document = { ...REPORT, blocks: [{ ...REPORT.blocks[0], askedHere: true }] }
    fetchManagedTemplate.mockResolvedValue({ ...template('tp1', 'Household Report'), report: document })
    updateTemplate.mockResolvedValue(template('tp1', 'Household Report'))
    open()
    fireEvent.change(screen.getByTestId('reports-template-title'), { target: { value: ' Household Report ' } })
    await save()

    expect(updateTemplate).toHaveBeenCalledWith({
      authentication: AUTH,
      id: 'tp1',
      document: { ...document, title: 'Household Report' },
    })
    expect(screen.getByTestId('reports-save-as-template-saved')).toHaveTextContent(
      '“Household Report” is saved as a draft.',
    )
  })

  it('leaves out an approval the report had (RW-372): AutoQL copies the report as it was', async () => {
    createTemplateFromReport.mockResolvedValue(template('tp1', 'Q3 book review'))
    // Its questions marked already, and titled as it's saved: only the approval is taken out.
    const document = { ...REPORT, blocks: [{ ...REPORT.blocks[0], askedHere: true }] }
    const approval = { name: 'Dana Lee', at: '2026-11-17T18:00:00.000Z', fingerprint: 'abc' }
    fetchManagedTemplate.mockResolvedValue({ ...template('tp1', 'Q3 book review'), report: { ...document, approval } })
    updateTemplate.mockResolvedValue(template('tp1', 'Q3 book review'))
    open()
    await save()

    expect(updateTemplate).toHaveBeenCalledWith({ authentication: AUTH, id: 'tp1', document })
  })

  it('is made even when its questions can’t be marked', async () => {
    createTemplateFromReport.mockResolvedValue(template('tp1', 'Quarterly review'))
    fetchManagedTemplate.mockRejectedValueOnce(new ReportsApiError({ status: 0 }))
    open()
    await save()
    expect(screen.getByTestId('reports-save-as-template-saved')).toHaveTextContent(
      '“Quarterly review” is saved as a draft.',
    )
  })

  it('makes nothing when the report couldn’t be saved first', async () => {
    open({ flush: jest.fn(() => Promise.resolve(false)) })
    await save()
    expect(createTemplateFromReport).not.toHaveBeenCalled()
    expect(screen.getByText(/The report couldn’t be saved first/)).toBeInTheDocument()
  })

  it('names the block a template can’t keep, and says why otherwise', async () => {
    createTemplateFromReport.mockRejectedValueOnce(
      new ReportsApiError({ status: 422, code: 'REPORT_TEMPLATE_BLOCK_NOT_PORTABLE', details: { blockId: 'b7' } }),
    )
    open()
    await save()
    expect(screen.getByText(/“aum by household” has no question a template can keep/)).toBeInTheDocument()

    createTemplateFromReport.mockRejectedValueOnce(new ReportsApiError({ status: 403 }))
    await save()
    expect(
      screen.getByText('The template wasn’t saved: you don’t have permission to manage templates.'),
    ).toBeInTheDocument()
  })

  it('turns down too many tags before asking', async () => {
    open()
    const tags = Array.from({ length: 21 }, (_, i) => `t${i}`).join(',')
    fireEvent.change(screen.getByTestId('reports-template-tags'), { target: { value: tags } })
    await save()
    expect(createTemplateFromReport).not.toHaveBeenCalled()
    expect(screen.getByText('The template wasn’t saved: a template can carry up to 20 tags.')).toBeInTheDocument()
  })
})

describe('ManageTemplatesDialog', () => {
  const open = (props = {}) => {
    const onClose = jest.fn()
    const onEdit = jest.fn()
    render(<ManageTemplatesDialog authentication={AUTH} onEdit={onEdit} onClose={onClose} {...props} />)
    return { onClose, onEdit }
  }
  const rows = () => screen.queryAllByTestId('reports-manage-template')
  const row = (title) => rows().find((item) => item.textContent.includes(title))
  const publishButton = (title) => within(row(title)).getByTestId('reports-manage-publish')
  // A template's Publish, Publish changes or Unpublish, and its question answered (RW-370).
  const publishConfirmed = async (title) => {
    fireEvent.click(publishButton(title))
    await act(async () => fireEvent.click(screen.getByTestId('reports-manage-confirm-publish')))
  }

  beforeEach(() => {
    fetchManagedTemplates.mockResolvedValue({
      templates: [
        template('tp2', 'New accounts', { status: 'PUBLISHED', categoryId: 'c1', tags: ['Monthly'] }),
        template('tp1', 'Household review'),
      ],
      totalPages: 1,
    })
  })

  it('says in the middle when there’s no template yet, how one’s made, and offers New report', async () => {
    fetchManagedTemplates.mockResolvedValue({ templates: [], totalPages: 1 })
    fetchManagedCategories.mockResolvedValue([])
    const onNewReport = jest.fn()
    open({ onNewReport })

    const none = await screen.findByTestId('reports-manage-no-templates')
    expect(none).toHaveTextContent('No templates yet')
    expect(none).toHaveTextContent('Make a report, then save it as a template from its ⋮ menu.')
    fireEvent.click(within(none).getByRole('button', { name: 'New report' }))
    expect(onNewReport).toHaveBeenCalled()

    // The same for categories, with nothing to start from there: one is added above it.
    fireEvent.click(screen.getByTestId('reports-manage-tab-categories'))
    const noCategories = screen.getByTestId('reports-manage-no-categories')
    expect(noCategories).toHaveTextContent('No categories yet')
    expect(within(noCategories).queryByRole('button')).toBeNull()
  })

  it('offers no New report without somewhere to start one', async () => {
    fetchManagedTemplates.mockResolvedValue({ templates: [], totalPages: 1 })
    open()
    const none = await screen.findByTestId('reports-manage-no-templates')
    expect(within(none).queryByRole('button')).toBeNull()
  })

  it('lists the organization’s templates, A to Z, drafts and published', async () => {
    open()
    await waitFor(() => expect(rows()).toHaveLength(2))
    expect(rows()[0]).toHaveTextContent('Household review')
    expect(rows()[0]).toHaveTextContent('Draft')
    expect(rows()[1]).toHaveTextContent('New accountsReviews · Monthly · Edited')
    expect(rows()[1]).toHaveTextContent('Published')
  })

  it('publishes a draft and takes a published one back, once asked', async () => {
    publishTemplate.mockResolvedValue(null)
    unpublishTemplate.mockResolvedValue(null)
    open()
    await waitFor(() => expect(rows()).toHaveLength(2))

    await publishConfirmed('Household review')
    expect(publishTemplate).toHaveBeenCalledWith({ authentication: AUTH, id: 'tp1' })
    expect(publishTemplate).toHaveBeenCalledTimes(1)
    expect(unpublishTemplate).not.toHaveBeenCalled()
    expect(row('Household review')).toHaveTextContent('Published')
    expect(screen.queryByRole('alertdialog')).toBeNull()

    await publishConfirmed('New accounts')
    expect(unpublishTemplate).toHaveBeenCalledWith({ authentication: AUTH, id: 'tp2' })
    expect(unpublishTemplate).toHaveBeenCalledTimes(1)
    expect(publishTemplate).toHaveBeenCalledTimes(1)
    expect(row('New accounts')).toHaveTextContent('Draft')
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('says why a publish was turned down, and asks again', async () => {
    publishTemplate.mockRejectedValue(new ReportsApiError({ status: 409, code: 'REPORT_LIMIT_EXCEEDED' }))
    open()
    await waitFor(() => expect(rows()).toHaveLength(2))
    await publishConfirmed('Household review')
    expect(
      screen.getByText('The template wasn’t published: a published template can have up to 50 data blocks.'),
    ).toBeInTheDocument()
    expect(row('Household review')).toHaveTextContent('Draft')
    // The question stays, to try again or not.
    expect(screen.getByTestId('reports-manage-confirm-publish')).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled()
  })

  describe('asks before publishing or unpublishing a template (RW-370)', () => {
    const question = () => screen.queryByRole('alertdialog')
    const cancel = () => within(question()).getByRole('button', { name: 'Cancel' })

    it('asks before publishing a draft: Cancel and Escape change nothing, and the focus goes back to Publish', async () => {
      publishTemplate.mockResolvedValue(null)
      const { onClose } = open()
      await waitFor(() => expect(rows()).toHaveLength(2))

      fireEvent.click(publishButton('Household review'))
      expect(question()).toHaveAccessibleName('Publish “Household review”?')
      expect(question()).toHaveAccessibleDescription('Everyone in your organization can start reports from it.')
      expect(question()).toHaveTextContent(
        'Publish “Household review”?Everyone in your organization can start reports from it.CancelPublish',
      )
      expect(row('Household review')).toContainElement(question())
      expect(cancel()).toHaveFocus()
      expect(screen.getByTestId('reports-manage-confirm-publish')).toHaveTextContent('Publish')
      expect(screen.getByTestId('reports-manage-confirm-publish')).toHaveAttribute('data-variant', 'primary')

      fireEvent.click(cancel())
      expect(question()).toBeNull()
      expect(publishButton('Household review')).toHaveFocus()

      fireEvent.click(publishButton('Household review'))
      expect(cancel()).toHaveFocus()
      fireEvent.keyDown(cancel(), { key: 'Escape' })
      expect(question()).toBeNull()
      expect(publishButton('Household review')).toHaveFocus()
      // Only the question: Manage templates stays open.
      expect(onClose).not.toHaveBeenCalled()
      expect(screen.getByTestId('reports-manage-templates')).toBeInTheDocument()

      expect(publishTemplate).not.toHaveBeenCalled()
      expect(row('Household review')).toHaveTextContent('Draft')

      await publishConfirmed('Household review')
      expect(publishTemplate).toHaveBeenCalledWith({ authentication: AUTH, id: 'tp1' })
      expect(row('Household review')).toHaveTextContent('Published')
      expect(question()).toBeNull()
      // Back on the same button, Unpublish now.
      expect(publishButton('Household review')).toHaveTextContent('Unpublish')
      expect(publishButton('Household review')).toHaveFocus()
    })

    it('asks before taking a published template back to a draft', async () => {
      unpublishTemplate.mockResolvedValue(null)
      open()
      await waitFor(() => expect(rows()).toHaveLength(2))

      fireEvent.click(publishButton('New accounts'))
      expect(question()).toHaveTextContent(
        'Unpublish “New accounts”?No one can start a report from it until it’s published again. Reports already made from it don’t change.CancelUnpublish',
      )
      expect(cancel()).toHaveFocus()
      fireEvent.keyDown(question(), { key: 'Escape' })
      expect(question()).toBeNull()
      expect(unpublishTemplate).not.toHaveBeenCalled()
      expect(row('New accounts')).toHaveTextContent('Published')
      expect(publishButton('New accounts')).toHaveFocus()

      await publishConfirmed('New accounts')
      expect(unpublishTemplate).toHaveBeenCalledWith({ authentication: AUTH, id: 'tp2' })
      expect(publishTemplate).not.toHaveBeenCalled()
      expect(row('New accounts')).toHaveTextContent('Draft')
      expect(publishButton('New accounts')).toHaveTextContent('Publish')
      expect(publishButton('New accounts')).toHaveFocus()
    })

    it('asks before publishing a published template’s changes (RW-361)', async () => {
      fetchManagedTemplates.mockResolvedValue({
        templates: [template('tp2', 'New accounts', { status: 'PUBLISHED', hasDraft: true })],
        totalPages: 1,
      })
      publishTemplate.mockResolvedValue(null)
      open()
      await waitFor(() => expect(rows()).toHaveLength(1))

      fireEvent.click(publishButton('New accounts'))
      expect(question()).toHaveTextContent(
        'Publish your changes to “New accounts”?Reports started from it from now on use them. Reports already made don’t change.CancelPublish changes',
      )
      fireEvent.click(cancel())
      expect(publishTemplate).not.toHaveBeenCalled()
      expect(row('New accounts')).toHaveTextContent('Unpublished changes')

      await publishConfirmed('New accounts')
      expect(publishTemplate).toHaveBeenCalledWith({ authentication: AUTH, id: 'tp2' })
      expect(unpublishTemplate).not.toHaveBeenCalled()
      expect(row('New accounts')).not.toHaveTextContent('Unpublished changes')
      expect(publishButton('New accounts')).toHaveFocus()
    })

    it('can’t be taken back once it’s on its way: Cancel and Escape wait, and the dialog stays', async () => {
      let publish
      publishTemplate.mockImplementation(() => new Promise((resolve) => (publish = resolve)))
      const { onClose } = open()
      await waitFor(() => expect(rows()).toHaveLength(2))
      fireEvent.click(publishButton('Household review'))
      fireEvent.click(screen.getByTestId('reports-manage-confirm-publish'))

      expect(cancel()).toBeDisabled()
      expect(screen.getByTestId('reports-manage-confirm-publish')).toBeDisabled()
      expect(
        screen.getByTestId('reports-manage-confirm-publish').querySelector('.react-autoql-reports-spin'),
      ).not.toBeNull()
      fireEvent.keyDown(question(), { key: 'Escape' })
      expect(question()).not.toBeNull()
      expect(onClose).not.toHaveBeenCalled()

      await act(async () => publish(null))
      expect(question()).toBeNull()
      expect(row('Household review')).toHaveTextContent('Published')
    })

    it('asks about one template at a time, its Cancel focused each time', async () => {
      open()
      await waitFor(() => expect(rows()).toHaveLength(2))
      fireEvent.click(publishButton('Household review'))
      fireEvent.click(within(row('Household review')).getByTestId('reports-manage-delete'))
      expect(screen.getAllByRole('alertdialog')).toHaveLength(1)
      expect(question()).toHaveTextContent('Delete “Household review”?')
      expect(cancel()).toHaveFocus()

      fireEvent.click(publishButton('New accounts'))
      expect(screen.getAllByRole('alertdialog')).toHaveLength(1)
      expect(row('New accounts')).toContainElement(question())
      expect(cancel()).toHaveFocus()
      fireEvent.click(cancel())
      expect(publishButton('New accounts')).toHaveFocus()
    })

    it('keeps Tab on its two buttons', async () => {
      open()
      await waitFor(() => expect(rows()).toHaveLength(2))
      fireEvent.click(publishButton('Household review'))
      const confirm = screen.getByTestId('reports-manage-confirm-publish')

      expect(fireEvent.keyDown(cancel(), { key: 'Tab' })).toBe(false)
      expect(confirm).toHaveFocus()
      fireEvent.keyDown(confirm, { key: 'Tab' })
      expect(cancel()).toHaveFocus()
      fireEvent.keyDown(cancel(), { key: 'Tab', shiftKey: true })
      expect(confirm).toHaveFocus()
      fireEvent.keyDown(confirm, { key: 'Tab', shiftKey: true })
      expect(cancel()).toHaveFocus()
    })

    it('closes on a click outside it, but not on a click in it or on its button, nor once it’s on its way', async () => {
      let publish
      publishTemplate.mockImplementation(() => new Promise((resolve) => (publish = resolve)))
      const { onClose } = open()
      await waitFor(() => expect(rows()).toHaveLength(2))
      fireEvent.click(publishButton('Household review'))

      fireEvent.mouseDown(within(question()).getByText('Publish “Household review”?'))
      expect(question()).not.toBeNull()
      fireEvent.mouseDown(publishButton('Household review'))
      expect(question()).not.toBeNull()
      fireEvent.mouseDown(screen.getByText(/Reports can be started only from published ones/))
      expect(question()).toBeNull()
      expect(publishButton('Household review')).toHaveFocus()
      expect(publishTemplate).not.toHaveBeenCalled()
      expect(onClose).not.toHaveBeenCalled()

      fireEvent.click(publishButton('Household review'))
      fireEvent.click(screen.getByTestId('reports-manage-confirm-publish'))
      fireEvent.mouseDown(document.body)
      expect(question()).not.toBeNull()
      await act(async () => publish(null))
      expect(question()).toBeNull()
      expect(row('Household review')).toHaveTextContent('Published')
    })

    it('places its card by the button it was asked from, and again when the window is resized', async () => {
      open()
      await waitFor(() => expect(rows()).toHaveLength(2))
      const button = publishButton('New accounts')
      const item = row('New accounts')
      const list = item.closest('.react-autoql-reports-manage')
      const box = (left, top, width, height) => ({
        left,
        top,
        width,
        height,
        right: left + width,
        bottom: top + height,
      })
      let listBottom = 900
      const spies = [
        jest.spyOn(button, 'getBoundingClientRect').mockReturnValue(box(600, 312, 80, 28)),
        jest.spyOn(item, 'getBoundingClientRect').mockReturnValue(box(20, 300, 760, 52)),
        jest.spyOn(list, 'getBoundingClientRect').mockImplementation(() => box(0, 100, 800, listBottom - 100)),
        jest.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(300),
        jest.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(120),
      ]
      const scroll = jest.fn()
      Element.prototype.scrollIntoView = scroll
      try {
        fireEvent.click(button)
        const card = question()
        expect(item).toContainElement(card)
        expect(card.style.left).toBe('376px')
        expect(card.style.right).toBe('auto')
        expect(card.style.top).toBe('48px')
        expect(card.style.getPropertyValue('--rs-question-arrow')).toBe('244px')
        expect(card).toHaveAttribute('data-placement', 'below')
        expect(scroll).toHaveBeenCalledWith({ block: 'nearest' })

        // Less of the list in view: only over the button fits.
        listBottom = 400
        act(() => {
          window.dispatchEvent(new Event('resize'))
        })
        expect(card.style.top).toBe('-116px')
        expect(card).toHaveAttribute('data-placement', 'above')
      } finally {
        spies.forEach((spy) => spy.mockRestore())
        delete Element.prototype.scrollIntoView
      }
    })

    it('stops listening for clicks and resizes once it’s closed', async () => {
      const spies = [
        jest.spyOn(document, 'addEventListener'),
        jest.spyOn(document, 'removeEventListener'),
        jest.spyOn(window, 'addEventListener'),
        jest.spyOn(window, 'removeEventListener'),
      ]
      const [documentOn, documentOff, windowOn, windowOff] = spies
      const handlers = (spy, type) => spy.mock.calls.filter(([on]) => on === type).map(([, handler]) => handler)
      try {
        const view = render(<ManageTemplatesDialog authentication={AUTH} onEdit={jest.fn()} onClose={jest.fn()} />)
        await waitFor(() => expect(rows()).toHaveLength(2))
        view.unmount()
        for (const [on, off, type] of [
          [documentOn, documentOff, 'mousedown'],
          [windowOn, windowOff, 'resize'],
        ]) {
          const removed = handlers(off, type)
          expect(removed).not.toHaveLength(0)
          removed.forEach((handler) => expect(handlers(on, type)).toContain(handler))
        }
      } finally {
        spies.forEach((spy) => spy.mockRestore())
      }
    })

    it('puts the focus back once: it stays where it’s moved after', async () => {
      open()
      await waitFor(() => expect(rows()).toHaveLength(2))
      fireEvent.click(publishButton('Household review'))
      fireEvent.click(cancel())
      expect(publishButton('Household review')).toHaveFocus()

      fireEvent.click(screen.getByTestId('reports-manage-tab-categories'))
      const name = screen.getByTestId('reports-manage-new-category')
      name.focus()
      fireEvent.change(name, { target: { value: 'Fees' } })
      expect(name).toHaveFocus()
    })

    it('leaves the focus on another tab when it’s shown', async () => {
      open()
      await waitFor(() => expect(rows()).toHaveLength(2))
      fireEvent.click(publishButton('Household review'))
      const categories = screen.getByTestId('reports-manage-tab-categories')
      categories.focus()
      fireEvent.click(categories)
      expect(question()).toBeNull()
      expect(categories).toHaveFocus()
    })

    it('puts the focus on the Edit button of the template just edited, once the list is in', async () => {
      let list
      fetchManagedTemplates.mockImplementation(() => new Promise((resolve) => (list = resolve)))
      open({ focusTemplateId: 'tp2' })
      await act(async () =>
        list({
          templates: [template('tp2', 'New accounts', { status: 'PUBLISHED' }), template('tp1', 'Household review')],
          totalPages: 1,
        }),
      )
      expect(within(row('New accounts')).getByTestId('reports-manage-edit')).toHaveFocus()
    })

    it('puts it there after Try again too', async () => {
      fetchManagedTemplates.mockRejectedValueOnce(new ReportsApiError({ status: 0 }))
      open({ focusTemplateId: 'tp2' })
      const retry = await screen.findByRole('button', { name: 'Try again' })
      retry.focus()
      await act(async () => fireEvent.click(retry))
      await waitFor(() => expect(rows()).toHaveLength(2))
      expect(within(row('New accounts')).getByTestId('reports-manage-edit')).toHaveFocus()
    })

    it('leaves the focus where it was moved while the list loaded', async () => {
      let list
      fetchManagedTemplates.mockImplementation(() => new Promise((resolve) => (list = resolve)))
      open({ focusTemplateId: 'tp2' })
      screen.getByTestId('reports-manage-close').focus()
      await act(async () => list({ templates: [template('tp2', 'New accounts')], totalPages: 1 }))
      expect(screen.getByTestId('reports-manage-close')).toHaveFocus()
    })

    it('puts the focus nowhere new without a template just edited', async () => {
      open()
      await waitFor(() => expect(rows()).toHaveLength(2))
      expect(screen.getByTestId('reports-manage-templates')).toHaveFocus()
    })
  })

  it('renames a draft in place, by its title', async () => {
    updateTemplate.mockImplementation(async ({ id, title }) => template(id, title))
    open()
    await waitFor(() => expect(rows()).toHaveLength(2))
    fireEvent.click(within(row('Household review')).getByTestId('reports-manage-title'))
    const input = screen.getByRole('textbox', { name: 'Rename Household review' })
    fireEvent.change(input, { target: { value: 'Not this' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByTestId('reports-manage-title-input')).toBeNull()
    expect(updateTemplate).not.toHaveBeenCalled()

    fireEvent.click(within(row('Household review')).getByTestId('reports-manage-title'))
    fireEvent.change(screen.getByTestId('reports-manage-title-input'), { target: { value: ' Annual review ' } })
    await act(async () => fireEvent.keyDown(screen.getByTestId('reports-manage-title-input'), { key: 'Enter' }))

    expect(updateTemplate).toHaveBeenCalledWith({ authentication: AUTH, id: 'tp1', title: 'Annual review' })
    expect(rows()[0]).toHaveTextContent('Annual review')
    expect(screen.queryByTestId('reports-manage-title-input')).toBeNull()
  })

  it('opens a draft to be edited in the builder', async () => {
    const { onEdit } = open()
    await waitFor(() => expect(rows()).toHaveLength(2))
    fireEvent.click(within(row('Household review')).getByTestId('reports-manage-edit'))
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 'tp1', status: 'DRAFT' }))
  })

  it('offers no Edit without somewhere to edit', async () => {
    open({ onEdit: undefined })
    await waitFor(() => expect(rows()).toHaveLength(2))
    expect(screen.queryByTestId('reports-manage-edit')).toBeNull()
  })

  it('asks to unpublish a published template before it’s edited or renamed, where its changes can’t be kept apart', async () => {
    unpublishTemplate.mockResolvedValue(null)
    const { onEdit } = open()
    await waitFor(() => expect(rows()).toHaveLength(2))

    fireEvent.click(within(row('New accounts')).getByTestId('reports-manage-edit'))
    expect(screen.getByRole('alertdialog')).toHaveAccessibleName(
      '“New accounts” is published. Unpublish it to edit it?',
    )
    expect(screen.getByRole('alertdialog')).toHaveAccessibleDescription(
      'No reports can be started from it until it’s published again.',
    )
    expect(onEdit).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(unpublishTemplate).not.toHaveBeenCalled()
    expect(within(row('New accounts')).getByTestId('reports-manage-edit')).toHaveFocus()

    fireEvent.click(within(row('New accounts')).getByTestId('reports-manage-title'))
    expect(screen.getByText(/Unpublish it to rename it\?/)).toBeTruthy()
    await act(async () => fireEvent.click(screen.getByTestId('reports-manage-confirm-unpublish')))
    expect(unpublishTemplate).toHaveBeenCalledWith({ authentication: AUTH, id: 'tp2' })
    // A draft now, being renamed, its title's field focused.
    const input = screen.getByTestId('reports-manage-title-input')
    expect(input).toHaveValue('New accounts')
    expect(input).toHaveFocus()
    expect(input.closest('[data-test="reports-manage-template"]')).toHaveTextContent('Draft')

    fireEvent.keyDown(screen.getByTestId('reports-manage-title-input'), { key: 'Escape' })
    unpublishTemplate.mockClear()
    // A draft now: edited straight away.
    fireEvent.click(within(row('New accounts')).getByTestId('reports-manage-edit'))
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 'tp2', status: 'DRAFT' }))
    expect(unpublishTemplate).not.toHaveBeenCalled()
  })

  it('unpublishes one, then opens it to be edited', async () => {
    unpublishTemplate.mockResolvedValue(null)
    const { onEdit } = open()
    await waitFor(() => expect(rows()).toHaveLength(2))
    fireEvent.click(within(row('New accounts')).getByTestId('reports-manage-edit'))
    await act(async () => fireEvent.click(screen.getByTestId('reports-manage-confirm-unpublish')))
    expect(unpublishTemplate).toHaveBeenCalledWith({ authentication: AUTH, id: 'tp2' })
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 'tp2', status: 'DRAFT' }))
  })

  describe('where a published template’s changes are kept apart until they’re published (RW-361)', () => {
    const DOCUMENT = { schemaVersion: 1, title: 'New accounts', page: {}, blocks: [] }

    it('edits one straight away', async () => {
      fetchManagedTemplates.mockResolvedValue({
        templates: [template('tp2', 'New accounts', { status: 'PUBLISHED', hasDraft: false })],
        totalPages: 1,
      })
      const { onEdit } = open()
      await waitFor(() => expect(rows()).toHaveLength(1))
      expect(row('New accounts')).not.toHaveTextContent('Unpublished changes')
      fireEvent.click(within(row('New accounts')).getByTestId('reports-manage-edit'))
      expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 'tp2', status: 'PUBLISHED' }))
      expect(unpublishTemplate).not.toHaveBeenCalled()
    })

    it('keeps a new title with its other changes, which stay as they are', async () => {
      fetchManagedTemplates.mockResolvedValue({
        templates: [
          template('tp2', 'New accounts', { status: 'PUBLISHED', categoryId: 'c1', tags: ['Monthly'], hasDraft: true }),
        ],
        totalPages: 1,
      })
      fetchManagedTemplate.mockResolvedValue(
        template('tp2', 'New accounts', {
          status: 'PUBLISHED',
          report: DOCUMENT,
          hasDraft: true,
          draft: {
            title: 'New accounts',
            description: 'Opened this month',
            categoryId: 'c1',
            tags: ['Monthly'],
            report: { ...DOCUMENT, title: 'Accounts opened' },
          },
        }),
      )
      saveTemplateDraft.mockResolvedValue(null)
      open()
      await waitFor(() => expect(rows()).toHaveLength(1))
      fireEvent.click(within(row('New accounts')).getByTestId('reports-manage-title'))
      fireEvent.change(screen.getByTestId('reports-manage-title-input'), { target: { value: 'Accounts opened' } })
      await act(async () => fireEvent.keyDown(screen.getByTestId('reports-manage-title-input'), { key: 'Enter' }))

      expect(saveTemplateDraft).toHaveBeenCalledWith({
        authentication: AUTH,
        id: 'tp2',
        title: 'Accounts opened',
        description: 'Opened this month',
        categoryId: 'c1',
        tags: ['Monthly'],
        document: { ...DOCUMENT, title: 'Accounts opened' },
      })
      expect(updateTemplate).not.toHaveBeenCalled()
      expect(
        screen.getByText('“Accounts opened” is kept with the template’s unpublished changes. Publish them to use it.'),
      ).toBeTruthy()
      expect(row('New accounts')).toHaveTextContent('Unpublished changes')
    })

    it('publishes a template’s changes, or discards them once asked', async () => {
      fetchManagedTemplates.mockResolvedValue({
        templates: [
          template('tp2', 'New accounts', { status: 'PUBLISHED', hasDraft: true }),
          template('tp3', 'Quarterly review', { status: 'PUBLISHED', hasDraft: true }),
        ],
        totalPages: 1,
      })
      publishTemplate.mockResolvedValue(template('tp2', 'Accounts opened', { status: 'PUBLISHED' }))
      discardTemplateDraft.mockResolvedValue(undefined)
      open()
      await waitFor(() => expect(rows()).toHaveLength(2))
      expect(row('New accounts')).toHaveTextContent('Unpublished changes')
      expect(within(row('New accounts')).queryByRole('button', { name: 'Unpublish' })).toBeNull()

      await publishConfirmed('New accounts')
      expect(publishTemplate).toHaveBeenCalledWith({ authentication: AUTH, id: 'tp2' })
      expect(unpublishTemplate).not.toHaveBeenCalled()
      expect(row('Accounts opened')).not.toHaveTextContent('Unpublished changes')
      expect(row('Accounts opened')).toHaveTextContent('Published')

      fireEvent.click(within(row('Quarterly review')).getByTestId('reports-manage-discard'))
      expect(screen.getByRole('alertdialog')).toHaveAccessibleName(
        'Discard the unpublished changes to “Quarterly review”?',
      )
      expect(screen.getByRole('alertdialog')).toHaveAccessibleDescription('It stays as it’s published.')
      await act(async () => fireEvent.click(screen.getByTestId('reports-manage-confirm-discard')))
      expect(discardTemplateDraft).toHaveBeenCalledWith({ authentication: AUTH, id: 'tp3' })
      expect(row('Quarterly review')).not.toHaveTextContent('Unpublished changes')
      expect(row('Quarterly review')).toHaveTextContent('Published')
      // Its Discard changes is gone: the focus is on its Unpublish.
      expect(publishButton('Quarterly review')).toHaveFocus()
    })
  })

  it('deletes a template once asked', async () => {
    deleteTemplate.mockResolvedValue(undefined)
    open()
    await waitFor(() => expect(rows()).toHaveLength(2))
    const remove = within(row('Household review')).getByRole('button', { name: 'Delete' })
    fireEvent.click(remove)
    expect(screen.getByRole('alertdialog')).toHaveAccessibleName('Delete “Household review”?')
    expect(screen.getByRole('alertdialog')).toHaveAccessibleDescription('Reports already made from it keep their copy.')
    expect(screen.getByTestId('reports-manage-confirm-delete')).toHaveAttribute('data-variant', 'danger')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(deleteTemplate).not.toHaveBeenCalled()
    expect(remove).toHaveFocus()

    fireEvent.click(remove)
    await act(async () => fireEvent.click(screen.getByTestId('reports-manage-confirm-delete')))
    expect(deleteTemplate).toHaveBeenCalledWith({ authentication: AUTH, id: 'tp1' })
    expect(rows()).toHaveLength(1)
    // Its row is gone: the focus is on the dialog.
    expect(screen.getByTestId('reports-manage-templates')).toHaveFocus()
  })

  it('adds, renames and deletes the organization’s categories; a deleted one’s templates stay without it', async () => {
    createTemplateCategory.mockResolvedValue({ id: 'c9', scope: 'ORGANIZATION', organizationId: 'org', name: 'Fees' })
    renameTemplateCategory.mockResolvedValue({ ...ORG_CATEGORY, name: 'Client reviews' })
    deleteTemplateCategory.mockResolvedValue(undefined)
    open()
    await waitFor(() => expect(rows()).toHaveLength(2))
    fireEvent.click(screen.getByTestId('reports-manage-tab-categories'))
    const categories = () => screen.getAllByTestId('reports-manage-category').map((item) => item.textContent)
    // Only the organization's own: the shared ones aren't its to change.
    expect(categories()).toEqual(['ReviewsRenameDelete'])

    fireEvent.change(screen.getByTestId('reports-manage-new-category'), { target: { value: ' Fees ' } })
    await act(async () => fireEvent.click(screen.getByTestId('reports-manage-add-category')))
    expect(createTemplateCategory).toHaveBeenCalledWith({ authentication: AUTH, name: 'Fees' })
    expect(categories()).toEqual(['FeesRenameDelete', 'ReviewsRenameDelete'])

    const reviews = screen.getAllByTestId('reports-manage-category')[1]
    fireEvent.click(within(reviews).getByRole('button', { name: 'Rename' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Rename Reviews' }), { target: { value: 'Client reviews' } })
    await act(async () => fireEvent.keyDown(screen.getByRole('textbox', { name: 'Rename Reviews' }), { key: 'Enter' }))
    expect(renameTemplateCategory).toHaveBeenCalledWith({ authentication: AUTH, id: 'c1', name: 'Client reviews' })
    expect(categories()).toContain('Client reviewsRenameDelete')

    const renamed = screen
      .getAllByTestId('reports-manage-category')
      .find((item) => item.textContent.startsWith('Client'))
    fireEvent.click(within(renamed).getByRole('button', { name: 'Delete' }))
    // Asked in a card by its Delete, as a template's changes are.
    expect(renamed).toContainElement(screen.getByRole('alertdialog'))
    expect(screen.getByRole('alertdialog')).toHaveAccessibleName('Delete “Client reviews”?')
    expect(screen.getByRole('alertdialog')).toHaveAccessibleDescription('Its templates stay, without a category.')
    await act(async () => fireEvent.click(screen.getByTestId('reports-manage-confirm-delete')))
    expect(deleteTemplateCategory).toHaveBeenCalledWith({ authentication: AUTH, id: 'c1' })

    fireEvent.click(screen.getByTestId('reports-manage-tab-templates'))
    expect(row('New accounts')).not.toHaveTextContent('Client reviews')
  })

  it('says when the templates couldn’t be loaded', async () => {
    fetchManagedTemplates.mockRejectedValueOnce(new ReportsApiError({ status: 403 }))
    open()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Templates couldn’t be loaded: you don’t have permission to manage templates.',
    )
  })
})

describe('questionPlacement (RW-370)', () => {
  const box = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height })
  const row = box(20, 300, 760, 52)
  const button = box(600, 312, 80, 28)
  const card = { width: 300, height: 120 }

  it('puts the card under the button, its right edge a little past the button’s, its arrow at the button', () => {
    expect(questionPlacement({ button, row, view: { top: 100, bottom: 900 }, ...card })).toEqual({
      left: 376,
      top: 48,
      arrow: 244,
      placement: 'below',
    })
  })

  it('puts it over the button where only that fits in view', () => {
    expect(questionPlacement({ button, row, view: { top: 100, bottom: 400 }, ...card })).toEqual({
      left: 376,
      top: -116,
      arrow: 244,
      placement: 'above',
    })
  })

  it('keeps it under the button where it fits neither way, and where it just fits', () => {
    expect(questionPlacement({ button, row, view: { top: 250, bottom: 400 }, ...card }).placement).toBe('below')
    // Exactly the room it takes, under and over.
    expect(questionPlacement({ button, row, view: { top: 184, bottom: 468 }, ...card }).placement).toBe('below')
    expect(questionPlacement({ button, row, view: { top: 184, bottom: 467 }, ...card }).placement).toBe('above')
  })

  it('keeps it in the row, and its arrow on it, near the row’s ends', () => {
    expect(questionPlacement({ button: box(10, 312, 20, 28), row, view: { top: 0, bottom: 900 }, ...card })).toEqual({
      left: 0,
      top: 48,
      arrow: 14,
      placement: 'below',
    })
    expect(questionPlacement({ button: box(760, 312, 40, 28), row, view: { top: 0, bottom: 900 }, ...card })).toEqual({
      left: 460,
      top: 48,
      arrow: 286,
      placement: 'below',
    })
  })
})
