import React from 'react'
import { FilterLockPopover } from '../../FilterLockPopover'
import { RB } from '../constants'
import { STRINGS } from '../strings'
import { filterLocksKey, normalizeFilterLocks, summarizeFilterLocks } from '../model/filterLocks'

const L = STRINGS.filterLock

// A report's filter lock (model/filterLocks.js), shown and changed: what it is ("Brown Family", or the host's word for
// none) and Change…, which opens FilterLockPopover on it. The locks it edits are the report's, never the user's own:
// they're handed in session-scoped, new ones start that way, and there's no Persist toggle, so nothing here reaches
// the filter-locking API.
//
// With `loadSuggestions` (the host's values to lock on, e.g. its households, as a promise of strings) the popover
// lists those, loaded the first time it opens; without it, the popover searches AutoQL's values as it does anywhere.
// `parentElement` keeps the popover inside a dialog that traps focus. `classPrefix` is whose styles it takes: the
// builder's, or the reports workspace's in its dialogs.
export class FilterLockField extends React.Component {
  static defaultProps = {
    locks: [],
    labels: {},
    disabled: false,
    classPrefix: RB,
  }

  state = { open: false, loading: false, failed: false, suggestions: null, seed: 0 }

  // The row Change… is in. The popover takes its button's ref to place itself, so the button is found from here.
  row = React.createRef()

  changeButton = () => this.row.current?.querySelector('button')

  componentDidUpdate(prevProps) {
    // Changed from outside rather than in the popover: it starts again from the new one.
    const key = filterLocksKey(this.props.locks)
    if (key !== filterLocksKey(prevProps.locks) && key !== this.changedTo) {
      this.setState(({ seed }) => ({ seed: seed + 1 }))
    }
  }

  componentWillUnmount() {
    this.unmounted = true
  }

  open = async () => {
    if (this.props.disabled || this.state.loading) {
      return
    }
    // Change… is disabled while the list loads, and loses the focus to the page: it gets it back once the popover is
    // open, so Escape still closes it.
    const button = this.changeButton()
    const focused = !!button && document.activeElement === button
    if (this.props.loadSuggestions && !this.state.suggestions) {
      this.setState({ loading: true, failed: false })
      let suggestions
      try {
        suggestions = await this.props.loadSuggestions()
      } catch (error) {
        if (!this.unmounted) {
          this.setState({ loading: false, failed: true })
        }
        return
      }
      if (this.unmounted) {
        return
      }
      this.setState({
        loading: false,
        suggestions: (Array.isArray(suggestions) ? suggestions : []).filter((value) => typeof value === 'string'),
      })
    }
    this.setState({ open: true }, () => {
      const lost = !document.activeElement || document.activeElement === document.body
      if (focused && lost) {
        this.changeButton()?.focus()
      }
    })
  }

  close = () => this.setState({ open: false })

  // Escape closes the popover, and nothing it's in: the dialog a report is started from, or a selection in the builder.
  onKeyDown = (event) => {
    if (event.key === 'Escape' && this.state.open) {
      event.stopPropagation()
      this.close()
    }
  }

  // The popover says what it holds on opening as well as after each change: only a change goes on.
  onChange = (filters) => {
    const key = filterLocksKey(filters)
    if (key === filterLocksKey(this.props.locks)) {
      return
    }
    this.changedTo = key
    this.props.onChange(normalizeFilterLocks(filters))
  }

  render() {
    const { locks, labels, disabled, authentication, parentElement, loadSuggestions, classPrefix } = this.props
    const { open, loading, failed, suggestions, seed } = this.state

    return (
      <div className={`${classPrefix}-filter-lock`} data-test='report-filter-lock'>
        <div className={`${classPrefix}-filter-lock-row`} onKeyDown={this.onKeyDown} ref={this.row}>
          <span className={`${classPrefix}-filter-lock-value`} data-test='report-filter-lock-value'>
            {summarizeFilterLocks(locks) || labels.none || L.none}
          </span>
          <FilterLockPopover
            key={seed}
            authentication={authentication}
            isOpen={open}
            onClose={this.close}
            onChange={this.onChange}
            seedFilters={normalizeFilterLocks(locks).map((lock) => ({ ...lock, isSession: true }))}
            persistNewFilters={false}
            showPersistToggle={false}
            suggestionList={loadSuggestions ? suggestions ?? [] : undefined}
            suggestionListTitle={labels.title}
            parentElement={parentElement}
            boundaryElement={parentElement}
            positions={['bottom', 'top', 'left', 'right']}
            align='start'
          >
            <button
              type='button'
              className={`${classPrefix}-button`}
              data-test='report-filter-lock-change'
              disabled={disabled || loading}
              onClick={this.open}
            >
              {loading ? L.loading : L.change}
            </button>
          </FilterLockPopover>
        </div>
        {failed ? (
          <p className={`${classPrefix}-filter-lock-failed`} role='alert'>
            {L.loadFailed}
          </p>
        ) : null}
      </div>
    )
  }
}
