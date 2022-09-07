import React from 'react'
import PropTypes from 'prop-types'
import Popover from 'react-tiny-popover'

import FilterLockPopoverContent from './FilterLockPopoverContent'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

import { authenticationType } from '../../props/types'
import { authenticationDefault } from '../../props/defaults'
import { withTheme } from '../../theme'

import './FilterLockPopover.scss'

export class FilterLockPopover extends React.Component {
  static propTypes = {
    authentication: authenticationType,

    isOpen: PropTypes.bool,
    position: PropTypes.string,
    align: PropTypes.string,
    onClose: PropTypes.func,
    onChange: PropTypes.func,
    rebuildTooltips: PropTypes.func,
  }

  static defaultProps = {
    authentication: authenticationDefault,

    isOpen: false,
    position: 'bottom',
    align: 'center',
    onClose: () => {},
    onChange: () => {},
  }

  render = () => {
    if (this.props.isOpen) {
      return (
        <Popover
          containerClassName="filter-lock-menu"
          onClickOutside={this.props.onClose}
          position={this.props.position}
          isOpen={this.props.isOpen}
          align={this.props.align}
          padding={0}
          content={
            <FilterLockPopoverContent
              authentication={this.props.authentication}
              isOpen={this.props.isOpen}
              onClose={this.props.onClose}
              onChange={this.props.onChange}
              rebuildTooltips={this.props.rebuildTooltips}
            />
          }
        >
          <ErrorBoundary>{this.props.children || null}</ErrorBoundary>
        </Popover>
      )
    }
    return this.props.children || null
  }
}

export default withTheme(FilterLockPopover)
