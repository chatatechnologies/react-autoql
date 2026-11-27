import React from 'react'
import { Icon } from '../components/icons'
import { SelectBox } from '../components/controls'
import { ReportBuilder } from '../ReportBuilder'
import { FilterLockField } from '../components/FilterLockField'
import { filterLocksKey, normalizeFilterLocks } from '../model/filterLocks'
import { STRINGS } from '../strings'
import { fetchReportCategories, fetchReportTemplate, fetchReportTemplates } from '../run/reportsApi'
import { batchFolderName, batchFolderOf, describeReportError, newReportId, ORGANIZER_NAME_MAX } from './documents'
import { ReportModal } from './ReportModal'
import { BATCH_AT_ONCE, BATCH_SECONDS_PER_REPORT, DEFAULT_BATCH_LIMIT, RS } from './reportsConstants'
import { REPORTS_STRINGS } from './reportsStrings'

// New report › Start from a template: the templates published for the data source (its organization's and the
// integrator's, made for its data model), to search by title and narrow by category and tags, each shown as it prints
// beside the list, its data blocks waiting for data. Starting one makes the report from it (onStart), which AutoQL then
// fills in with the user's data.
//
// Every template is listed at once (they're summaries, without their documents), so searching and narrowing happen
// here. A template's document is fetched when it's chosen, and kept while the dialog is open.
//
// Props: authentication, autoQLConfig, dataFormatting, previewProps (more for the preview's ReportBuilder: branding,
// enableBranding, fontStylesheetUrl), onClose (back to New report), onStart({ templateId, title, id,
// sessionFilterLocks? }), which resolves once the report is made or rejects with why not, and onManage (Manage
// templates, for an organization's admins). `title` is the template's name, which its reports are titled with.
//
// With enableFilterLocks, who the report is for is chosen under the templates (renderFor), one of three, each saying
// what it makes, so the footer has only Back and Start. Everything: no filter lock, even from a template that has one.
// Specific values of what the host's data locks on (its households, say): the report's filter lock
// (model/filterLocks.js), picked with the host's loadFilterLockSuggestions and filterLockLabels, as in the builder. It
// starts out as the template's own, which a template keeps from the report it was made from, so Start report waits for
// the template's document; the preview shows the report for what's chosen.
//
// With onStartEach too, a report for each value (RW-353): onStartEach({ templateId, title, starts: [{ id, lock }],
// folderName }), which resolves once they're under way or rejects with why none were made. With the host's list
// (loadFilterLockSuggestions), it's every value in it, any unticked again in the list shown in the preview's place
// (RW-371), started by name (starts: [{ id, name }]), each looked up as its report is made, so a batch of hundreds
// starts at once; without the list, it's each value picked. At most `batchLimit` at once (DEFAULT_BATCH_LIMIT; null
// for no limit). A batch says about how long it takes, and asks before it starts, in a pop-up over the dialog
// (RW-385) that has the folder they go into: named for the template and the day, or as the user names it (RW-387).

// A template's own filter lock, from its document.
const templateLocks = (template) => normalizeFilterLocks(template?.report?.sessionFilterLocks)

let dialogIds = 0

// What one of the host's values is called, from what they all are ("Households" → "household"), for "a report for each
// household".
const oneOf = (what) => what.trim().toLowerCase().replace(/s$/, '')

// The host's values, each once, A to Z: what a report for each is made for.
const valuesOf = (names) =>
  Array.from(new Set((Array.isArray(names) ? names : []).filter((n) => typeof n === 'string' && n.trim()))).sort(
    (a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true }),
  )

// About how long a batch of `n` takes, in minutes for "It takes about …": to the minute below ten, to five above.
export const batchMinutes = (n) => {
  const minutes = (n * BATCH_SECONDS_PER_REPORT) / BATCH_AT_ONCE / 60
  return minutes < 10 ? Math.max(1, Math.round(minutes)) : Math.round(minutes / 5) * 5
}

const S = REPORTS_STRINGS
const T = S.templates

// A data source sees at most 1,000 templates (500 of its organization's and 500 of the integrator's): five pages of
// the most the service sends at once.
const PAGE_SIZE = 200
const MAX_PAGES = 5

// A template shows its data blocks waiting for data.
const TEMPLATE_FILL = { state: 'template' }

const byName = (a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true })

const listTemplates = async (authentication) => {
  const ask = (page) =>
    fetchReportTemplates({ authentication, page, pageSize: PAGE_SIZE, orderBy: 'title', order: 'asc' })
  const first = await ask(1)
  const more = []
  for (let page = 2; page <= Math.min(first.totalPages || 1, MAX_PAGES); page += 1) {
    more.push(ask(page))
  }
  const seen = new Set()
  return [first, ...(await Promise.all(more))]
    .flatMap((page) => page.templates)
    .filter((template) => !seen.has(template.id) && seen.add(template.id))
}

// The templates shown: those whose title has the search in it, in the category chosen, with any of the tags chosen.
export const matchingTemplates = (templates, { q = '', categoryId = '', tags = [] } = {}) => {
  const search = q.trim().toLowerCase()
  return templates.filter(
    (template) =>
      (!search || template.title.toLowerCase().includes(search)) &&
      (!categoryId || template.categoryId === categoryId) &&
      (!tags.length || tags.some((tag) => template.tags.includes(tag))),
  )
}

export class TemplatesDialog extends React.Component {
  constructor(props) {
    super(props)
    this.searchRef = React.createRef()
    this.pickListRef = React.createRef()
    // Documents fetched, by template.
    this.documents = new Map()
    // The id each template's report is made under, for each filter lock: a retry after a start that may have gone
    // through asks for the same report again, rather than making a second. Started for another lock, it's another
    // report: the service answers an id it has already made with that report, whatever else is asked.
    this.startIds = new Map()
    this.loadRequest = 0
    dialogIds += 1
    this.forId = `${RS}-templates-for-${dialogIds}`
    this.folderId = `${RS}-templates-folder-${dialogIds}`
    this.state = {
      templates: null,
      categories: [],
      listError: null,
      q: '',
      categoryId: '',
      tags: [],
      chosenId: null,
      chosen: null,
      chosenError: null,
      starting: false,
      startError: null,
      locks: [],
      // Who the report is for: everything ('all'), the values picked ('some'), or a report for each ('each').
      mode: 'all',
      // The host's whole list, for a report for each (RW-371); whether it couldn't be loaded; and the values in it
      // unticked again.
      allNames: null,
      allNamesFailed: false,
      left: [],
      // The list a report for each is made for, shown in the preview's place to untick some; what it's searched for; and
      // how many of it are below what's in sight.
      picking: false,
      pickQ: '',
      pickBelow: 0,
      // A batch's question before it starts, in a pop-up (RW-385): how many, about how long, and the folder they go
      // into, as it's named there (RW-387): null until it's asked, then kept should it ask again for this template.
      confirming: false,
      folderName: null,
      // The dialog, for the filter lock's popover to open in: one opened outside it couldn't take focus.
      lockHost: null,
    }
  }

  componentDidMount() {
    this.mounted = true
    this.load()
    this.loadAllNames()
  }

  componentDidUpdate() {
    this.watchPickList()
    this.measurePickList()
  }

  componentWillUnmount() {
    this.mounted = false
    this.chosenController?.abort()
    this.pickListObserver?.disconnect()
    if (typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.pickFrame)
    }
  }

  load = () => {
    const { authentication } = this.props
    this.loadRequest += 1
    const request = this.loadRequest
    this.setState({ templates: null, listError: null })
    Promise.all([listTemplates(authentication), fetchReportCategories({ authentication }).catch(() => [])]).then(
      ([templates, categories]) => {
        if (this.mounted && request === this.loadRequest) {
          this.setState({ templates, categories: [...categories].sort((a, b) => byName(a.name, b.name)) })
        }
      },
      (error) => {
        if (this.mounted && request === this.loadRequest) {
          this.setState({ templates: [], listError: describeReportError(error, 'templates').message })
        }
      },
    )
  }

  // A template chosen: shown as soon as its document is in. With enableFilterLocks, the report it starts is for what
  // the template is for, once that's known, unless something else was chosen under the templates while it came.
  choose = (id) => {
    if (id === this.state.chosenId) {
      return
    }
    this.chosenController?.abort()
    this.lockChosenFor = null
    const kept = this.documents.get(id)
    this.setState({
      chosenId: id,
      chosen: kept || null,
      chosenError: null,
      startError: null,
      confirming: false,
      folderName: null,
      ...this.locksOf(kept),
    })
    if (kept) {
      return
    }
    const controller = typeof AbortController === 'function' ? new AbortController() : null
    this.chosenController = controller
    fetchReportTemplate({ authentication: this.props.authentication, id, signal: controller?.signal }).then(
      (template) => {
        this.documents.set(id, template)
        if (this.mounted && this.state.chosenId === id) {
          this.setState({ chosen: template, ...(this.lockChosenFor === id ? {} : this.locksOf(template)) })
        }
      },
      (error) => {
        if (this.mounted && this.state.chosenId === id && !controller?.signal.aborted) {
          this.setState({ chosenError: describeReportError(error, 'template').message })
        }
      },
    )
  }

  retryChosen = () => {
    const id = this.state.chosenId
    this.setState({ chosenId: null }, () => this.choose(id))
  }

  toggleTag = (tag) =>
    this.setState(({ tags }) => ({ tags: tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag] }))

  clearFilters = () => this.setState({ q: '', categoryId: '', tags: [] }, () => this.searchRef.current?.focus())

  setLockHost = (element) => {
    if (element) {
      this.setState({ lockHost: element.closest('[role="dialog"]') || null })
    }
  }

  // Who the report is for, as the template has it (everything before its document is in): its own filter lock, or
  // everything. A report for each, once chosen, stays chosen from one template to the next.
  locksOf = (template) => {
    if (!this.props.enableFilterLocks || this.state.mode === 'each') {
      return {}
    }
    const locks = templateLocks(template)
    return { locks, mode: locks.length ? 'some' : 'all' }
  }

  setLocks = (locks) => {
    this.lockChosenFor = this.state.chosenId
    this.setState({ locks, confirming: false, startError: null })
  }

  // Who the report is for, chosen. What was picked or unticked for the others is kept, should they be chosen again.
  setMode = (mode) => {
    this.lockChosenFor = this.state.chosenId
    this.setState({ mode, picking: false, pickQ: '', confirming: false, startError: null })
  }

  // The filter lock one report is started for: the values picked, or none, for everything. A report for each has its
  // own, one value each.
  reportLocks() {
    return this.props.enableFilterLocks && this.state.mode === 'some' ? this.state.locks : []
  }

  // ---------------------------------------------------------------- a report for each value in the list (RW-371)

  canSelectAll = () =>
    !!(this.props.enableFilterLocks && this.props.onStartEach && this.props.loadFilterLockSuggestions)

  // A report for each is for the host's list, unless there's none, or it couldn't be loaded: then it's for each value
  // picked.
  listEach = () => this.canSelectAll() && !this.state.allNamesFailed

  // The host's list, as the lock's picker has it: a report for each says how many it makes.
  loadAllNames = async () => {
    if (!this.canSelectAll()) {
      return
    }
    try {
      const names = valuesOf(await this.props.loadFilterLockSuggestions())
      if (this.mounted) {
        this.setState({ allNames: names })
      }
    } catch (error) {
      if (this.mounted) {
        this.setState({ allNamesFailed: true })
      }
    }
  }

  togglePicking = () => this.setState(({ picking }) => ({ picking: !picking, pickQ: '' }))

  // How many of the list are below what's in sight: those whose middle is past its bottom edge. Measured as it's
  // scrolled, searched or resized, so the line under it says how many more there are, and goes once there are none.
  measurePickList = () => {
    const list = this.pickListRef.current
    let below = 0
    if (list) {
      const bottom = list.scrollTop + list.clientHeight
      Array.from(list.children).forEach((item) => {
        if (item.offsetTop + item.offsetHeight / 2 > bottom) {
          below += 1
        }
      })
    }
    if (below !== this.state.pickBelow) {
      this.setState({ pickBelow: below })
    }
  }

  onPickScroll = () => {
    if (typeof requestAnimationFrame !== 'function') {
      this.measurePickList()
      return
    }
    cancelAnimationFrame(this.pickFrame)
    this.pickFrame = requestAnimationFrame(this.measurePickList)
  }

  // The list's size changes with the dialog's (the window resized), which changes what's in sight.
  watchPickList = () => {
    const list = this.pickListRef.current
    if (list === this.pickListWatched) {
      return
    }
    this.pickListObserver?.disconnect()
    this.pickListWatched = list
    if (list && typeof ResizeObserver === 'function') {
      this.pickListObserver = new ResizeObserver(this.onPickScroll)
      this.pickListObserver.observe(list)
    }
  }

  // Show more: a page further down.
  scrollPickList = () => {
    const list = this.pickListRef.current
    if (!list) {
      return
    }
    const top = Math.round(list.clientHeight * 0.85)
    if (typeof list.scrollBy === 'function') {
      list.scrollBy({ top, behavior: 'smooth' })
    } else {
      list.scrollTop += top
      this.measurePickList()
    }
  }

  // A value in the list, unticked (or ticked again).
  toggleLeft = (name) =>
    this.setState(({ left }) => ({
      left: left.includes(name) ? left.filter((n) => n !== name) : [...left, name],
      confirming: false,
      startError: null,
    }))

  // Every value ticked again; or, with every one ticked, none, to tick only a few.
  tickAll = () => this.setState({ left: [], confirming: false, startError: null })

  untickAll = () =>
    this.setState(({ allNames }) => ({ left: [...(allNames || [])], confirming: false, startError: null }))

  // The host's list, less those unticked.
  pickedNames() {
    const { allNames, left } = this.state
    if (!allNames) {
      return []
    }
    const unticked = new Set(left)
    return allNames.filter((name) => !unticked.has(name))
  }

  // The most one batch may make: the host's, null for no limit.
  batchLimit() {
    const { batchLimit } = this.props
    if (batchLimit === null) {
      return Infinity
    }
    return Number.isFinite(batchLimit) && batchLimit > 0 ? batchLimit : DEFAULT_BATCH_LIMIT
  }

  // The chosen template as it would start: titled with the template's name, as its reports are, and for what's chosen
  // under the templates (a report for each, as the template, for none of them). Made again only when either changes, so
  // the preview isn't handed a new document on every render.
  previewReport() {
    const { chosen } = this.state
    const locks = this.reportLocks()
    if (!chosen?.report) {
      return chosen?.report
    }
    const withLocks = !!this.props.enableFilterLocks
    const key = withLocks ? filterLocksKey(locks) : ''
    if (this.preview?.chosen !== chosen || this.preview.key !== key) {
      const report = { ...chosen.report, ...(chosen.title ? { title: chosen.title } : {}) }
      if (withLocks) {
        report.sessionFilterLocks = locks
        if (!locks.length) {
          delete report.sessionFilterLocks
        }
      }
      this.preview = { chosen, key, report }
    }
    return this.preview.report
  }

  // The values a report each is started for, when that's what's chosen; null for one report. Those ticked in the
  // host's list are by name ({ name }); those picked, without the list, by their lock ({ lock }), none of them left
  // out (an excluded value can't have a report of its own).
  startsEach() {
    if (!this.props.enableFilterLocks || !this.props.onStartEach || this.state.mode !== 'each') {
      return null
    }
    if (this.listEach()) {
      return this.pickedNames().map((name) => ({ name }))
    }
    const { locks } = this.state
    return locks.every((lock) => lock.filter_type === 'include') ? locks.map((lock) => ({ lock })) : []
  }

  // What stops a report each from starting, said beside Back and Start: more than the limit, or, without the host's
  // list, a value picked that's left out.
  eachProblem(each, what) {
    if (!each) {
      return null
    }
    const limit = this.batchLimit()
    if (each.length > limit) {
      return T.tooMany(limit)
    }
    if (!this.listEach() && this.state.locks.some((lock) => lock.filter_type !== 'include')) {
      return T.forEachExcluded(what)
    }
    return null
  }

  // Under the templates, with enableFilterLocks: who the report is for, one of three, each saying what it makes.
  // Everything (the host's word for no filter lock); the values picked (FilterLockField, which opens FilterLockPopover
  // inside the dialog); and, with onStartEach, a report for each: each value in the host's list, any unticked in the
  // list shown in the preview's place (renderPicking), or, without the list, each value picked.
  renderFor() {
    const labels = this.props.filterLockLabels || {}
    const what = labels.title || STRINGS.filterLock.title
    const { mode, locks, starting, confirming, picking, allNames } = this.state
    const busy = starting || confirming
    // With none picked yet, the field says so, and Change… is Pick….
    const lockField = () => (
      <FilterLockField
        classPrefix={RS}
        locks={locks}
        labels={locks.length ? labels : { ...labels, none: T.forSomeNone, change: T.forSomePick }}
        authentication={this.props.authentication}
        loadSuggestions={this.props.loadFilterLockSuggestions}
        parentElement={this.state.lockHost || undefined}
        disabled={busy}
        onChange={this.setLocks}
      />
    )
    // A report for each: how many of the host's list get one (once it's in), and Edit list…; without the list, the
    // values picked.
    let eachDetail = null
    if (mode === 'each' && !this.listEach()) {
      eachDetail = lockField()
    } else if (mode === 'each') {
      eachDetail = (
        <>
          <span className={`${RS}-templates-for-count`} data-test='reports-templates-for-count'>
            {allNames ? T.forEachCount(this.pickedNames().length, allNames.length) : T.forEachLoading}
          </span>
          {allNames ? (
            <button
              type='button'
              className={`${RS}-templates-link`}
              aria-expanded={picking}
              data-test='reports-templates-edit-list'
              disabled={busy}
              onClick={this.togglePicking}
            >
              {T.forEachEdit}
            </button>
          ) : null}
        </>
      )
    }
    const options = [
      { key: 'all', name: labels.none || STRINGS.filterLock.none, says: T.forAllWhat },
      { key: 'some', name: T.forSome(what), says: T.forSomeWhat, detail: mode === 'some' ? lockField() : null },
    ]
    if (this.props.onStartEach) {
      options.push({ key: 'each', name: T.forEach(oneOf(what)), says: T.forEachWhat, detail: eachDetail })
    }
    return (
      <section className={`${RS}-templates-for`} ref={this.setLockHost} data-test='reports-templates-lock'>
        <h3 className={`${RS}-templates-heading`} id={this.forId}>
          {what}
        </h3>
        <div className={`${RS}-templates-for-options`} role='radiogroup' aria-labelledby={this.forId}>
          {options.map(({ key, name, says, detail }) => (
            <React.Fragment key={key}>
              <label className={`${RS}-templates-for-option`} data-checked={mode === key || undefined}>
                <input
                  type='radio'
                  name={this.forId}
                  value={key}
                  checked={mode === key}
                  disabled={busy}
                  data-test={`reports-templates-for-${key}`}
                  onChange={() => this.setMode(key)}
                />
                <span className={`${RS}-templates-text`}>
                  <span className={`${RS}-templates-name`}>{name}</span>
                  <span className={`${RS}-templates-for-what`}>{says}</span>
                </span>
              </label>
              {mode === key && detail ? <div className={`${RS}-templates-for-detail`}>{detail}</div> : null}
            </React.Fragment>
          ))}
        </div>
      </section>
    )
  }

  // Waits for the template's document with enableFilterLocks: until it's in, what the template is for isn't known.
  // Specific values need one picked at least; a batch, one at least, and no more than the limit.
  canStart() {
    const { chosenId, chosen, starting, mode, locks } = this.state
    const each = this.startsEach()
    const locking = !!this.props.enableFilterLocks
    return (
      !!chosenId &&
      !starting &&
      (!locking || !!chosen) &&
      (!locking || mode !== 'some' || locks.length > 0) &&
      (!each || (each.length > 0 && each.length <= this.batchLimit()))
    )
  }

  // The chosen template's name, which its reports are titled with: from its document once it's in, and from the list
  // until then (without enableFilterLocks, it can be started before its document is in).
  chosenTitle() {
    const { chosenId, chosen, templates } = this.state
    return (chosen || (templates || []).find((template) => template.id === chosenId))?.title || undefined
  }

  // The id a report from the template is made under for these locks (or this value, by name): the same each time it's
  // asked for.
  startIdFor(templateId, locks, name) {
    const startKey = name === undefined ? `${templateId}\n${filterLocksKey(locks)}` : `${templateId}\nname:${name}`
    if (!this.startIds.has(startKey)) {
      this.startIds.set(startKey, newReportId())
    }
    return this.startIds.get(startKey)
  }

  start = async () => {
    const templateId = this.state.chosenId
    if (!this.canStart()) {
      return
    }
    const locks = this.reportLocks()
    // None, from a template that has one, is said: the report is for everything, not for the template's.
    const said = locks.length > 0 || (this.props.enableFilterLocks && templateLocks(this.state.chosen).length > 0)
    const each = this.startsEach()
    // A batch asks first, in a pop-up (RW-385): how many, about how long, and the folder they go into, named for the
    // template and the day unless it was named otherwise when it last asked (RW-387).
    if (each && !this.state.confirming) {
      this.setState(({ folderName }) => ({
        confirming: true,
        startError: null,
        folderName: folderName?.trim() ? folderName : batchFolderName(this.chosenTitle(), new Date()),
      }))
      return
    }
    this.setState({ starting: true, startError: null, confirming: false })
    try {
      if (each) {
        const title = this.chosenTitle()
        await this.props.onStartEach({
          templateId,
          title,
          starts: each.map(({ lock, name }) =>
            lock
              ? { id: this.startIdFor(templateId, [lock]), lock }
              : { id: this.startIdFor(templateId, null, name), name },
          ),
          // Left blank, it's the one suggested.
          folderName: batchFolderOf(this.state.folderName, title, new Date()),
        })
      } else {
        await this.props.onStart({
          templateId,
          title: this.chosenTitle(),
          id: this.startIdFor(templateId, locks),
          ...(said ? { sessionFilterLocks: locks } : {}),
        })
      }
    } catch (error) {
      if (this.mounted) {
        this.setState({ startError: describeReportError(error, 'startFromTemplate').message })
      }
      return
    } finally {
      if (this.mounted) {
        this.setState({ starting: false })
      }
    }
  }

  // Every tag the templates carry, A to Z.
  allTags() {
    const tags = new Set()
    ;(this.state.templates || []).forEach((template) => template.tags.forEach((tag) => tags.add(tag)))
    return [...tags].sort(byName)
  }

  // Over the templates: what they are, with Manage templates (for an organization's admins), and how to narrow them.
  // Titled where the column has a second part, who the report is for, or the link to Manage templates.
  renderFilters() {
    const { onManage, enableFilterLocks } = this.props
    const { q, categoryId, tags: chosenTags, categories, starting } = this.state
    const tags = this.allTags()
    return (
      <div className={`${RS}-templates-filters`}>
        {onManage || enableFilterLocks ? (
          <div className={`${RS}-templates-head`}>
            <h3 className={`${RS}-templates-heading`}>{T.list}</h3>
            {onManage ? (
              <button
                type='button'
                className={`${RS}-templates-link`}
                data-test='reports-templates-manage'
                disabled={starting}
                onClick={onManage}
              >
                {S.manageTemplates.open}
              </button>
            ) : null}
          </div>
        ) : null}
        <input
          ref={this.searchRef}
          type='search'
          className={`${RS}-input`}
          value={q}
          placeholder={T.searchPlaceholder}
          aria-label={T.search}
          data-test='reports-templates-search'
          onChange={(e) => this.setState({ q: e.target.value })}
        />
        {categories.length ? (
          <SelectBox prefix={RS}>
            <select
              className={`${RS}-select`}
              value={categoryId}
              aria-label={T.category}
              data-test='reports-templates-category'
              onChange={(e) => this.setState({ categoryId: e.target.value })}
            >
              <option value=''>{T.allCategories}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </SelectBox>
        ) : null}
        {tags.length ? (
          <div className={`${RS}-templates-tags`} role='group' aria-label={T.tags}>
            {tags.map((tag) => (
              <button
                key={tag}
                type='button'
                className={`${RS}-templates-tag`}
                aria-pressed={chosenTags.includes(tag)}
                onClick={() => this.toggleTag(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  renderList() {
    const { templates, listError, q, categoryId, tags, chosenId, categories } = this.state
    if (templates === null) {
      return (
        <p className={`${RS}-templates-empty`}>
          <span className={`${RS}-spin`}>
            <Icon name='spinner' size={14} />
          </span>
          {T.loading}
        </p>
      )
    }
    if (listError) {
      return (
        <div className={`${RS}-templates-empty`} data-tone='error'>
          <p role='alert'>{listError}</p>
          <button type='button' className={`${RS}-button`} onClick={this.load}>
            {S.tryAgain}
          </button>
        </div>
      )
    }
    if (!templates.length) {
      return <p className={`${RS}-templates-empty`}>{T.none}</p>
    }
    const shown = matchingTemplates(templates, { q, categoryId, tags })
    if (!shown.length) {
      return (
        <div className={`${RS}-templates-empty`}>
          <p>{T.noMatch}</p>
          <button type='button' className={`${RS}-button`} onClick={this.clearFilters}>
            {T.clearFilters}
          </button>
        </div>
      )
    }
    const categoryName = (id) => categories.find((category) => category.id === id)?.name
    return (
      <ul className={`${RS}-templates-list`} role='radiogroup' aria-label={T.list}>
        {shown.map((template) => {
          const meta = [categoryName(template.categoryId), ...template.tags].filter(Boolean).join(' · ')
          return (
            <li key={template.id}>
              <label className={`${RS}-templates-item`} data-checked={template.id === chosenId || undefined}>
                <input
                  type='radio'
                  name={`${RS}-templates`}
                  value={template.id}
                  checked={template.id === chosenId}
                  data-test='reports-templates-item'
                  onChange={() => this.choose(template.id)}
                />
                <span className={`${RS}-templates-text`}>
                  <span className={`${RS}-templates-name`}>{template.title || S.untitled}</span>
                  {template.description ? (
                    <span className={`${RS}-templates-description`}>{template.description}</span>
                  ) : null}
                  {meta ? <span className={`${RS}-templates-meta`}>{meta}</span> : null}
                </span>
              </label>
            </li>
          )
        })}
      </ul>
    )
  }

  // The list a report for each is made for, in the preview's place: every value, ticked, to untick any that shouldn't
  // get a report.
  renderPicking() {
    const labels = this.props.filterLockLabels || {}
    const what = labels.title || STRINGS.filterLock.title
    const { allNames, pickQ } = this.state
    const left = new Set(this.state.left)
    const q = pickQ.trim().toLowerCase()
    const shown = allNames.filter((name) => !q || name.toLowerCase().includes(q))
    return (
      <div className={`${RS}-templates-preview ${RS}-templates-pick`} data-test='reports-templates-pick'>
        <div className={`${RS}-templates-pick-head`}>
          <div className={`${RS}-templates-pick-titles`}>
            <h3 className={`${RS}-templates-pick-title`}>{T.pickTitle(what)}</h3>
            <p className={`${RS}-templates-pick-what`} role='status'>
              {T.pickWhat(allNames.length - left.size, allNames.length)}
            </p>
          </div>
          <input
            type='search'
            className={`${RS}-input`}
            value={pickQ}
            placeholder={T.pickSearch(what)}
            aria-label={T.pickSearch(what)}
            data-test='reports-templates-pick-search'
            onChange={(e) => this.setState({ pickQ: e.target.value })}
          />
          <button
            type='button'
            className={`${RS}-button`}
            data-test='reports-templates-pick-all'
            onClick={left.size ? this.tickAll : this.untickAll}
          >
            {left.size ? T.pickAll : T.untickAll}
          </button>
          <button
            type='button'
            className={`${RS}-button`}
            data-test='reports-templates-pick-done'
            onClick={this.togglePicking}
          >
            {T.pickDone}
          </button>
        </div>
        {shown.length ? (
          <div className={`${RS}-templates-pick-body`}>
            <ul
              ref={this.pickListRef}
              className={`${RS}-templates-pick-list`}
              aria-label={T.pickTitle(what)}
              onScroll={this.onPickScroll}
            >
              {shown.map((name) => (
                <li key={name}>
                  <label className={`${RS}-templates-pick-item`}>
                    <input type='checkbox' checked={!left.has(name)} onChange={() => this.toggleLeft(name)} />
                    <span>{name}</span>
                  </label>
                </li>
              ))}
            </ul>
            {this.state.pickBelow > 0 ? (
              <>
                <div className={`${RS}-templates-pick-fade`} aria-hidden='true' />
                <button
                  type='button'
                  className={`${RS}-templates-pick-more`}
                  data-test='reports-templates-pick-more'
                  onClick={this.scrollPickList}
                >
                  <Icon name='down' size={13} />
                  {T.pickMore(this.state.pickBelow)}
                </button>
              </>
            ) : null}
          </div>
        ) : (
          <p className={`${RS}-templates-empty`}>{T.pickNone}</p>
        )}
      </div>
    )
  }

  renderPreview() {
    if (this.state.picking && this.state.mode === 'each' && this.state.allNames && this.listEach()) {
      return this.renderPicking()
    }
    const { chosenId, chosen, chosenError } = this.state
    const { authentication, autoQLConfig, dataFormatting, previewProps } = this.props
    let content
    if (!chosenId) {
      content = <p className={`${RS}-templates-empty`}>{T.choose}</p>
    } else if (chosenError) {
      content = (
        <div className={`${RS}-templates-empty`} data-tone='error'>
          <p role='alert'>{chosenError}</p>
          <button type='button' className={`${RS}-button`} onClick={this.retryChosen}>
            {S.tryAgain}
          </button>
        </div>
      )
    } else if (!chosen) {
      content = (
        <p className={`${RS}-templates-empty`}>
          <span className={`${RS}-spin`}>
            <Icon name='spinner' size={14} />
          </span>
          {T.loadingOne}
        </p>
      )
    } else {
      // Made again for another filter lock, rather than told that its lock changed (which offers Rerun all).
      content = (
        <ReportBuilder
          key={this.props.enableFilterLocks ? `${chosen.id}\n${filterLocksKey(this.reportLocks())}` : chosen.id}
          {...previewProps}
          authentication={authentication}
          autoQLConfig={autoQLConfig}
          dataFormatting={dataFormatting}
          report={this.previewReport()}
          readOnly
          dataFill={TEMPLATE_FILL}
        />
      )
    }
    return (
      <div className={`${RS}-templates-preview`} data-test='reports-templates-preview'>
        {content}
      </div>
    )
  }

  cancelConfirm = () => this.setState({ confirming: false })

  // Enter in the folder's name makes them, as its pop-up's main button does.
  onFolderKeyDown = (e) => {
    if (e.key === 'Enter' && !e.nativeEvent?.isComposing) {
      e.preventDefault()
      this.start()
    }
  }

  // A batch's question, in a pop-up over the dialog (RW-385): how many, about how long, and the folder they go into,
  // which can be named (RW-387). Cancel, Escape and the backdrop go back to the dialog as it was.
  renderConfirm(each, minutes) {
    return (
      <ReportModal
        title={T.confirmTitle(each.length)}
        size='small'
        over
        testId='reports-templates-confirm'
        onClose={this.cancelConfirm}
        actions={
          <>
            <button
              type='button'
              className={`${RS}-button`}
              data-test='reports-templates-confirm-cancel'
              onClick={this.cancelConfirm}
            >
              {S.cancel}
            </button>
            <button
              type='button'
              className={`${RS}-button`}
              data-variant='primary'
              data-test='reports-templates-confirm-start'
              onClick={this.start}
            >
              {T.confirmStart(each.length)}
            </button>
          </>
        }
      >
        <p className={`${RS}-templates-confirm-what`}>{T.confirmWhat(T.about(minutes))}</p>
        <label className={`${RS}-label`} htmlFor={this.folderId}>
          {T.confirmFolder}
        </label>
        <input
          id={this.folderId}
          type='text'
          className={`${RS}-input`}
          value={this.state.folderName || ''}
          maxLength={ORGANIZER_NAME_MAX}
          spellCheck={false}
          data-test='reports-templates-confirm-folder'
          onChange={(e) => this.setState({ folderName: e.target.value })}
          onKeyDown={this.onFolderKeyDown}
        />
        <p className={`${RS}-note`}>{T.confirmFolderNote}</p>
      </ReportModal>
    )
  }

  // The footer has only Back and Start. Beside them: why it can't start, or, for a report for each, about how long it
  // takes. A report for each asks before it starts, in a pop-up of its own (renderConfirm).
  render() {
    const { onClose } = this.props
    const { starting, startError, confirming } = this.state
    const what = this.props.filterLockLabels?.title || STRINGS.filterLock.title
    const each = this.startsEach()
    const problem = startError || this.eachProblem(each, what)
    const minutes = each?.length ? batchMinutes(each.length) : 0
    const takes = each?.length && !problem ? T.takes(each.length, minutes) : null
    return (
      <>
        <ReportModal
          title={T.title}
          description={T.what}
          size='large'
          initialFocus={this.searchRef}
          testId='reports-templates'
          busy={starting}
          onClose={onClose}
          status={problem || takes}
          statusTone={problem ? 'error' : undefined}
          actions={
            <>
              <button
                type='button'
                className={`${RS}-button`}
                data-test='reports-templates-back'
                disabled={starting}
                onClick={onClose}
              >
                {T.back}
              </button>
              <button
                type='button'
                className={`${RS}-button`}
                data-variant='primary'
                data-test='reports-templates-start'
                disabled={!this.canStart()}
                onClick={this.start}
              >
                {starting ? (
                  <>
                    <span className={`${RS}-spin`}>
                      <Icon name='spinner' size={14} />
                    </span>
                    {T.starting}
                  </>
                ) : each ? (
                  T.startEach(each.length)
                ) : (
                  T.start
                )}
              </button>
            </>
          }
        >
          <div className={`${RS}-templates-aside`}>
            {this.renderFilters()}
            {this.renderList()}
            {this.props.enableFilterLocks ? this.renderFor() : null}
          </div>
          {this.renderPreview()}
        </ReportModal>
        {confirming && each?.length && !problem ? this.renderConfirm(each, minutes) : null}
      </>
    )
  }
}
