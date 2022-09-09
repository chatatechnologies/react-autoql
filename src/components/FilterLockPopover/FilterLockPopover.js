import React from 'react'
import PropTypes from 'prop-types'
import Popover from 'react-tiny-popover'

import FilterLockPopoverContent from './FilterLockPopoverContent'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

import { fetchFilters } from '../../js/queryService'

import { authenticationType, themeConfigType } from '../../props/types'
import {
  authenticationDefault,
  getAuthentication,
  themeConfigDefault,
} from '../../props/defaults'

import './FilterLockPopover.scss'

export default class FilterLockPopover extends React.Component {
  static propTypes = {
    authentication: authenticationType,
    themeConfig: themeConfigType,

    isOpen: PropTypes.bool,
    position: PropTypes.string,
    align: PropTypes.string,
    onClose: PropTypes.func,
    onChange: PropTypes.func,
    rebuildTooltips: PropTypes.func,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    themeConfig: themeConfigDefault,

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

  insertFilter = (text) => {
    this.setState({ insertedFilter: text })
  }

  renderContent = ({ position, targetRect, popoverRect }) => {
    return (
      <>
        {/* TODO: Use this component for arrow
        
        <ArrowContainer
          className="filter-lock-menu"
          position={position}
          targetRect={targetRect}
          popoverRect={popoverRect}
          arrowStyle={{ opacity: 1 }}
        /> */}
        <FilterLockPopoverContent
          ref={(r) => (this.popoverContentRef = r)}
          authentication={this.props.authentication}
          themeConfig={this.props.themeConfig}
          isOpen={this.props.isOpen}
          onClose={this.props.onClose}
          onChange={this.props.onChange}
          rebuildTooltips={this.props.rebuildTooltips}
          containerRef={this.containerRef}
          insertedFilter={this.state.insertedFilter}
          initialFilters={this.state.initialFilters}
          isFetchingFilters={this.state.isFetchingFilters}
        />
      </>
    )
  }

  render = () => {
    return (
      <Popover
        containerClassName="filter-lock-menu"
        onClickOutside={this.props.onClose}
        position={this.props.position}
        isOpen={this.props.isOpen}
        align={this.props.align}
        ref={(r) => (this.containerRef = r)}
        padding={0}
        content={this.renderContent}
      >
        <ErrorBoundary>{this.props.children || null}</ErrorBoundary>
      </Popover>
    )
  }
}
