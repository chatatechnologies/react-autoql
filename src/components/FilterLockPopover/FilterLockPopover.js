import React from 'react'
import PropTypes from 'prop-types'
import { Popover, ArrowContainer } from 'react-tiny-popover'

import FilterLockPopoverContent from './FilterLockPopoverContent'
import { isMobile } from 'react-device-detect'
import { fetchFilters } from '../../js/queryService'
import { authenticationType } from '../../props/types'
import { authenticationDefault, getAuthentication } from '../../props/defaults'
import { withTheme } from '../../theme'
import { rebuildTooltips } from '../Tooltip'

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
    } else if (this.props.isOpen && !prevProps.isOpen) {
      rebuildTooltips()
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

  renderContent = ({ position, childRect, popoverRect }) => {
    return (
      <ArrowContainer
        className='filter-lock-menu-content-container'
        arrowClassName='filter-lock-menu-popover-arrow'
        position={position}
        childRect={childRect}
        popoverRect={popoverRect}
        arrowSize={10}
      >
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
      </ArrowContainer>
    )
  }

  render = () => {
    return (
      <Popover
        containerClassName={isMobile ? 'mobile-filter-lock-menu' : 'filter-lock-menu'}
        onClickOutside={this.props.onClose}
        positions={this.props.positions}
        isOpen={this.props.isOpen}
        align={this.props.align}
        // ref={(r) => (this.containerRef = r)}
        parentElement={this.props.parentElement}
        boundaryElement={this.props.boundaryElement}
        content={this.renderContent}
        boundaryInset={10}
      >
        {this.props.children || <div style={{ display: 'none' }} />}
      </Popover>
    )
  }
}

export default withTheme(FilterLockPopover)
