import React from 'react'
import { Icon } from '../components/icons'
import { summarizeFilterLocks } from '../model/filterLocks'
import { STRINGS } from '../strings'
import { fetchReportCategories } from '../run/reportsApi'
import { createTemplateFromReport } from '../run/templatesApi'
import { describeBlock, describeReportError } from './documents'
import { ReportModal } from './ReportModal'
import { RS } from './reportsConstants'
import { REPORTS_STRINGS } from './reportsStrings'
import { detailsOf, detailsProblem, detailsToSend, TemplateDetailsFields } from './templateDetails'

// Report options › Save as template… (an organization's admins): a draft template for the organization, made from the
// report as AutoQL has it — so it's saved first (`flush`, which resolves with whether it was). AutoQL takes the data
// out; what it keeps as it is — titles, headings, text, questions, an analysis's focus — can still name clients, which
// is said before anything else. With enableFilterLocks, a template is for what its report is for (a household, say:
// its filter lock), and reports started from it begin with that, so what's said first is what that is, or that it's
// for everything and how to make it for one. Once it's made, Manage templates (`onManage`) is where it's published.
//
// Props: authentication, reportId, report (as shown), flush, onClose, onManage, enableFilterLocks, filterLockLabels.

const S = REPORTS_STRINGS.saveAsTemplate

export class SaveAsTemplateDialog extends React.Component {
  constructor(props) {
    super(props)
    this.titleRef = React.createRef()
    this.state = {
      details: detailsOf({ title: props.report?.title }),
      categories: [],
      saving: false,
      error: null,
      saved: null,
    }
  }

  componentDidMount() {
    this.mounted = true
    fetchReportCategories({ authentication: this.props.authentication }).then(
      (categories) => {
        if (this.mounted) {
          this.setState({ categories: [...categories].sort((a, b) => a.name.localeCompare(b.name)) })
        }
      },
      () => {}, // Without them, there's no category to choose.
    )
  }

  componentWillUnmount() {
    this.mounted = false
  }

  save = async () => {
    const { details, saving } = this.state
    if (saving) {
      return
    }
    const problem = detailsProblem(details)
    if (problem) {
      this.setState({ error: `${REPORTS_STRINGS.errors.lead.saveTemplate}: ${problem}.` })
      return
    }
    this.setState({ saving: true, error: null })
    let error = null
    let saved = null
    if (!(await this.props.flush())) {
      error = S.notSaved
    } else {
      const { title, description, categoryId, tags } = detailsToSend(details)
      try {
        saved = await createTemplateFromReport({
          authentication: this.props.authentication,
          reportId: this.props.reportId,
          title,
          description: description || undefined,
          categoryId: categoryId || undefined,
          tags: tags || undefined,
        })
      } catch (failure) {
        error =
          failure?.code === 'REPORT_TEMPLATE_BLOCK_NOT_PORTABLE'
            ? S.blockNotPortable(
                describeBlock(this.props.report?.blocks?.find((block) => block?.id === failure.details?.blockId)),
              )
            : describeReportError(failure, 'saveTemplate').message
      }
    }
    if (this.mounted) {
      this.setState({ saving: false, error, saved })
    }
  }

  // Before anything else, with enableFilterLocks: what the template is for, as its report is (one household, say, or
  // everything). Without, that what it keeps as it is can still name clients.
  renderCheck() {
    const { enableFilterLocks, filterLockLabels, report } = this.props
    if (enableFilterLocks) {
      const label = filterLockLabels?.title || STRINGS.filterLock.title
      const lock = summarizeFilterLocks(report?.sessionFilterLocks)
      return (
        <p className={`${RS}-template-check`} data-tone='kept' data-test='reports-save-as-template-lock'>
          <Icon name='check' size={14} />
          {lock ? S.keepsLock(label, lock) : S.keepsNone(label, filterLockLabels?.none || STRINGS.filterLock.none)}
        </p>
      )
    }
    return (
      <p className={`${RS}-template-check`}>
        <Icon name='warning' size={14} />
        {S.check}
      </p>
    )
  }

  renderSaved() {
    return (
      <p className={`${RS}-template-saved`} role='status' data-test='reports-save-as-template-saved'>
        <Icon name='check' size={16} />
        {S.saved(this.state.saved.title)}
      </p>
    )
  }

  render() {
    const { onClose, onManage } = this.props
    const { details, categories, saving, error, saved } = this.state
    return (
      <ReportModal
        title={S.title}
        description={saved ? undefined : S.what}
        size='small'
        initialFocus={this.titleRef}
        testId='reports-save-as-template'
        busy={saving}
        onClose={onClose}
        status={error}
        statusTone={error ? 'error' : undefined}
        actions={
          saved ? (
            <>
              <button type='button' className={`${RS}-button`} onClick={onClose}>
                {REPORTS_STRINGS.close}
              </button>
              {onManage ? (
                <button
                  type='button'
                  className={`${RS}-button`}
                  data-variant='primary'
                  data-test='reports-save-as-template-manage'
                  onClick={onManage}
                >
                  {S.manage}
                </button>
              ) : null}
            </>
          ) : (
            <>
              <button type='button' className={`${RS}-button`} disabled={saving} onClick={onClose}>
                {REPORTS_STRINGS.cancel}
              </button>
              <button
                type='button'
                className={`${RS}-button`}
                data-variant='primary'
                data-test='reports-save-as-template-save'
                disabled={saving || !details.title.trim()}
                onClick={this.save}
              >
                {saving ? (
                  <>
                    <span className={`${RS}-spin`}>
                      <Icon name='spinner' size={14} />
                    </span>
                    {S.saving}
                  </>
                ) : (
                  S.save
                )}
              </button>
            </>
          )
        }
      >
        {saved ? (
          this.renderSaved()
        ) : (
          <>
            {this.renderCheck()}
            <TemplateDetailsFields
              value={details}
              categories={categories}
              disabled={saving}
              titleRef={this.titleRef}
              onChange={(next) => this.setState({ details: next, error: null })}
            />
          </>
        )}
      </ReportModal>
    )
  }
}
