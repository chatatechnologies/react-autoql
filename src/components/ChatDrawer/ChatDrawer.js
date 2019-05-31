import React from 'react'

import PropTypes from 'prop-types'

import Drawer from 'rc-drawer'

import styles from './ChatDrawer.css'
import rcStyles from 'rc-drawer/assets/index.css'

export default class ChatDrawer extends React.Component {
  static propTypes = {
    placement: PropTypes.string,
    maskClosable: PropTypes.bool,
    onVisibleChange: PropTypes.func,
    isVisible: PropTypes.bool,
    showHandle: PropTypes.bool,
    // customHandle: PropTypes.ReactElement,
    theme: PropTypes.string,
    handleStyles: PropTypes.shape({})
  }

  static defaultProps = {
    placement: 'right',
    maskClosable: true,
    isVisible: false,
    width: '500px',
    height: '300px',
    // customHandle: undefined, // not working atm
    showHandle: true,
    theme: 'light',
    handleStyles: {},
    onHandleClick: () => {},
    onVisibleChange: () => {}
  }

  state = {}

  getHandlerProp = () => {
    if (this.props.customHandle !== undefined) {
      console.log('using custom handle')
      return this.props.customHandle
    } else if (this.props.showHandle) {
      return (
        <div className="drawer-handle" style={this.props.handleStyles}>
          <i className="drawer-handle-icon" />
        </div>
      )
    }
    return false
  }

  getHeightProp = () => {
    if (
      this.getPlacementProp() === 'right' ||
      this.getPlacementProp() === 'left'
    ) {
      return null
    }
    return this.props.height
  }

  getWidthProp = () => {
    if (
      this.getPlacementProp() === 'right' ||
      this.getPlacementProp() === 'left'
    ) {
      return this.props.width
    }
    return null
  }

  getPlacementProp = () => {
    const { placement } = this.props
    let formattedPlacement
    if (typeof placement === 'string') {
      formattedPlacement = placement.trim().toLowerCase()
      if (
        formattedPlacement === 'right' ||
        formattedPlacement === 'left' ||
        formattedPlacement === 'bottom' ||
        formattedPlacement === 'top'
      ) {
        return formattedPlacement
      }
    }
    return 'right'
  }

  handleMaskClick = () => {
    if (this.props.maskClosable === false) {
      return
    }
    this.props.onHandleClick()
  }

  render = () => {
    console.log(this.props)
    return (
      <div>
        <div>The drawer should appear on the {this.getPlacementProp()}</div>
        <Drawer
          // prefixCls={prefixCls}
          // style={this.getRcDrawerStyle()}
          // className={classNames(wrapClassName, className, haveMask)}
          className="chata-drawer"
          open={this.props.isVisible}
          showMask={this.props.showMask}
          placement={this.getPlacementProp()}
          width={this.getWidthProp()}
          height={this.getHeightProp()}
          onMaskClick={this.handleMaskClick}
          onHandleClick={this.props.onHandleClick}
          afterVisibleChange={this.props.onVisibleChange}
          handler={this.getHandlerProp()}
        >
          <div>
            <style>{`${rcStyles}`}</style>
            <style>{`${styles}`}</style>
            <div className="test">
              <span>Drawer EWOFIJEWOFIEJF</span>
            </div>
          </div>
        </Drawer>
      </div>
    )
  }
}

export const closeDrawer = () => {}
