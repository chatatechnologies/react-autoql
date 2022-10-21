import React from 'react'
import PropTypes from 'prop-types'
import _isEqual from 'lodash.isequal'
import ReactTooltip from 'react-tooltip'
import { v4 as uuid } from 'uuid'
import './AutoZoomToolbar.scss'
import { Icon } from '../Icon'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

class AutoZoomToolbar extends React.Component {
  COMPONENT_KEY = uuid()
  constructor(props) {
    super(props)
  }
  static propTypes = {
    disableCharts: PropTypes.bool,
    vertical: PropTypes.bool,
    isChart: PropTypes.bool,
  }

  static defaultProps = {
    disableCharts: false,
    vertical: false,
    isChart: false,
  }

  componentDidMount = () => {
    this._isMounted = true
    this.rebuildTooltips()
  }

  componentDidUpdate = () => {
    this.rebuildTooltips()
  }

  componentWillUnmount = () => {
    this._isMounted = false
  }

  rebuildTooltips = () => {
    if (this.props.rebuildTooltips) {
      this.props.rebuildTooltips()
    } else {
      ReactTooltip.rebuild()
    }
  }

  render = () => {
    if (this.props.isChart) {
      return (
        <ErrorBoundary>
          <div className={`${this.props.className || ''} react-autoql-toolbar auto-zoom-toolbar vertical`}>
            <button
              className={`react-autoql-toolbar-btn`}
              onClick={() => {
                if (this.props.responseRef?._isMounted) {
                  this.props.responseRef?.setIsZoomed()
                }
              }}
              data-tip={this.props.responseRef.state.isChartZoomed ? 'Zoom Out' : 'Zoom In'}
              data-for={`react-autoql-auto-zoom-toolbar-tooltip-${this.COMPONENT_KEY}`}
            >
              {<Icon type={this.props.responseRef.state.isChartZoomed ? 'zoom-out' : 'zoom-in'} />}
            </button>
          </div>
          <ReactTooltip
            className='react-autoql-tooltip'
            id={`react-autoql-auto-zoom-toolbar-tooltip-${this.COMPONENT_KEY}`}
            effect='solid'
            delayShow={800}
          />
        </ErrorBoundary>
      )
    }
    return null
  }
}
export default AutoZoomToolbar
