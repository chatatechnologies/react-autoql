import React from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import { SaveAsTemplateDialog } from '../workspace/SaveAsTemplateDialog'
import { ManageTemplatesDialog } from '../workspace/ManageTemplatesDialog'
import { parseTags } from '../workspace/templateDetails'
import { fetchReportCategories, ReportsApiError } from '../run/reportsApi'
import {
  createTemplateCategory,
  createTemplateFromReport,
  deleteTemplate,
  deleteTemplateCategory,
  fetchManagedCategories,
  fetchManagedTemplates,
  publishTemplate,
  renameTemplateCategory,
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
  fetchManagedCategories: jest.fn(),
  updateTemplate: jest.fn(),
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

  it('says first that what it keeps can still name clients, and starts from the report’s title', async () => {
    open()
    expect(screen.getByText(/Check that it names no clients first/)).toBeInTheDocument()
    expect(screen.getByTestId('reports-template-title')).toHaveValue('Q3 book review')
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
  const open = () => {
    const onClose = jest.fn()
    render(<ManageTemplatesDialog authentication={AUTH} onClose={onClose} />)
    return { onClose }
  }
  const rows = () => screen.queryAllByTestId('reports-manage-template')
  const row = (title) => rows().find((item) => item.textContent.includes(title))

  beforeEach(() => {
    fetchManagedTemplates.mockResolvedValue({
      templates: [
        template('tp2', 'New accounts', { status: 'PUBLISHED', categoryId: 'c1', tags: ['Monthly'] }),
        template('tp1', 'Household review'),
      ],
      totalPages: 1,
    })
  })

  it('lists the organization’s templates, A to Z, drafts and published', async () => {
    open()
    await waitFor(() => expect(rows()).toHaveLength(2))
    expect(rows()[0]).toHaveTextContent('Household review')
    expect(rows()[0]).toHaveTextContent('Draft')
    expect(rows()[1]).toHaveTextContent('New accountsReviews · Monthly · Edited')
    expect(rows()[1]).toHaveTextContent('Published')
  })

  it('publishes a draft and takes a published one back', async () => {
    publishTemplate.mockResolvedValue(null)
    unpublishTemplate.mockResolvedValue(null)
    open()
    await waitFor(() => expect(rows()).toHaveLength(2))

    await act(async () => fireEvent.click(within(row('Household review')).getByTestId('reports-manage-publish')))
    expect(publishTemplate).toHaveBeenCalledWith({ authentication: AUTH, id: 'tp1' })
    expect(row('Household review')).toHaveTextContent('Published')

    await act(async () => fireEvent.click(within(row('New accounts')).getByTestId('reports-manage-publish')))
    expect(unpublishTemplate).toHaveBeenCalledWith({ authentication: AUTH, id: 'tp2' })
    expect(row('New accounts')).toHaveTextContent('Draft')
  })

  it('says why a publish was turned down', async () => {
    publishTemplate.mockRejectedValue(new ReportsApiError({ status: 409, code: 'REPORT_LIMIT_EXCEEDED' }))
    open()
    await waitFor(() => expect(rows()).toHaveLength(2))
    await act(async () => fireEvent.click(within(row('Household review')).getByTestId('reports-manage-publish')))
    expect(
      screen.getByText('The template wasn’t published: a published template can have up to 50 data blocks.'),
    ).toBeInTheDocument()
    expect(row('Household review')).toHaveTextContent('Draft')
  })

  it('changes a template’s details, taking away what’s cleared', async () => {
    updateTemplate.mockImplementation(async ({ id, title }) => template(id, title, { tags: [] }))
    open()
    await waitFor(() => expect(rows()).toHaveLength(2))
    fireEvent.click(within(row('New accounts')).getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByTestId('reports-template-title'), { target: { value: 'Accounts opened' } })
    fireEvent.change(screen.getByTestId('reports-template-tags'), { target: { value: '' } })
    await act(async () => fireEvent.click(screen.getByTestId('reports-manage-save')))

    expect(updateTemplate).toHaveBeenCalledWith({
      authentication: AUTH,
      id: 'tp2',
      title: 'Accounts opened',
      description: null,
      categoryId: 'c1',
      tags: null,
    })
    expect(row('Accounts opened')).toBeTruthy()
    expect(screen.queryByTestId('reports-manage-save')).toBeNull()
  })

  it('deletes a template once asked', async () => {
    deleteTemplate.mockResolvedValue(undefined)
    open()
    await waitFor(() => expect(rows()).toHaveLength(2))
    fireEvent.click(within(row('Household review')).getByRole('button', { name: 'Delete' }))
    expect(screen.getByText('Delete “Household review”? Reports already made from it keep their copy.')).toBeTruthy()
    await act(async () => fireEvent.click(screen.getByTestId('reports-manage-confirm-delete')))
    expect(deleteTemplate).toHaveBeenCalledWith({ authentication: AUTH, id: 'tp1' })
    expect(rows()).toHaveLength(1)
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
