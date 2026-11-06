import React from 'react'
import { Icon } from '../components/icons'
import { ReportBuilder } from '../ReportBuilder'
import { isNewerSchema } from '../model/reportSchema'
import { updateBlock } from '../model/reportOperations'
import { fetchReportCategories } from '../run/reportsApi'
import { fillQuestions, questionBlocks } from '../run/fillQuestions'
import {
  discardTemplateDraft,
  fetchManagedTemplate,
  keepsTemplateDrafts,
  publishTemplate,
  saveTemplateDraft,
  TEMPLATE_TITLE_MAX,
  updateTemplate,
} from '../run/templatesApi'
import { describeBlock, describeReportError, stripQueryResponses } from './documents'
import { fillNoticeOf } from './fillNotice'
import { ReportModal } from './ReportModal'
import { RS } from './reportsConstants'
import { REPORTS_STRINGS } from './reportsStrings'
import { detailsOf, detailsProblem, detailsToSend, TemplateDetailsFields } from './templateDetails'

// A template opened from Manage templates › Edit (an organization's admins): the whole of it in the builder, in place
// of the workspace's tabs, the way a report is shown. Its questions are asked on the admin's own data as it opens, so
// it looks the way its reports will; those answers are only shown, never saved. Nothing is saved until Save: a draft's
// changes go into it, and a published template's are kept apart from it until they're published (RW-361), so reports
// go on being started from it as it was. Publish saves, then publishes. Leaving with changes that aren't saved asks
// first.
//
// Props: authentication, templateId, title (the template's, shown while it's read), builderProps (what the workspace
// hands its own builder), onClose.

const S = REPORTS_STRINGS
const T = S.templateEditor
const M = S.manageTemplates
const FILLING = { state: 'filling' }

const byName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true })

// Every question in a template is one its reports can ask again (Rerun), and so can the admin here.
const withQuestionsAskedHere = (report) => ({
  ...report,
  blocks: (Array.isArray(report?.blocks) ? report.blocks : []).map((block) =>
    block?.type === 'data' && block.source?.type === 'query' && block.source.query && !block.askedHere
      ? { ...block, askedHere: true }
      : block,
  ),
})

// What a template is saved as: its document without the answers shown here. AutoQL takes out whatever else of the
// admin's data is left in it (table filters, legends, an analysis's wording), as it does for Save as template.
export const templateDocumentOf = (report) => {
  const asked = withQuestionsAskedHere(report)
  return stripQueryResponses({
    ...asked,
    blocks: asked.blocks.map((block) => {
      if (block?.type !== 'data' || !('capture' in block)) {
        return block
      }
      const unanswered = { ...block }
      delete unanswered.capture
      return unanswered
    }),
  })
}

// Whether a published template has changes waiting to be published: said in a list, or seen in one read by id.
const hasChangesWaiting = (template) =>
  template?.status === 'PUBLISHED' && (typeof template.hasDraft === 'boolean' ? template.hasDraft : !!template.draft)

const sameDetails = (a, b) => JSON.stringify(detailsToSend(a)) === JSON.stringify(detailsToSend(b))

export class TemplateEditor extends React.Component {
  constructor(props) {
    super(props)
    this.keepEditingRef = React.createRef()
    this.keepChangesRef = React.createRef()
    // Edits made so far: a save leaves those made while it was on its way still to be saved.
    this.edits = 0
    this.fillRun = null
    this.renamingNow = false
    this.state = {
      template: null,
      loadError: null,
      // The template's document and details, as they're edited.
      report: null,
      details: null,
      categories: [],
      edited: false,
      // Its questions asked from here: how that went ({ errors, ended }), and whether it's still going.
      fill: null,
      filling: false,
      renaming: false,
      nameText: '',
      // The details as they're changed in Details…, and what's wrong with them.
      detailsDraft: null,
      detailsError: null,
      // What's asked about first ('leave' or 'discard'), and what's under way ('save', 'publish' or 'discard').
      confirming: null,
      busy: null,
      error: null,
      saved: false,
    }
  }

  componentDidMount() {
    this.mounted = true
    this.load()
  }

  componentWillUnmount() {
    this.mounted = false
    this.fillRun?.stop()
  }

  // ---------------------------------------------------------------- for the workspace

  // Whether there are changes that aren't saved.
  hasUnsaved = () => this.state.edited

  // ⌘S / Ctrl+S.
  saveNow = () => {
    if (this.canSave()) {
      this.save()
    }
  }

  // ---------------------------------------------------------------- reading it, and asking its questions

  load = () => {
    const { authentication, templateId } = this.props
    this.fillRun?.stop()
    this.fillRun = null
    this.setState({ template: null, loadError: null, report: null, fill: null, filling: false, edited: false })
    fetchReportCategories({ authentication }).then(
      (categories) => {
        if (this.mounted) {
          this.setState({ categories: [...categories].sort(byName) })
        }
      },
      () => {}, // Without them, there's no category to choose.
    )
    fetchManagedTemplate({ authentication, id: templateId }).then(
      (template) => {
        if (!this.mounted) {
          return
        }
        // A published template's changes waiting to be published, when it has some, are what's edited.
        const draft = template.draft || null
        const report = withQuestionsAskedHere(draft?.report || template.report)
        this.setState({ template, report, details: detailsOf(draft || template) })
        if (!isNewerSchema(report)) {
          this.fillIn(report)
        }
      },
      (error) => {
        if (this.mounted) {
          this.setState({ loadError: describeReportError(error, 'openTemplate').message })
        }
      },
    )
  }

  // Its questions asked on the admin's data, a few at a time, as a report started from it would be. Meanwhile it's
  // shown read-only, as a report is while its data is filled in.
  fillIn = (report) => {
    if (!questionBlocks(report).length) {
      return
    }
    const { authentication, builderProps } = this.props
    const run = { stop: () => {} }
    const current = () => this.mounted && this.fillRun === run
    this.fillRun = run
    this.setState({ filling: true, fill: { errors: [] } })
    const fill = fillQuestions({
      report,
      authentication,
      autoQLConfig: builderProps?.autoQLConfig,
      capturedAt: new Date().toISOString(),
      isCurrent: current,
      onAnswer: this.showAnswer,
    })
    run.stop = fill.stop
    fill.done.then(({ errors }) => {
      if (current()) {
        this.fillRun = null
        this.setState({ filling: false, fill: { errors, ended: true } })
      }
    })
  }

  // An answer to one of its questions, shown in its block while the block still asks it.
  showAnswer = (block, capture) =>
    this.setState(({ report }) => {
      const target = report?.blocks?.find((b) => b?.id === block.id)
      if (!target || target.source?.type !== 'query' || target.source.query !== block.source.query) {
        return null
      }
      return { report: updateBlock(report, block.id, { capture }) }
    })

  // What the builder says about blocks with no answer: kept the same while the fill is.
  dataFill = () => {
    const { fill, filling } = this.state
    if (filling) {
      return FILLING
    }
    if (!fill?.errors?.length) {
      return null
    }
    if (this.lastFill?.fill !== fill) {
      const errors = {}
      fill.errors.forEach(({ blockId, reason, message }) => {
        errors[blockId] = { reason, message }
      })
      this.lastFill = { fill, value: { state: 'filled', errors } }
    }
    return this.lastFill.value
  }

  // ---------------------------------------------------------------- changing it

  // Why it can't be changed here, if it can't: saved by a newer version of the builder, or published where its
  // changes can't be kept apart from it (Manage templates takes it back to a draft first).
  lockedReason = () => {
    const { template, report } = this.state
    if (report && isNewerSchema(report)) {
      return T.newerVersion
    }
    if (template?.status === 'PUBLISHED' && !keepsTemplateDrafts(template)) {
      return T.publishedNoDrafts
    }
    return null
  }

  // Whether it can be changed now: read, its questions answered, and nothing under way.
  ready = () => !!this.state.template && !this.state.filling && !this.state.busy && !this.lockedReason()

  edit = (change) => {
    this.edits += 1
    this.setState({ ...change, edited: true, saved: false })
  }

  onChange = (report) => {
    if (!this.state.filling) {
      this.edit({ report })
    }
  }

  startRenaming = () => {
    this.renamingNow = true
    this.setState({ renaming: true, nameText: this.state.details.title })
  }

  // Enter, or leaving the field, keeps the new name; Escape doesn't. Either way once.
  finishRenaming = (keep) => {
    if (!this.renamingNow) {
      return
    }
    this.renamingNow = false
    const title = this.state.nameText.trim()
    if (keep && title && title !== this.state.details.title) {
      this.edit({ details: { ...this.state.details, title }, renaming: false })
    } else {
      this.setState({ renaming: false })
    }
  }

  openDetails = () => this.setState({ detailsDraft: this.state.details, detailsError: null })

  closeDetails = () => this.setState({ detailsDraft: null, detailsError: null })

  applyDetails = () => {
    const { detailsDraft, details } = this.state
    const problem = detailsProblem(detailsDraft)
    if (problem) {
      this.setState({ detailsError: `${T.detailsInvalid}: ${problem}.` })
    } else if (sameDetails(detailsDraft, details)) {
      this.closeDetails()
    } else {
      this.edit({ details: detailsDraft, detailsDraft: null, detailsError: null })
    }
  }

  canSave = () => this.ready() && this.state.edited

  // Whether the details can be saved as they are; if not, why is said.
  checkDetails = () => {
    const problem = detailsProblem(this.state.details)
    if (problem) {
      this.setState({ error: `${S.errors.lead.editTemplate}: ${problem}.`, saved: false })
    }
    return !problem
  }

  // One thing at a time; what went wrong is said over the builder. `action` resolves with the state that follows, or
  // with `close` to go back to Manage templates.
  run = async (busy, describeAs, action) => {
    if (this.state.busy) {
      return
    }
    this.setState({ busy, error: null, saved: false, confirming: null })
    try {
      const next = await action()
      if (!this.mounted) {
        return
      }
      if (next?.close) {
        this.props.onClose()
        return
      }
      this.setState({ ...next, busy: null })
    } catch (failure) {
      if (this.mounted) {
        this.setState({ busy: null, error: this.describe(failure, describeAs) })
      }
    }
  }

  describe = (failure, action) => {
    if (failure?.code === 'REPORT_TEMPLATE_BLOCK_NOT_PORTABLE') {
      const block = this.state.report?.blocks?.find((b) => b?.id === failure.details?.blockId)
      return S.saveAsTemplate.blockNotPortable(describeBlock(block))
    }
    return describeReportError(failure, action).message
  }

  // The changes as they are now, saved: into the template while it's a draft, apart from it while it's published
  // (RW-361). Changes made while it saves are still to be saved.
  saveChanges = async () => {
    const { authentication } = this.props
    const { template, details, report } = this.state
    const published = template.status === 'PUBLISHED'
    const edits = this.edits
    const answered = await (published ? saveTemplateDraft : updateTemplate)({
      authentication,
      id: template.id,
      ...detailsToSend(details),
      document: templateDocumentOf(report),
    })
    if (this.mounted) {
      this.setState(({ template: now }) => ({
        template: { ...now, ...(answered || {}), ...(published ? { status: 'PUBLISHED', hasDraft: true } : {}) },
        edited: this.edits !== edits,
      }))
    }
  }

  save = () => {
    if (this.checkDetails()) {
      this.run('save', 'editTemplate', async () => {
        await this.saveChanges()
        return { saved: true }
      })
    }
  }

  // Saves what's changed, then publishes it: a draft, for everyone to start reports from, or a published template's
  // changes, in place of it as it was. Then it's back to Manage templates.
  publish = () => {
    if (this.checkDetails()) {
      this.run('publish', 'publish', async () => {
        if (this.state.edited) {
          await this.saveChanges()
        }
        await publishTemplate({ authentication: this.props.authentication, id: this.state.template.id })
        return { close: true }
      })
    }
  }

  // A published template's changes dropped: it stays as it's published.
  discard = () =>
    this.run('discard', 'discardChanges', async () => {
      await discardTemplateDraft({ authentication: this.props.authentication, id: this.state.template.id })
      return { close: true }
    })

  // Back to Manage templates, asking first when there are changes that aren't saved.
  leave = () => {
    if (this.state.busy) {
      return
    }
    if (this.state.edited) {
      this.setState({ confirming: 'leave' })
      return
    }
    this.props.onClose()
  }

  // ---------------------------------------------------------------- drawing

  renderName() {
    const { details, renaming, nameText } = this.state
    if (renaming) {
      return (
        <input
          type='text'
          className={`${RS}-input ${RS}-template-editor-name-input`}
          value={nameText}
          maxLength={TEMPLATE_TITLE_MAX}
          aria-label={T.nameLabel}
          data-test='reports-template-editor-name-input'
          autoFocus
          onChange={(e) => this.setState({ nameText: e.target.value })}
          onBlur={() => this.finishRenaming(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              this.finishRenaming(true)
            } else if (e.key === 'Escape') {
              e.preventDefault()
              this.finishRenaming(false)
            }
          }}
        />
      )
    }
    return (
      <button
        type='button'
        className={`${RS}-template-editor-name`}
        title={T.rename}
        data-test='reports-template-editor-name'
        disabled={!this.ready()}
        onClick={this.startRenaming}
      >
        {(details ? details.title : this.props.title) || T.untitled}
      </button>
    )
  }

  renderStatus() {
    const { template } = this.state
    if (!template) {
      return null
    }
    const published = template.status === 'PUBLISHED'
    return (
      <>
        <span className={`${RS}-template-status`} data-published={published || undefined}>
          {published ? M.published : M.draft}
        </span>
        {hasChangesWaiting(template) ? (
          <span className={`${RS}-template-status`} data-changes='' data-test='reports-template-editor-changes'>
            {M.unpublishedChanges}
          </span>
        ) : null}
      </>
    )
  }

  renderActions() {
    const { template, edited, busy } = this.state
    const ready = this.ready()
    const published = template?.status === 'PUBLISHED'
    const waiting = hasChangesWaiting(template)
    const spinner = (what) =>
      busy === what ? (
        <span className={`${RS}-spin`}>
          <Icon name='spinner' size={13} />
        </span>
      ) : null
    return (
      <div className={`${RS}-template-editor-actions`}>
        <button
          type='button'
          className={`${RS}-button`}
          data-test='reports-template-editor-details'
          disabled={!ready}
          onClick={this.openDetails}
        >
          {T.details}
        </button>
        {waiting ? (
          <button
            type='button'
            className={`${RS}-button`}
            data-test='reports-template-editor-discard'
            disabled={!ready}
            onClick={() => this.setState({ confirming: 'discard' })}
          >
            {spinner('discard')}
            {T.discardChanges}
          </button>
        ) : null}
        <button
          type='button'
          className={`${RS}-button`}
          data-test='reports-template-editor-close'
          disabled={!!busy}
          onClick={this.leave}
        >
          {edited ? S.cancel : S.close}
        </button>
        <button
          type='button'
          className={`${RS}-button`}
          data-test='reports-template-editor-save'
          disabled={!this.canSave()}
          onClick={this.save}
        >
          {spinner('save')}
          {busy === 'save' ? T.saving : T.save}
        </button>
        <button
          type='button'
          className={`${RS}-button`}
          data-variant='primary'
          data-test='reports-template-editor-publish'
          disabled={!ready || (published && !edited && !waiting)}
          onClick={this.publish}
        >
          {spinner('publish')}
          {busy === 'publish' ? T.publishing : published ? T.publishChanges : T.publish}
        </button>
      </div>
    )
  }

  renderNotices() {
    const { error, saved, template, report, fill, filling } = this.state
    const locked = this.lockedReason()
    const fillNotice = fill && report ? fillNoticeOf(fill, filling, report, T.fill) : null
    return (
      <>
        {error ? (
          <p className={`${RS}-editor-notice`} role='alert' data-test='reports-template-editor-error'>
            <Icon name='alert' size={14} />
            {error}
          </p>
        ) : null}
        {locked ? (
          <p className={`${RS}-editor-notice`} data-tone='warning' role='status'>
            <Icon name='alert' size={14} />
            {locked}
          </p>
        ) : null}
        {saved ? (
          <p className={`${RS}-editor-notice`} data-tone='info' role='status' data-test='reports-template-editor-saved'>
            <Icon name='check' size={14} />
            {template?.status === 'PUBLISHED' ? T.savedChanges : T.saved}
          </p>
        ) : null}
        {fillNotice ? (
          <p
            className={`${RS}-editor-notice`}
            data-tone={fillNotice.tone}
            role='status'
            data-test='reports-template-editor-fill'
          >
            {filling ? (
              <span className={`${RS}-spin`}>
                <Icon name='spinner' size={14} />
              </span>
            ) : (
              <Icon name={fillNotice.tone === 'info' ? 'check' : 'alert'} size={14} />
            )}
            {fillNotice.text}
          </p>
        ) : null}
      </>
    )
  }

  renderBody() {
    const { template, report, loadError, filling } = this.state
    if (loadError) {
      return (
        <div className={`${RS}-message`} data-tone='error'>
          <Icon name='alert' size={20} />
          <p role='alert'>{loadError}</p>
          <button type='button' className={`${RS}-button`} onClick={this.load}>
            {S.tryAgain}
          </button>
        </div>
      )
    }
    if (!report) {
      return (
        <div className={`${RS}-message`}>
          <span className={`${RS}-spin`}>
            <Icon name='spinner' size={20} />
          </span>
          <p>{T.opening}</p>
        </div>
      )
    }
    return (
      <ReportBuilder
        key={template.id}
        {...this.props.builderProps}
        report={report}
        onChange={this.onChange}
        readOnly={filling || !!this.lockedReason()}
        dataFill={this.dataFill()}
      />
    )
  }

  renderDialogs() {
    const { detailsDraft, detailsError, categories, confirming, busy } = this.state
    const stay = () => this.setState({ confirming: null })
    return (
      <>
        {detailsDraft ? (
          <ReportModal
            title={T.detailsTitle}
            description={T.detailsWhat}
            size='small'
            testId='reports-template-editor-details-dialog'
            onClose={this.closeDetails}
            status={detailsError}
            statusTone={detailsError ? 'error' : undefined}
            actions={
              <>
                <button type='button' className={`${RS}-button`} onClick={this.closeDetails}>
                  {S.cancel}
                </button>
                <button
                  type='button'
                  className={`${RS}-button`}
                  data-variant='primary'
                  data-test='reports-template-editor-details-apply'
                  disabled={!detailsDraft.title.trim()}
                  onClick={this.applyDetails}
                >
                  {T.apply}
                </button>
              </>
            }
          >
            <TemplateDetailsFields
              value={detailsDraft}
              categories={categories}
              onChange={(next) => this.setState({ detailsDraft: next, detailsError: null })}
            />
          </ReportModal>
        ) : null}

        {confirming === 'leave' ? (
          <ReportModal
            title={T.leaveTitle}
            description={T.leaveWhat}
            size='small'
            testId='reports-template-editor-leave'
            initialFocus={this.keepEditingRef}
            onClose={stay}
            actions={
              <>
                <button ref={this.keepEditingRef} type='button' className={`${RS}-button`} onClick={stay}>
                  {T.keepEditing}
                </button>
                <button
                  type='button'
                  className={`${RS}-button`}
                  data-variant='danger'
                  data-test='reports-template-editor-leave-confirm'
                  onClick={this.props.onClose}
                >
                  {T.leave}
                </button>
              </>
            }
          />
        ) : null}

        {confirming === 'discard' ? (
          <ReportModal
            title={T.discardTitle}
            description={T.discardWhat}
            size='small'
            testId='reports-template-editor-discard-dialog'
            initialFocus={this.keepChangesRef}
            busy={!!busy}
            onClose={stay}
            actions={
              <>
                <button ref={this.keepChangesRef} type='button' className={`${RS}-button`} onClick={stay}>
                  {T.keep}
                </button>
                <button
                  type='button'
                  className={`${RS}-button`}
                  data-variant='danger'
                  data-test='reports-template-editor-discard-confirm'
                  onClick={this.discard}
                >
                  {T.discard}
                </button>
              </>
            }
          />
        ) : null}
      </>
    )
  }

  render() {
    return (
      <div className={`${RS}-editor ${RS}-template-editor`} data-test='reports-template-editor'>
        <div className={`${RS}-template-editor-bar`}>
          <span className={`${RS}-template-editor-kind`}>
            <Icon name='template' size={14} />
            {T.kind}
          </span>
          <div className={`${RS}-template-editor-heading`}>
            {this.renderName()}
            {this.renderStatus()}
          </div>
          {this.renderActions()}
        </div>
        {this.renderNotices()}
        <div className={`${RS}-editor-body`}>{this.renderBody()}</div>
        {this.renderDialogs()}
      </div>
    )
  }
}
