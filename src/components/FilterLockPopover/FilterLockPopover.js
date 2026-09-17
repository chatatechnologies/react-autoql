import React from 'react'
import PropTypes from 'prop-types'
import { isMobile } from 'react-device-detect'
import { fetchFilters, authenticationDefault, getAuthentication } from 'autoql-fe-utils'

import { Popover } from '../Popover'
import FilterLockPopoverContent from './FilterLockPopoverContent'
import { observeContainer } from '../Charts/measureObserver'

import { withTheme } from '../../theme'
import { authenticationType } from '../../props/types'

import './FilterLockPopover.scss'

export class FilterLockPopover extends React.Component {
  static propTypes = {
    authentication: authenticationType,

    isOpen: PropTypes.bool,
    position: PropTypes.string,
    align: PropTypes.string,
    onClose: PropTypes.func,
    onChange: PropTypes.func,
    showArrow: PropTypes.bool,
    padding: PropTypes.number,
    /**
     * Values this user may filter on. When set, it REPLACES the value-label
     * autocomplete: the popover lists all of them and searches locally. See
     * FilterLockPopoverContent for the full contract.
     */
    suggestionList: PropTypes.arrayOf(PropTypes.string),
    /** Section heading over an unfiltered `suggestionList`. */
    suggestionListTitle: PropTypes.string,
    /**
     * Whether a newly added filter starts PERSISTED (kept in the filter-locking
     * API and fetched back on the next mount) or scoped to this session. Sets
     * the initial position of each row's "Persist" toggle. Default true — the
     * long-standing behaviour. See FilterLockPopoverContent for the full note.
     */
    persistNewFilters: PropTypes.bool,
  }

  static defaultProps = {
    authentication: authenticationDefault,

    isOpen: false,
    position: 'bottom',
    align: 'center',
    onClose: () => {},
    onChange: () => {},
    // Default true preserves the DataMessenger header lock's arrow; ChatContent
    // opts out with showArrow={false}.
    showArrow: true,
    persistNewFilters: true,
  }

  state = {
    insertedFilter: null,
    drawerWidth: null,
  }

  componentDidMount = () => {
    this._isMounted = true
    this.initialize()
    this.updateDrawerWidth()
    if (this.props.boundaryElement) {
      // prefer centralized helper that handles no-RO environments
      this._cleanupBoundaryObserver = observeContainer(this.props.boundaryElement, () => this.updateDrawerWidth(), {
        debounceMs: 80,
      })
    }
  }

  componentDidUpdate = (prevProps) => {
    if (!this.props.isOpen && prevProps.isOpen) {
      // Clear inserted filter when popover is closed
      this.setState({ insertedFilter: null })
    }
    if (this.props.boundaryElement) {
      this.updateDrawerWidth()
    }
    if (prevProps.boundaryElement !== this.props.boundaryElement) {
      if (this._cleanupBoundaryObserver) {
        try {
          this._cleanupBoundaryObserver()
        } catch (e) {}
        this._cleanupBoundaryObserver = null
      }
      if (this.props.boundaryElement) {
        this._cleanupBoundaryObserver = observeContainer(this.props.boundaryElement, () => this.updateDrawerWidth(), {
          debounceMs: 80,
        })
      }
    }
  }

  updateDrawerWidth = () => {
    if (this.props.boundaryElement) {
      const width = this.props.boundaryElement.offsetWidth
      if (width && width !== this.state.drawerWidth) {
        this.setState({ drawerWidth: width })
      }
    }
  }

  componentWillUnmount = () => {
    this._isMounted = false
    if (this._cleanupBoundaryObserver) {
      try {
        this._cleanupBoundaryObserver()
      } catch (e) {}
      this._cleanupBoundaryObserver = null
    }
  }

  initialize = () => {
    this.setState({ isFetchingFilters: true })
    fetchFilters(getAuthentication(this.props.authentication))
      .then((response) => {
        const initialFilters = response?.data?.data?.data || []
        this.props.onChange(initialFilters)
        if (this._isMounted) {
          this.setState({ initialFilters, isFetchingFilters: false })
        }
      })
      .catch((error) => {
        console.error('FilterLockPopover - initialize - Error fetching filters:', error)
        if (this._isMounted) {
          this.setState({ isFetchingFilters: false })
        }
      })
  }

  onChange = (filters) => {
    this.props.onChange(filters)
    this.setState({ initialFilters: filters })
  }

  insertFilter = (text) => {
    this.setState({ insertedFilter: text })
  }

  renderContent = () => {
    return (
      <FilterLockPopoverContent
        authentication={this.props.authentication}
        isOpen={this.props.isOpen}
        onClose={this.props.onClose}
        onChange={this.onChange}
        containerRef={this.containerRef}
        insertedFilter={this.state.insertedFilter}
        initialFilters={this.state.initialFilters}
        isFetchingFilters={this.state.isFetchingFilters}
        suggestionList={this.props.suggestionList}
        suggestionListTitle={this.props.suggestionListTitle}
        persistNewFilters={this.props.persistNewFilters}
        tooltipID={this.props.tooltipID ?? this.TOOLTIP_ID}
      />
    )
  }

  render = () => {
    const containerStyle = this.state.drawerWidth && !isMobile ? { width: `${this.state.drawerWidth - 20}px` } : {}

    return (
      <Popover
        containerClassName={`filter-lock-popover${isMobile ? ' filter-lock-popover-mobile' : ''}`}
        // contentClassName={`filter-lock-menu${isMobile ? ' filter-lock-menu-mobile' : ''}`}
        onClickOutside={this.props.onClose}
        positions={this.props.positions}
        isOpen={this.props.isOpen}
        align={this.props.align}
        parentElement={this.props.parentElement}
        boundaryElement={this.props.boundaryElement}
        content={this.renderContent()}
        boundaryInset={10}
        showArrow={this.props.showArrow}
        padding={this.props.padding}
        containerStyle={containerStyle}
      >
        {this.props.children || <div style={{ display: 'none' }} />}
      </Popover>
    )
  }
}

export default withTheme(FilterLockPopover)
