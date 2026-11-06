import React from 'react'
import { Icon } from '../components/icons'
import { fetchReportCategories } from '../run/reportsApi'
import {
  createTemplateCategory,
  deleteTemplate,
  deleteTemplateCategory,
  discardTemplateDraft,
  fetchManagedCategories,
  fetchManagedTemplate,
  fetchManagedTemplates,
  keepsTemplateDrafts,
  publishTemplate,
  renameTemplateCategory,
  saveTemplateDraft,
  TEMPLATE_TITLE_MAX,
  unpublishTemplate,
  updateTemplate,
} from '../run/templatesApi'
import { describeReportError } from './documents'
import { ReportModal } from './ReportModal'
import { RS } from './reportsConstants'
import { REPORTS_STRINGS } from './reportsStrings'
import { detailsOf, detailsProblem, detailsToSend } from './templateDetails'

// Manage templates (an organization's admins): the organization's templates, drafts and published — each one renamed
// (its title clicked), opened in the builder to be edited (`onEdit`, TemplateEditor), published or taken back, or
// deleted — and its categories, added, renamed or deleted. A published template's changes are kept apart from it until
// they're published (RW-361); where the service can't do that, it's taken back to a draft first, asking. Reports
// already made from a template keep their copy whatever happens to it. Each change is made one at a time, and what
// went wrong is said beside the dialog's buttons.
//
// Props: authentication, onEdit (opens a template to be edited; without it there's no Edit), onClose.

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

// A published template with changes waiting to be published (RW-361).
const hasChangesWaiting = (template) => template.status === 'PUBLISHED' && !!template.hasDraft

// A published template that's taken back to a draft before it's changed: the service can't keep its changes apart.
const mustUnpublishFirst = (template) => template.status === 'PUBLISHED' && !keepsTemplateDrafts(template)

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
    // What's being changed: a template's title or a category's name (`renamingId`), and a change that's asked about
    // first (`confirming`: { id, action }, the action 'delete', 'discard', 'unpublishToEdit' or 'unpublishToRename').
    confirming: null,
    renamingId: null,
    renameText: '',
    newCategory: '',
    busyId: null,
    error: null,
    // What's said once a change is made, when there's more to say than the list shows.
    notice: null,
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

  // One change at a time: `run` makes it and resolves with how the lists then are; what went wrong is said. Resolves
  // with whether it was made.
  change = async (busyId, action, run) => {
    if (this.state.busyId) {
      return false
    }
    this.setState({ busyId, error: null, notice: null })
    try {
      const next = await run()
      if (this.mounted) {
        this.setState({ ...next, busyId: null })
      }
      return true
    } catch (error) {
      if (this.mounted) {
        this.setState({ busyId: null, error: describeReportError(error, action).message })
      }
      return false
    }
  }

  confirm = (id, action) => this.setState({ confirming: { id, action }, renamingId: null, error: null, notice: null })

  replaceTemplate = (templates, id, change) =>
    templates.map((template) => (template.id === id ? change(template) : template))

  // ---------------------------------------------------------------- templates

  // Its title, clicked: renamed in place.
  startRenaming = (template) => {
    if (mustUnpublishFirst(template)) {
      this.confirm(template.id, 'unpublishToRename')
      return
    }
    this.setState({ renamingId: template.id, renameText: template.title, confirming: null, error: null, notice: null })
  }

  // A draft's new title is saved to it. A published template's is kept with the rest of its changes waiting to be
  // published (RW-361), which stay as they are.
  saveTitle = (template) => {
    const title = this.state.renameText.trim()
    if (!title || title === template.title) {
      this.setState({ renamingId: null })
      return
    }
    const problem = detailsProblem({ ...detailsOf(template), title })
    if (problem) {
      this.setState({ error: `${S.errors.lead.templateDetails}: ${problem}.` })
      return
    }
    const { authentication } = this.props
    this.change(template.id, 'templateDetails', async () => {
      if (template.status === 'PUBLISHED') {
        const now = await fetchManagedTemplate({ authentication, id: template.id })
        const waiting = now.draft || now
        await saveTemplateDraft({
          authentication,
          id: template.id,
          ...detailsToSend(detailsOf(waiting)),
          document: waiting.report || now.report,
          title,
        })
        return {
          renamingId: null,
          notice: M.titleKept(title),
          templates: this.replaceTemplate(this.state.templates, template.id, (old) => ({ ...old, hasDraft: true })),
        }
      }
      const updated = await updateTemplate({ authentication, id: template.id, title })
      return {
        renamingId: null,
        templates: this.replaceTemplate(this.state.templates, template.id, (old) => ({ ...old, ...updated })).sort(
          byTitle,
        ),
      }
    })
  }

  // Edit: the whole template in the builder (TemplateEditor).
  edit = (template) => {
    if (mustUnpublishFirst(template)) {
      this.confirm(template.id, 'unpublishToEdit')
      return
    }
    this.props.onEdit(template)
  }

  // A published template taken back to a draft to be edited or renamed (`then`), where the service can't keep its
  // changes apart from it: no reports can be started from it until it's published again.
  unpublishFirst = async (template, then) => {
    const { authentication } = this.props
    let draft = template
    const unpublished = await this.change(template.id, 'unpublish', async () => {
      const answered = await unpublishTemplate({ authentication, id: template.id })
      draft = { ...template, ...(answered || {}), status: 'DRAFT' }
      return {
        confirming: null,
        templates: this.replaceTemplate(this.state.templates, template.id, () => draft),
        ...(then === 'rename' ? { renamingId: template.id, renameText: draft.title } : {}),
      }
    })
    if (unpublished && then === 'edit' && this.mounted) {
      this.props.onEdit(draft)
    }
  }

  // Publishes a draft, or a published template's changes in place of it as it was (RW-361); or takes a published one
  // back to a draft, which drops changes it had waiting.
  togglePublished = (template) => {
    const { authentication } = this.props
    const publishing = template.status !== 'PUBLISHED' || hasChangesWaiting(template)
    this.change(template.id, publishing ? 'publish' : 'unpublish', async () => {
      const answered = await (publishing ? publishTemplate : unpublishTemplate)({ authentication, id: template.id })
      return {
        templates: this.replaceTemplate(this.state.templates, template.id, (old) => ({
          ...old,
          ...(answered || {}),
          status: publishing ? 'PUBLISHED' : 'DRAFT',
          ...(keepsTemplateDrafts(old) ? { hasDraft: false } : {}),
        })).sort(byTitle),
      }
    })
  }

  // A published template's changes dropped (RW-361): it stays as it's published.
  discardChanges = (template) => {
    const { authentication } = this.props
    this.change(template.id, 'discardChanges', async () => {
      await discardTemplateDraft({ authentication, id: template.id })
      return {
        confirming: null,
        templates: this.replaceTemplate(this.state.templates, template.id, (old) => ({
          ...old,
          hasDraft: false,
          draftUpdatedAt: null,
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
        confirming: null,
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
        confirming: null,
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

  renderConfirm(
    text,
    onConfirm,
    busy,
    { label = M.delete, variant = 'danger', test = 'reports-manage-confirm-delete' } = {},
  ) {
    return (
      <div className={`${RS}-manage-confirm`} role='group' aria-label={text}>
        <span>{text}</span>
        <button type='button' className={`${RS}-button`} onClick={() => this.setState({ confirming: null })}>
          {S.cancel}
        </button>
        <button
          type='button'
          className={`${RS}-button`}
          data-variant={variant}
          data-test={test}
          disabled={busy}
          onClick={onConfirm}
        >
          {label}
        </button>
      </div>
    )
  }

  // What's asked about a template before it's changed.
  renderTemplateConfirm(template, busy) {
    const { confirming } = this.state
    if (confirming?.id !== template.id) {
      return null
    }
    const title = template.title || S.untitled
    const unpublish = { variant: 'primary', test: 'reports-manage-confirm-unpublish' }
    const asks = {
      delete: () => this.renderConfirm(M.deleteConfirm(title), () => this.removeTemplate(template), busy),
      discard: () =>
        this.renderConfirm(M.discardConfirm(title), () => this.discardChanges(template), busy, {
          label: M.discard,
          test: 'reports-manage-confirm-discard',
        }),
      unpublishToEdit: () =>
        this.renderConfirm(M.unpublishToEdit(title), () => this.unpublishFirst(template, 'edit'), busy, {
          ...unpublish,
          label: M.unpublishAndEdit,
        }),
      unpublishToRename: () =>
        this.renderConfirm(M.unpublishToRename(title), () => this.unpublishFirst(template, 'rename'), busy, {
          ...unpublish,
          label: M.unpublishAndRename,
        }),
    }
    return asks[confirming.action]?.() || null
  }

  renderTitle(template, busy) {
    const { renamingId, renameText, busyId } = this.state
    const title = template.title || S.untitled
    if (renamingId === template.id) {
      return (
        <input
          type='text'
          className={`${RS}-input`}
          value={renameText}
          maxLength={TEMPLATE_TITLE_MAX}
          aria-label={M.renameLabel(title)}
          data-test='reports-manage-title-input'
          disabled={busy}
          autoFocus
          onChange={(e) => this.setState({ renameText: e.target.value, error: null })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              this.saveTitle(template)
            } else if (e.key === 'Escape') {
              e.stopPropagation()
              this.setState({ renamingId: null })
            }
          }}
        />
      )
    }
    return (
      <button
        type='button'
        className={`${RS}-manage-name`}
        title={M.renameTitle}
        data-test='reports-manage-title'
        disabled={!!busyId}
        onClick={() => this.startRenaming(template)}
      >
        {title}
      </button>
    )
  }

  renderTemplateActions(template, busy) {
    const { onEdit } = this.props
    const { confirming, renamingId, renameText, busyId } = this.state
    const published = template.status === 'PUBLISHED'
    const waiting = hasChangesWaiting(template)
    const spinner = (
      <span className={`${RS}-spin`}>
        <Icon name='spinner' size={13} />
      </span>
    )
    if (renamingId === template.id) {
      return (
        <div className={`${RS}-manage-actions`}>
          <button
            type='button'
            className={`${RS}-button`}
            disabled={busy}
            onClick={() => this.setState({ renamingId: null })}
          >
            {S.cancel}
          </button>
          <button
            type='button'
            className={`${RS}-button`}
            data-variant='primary'
            data-test='reports-manage-save'
            disabled={busy || !renameText.trim()}
            onClick={() => this.saveTitle(template)}
          >
            {busy ? spinner : null}
            {M.save}
          </button>
        </div>
      )
    }
    return (
      <div className={`${RS}-manage-actions`}>
        {onEdit ? (
          <button
            type='button'
            className={`${RS}-button`}
            data-test='reports-manage-edit'
            disabled={!!busyId}
            onClick={() => this.edit(template)}
          >
            {M.edit}
          </button>
        ) : null}
        <button
          type='button'
          className={`${RS}-button`}
          data-test='reports-manage-publish'
          disabled={!!busyId}
          onClick={() => this.togglePublished(template)}
        >
          {busy && !confirming ? spinner : null}
          {waiting ? M.publishChanges : published ? M.unpublish : M.publish}
        </button>
        {waiting ? (
          <button
            type='button'
            className={`${RS}-button`}
            data-test='reports-manage-discard'
            disabled={!!busyId}
            onClick={() => this.confirm(template.id, 'discard')}
          >
            {M.discardChanges}
          </button>
        ) : null}
        <button
          type='button'
          className={`${RS}-button`}
          data-test='reports-manage-delete'
          disabled={!!busyId}
          onClick={() => this.confirm(template.id, 'delete')}
        >
          {M.delete}
        </button>
      </div>
    )
  }

  renderTemplate(template) {
    const { categories, renamingId, busyId } = this.state
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
            {this.renderTitle(template, busy)}
            {meta && renamingId !== template.id ? <span className={`${RS}-manage-meta`}>{meta}</span> : null}
          </div>
          <span className={`${RS}-manage-status`} data-published={published || undefined}>
            {published ? M.published : M.draft}
          </span>
          {hasChangesWaiting(template) ? (
            <span className={`${RS}-manage-status`} data-changes='' data-test='reports-manage-changes'>
              {M.unpublishedChanges}
            </span>
          ) : null}
          {this.renderTemplateActions(template, busy)}
        </div>
        {this.renderTemplateConfirm(template, busy)}
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
    const { renamingId, renameText, confirming, busyId } = this.state
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
                  this.setState({ renamingId: category.id, renameText: category.name, confirming: null, error: null })
                }
              >
                {M.rename}
              </button>
            )}
            <button
              type='button'
              className={`${RS}-button`}
              disabled={!!busyId}
              onClick={() => this.confirm(category.id, 'delete')}
            >
              {M.delete}
            </button>
          </div>
        </div>
        {confirming?.id === category.id
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
        onClick={() => this.setState({ tab: key, confirming: null, renamingId: null, error: null, notice: null })}
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
    const { tab, templates, loadError, error, notice, busyId } = this.state
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
        status={error || notice}
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
