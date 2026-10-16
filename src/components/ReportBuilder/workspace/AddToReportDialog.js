import React from 'react'
import PropTypes from 'prop-types'
import { authenticationType } from '../../../props/types'
import { Icon } from '../components/icons'
import { createEmptyReport } from '../model/reportSchema'
import { appendReportBlock, createReport, fetchReports } from '../run/reportsApi'
import { REPORTS_PAGE_SIZE, RS } from './constants'
import {
  REPORT_TITLE_MAX,
  describeBlock,
  describeReportError,
  isReportGone,
  newReportId,
  stripQueryResponses,
  titleOf,
} from './documents'
import { ReportModal } from './ReportModal'
import { REPORTS_STRINGS } from './strings'
import './Reports.scss'

// "Add to Report…": a host opens it from an answer's or a dashboard tile's More menu, with the block
// captureReportBlock made of what the answer or tile showed then, and where it came from. The block goes at the end
// of one of the user's saved reports, or of a new one. The reports are the user's own on the token's data source,
// kept by AutoQL's report service. Afterwards the host hears where it went (onAdded): it shows its own confirmation,
// and may open the report.

const S = REPORTS_STRINGS.addToReport

// The choice that makes a new report. Report ids are UUIDs, so none is this.
const NEW_REPORT = '__new__'

// The data source is the token's: without a token, and a domain to reach AutoQL at, there's nothing to list or add to.
const hasDataSource = (authentication) => !!(authentication?.token && authentication?.domain)

// When a report was last saved, beside its name ("Edited Oct 3"); nothing for a date that can't be read.
const editedLabel = (iso) => {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : S.edited(date.toLocaleDateString([], { month: 'short', day: 'numeric' }))
}

// Whether the new report's name field shows: it's chosen, and the list is in.
const isNaming = ({ chosenId, reports }) => chosenId === NEW_REPORT && reports !== null

let dialogIds = 0

export class AddToReportDialog extends React.Component {
  static propTypes = {
    // AutoQL's { apiKey, domain, token }: the reports are the token's user's, on its data source.
    authentication: authenticationType,
    // The report block to add, as captureReportBlock made it.
    block: PropTypes.object.isRequired,
    onClose: PropTypes.func.isRequired,
    // Called once the block is added, before onClose, with { id, title, created }: created is true when a new
    // report was made for it.
    onAdded: PropTypes.func,
  }

  static defaultProps = {
    authentication: undefined,
    onAdded: undefined,
  }

  constructor(props) {
    super(props)
    dialogIds += 1
    this.ids = { choice: `${RS}-add-to-report-${dialogIds}`, name: `${RS}-add-to-report-name-${dialogIds}` }
    this.nameRef = React.createRef()
    // The latest list asked for (an answer to an earlier one is ignored), and whether any has come back yet.
    this.listSeq = 0
    this.listed = false
    this.state = {
      // Null while the list loads.
      reports: null,
      // The report to add to, NEW_REPORT, or null for nothing (the chosen report turned out to be gone).
      chosenId: NEW_REPORT,
      name: '',
      error: null,
      adding: false,
    }
  }

  componentDidMount() {
    this.mounted = true
    this.load()
  }

  componentDidUpdate(prevProps, prevState) {
    const before = prevProps.authentication || {}
    const now = this.props.authentication || {}
    if (before.token !== now.token || before.domain !== now.domain || before.apiKey !== now.apiKey) {
      this.load()
    }
    // The name field takes focus as it shows: a new report chosen, or the list in with that choice.
    if (isNaming(this.state) && !isNaming(prevState)) {
      this.nameRef.current?.focus()
    }
  }

  componentWillUnmount() {
    this.mounted = false
  }

  // The user's reports, most recently saved first (the service's order). The first list chooses the newest, or a
  // new report when there are none. A later one, after an add found its report gone, keeps the choice only while
  // it's still listed, so nothing lands somewhere unexpected.
  load = () => {
    this.listSeq += 1
    const seq = this.listSeq
    const { authentication } = this.props
    if (!hasDataSource(authentication)) {
      this.setState({ reports: [] })
      return
    }
    this.setState({ reports: null })
    const current = () => this.mounted && seq === this.listSeq
    fetchReports({ authentication, pageSize: REPORTS_PAGE_SIZE }).then(
      (result) => {
        if (!current()) return
        const reports = Array.isArray(result?.reports) ? result.reports : []
        const first = !this.listed
        this.listed = true
        this.setState(({ chosenId }) => ({
          reports,
          chosenId: first
            ? reports[0]?.id ?? NEW_REPORT
            : chosenId === NEW_REPORT || reports.some((report) => report.id === chosenId)
            ? chosenId
            : null,
        }))
      },
      (error) => {
        if (!current()) return
        // A new report may still be made. A report chosen before can't be seen now, so it isn't kept.
        const first = !this.listed
        this.listed = true
        this.setState(({ chosenId }) => ({
          reports: [],
          chosenId: first || chosenId === NEW_REPORT ? NEW_REPORT : null,
          error: describeReportError(error, 'load').message,
        }))
      },
    )
  }

  choose = (chosenId) => this.setState({ chosenId, error: null })

  canAdd = () => {
    const { reports, chosenId, name, adding } = this.state
    return (
      hasDataSource(this.props.authentication) &&
      reports !== null &&
      chosenId !== null &&
      !adding &&
      (chosenId !== NEW_REPORT || !!name.trim())
    )
  }

  // The block goes as plain JSON, without the live query response it may still carry.
  add = async () => {
    if (!this.canAdd()) return
    const { authentication, block } = this.props
    const { reports, chosenId, name } = this.state
    this.setState({ adding: true, error: null })
    const clean = stripQueryResponses(block)
    let added
    try {
      if (chosenId === NEW_REPORT) {
        const report = createEmptyReport({ title: name.trim(), blocks: [clean] })
        const created = await createReport({ authentication, id: newReportId(), report })
        added = { id: created.id, title: titleOf(created), created: true }
      } else {
        await appendReportBlock({ authentication, id: chosenId, block: clean })
        added = { id: chosenId, title: titleOf(reports.find((report) => report.id === chosenId)), created: false }
      }
    } catch (error) {
      if (!this.mounted) return
      this.setState({ adding: false, error: describeReportError(error, 'add').message })
      // Deleted in the meantime: show the list as it is now.
      if (isReportGone(error)) this.load()
      return
    }
    if (!this.mounted) return
    this.props.onAdded?.(added)
    this.props.onClose?.()
    // A host that keeps it open gets it back as it was, rather than stuck adding.
    if (this.mounted) this.setState({ adding: false })
  }

  // Cancel, which is off while adding, as the close button is.
  close = () => this.props.onClose?.()

  // Enter adds, once it can (and not while it's confirming a character being composed).
  onNameKeyDown = (e) => {
    if (e.key === 'Enter' && !e.nativeEvent?.isComposing && this.canAdd()) {
      e.preventDefault()
      this.add()
    }
  }

  renderChoices() {
    const { reports, chosenId, name } = this.state
    const naming = chosenId === NEW_REPORT
    return (
      <ul className={`${RS}-choices`} role='radiogroup' aria-label={S.chooseReport}>
        {reports.map((report) => {
          const checked = report.id === chosenId
          const edited = editedLabel(report.updatedAt)
          return (
            <li
              key={report.id}
              className={`${RS}-choice`}
              data-checked={checked || undefined}
              data-test='reports-add-to-report-report'
            >
              <label className={`${RS}-choice-row`}>
                <input type='radio' name={this.ids.choice} checked={checked} onChange={() => this.choose(report.id)} />
                <span className={`${RS}-choice-name`}>{titleOf(report)}</span>
                {edited ? <span className={`${RS}-choice-aside`}>{edited}</span> : null}
              </label>
            </li>
          )
        })}
        <li className={`${RS}-choice`} data-checked={naming || undefined} data-test='reports-add-to-report-new'>
          <label className={`${RS}-choice-row`}>
            <input type='radio' name={this.ids.choice} checked={naming} onChange={() => this.choose(NEW_REPORT)} />
            <Icon name='file' />
            <span className={`${RS}-choice-name`}>{S.newReport}</span>
          </label>
          {naming ? (
            <div className={`${RS}-choice-more`}>
              <label className={`${RS}-label`} htmlFor={this.ids.name}>
                {S.newName}
              </label>
              <input
                ref={this.nameRef}
                id={this.ids.name}
                type='text'
                className={`${RS}-input`}
                value={name}
                maxLength={REPORT_TITLE_MAX}
                placeholder={S.newNamePlaceholder}
                data-test='reports-add-to-report-name'
                onChange={(e) => this.setState({ name: e.target.value })}
                onKeyDown={this.onNameKeyDown}
              />
            </div>
          ) : null}
        </li>
      </ul>
    )
  }

  render() {
    const { authentication, block, onClose } = this.props
    const { reports, error, adding } = this.state
    const status = error || (hasDataSource(authentication) ? null : S.noDataSource)
    return (
      <ReportModal
        title={S.title}
        description={S.what(describeBlock(block))}
        size='small'
        status={status}
        statusTone={status ? 'error' : undefined}
        busy={adding}
        onClose={onClose}
        testId='reports-add-to-report'
        actions={
          <>
            <button
              type='button'
              className={`${RS}-button`}
              disabled={adding}
              data-test='reports-add-to-report-cancel'
              onClick={this.close}
            >
              {REPORTS_STRINGS.cancel}
            </button>
            <button
              type='button'
              className={`${RS}-button`}
              data-variant='primary'
              disabled={!this.canAdd()}
              data-test='reports-add-to-report-add'
              onClick={this.add}
            >
              {adding ? S.adding : S.add}
            </button>
          </>
        }
      >
        <div
          className={`${RS}-add-to-report-list`}
          aria-busy={reports === null || undefined}
          data-test='reports-add-to-report-list'
        >
          {reports === null ? (
            <div className={`${RS}-message`}>
              <span className={`${RS}-spin`}>
                <Icon name='spinner' />
              </span>
              <p>{REPORTS_STRINGS.loadingReports}</p>
            </div>
          ) : (
            this.renderChoices()
          )}
        </div>
      </ReportModal>
    )
  }
}
