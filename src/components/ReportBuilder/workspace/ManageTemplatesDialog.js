import React from 'react'
import { Icon } from '../components/icons'
import { fetchReportCategories } from '../run/reportsApi'
import {
  createTemplateCategory,
  deleteTemplate,
  deleteTemplateCategory,
  fetchManagedCategories,
  fetchManagedTemplates,
  publishTemplate,
  renameTemplateCategory,
  unpublishTemplate,
  updateTemplate,
} from '../run/templatesApi'
import { describeReportError } from './documents'
import { ReportModal } from './ReportModal'
import { RS } from './reportsConstants'
import { REPORTS_STRINGS } from './reportsStrings'
import { detailsOf, detailsProblem, detailsToSend, TemplateDetailsFields } from './templateDetails'

// Manage templates (an organization's admins): the organization's templates, drafts and published — each one's details
// changed, published or taken back, or deleted — and its categories, added, renamed or deleted. A change to a published
// template reaches everyone at once; reports already made from one keep their copy whatever happens to it. Each change
// is made one at a time, and what went wrong is said beside the dialog's buttons.
//
// Props: authentication, onClose.

const S = REPORTS_STRINGS
const M = S.manageTemplates

// An organization has at most 500 templates: three pages of the most the service sends at once.
const PAGE_SIZE = 200
const MAX_PAGES = 3

const byTitle = (a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base', numeric: true })
const byName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true })

const listManaged = async (authentication) => {
  const ask = (page) => fetchManagedTemplates({ authentication, page, pageSize: PAGE_SIZE })
  const first = await ask(1)
  const more = []
  for (let page = 2; page <= Math.min(first.totalPages || 1, MAX_PAGES); page += 1) {
    more.push(ask(page))
  }
  return [first, ...(await Promise.all(more))].flatMap((page) => page.templates).sort(byTitle)
}

const dateOf = (iso) => {
  const date = new Date(iso)
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

export class ManageTemplatesDialog extends React.Component {
  state = {
    tab: 'templates',
    templates: null,
    // Those a template can take (the organization's and the integrator's), and the organization's own, which are
    // managed here.
    categories: [],
    ownCategories: null,
    loadError: null,
    // What's being changed: a template's details, a template or category waiting to be deleted, a category's name.
    editingId: null,
    draft: null,
    confirmingId: null,
    renamingId: null,
    renameText: '',
    newCategory: '',
    busyId: null,
    error: null,
  }

  componentDidMount() {
    this.mounted = true
    this.load()
  }

  componentWillUnmount() {
    this.mounted = false
  }

  load = () => {
    const { authentication } = this.props
    this.setState({ templates: null, ownCategories: null, loadError: null })
    Promise.all([
      listManaged(authentication),
      fetchReportCategories({ authentication }),
      fetchManagedCategories({ authentication }),
    ]).then(
      ([templates, categories, ownCategories]) => {
        if (this.mounted) {
          this.setState({
            templates,
            categories: [...categories].sort(byName),
            ownCategories: [...ownCategories].sort(byName),
          })
        }
      },
      (error) => {
        if (this.mounted) {
          this.setState({
            templates: [],
            ownCategories: [],
            loadError: describeReportError(error, 'manageTemplates').message,
          })
        }
      },
    )
  }

  // One change at a time: `run` makes it and resolves with how the lists then are; what went wrong is said.
  change = async (busyId, action, run) => {
    if (this.state.busyId) {
      return
    }
    this.setState({ busyId, error: null })
    try {
      const next = await run()
      if (this.mounted) {
        this.setState({ ...next, busyId: null })
      }
    } catch (error) {
      if (this.mounted) {
        this.setState({ busyId: null, error: describeReportError(error, action).message })
      }
    }
  }

  replaceTemplate = (templates, id, change) =>
    templates.map((template) => (template.id === id ? change(template) : template))

  // ---------------------------------------------------------------- templates

  startEditing = (template) =>
    this.setState({ editingId: template.id, draft: detailsOf(template), confirmingId: null, error: null })

  saveDetails = (template) => {
    const problem = detailsProblem(this.state.draft)
    if (problem) {
      this.setState({ error: `${S.errors.lead.templateDetails}: ${problem}.` })
      return
    }
    const { authentication } = this.props
    this.change(template.id, 'templateDetails', async () => {
      const updated = await updateTemplate({ authentication, id: template.id, ...detailsToSend(this.state.draft) })
      return {
        templates: this.replaceTemplate(this.state.templates, template.id, (old) => ({ ...old, ...updated })).sort(
          byTitle,
        ),
        editingId: null,
        draft: null,
      }
    })
  }

  togglePublished = (template) => {
    const { authentication } = this.props
    const publishing = template.status !== 'PUBLISHED'
    this.change(template.id, publishing ? 'publish' : 'unpublish', async () => {
      const answered = await (publishing ? publishTemplate : unpublishTemplate)({ authentication, id: template.id })
      return {
        templates: this.replaceTemplate(this.state.templates, template.id, (old) => ({
          ...old,
          ...(answered || {}),
          status: publishing ? 'PUBLISHED' : 'DRAFT',
        })),
      }
    })
  }

  removeTemplate = (template) => {
    const { authentication } = this.props
    this.change(template.id, 'deleteTemplate', async () => {
      await deleteTemplate({ authentication, id: template.id })
      return {
        templates: this.state.templates.filter((t) => t.id !== template.id),
        confirmingId: null,
      }
    })
  }

  // ---------------------------------------------------------------- categories

  addCategory = () => {
    const name = this.state.newCategory.trim()
    if (!name) {
      return
    }
    const { authentication } = this.props
    this.change('new-category', 'category', async () => {
      const category = await createTemplateCategory({ authentication, name })
      return {
        newCategory: '',
        ownCategories: [...this.state.ownCategories, category].sort(byName),
        categories: [...this.state.categories, category].sort(byName),
      }
    })
  }

  saveRename = (category) => {
    const name = this.state.renameText.trim()
    if (!name || name === category.name) {
      this.setState({ renamingId: null })
      return
    }
    const { authentication } = this.props
    this.change(category.id, 'category', async () => {
      const renamed = await renameTemplateCategory({ authentication, id: category.id, name })
      const rename = (list) => list.map((c) => (c.id === category.id ? { ...c, ...renamed } : c)).sort(byName)
      return {
        renamingId: null,
        ownCategories: rename(this.state.ownCategories),
        categories: rename(this.state.categories),
      }
    })
  }

  removeCategory = (category) => {
    const { authentication } = this.props
    this.change(category.id, 'deleteCategory', async () => {
      await deleteTemplateCategory({ authentication, id: category.id })
      return {
        confirmingId: null,
        ownCategories: this.state.ownCategories.filter((c) => c.id !== category.id),
        categories: this.state.categories.filter((c) => c.id !== category.id),
        // Its templates stay, without a category.
        templates: (this.state.templates || []).map((t) =>
          t.categoryId === category.id ? { ...t, categoryId: null } : t,
        ),
      }
    })
  }

  // ---------------------------------------------------------------- drawing

  renderConfirm(text, onConfirm, busy) {
    return (
      <div className={`${RS}-manage-confirm`} role='group' aria-label={text}>
        <span>{text}</span>
        <button type='button' className={`${RS}-button`} onClick={() => this.setState({ confirmingId: null })}>
          {S.cancel}
        </button>
        <button
          type='button'
          className={`${RS}-button`}
          data-variant='danger'
          data-test='reports-manage-confirm-delete'
          disabled={busy}
          onClick={onConfirm}
        >
          {M.delete}
        </button>
      </div>
    )
  }

  renderTemplate(template) {
    const { categories, editingId, draft, confirmingId, busyId } = this.state
    const busy = busyId === template.id
    const published = template.status === 'PUBLISHED'
    const category = categories.find((c) => c.id === template.categoryId)?.name
    const meta = [category, ...template.tags, template.updatedAt ? M.edited(dateOf(template.updatedAt)) : null]
      .filter(Boolean)
      .join(' · ')
    return (
      <li key={template.id} className={`${RS}-manage-item`} data-test='reports-manage-template'>
        <div className={`${RS}-manage-row`}>
          <div className={`${RS}-manage-main`}>
            <span className={`${RS}-manage-name`}>{template.title || S.untitled}</span>
            {meta ? <span className={`${RS}-manage-meta`}>{meta}</span> : null}
          </div>
          <span className={`${RS}-manage-status`} data-published={published || undefined}>
            {published ? M.published : M.draft}
          </span>
          <div className={`${RS}-manage-actions`}>
            <button
              type='button'
              className={`${RS}-button`}
              disabled={!!busyId}
              onClick={() => this.startEditing(template)}
            >
              {M.edit}
            </button>
            <button
              type='button'
              className={`${RS}-button`}
              data-test='reports-manage-publish'
              disabled={!!busyId}
              onClick={() => this.togglePublished(template)}
            >
              {busy && !confirmingId && editingId !== template.id ? (
                <span className={`${RS}-spin`}>
                  <Icon name='spinner' size={13} />
                </span>
              ) : null}
              {published ? M.unpublish : M.publish}
            </button>
            <button
              type='button'
              className={`${RS}-button`}
              disabled={!!busyId}
              onClick={() => this.setState({ confirmingId: template.id, editingId: null, error: null })}
            >
              {M.delete}
            </button>
          </div>
        </div>
        {confirmingId === template.id
          ? this.renderConfirm(M.deleteConfirm(template.title || S.untitled), () => this.removeTemplate(template), busy)
          : null}
        {editingId === template.id ? (
          <div className={`${RS}-manage-edit`}>
            <TemplateDetailsFields
              value={draft}
              categories={categories}
              disabled={busy}
              onChange={(next) => this.setState({ draft: next, error: null })}
            />
            <div className={`${RS}-manage-edit-actions`}>
              <button
                type='button'
                className={`${RS}-button`}
                disabled={busy}
                onClick={() => this.setState({ editingId: null, draft: null })}
              >
                {S.cancel}
              </button>
              <button
                type='button'
                className={`${RS}-button`}
                data-variant='primary'
                data-test='reports-manage-save'
                disabled={busy || !draft.title.trim()}
                onClick={() => this.saveDetails(template)}
              >
                {M.save}
              </button>
            </div>
          </div>
        ) : null}
      </li>
    )
  }

  renderTemplates() {
    const { templates } = this.state
    if (!templates.length) {
      return <p className={`${RS}-manage-empty`}>{M.noTemplates}</p>
    }
    return <ul className={`${RS}-manage-list`}>{templates.map((template) => this.renderTemplate(template))}</ul>
  }

  renderCategory(category) {
    const { renamingId, renameText, confirmingId, busyId } = this.state
    const busy = busyId === category.id
    return (
      <li key={category.id} className={`${RS}-manage-item`} data-test='reports-manage-category'>
        <div className={`${RS}-manage-row`}>
          <div className={`${RS}-manage-main`}>
            {renamingId === category.id ? (
              <input
                type='text'
                className={`${RS}-input`}
                value={renameText}
                aria-label={M.renameLabel(category.name)}
                disabled={busy}
                autoFocus
                onChange={(e) => this.setState({ renameText: e.target.value, error: null })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    this.saveRename(category)
                  } else if (e.key === 'Escape') {
                    e.stopPropagation()
                    this.setState({ renamingId: null })
                  }
                }}
              />
            ) : (
              <span className={`${RS}-manage-name`}>{category.name}</span>
            )}
          </div>
          <div className={`${RS}-manage-actions`}>
            {renamingId === category.id ? (
              <button
                type='button'
                className={`${RS}-button`}
                data-variant='primary'
                disabled={busy}
                onClick={() => this.saveRename(category)}
              >
                {M.save}
              </button>
            ) : (
              <button
                type='button'
                className={`${RS}-button`}
                disabled={!!busyId}
                onClick={() =>
                  this.setState({ renamingId: category.id, renameText: category.name, confirmingId: null, error: null })
                }
              >
                {M.rename}
              </button>
            )}
            <button
              type='button'
              className={`${RS}-button`}
              disabled={!!busyId}
              onClick={() => this.setState({ confirmingId: category.id, renamingId: null, error: null })}
            >
              {M.delete}
            </button>
          </div>
        </div>
        {confirmingId === category.id
          ? this.renderConfirm(M.deleteCategoryConfirm(category.name), () => this.removeCategory(category), busy)
          : null}
      </li>
    )
  }

  renderCategories() {
    const { ownCategories, newCategory, busyId } = this.state
    return (
      <>
        <div className={`${RS}-manage-add`}>
          <input
            type='text'
            className={`${RS}-input`}
            value={newCategory}
            placeholder={M.newCategoryPlaceholder}
            aria-label={M.newCategory}
            data-test='reports-manage-new-category'
            disabled={busyId === 'new-category'}
            onChange={(e) => this.setState({ newCategory: e.target.value, error: null })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                this.addCategory()
              }
            }}
          />
          <button
            type='button'
            className={`${RS}-button`}
            data-test='reports-manage-add-category'
            disabled={!newCategory.trim() || !!busyId}
            onClick={this.addCategory}
          >
            {M.addCategory}
          </button>
        </div>
        {ownCategories.length ? (
          <ul className={`${RS}-manage-list`}>{ownCategories.map((category) => this.renderCategory(category))}</ul>
        ) : (
          <p className={`${RS}-manage-empty`}>{M.noCategories}</p>
        )}
      </>
    )
  }

  renderTabs() {
    const { tab } = this.state
    const tabButton = (key, label) => (
      <button
        type='button'
        role='tab'
        className={`${RS}-manage-tab`}
        aria-selected={tab === key}
        data-test={`reports-manage-tab-${key}`}
        onClick={() => this.setState({ tab: key, confirmingId: null, renamingId: null, editingId: null, error: null })}
      >
        {label}
      </button>
    )
    return (
      <div className={`${RS}-manage-tabs`} role='tablist' aria-label={M.tabs}>
        {tabButton('templates', M.templatesTab)}
        {tabButton('categories', M.categoriesTab)}
      </div>
    )
  }

  render() {
    const { onClose } = this.props
    const { tab, templates, loadError, error, busyId } = this.state
    let body
    if (templates === null) {
      body = (
        <p className={`${RS}-manage-empty`}>
          <span className={`${RS}-spin`}>
            <Icon name='spinner' size={14} />
          </span>
          {M.loading}
        </p>
      )
    } else if (loadError) {
      body = (
        <div className={`${RS}-manage-empty`} data-tone='error'>
          <p role='alert'>{loadError}</p>
          <button type='button' className={`${RS}-button`} onClick={this.load}>
            {S.tryAgain}
          </button>
        </div>
      )
    } else {
      body = tab === 'templates' ? this.renderTemplates() : this.renderCategories()
    }
    return (
      <ReportModal
        title={M.title}
        description={M.what}
        size='large'
        headerExtra={this.renderTabs()}
        testId='reports-manage-templates'
        busy={!!busyId}
        onClose={onClose}
        status={error}
        statusTone={error ? 'error' : undefined}
        actions={
          <button type='button' className={`${RS}-button`} data-test='reports-manage-close' onClick={onClose}>
            {S.close}
          </button>
        }
      >
        <div className={`${RS}-manage`} role='tabpanel'>
          {body}
        </div>
      </ReportModal>
    )
  }
}
