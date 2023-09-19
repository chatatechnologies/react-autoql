import React from 'react'
import PropTypes from 'prop-types'
import { fetchFilters } from 'autoql-fe-utils'

import FilterLockPopoverContent from './FilterLockPopoverContent'
import { isMobile } from 'react-device-detect'
import { authenticationType } from '../../props/types'
import { authenticationDefault, getAuthentication } from '../../props/defaults'
import { withTheme } from '../../theme'
import { Popover } from '../Popover'

import './FilterLockPopover.scss'

export class FilterLockPopover extends React.Component {
  static propTypes = {
    authentication: authenticationType,

    isOpen: PropTypes.bool,
    position: PropTypes.string,
    align: PropTypes.string,
    onClose: PropTypes.func,
    onChange: PropTypes.func,
  }

  static defaultProps = {
    authentication: authenticationDefault,

    isOpen: false,
    position: 'bottom',
    align: 'center',
    onClose: () => {},
    onChange: () => {},
  }

  state = {
    insertedFilter: null,
  }

  componentDidMount = () => {
    this._isMounted = true
    this.initialize()
  }

  componentDidUpdate = (prevProps) => {
    if (!this.props.isOpen && prevProps.isOpen) {
      // Clear inserted filter when popover is closed
      this.setState({ insertedFilter: null })
    }
  }

  componentWillUnmount = () => {
    this._isMounted = false
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
        console.error(error)
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
        tooltipID={this.props.tooltipID ?? this.TOOLTIP_ID}
      />
    )
  }

  render = () => {
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
        showArrow
      >
        {this.props.children || <div style={{ display: 'none' }} />}
      </Popover>
    )
  }
}

export default withTheme(FilterLockPopover)
