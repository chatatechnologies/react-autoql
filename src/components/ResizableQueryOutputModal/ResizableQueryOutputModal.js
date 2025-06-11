import React from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import { deepEqual, authenticationDefault, autoQLConfigDefault, dataFormattingDefault } from 'autoql-fe-utils'

import { Modal } from '../Modal'
import { QueryOutput } from '../QueryOutput'
import { Icon } from '../Icon'
import { VizToolbar } from '../VizToolbar'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

import { authenticationType, autoQLConfigType, dataFormattingType } from '../../props/types'

import './ResizableQueryOutputModal.scss'

export default class ResizableQueryOutputModal extends React.Component {
  constructor(props) {
    super(props)
    this.COMPONENT_KEY = uuid()

    // Fixed minimum constraints
    this.minWidth = 600 // in pixels
    this.minHeight = 500 // in pixels

    this.state = {
      width: `${this.minWidth}px`,
      height: `${this.minHeight}px`,
      isResizing: false,

      resizeStartX: 0,
      resizeStartY: 0,
      resizeStartWidth: 0,
      resizeStartHeight: 0,

      queryOutputKey: uuid(),
      currentDisplayType: null,
    }

    // Resize multiplier - how much to grow per pixel of mouse movement
    this.resizeMultiplier = 2.0

    // Dynamic maximum constraints will be set based on window size
    this.updateMaxConstraints()
  }

  static propTypes = {
    authentication: authenticationType,
    autoQLConfig: autoQLConfigType,
    dataFormatting: dataFormattingType,
    isVisible: PropTypes.bool,
    onClose: PropTypes.func,
    queryResponse: PropTypes.shape({}),
    responseRef: PropTypes.shape({}),
    onSuggestionClick: PropTypes.func,
    onErrorCallback: PropTypes.func,
    onSuccessAlert: PropTypes.func,
    onCSVDownloadStart: PropTypes.func,
    onCSVDownloadProgress: PropTypes.func,
    onCSVDownloadFinish: PropTypes.func,
    onExpandClick: PropTypes.func,
    source: PropTypes.oneOfType([PropTypes.array, PropTypes.string]),
    scope: PropTypes.string,
    tooltipID: PropTypes.string,
    chartTooltipID: PropTypes.string,
    subjects: PropTypes.arrayOf(PropTypes.shape({})),
  }

  static defaultProps = {
    authentication: authenticationDefault,
    autoQLConfig: autoQLConfigDefault,
    dataFormatting: dataFormattingDefault,
    isVisible: false,
    onClose: () => {},
    queryResponse: undefined,
    responseRef: undefined,
    onSuggestionClick: () => {},
    onErrorCallback: () => {},
    onSuccessAlert: () => {},
    onCSVDownloadStart: () => {},
    onCSVDownloadProgress: () => {},
    onCSVDownloadFinish: () => {},
    onExpandClick: () => {}, // Add this
    source: null,
    scope: undefined,
    tooltipID: undefined,
    chartTooltipID: undefined,
    subjects: [],
  }

  componentDidMount = () => {
    this._isMounted = true
    document.addEventListener('mousemove', this.handleMouseMove)
    document.addEventListener('mouseup', this.handleMouseUp)
    window.addEventListener('resize', this.handleWindowResize)

    // Update constraints and override the modal's max-width and max-height constraints
    this.updateMaxConstraints()
    this.overrideModalConstraints()
  }

  componentDidUpdate(prevProps) {
    // When the modal becomes visible, reset to minimum size and trigger a fake resize cycle
    if (!prevProps.isVisible && this.props.isVisible) {
      // Get the current display type from the original QueryOutput
      const originalDisplayType = this.props.responseRef?.state?.displayType

      // Always reset to minimum size when modal opens
      this.setState({
        width: `${this.minWidth}px`,
        height: `${this.minHeight}px`,
        queryOutputKey: uuid(), // Force remount of QueryOutput
        currentDisplayType: originalDisplayType, // Set current display type
      })

      // Override constraints when modal becomes visible
      setTimeout(() => this.overrideModalConstraints(), 100)

      // Simulate a resize cycle after a short delay
      setTimeout(() => {
        if (this._isMounted) {
          // Start a fake resize
          this.setState({ isResizing: true }, () => {
            // End the fake resize after a short delay
            setTimeout(() => {
              if (this._isMounted) {
                this.setState({ isResizing: false }, () => {
                  // Call refreshLayout explicitly
                  if (this.queryOutputRef && this.queryOutputRef.refreshLayout) {
                    this.queryOutputRef.refreshLayout()
                  }
                })
              }
            }, 100)
          })
        }
      }, 300)
    }
  }

  componentWillUnmount = () => {
    this._isMounted = false
    document.removeEventListener('mousemove', this.handleMouseMove)
    document.removeEventListener('mouseup', this.handleMouseUp)
    window.removeEventListener('resize', this.handleWindowResize)
  }

  shouldComponentUpdate = (nextProps, nextState) => {
    return !deepEqual(this.props, nextProps) || !deepEqual(this.state, nextState)
  }

  // Override the modal's max-width and max-height constraints
  overrideModalConstraints = () => {
    // Find the ReactModal content element
    const modalContent = document.querySelector('.react-autoql-modal')
    if (modalContent) {
      // Set custom max-width and max-height constraints
      modalContent.style.maxWidth = `${this.maxWidth}px`
      modalContent.style.maxHeight = `${this.maxHeight}px`
    }
  }
  // Add this method to the class
  updateMaxConstraints = () => {
    // Get current window dimensions
    const windowWidth = window.innerWidth
    const windowHeight = window.innerHeight

    // Set max dimensions to 90% of window size with some padding
    this.maxWidth = Math.floor(windowWidth * 0.9)
    this.maxHeight = Math.floor(windowHeight * 0.9)

    // Ensure minimums don't exceed maximums on very small screens
    this.maxWidth = Math.max(this.maxWidth, this.minWidth)
    this.maxHeight = Math.max(this.maxHeight, this.minHeight)
  }

  handleWindowResize = () => {
    this.updateMaxConstraints()
    this.overrideModalConstraints()
  }
  handleResizeStart = (e) => {
    e.preventDefault()

    // Update constraints based on current window size
    this.updateMaxConstraints()
    this.overrideModalConstraints()

    const rect = this.modalContent?.getBoundingClientRect()

    this.setState({
      isResizing: true,
      resizeStartX: e.clientX,
      resizeStartY: e.clientY,
      resizeStartWidth: rect?.width || 800,
      resizeStartHeight: rect?.height || 600,
    })
  }

  handleMouseMove = (e) => {
    if (!this.state.isResizing) return

    // Calculate delta with multiplier for faster growth
    const deltaX = (e.clientX - this.state.resizeStartX) * this.resizeMultiplier
    const deltaY = (e.clientY - this.state.resizeStartY) * this.resizeMultiplier

    // Calculate new dimensions with constraints
    const newWidth = Math.min(this.maxWidth, Math.max(600, this.state.resizeStartWidth + deltaX))
    const newHeight = Math.min(this.maxHeight, Math.max(500, this.state.resizeStartHeight + deltaY))

    // Update the state with the new dimensions
    this.setState({
      width: `${newWidth}px`,
      height: `${newHeight}px`,
    })

    // Override constraints again during resize
    this.overrideModalConstraints()
  }
  handleMouseUp = () => {
    if (this.state.isResizing) {
      // Preserve the current display type before refreshing
      const currentDisplayType = this.queryOutputRef?.state?.displayType || this.state.currentDisplayType

      this.setState({
        isResizing: false,
        currentDisplayType: currentDisplayType,
      })

      if (this.queryOutputRef) {
        this.queryOutputRef.refreshLayout()
      }
    }
  }

  // Method to manually trigger a refresh
  triggerRefresh = () => {
    if (this.queryOutputRef && this.queryOutputRef.refreshLayout) {
      this.queryOutputRef.refreshLayout()
    }
  }
  onDisplayTypeChange = (displayType) => {
    this.setState({ currentDisplayType: displayType })
  }
  render = () => {
    // Use current display type from state, fallback to original
    const displayTypeToUse = this.state.currentDisplayType || this.props.responseRef?.state?.displayType
    const originalAggConfig = this.props.responseRef?.state?.aggConfig
    const originalTableConfig = this.props.responseRef?.tableConfig
    const originalPivotTableConfig = this.props.responseRef?.pivotTableConfig

    return (
      <ErrorBoundary>
        <Modal
          isVisible={this.props.isVisible}
          onClose={this.props.onClose}
          title='Query Output'
          titleIcon={<Icon type='react-autoql-bubbles-outlined' />}
          width={this.state.width}
          height={this.state.height}
          contentClassName='resizable-query-output-modal'
          enableBodyScroll={false}
          showFooter={false}
          onOpened={() => {
            this.overrideModalConstraints()
            this.triggerRefresh()
          }}
          style={{ maxWidth: `${this.maxWidth}px`, maxHeight: `${this.maxHeight}px` }}
          overlayStyle={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}
        >
          <div className='resizable-query-output-container' ref={(r) => (this.modalContent = r)}>
            <div className='resizable-query-output-toolbar'>
              <VizToolbar
                ref={(r) => (this.vizToolbarRef = r)}
                responseRef={this.queryOutputRef}
                tooltipID={this.props.tooltipID}
                shouldRender={true}
                onDisplayTypeChange={this.onDisplayTypeChange} // Add this
              />
            </div>
            <QueryOutput
              key={this.state.queryOutputKey}
              ref={(ref) => (this.queryOutputRef = ref)}
              vizToolbarRef={this.vizToolbarRef}
              authentication={this.props.authentication}
              autoQLConfig={this.props.autoQLConfig}
              dataFormatting={this.props.dataFormatting}
              queryResponse={this.props.queryResponse}
              onSuggestionClick={this.props.onSuggestionClick}
              onErrorCallback={this.props.onErrorCallback}
              onSuccessAlert={this.props.onSuccessAlert}
              onExpandClick={this.props.onExpandClick} // Ad
              isResizing={this.state.isResizing}
              enableDynamicCharting={true}
              autoChartAggregations={true}
              showQueryInterpretation={true}
              source={this.props.source}
              scope={this.props.scope}
              mutable={true}
              tooltipID={this.props.tooltipID}
              chartTooltipID={this.props.chartTooltipID}
              showSuggestionPrefix={false}
              allowColumnAddition={true}
              subjects={this.props.subjects}
              height='100%'
              width='100%'
              // Use the preserved display type
              initialDisplayType={displayTypeToUse}
              initialAggConfig={originalAggConfig}
              initialTableConfigs={{
                tableConfig: originalTableConfig,
                pivotTableConfig: originalPivotTableConfig,
              }}
            />
          </div>
          <div
            className={`resize-handle-circle ${this.state.isResizing ? 'resizing' : ''}`}
            ref={(r) => (this.resizeHandleRef = r)}
            onMouseDown={this.handleResizeStart}
            title='Drag to resize'
          >
            <Icon type='resize' />
          </div>
        </Modal>
      </ErrorBoundary>
    )
  }
}
