import React from 'react'
import PropTypes from 'prop-types'
import { isMobile } from 'react-device-detect'
import { fetchFilters, authenticationDefault, getAuthentication } from 'autoql-fe-utils'

import { Popover } from '../Popover'
import FilterLockPopoverContent from './FilterLockPopoverContent'

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
    drawerWidth: null,
  }

  componentDidMount = () => {
    this._isMounted = true
    this.initialize()
    this.updateDrawerWidth()
    if (this.props.boundaryElement) {
      this.resizeObserver = new ResizeObserver(() => {
        this.updateDrawerWidth()
      })
      this.resizeObserver.observe(this.props.boundaryElement)
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
      if (this.resizeObserver) {
        this.resizeObserver.disconnect()
      }
      if (this.props.boundaryElement) {
        this.resizeObserver = new ResizeObserver(() => {
          this.updateDrawerWidth()
        })
        this.resizeObserver.observe(this.props.boundaryElement)
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
    if (this.resizeObserver) {
      this.resizeObserver.disconnect()
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
        showArrow
        containerStyle={containerStyle}
      >
        {this.props.children || <div style={{ display: 'none' }} />}
      </Popover>
    )
  }
}

export default withTheme(FilterLockPopover)
