import React from 'react'
import { Icon } from '../components/icons'
import { SelectBox } from '../components/controls'
import { ReportBuilder } from '../ReportBuilder'
import { fetchReportCategories, fetchReportTemplate, fetchReportTemplates } from '../run/reportsApi'
import { describeReportError, newReportId } from './documents'
import { ReportModal } from './ReportModal'
import { RS } from './reportsConstants'
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
// enableBranding, fontStylesheetUrl), onClose (back to New report), onStart({ templateId, id }), which resolves once
// the report is made or rejects with why not, and onManage (Manage templates, for an organization's admins).

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
    // Documents fetched, by template.
    this.documents = new Map()
    // The id each template's report is made under: a retry after a start that may have gone through asks for the same
    // report again, rather than making a second.
    this.startIds = new Map()
    this.loadRequest = 0
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
    }
  }

  componentDidMount() {
    this.mounted = true
    this.load()
  }

  componentWillUnmount() {
    this.mounted = false
    this.chosenController?.abort()
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

  // A template chosen: shown as soon as its document is in.
  choose = (id) => {
    if (id === this.state.chosenId) {
      return
    }
    this.chosenController?.abort()
    const kept = this.documents.get(id)
    this.setState({ chosenId: id, chosen: kept || null, chosenError: null, startError: null })
    if (kept) {
      return
    }
    const controller = typeof AbortController === 'function' ? new AbortController() : null
    this.chosenController = controller
    fetchReportTemplate({ authentication: this.props.authentication, id, signal: controller?.signal }).then(
      (template) => {
        this.documents.set(id, template)
        if (this.mounted && this.state.chosenId === id) {
          this.setState({ chosen: template })
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

  start = async () => {
    const templateId = this.state.chosenId
    if (!templateId || this.state.starting) {
      return
    }
    if (!this.startIds.has(templateId)) {
      this.startIds.set(templateId, newReportId())
    }
    this.setState({ starting: true, startError: null })
    try {
      await this.props.onStart({ templateId, id: this.startIds.get(templateId) })
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

  renderFilters() {
    const { q, categoryId, tags: chosenTags, categories } = this.state
    const tags = this.allTags()
    return (
      <div className={`${RS}-templates-filters`}>
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

  renderPreview() {
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
      content = (
        <ReportBuilder
          key={chosen.id}
          {...previewProps}
          authentication={authentication}
          autoQLConfig={autoQLConfig}
          dataFormatting={dataFormatting}
          report={chosen.report}
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

  render() {
    const { onClose, onManage } = this.props
    const { chosenId, starting, startError } = this.state
    return (
      <ReportModal
        title={T.title}
        description={T.what}
        size='large'
        initialFocus={this.searchRef}
        testId='reports-templates'
        busy={starting}
        onClose={onClose}
        status={startError}
        statusTone={startError ? 'error' : undefined}
        actions={
          <>
            {onManage ? (
              <button
                type='button'
                className={`${RS}-button`}
                data-test='reports-templates-manage'
                disabled={starting}
                onClick={onManage}
              >
                {S.manageTemplates.open}
              </button>
            ) : null}
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
              disabled={!chosenId || starting}
              onClick={this.start}
            >
              {starting ? (
                <>
                  <span className={`${RS}-spin`}>
                    <Icon name='spinner' size={14} />
                  </span>
                  {T.starting}
                </>
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
        </div>
        {this.renderPreview()}
      </ReportModal>
    )
  }
}
