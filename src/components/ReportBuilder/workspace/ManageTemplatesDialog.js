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
// Publishing, unpublishing, deleting and the rest are asked about first, in a card under the button they're asked from
// (RW-370), so the list stays where it is. The card has the focus, Cancel first, and keeps it; Escape or a click
// elsewhere answers it as Cancel does, and the focus goes back to the button it was asked from.
//
// With no template yet, it says how one is made, and offers New report (`onNewReport`) to make the report first.
//
// Props: authentication, onEdit (opens a template to be edited; without it there's no Edit), onNewReport (closes it
// for New report; without it there's no New report), focusTemplateId (the template just edited: once the list's in,
// the focus goes to its Edit button), onClose.

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

// What a template's Publish button does, asked about first (RW-370): publishes a draft, publishes a published one's
// changes waiting (RW-361), or takes a published one back to a draft.
const publishActionOf = (template) => {
  if (template.status !== 'PUBLISHED') {
    return 'publish'
  }
  return hasChangesWaiting(template) ? 'publishChanges' : 'unpublish'
}

// On a button while its change is on its way.
const SPINNER = (
  <span className={`${RS}-spin`}>
    <Icon name='spinner' size={13} />
  </span>
)

// Where a question's card goes in its row (RW-370), in pixels from the row's top left, from where things are on screen:
// the button it's asked from, the row, the part of the list in view, and the card's size. It goes under the button,
// its right edge a little past the button's and inside the row, with its arrow at the button's middle; over the
// button instead when it fits there and not under it.
const QUESTION_GAP = 8
const QUESTION_PAST = 16
const ARROW_INSET = 14

export const questionPlacement = ({ button, row, view, width, height }) => {
  const left = Math.max(0, Math.min(button.right + QUESTION_PAST - width - row.left, row.width - width))
  const fitsUnder = button.bottom + QUESTION_GAP + height <= view.bottom
  const fitsOver = button.top - QUESTION_GAP - height >= view.top
  const over = !fitsUnder && fitsOver
  return {
    left,
    top: over ? button.top - row.top - QUESTION_GAP - height : button.bottom - row.top + QUESTION_GAP,
    arrow: Math.max(ARROW_INSET, Math.min(button.left + button.width / 2 - row.left - left, width - ARROW_INSET)),
    placement: over ? 'above' : 'below',
  }
}

// The ids that name a question's card by its title and describe it by what it says.
let questionIds = 0
const nextQuestionIds = () => {
  questionIds += 1
  return { title: `${RS}-manage-question-${questionIds}`, what: `${RS}-manage-question-what-${questionIds}` }
}

const dateOf = (iso) => {
  const date = new Date(iso)
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

export class ManageTemplatesDialog extends React.Component {
  // The question's card and its Cancel, and the button the question was asked from: where the focus goes, and goes
  // back.
  questionRef = React.createRef()
  cancelRef = React.createRef()
  askedFrom = null
  ids = nextQuestionIds()
  // The Edit button of the template just edited (focusTemplateId).
  editedRef = React.createRef()

  state = {
    tab: 'templates',
    templates: null,
    // Those a template can take (the organization's and the integrator's), and the organization's own, which are
    // managed here.
    categories: [],
    ownCategories: null,
    loadError: null,
    // What's being changed: a template's title or a category's name (`renamingId`), and a change that's asked about
    // first (`confirming`: { id, action }, the action 'publish', 'publishChanges', 'unpublish', 'delete', 'discard',
    // 'unpublishToEdit' or 'unpublishToRename').
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
    document.addEventListener('mousedown', this.onMouseDown)
    window.addEventListener('resize', this.placeQuestion)
    this.load()
  }

  componentDidUpdate(prevProps, prevState) {
    const { confirming, renamingId, tab, templates } = this.state
    if (confirming && confirming !== prevState.confirming) {
      // Asked: its card goes by the button it was asked from, and the focus to its Cancel, so going on takes a
      // deliberate choice.
      this.placeQuestion()
      this.cancelRef.current?.focus()
    } else if (!confirming && this.askedFrom) {
      // Answered (Cancel, Escape, or the change made): back where it was asked from, but not when a title's being
      // renamed (its field has the focus), nor once the other tab is shown.
      const from = this.askedFrom
      this.askedFrom = null
      if (!renamingId && tab === prevState.tab) {
        this.focusBack(from)
      }
    }
    if (prevState.templates === null && templates && this.editedRef.current) {
      // Back from the template editor: its Edit button, unless the focus was moved while the list loaded.
      const active = document.activeElement
      if (active === document.body || active === this.editedRef.current.closest('[role="dialog"]')) {
        this.editedRef.current.focus()
      }
    }
  }

  componentWillUnmount() {
    this.mounted = false
    document.removeEventListener('mousedown', this.onMouseDown)
    window.removeEventListener('resize', this.placeQuestion)
  }

  // The question's card, where questionPlacement puts it: once it's asked, and again when the window is resized.
  placeQuestion = () => {
    const card = this.questionRef.current
    const button = this.askedFrom?.button
    const row = card?.parentElement
    if (!row || !button?.isConnected) {
      return
    }
    const list = card.closest(`.${RS}-manage`)
    const { left, top, arrow, placement } = questionPlacement({
      button: button.getBoundingClientRect(),
      row: row.getBoundingClientRect(),
      view: list ? list.getBoundingClientRect() : { top: -Infinity, bottom: Infinity },
      width: card.offsetWidth,
      height: card.offsetHeight,
    })
    card.style.left = `${left}px`
    card.style.right = 'auto'
    card.style.top = `${top}px`
    card.style.setProperty('--rs-question-arrow', `${arrow}px`)
    card.dataset.placement = placement
    card.scrollIntoView?.({ block: 'nearest' })
  }

  // A click outside the question answers it as Cancel does, but not once its change is on its way. A click on the
  // button it was asked from is left to that button.
  onMouseDown = (e) => {
    const card = this.questionRef.current
    if (!card || this.state.busyId || card.contains(e.target) || this.askedFrom?.button?.contains(e.target)) {
      return
    }
    this.setState({ confirming: null })
  }

  // In the question, Escape answers it as Cancel does and leaves the dialog open, and Tab, either way, goes to its
  // other button.
  onQuestionKeyDown = (e, cancel, busy) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      if (!busy) {
        cancel()
      }
    } else if (e.key === 'Tab') {
      e.preventDefault()
      const buttons = Array.from(e.currentTarget.querySelectorAll('button:not([disabled])'))
      buttons.find((button) => button !== document.activeElement)?.focus()
    }
  }

  // Back to the button a question was asked from; to its row's Publish button once that's gone (Discard changes, its
  // changes discarded); to the dialog once the row's gone too (deleted).
  focusBack = ({ button, row, dialog }) => {
    const publish = row?.querySelector('[data-test="reports-manage-publish"]')
    const back = [button, publish, dialog].find((element) => element?.isConnected)
    back?.focus()
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

  // A change asked about first, from a button (`from`, the one clicked): the focus goes back to it once it's answered.
  confirm = (id, action, from) => {
    this.askedFrom = { button: from, row: from?.closest('li'), dialog: from?.closest('[role="dialog"]') }
    this.setState({ confirming: { id, action }, renamingId: null, error: null, notice: null })
  }

  replaceTemplate = (templates, id, change) =>
    templates.map((template) => (template.id === id ? change(template) : template))

  // ---------------------------------------------------------------- templates

  // Its title, clicked (`from`): renamed in place.
  startRenaming = (template, from) => {
    if (mustUnpublishFirst(template)) {
      this.confirm(template.id, 'unpublishToRename', from)
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

  // Edit (`from`): the whole template in the builder (TemplateEditor).
  edit = (template, from) => {
    if (mustUnpublishFirst(template)) {
      this.confirm(template.id, 'unpublishToEdit', from)
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
  // back to a draft, which drops changes it had waiting. Asked about first (RW-370).
  togglePublished = (template) => {
    const { authentication } = this.props
    const publishing = template.status !== 'PUBLISHED' || hasChangesWaiting(template)
    this.change(template.id, publishing ? 'publish' : 'unpublish', async () => {
      const answered = await (publishing ? publishTemplate : unpublishTemplate)({ authentication, id: template.id })
      return {
        confirming: null,
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

  // A question before a change (`ask`: its title for `name`, and what going on means), in a card by the button it was
  // asked from (placeQuestion). Once its change is on its way, it can't be taken back: Cancel, Escape and a click
  // elsewhere wait.
  renderQuestion(
    ask,
    name,
    onConfirm,
    busy,
    { label = M.delete, variant = 'danger', test = 'reports-manage-confirm-delete' } = {},
  ) {
    const cancel = () => this.setState({ confirming: null })
    return (
      <div
        ref={this.questionRef}
        className={`${RS}-manage-question`}
        role='alertdialog'
        aria-labelledby={this.ids.title}
        aria-describedby={this.ids.what}
        data-test='reports-manage-question'
        onKeyDown={(e) => this.onQuestionKeyDown(e, cancel, busy)}
      >
        <span className={`${RS}-manage-question-arrow`} aria-hidden='true' />
        <p className={`${RS}-manage-question-title`} id={this.ids.title}>
          {ask.title(name)}
        </p>
        <p className={`${RS}-manage-question-what`} id={this.ids.what}>
          {ask.what}
        </p>
        <div className={`${RS}-manage-question-actions`}>
          <button ref={this.cancelRef} type='button' className={`${RS}-button`} disabled={busy} onClick={cancel}>
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
            {busy ? SPINNER : null}
            {label}
          </button>
        </div>
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
    const ask = (action, onConfirm, options) => () =>
      this.renderQuestion(M.asks[action], title, onConfirm, busy, options)
    // Publish, Publish changes or Unpublish: what the button does, once it's answered.
    const toggle = () => this.togglePublished(template)
    const publish = (label) => ({ label, variant: 'primary', test: 'reports-manage-confirm-publish' })
    const unpublish = (label) => ({ label, variant: 'primary', test: 'reports-manage-confirm-unpublish' })
    const asks = {
      publish: ask('publish', toggle, publish(M.publish)),
      publishChanges: ask('publishChanges', toggle, publish(M.publishChanges)),
      unpublish: ask('unpublish', toggle, publish(M.unpublish)),
      delete: ask('delete', () => this.removeTemplate(template)),
      discard: ask('discard', () => this.discardChanges(template), {
        label: M.discard,
        test: 'reports-manage-confirm-discard',
      }),
      unpublishToEdit: ask(
        'unpublishToEdit',
        () => this.unpublishFirst(template, 'edit'),
        unpublish(M.unpublishAndEdit),
      ),
      unpublishToRename: ask(
        'unpublishToRename',
        () => this.unpublishFirst(template, 'rename'),
        unpublish(M.unpublishAndRename),
      ),
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
        onClick={(e) => this.startRenaming(template, e.currentTarget)}
      >
        {title}
      </button>
    )
  }

  renderTemplateActions(template, busy) {
    const { onEdit, focusTemplateId } = this.props
    const { confirming, renamingId, renameText, busyId } = this.state
    const published = template.status === 'PUBLISHED'
    const waiting = hasChangesWaiting(template)
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
            {busy ? SPINNER : null}
            {M.save}
          </button>
        </div>
      )
    }
    return (
      <div className={`${RS}-manage-actions`}>
        {onEdit ? (
          <button
            ref={template.id === focusTemplateId ? this.editedRef : undefined}
            type='button'
            className={`${RS}-button`}
            data-test='reports-manage-edit'
            disabled={!!busyId}
            onClick={(e) => this.edit(template, e.currentTarget)}
          >
            {M.edit}
          </button>
        ) : null}
        <button
          type='button'
          className={`${RS}-button`}
          data-test='reports-manage-publish'
          disabled={!!busyId}
          onClick={(e) => this.confirm(template.id, publishActionOf(template), e.currentTarget)}
        >
          {busy && !confirming ? SPINNER : null}
          {waiting ? M.publishChanges : published ? M.unpublish : M.publish}
        </button>
        {waiting ? (
          <button
            type='button'
            className={`${RS}-button`}
            data-test='reports-manage-discard'
            disabled={!!busyId}
            onClick={(e) => this.confirm(template.id, 'discard', e.currentTarget)}
          >
            {M.discardChanges}
          </button>
        ) : null}
        <button
          type='button'
          className={`${RS}-button`}
          data-test='reports-manage-delete'
          disabled={!!busyId}
          onClick={(e) => this.confirm(template.id, 'delete', e.currentTarget)}
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

  // Nothing in a tab yet: said in the middle of it, with how to make one (`how`) and what can be done from here.
  renderNone({ test, icon, title, how, action }) {
    return (
      <div className={`${RS}-manage-none`} data-test={test}>
        {icon ? (
          <span className={`${RS}-manage-none-icon`}>
            <Icon name={icon} size={20} />
          </span>
        ) : null}
        <p className={`${RS}-manage-none-title`}>{title}</p>
        {how ? <p>{how}</p> : null}
        {action}
      </div>
    )
  }

  renderTemplates() {
    const { templates } = this.state
    if (!templates.length) {
      const { onNewReport } = this.props
      return this.renderNone({
        test: 'reports-manage-no-templates',
        icon: 'template',
        title: M.noTemplates,
        how: M.noTemplatesHow,
        action: onNewReport ? (
          <button
            type='button'
            className={`${RS}-button`}
            data-variant='primary'
            data-test='reports-manage-new-report'
            onClick={onNewReport}
          >
            {M.newReport}
          </button>
        ) : null,
      })
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
              onClick={(e) => this.confirm(category.id, 'delete', e.currentTarget)}
            >
              {M.delete}
            </button>
          </div>
        </div>
        {confirming?.id === category.id
          ? this.renderQuestion(M.asks.deleteCategory, category.name, () => this.removeCategory(category), busy)
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
          this.renderNone({ test: 'reports-manage-no-categories', title: M.noCategories })
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
