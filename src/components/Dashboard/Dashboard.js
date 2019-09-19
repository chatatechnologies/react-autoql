import React, { Fragment } from 'react'

import PropTypes from 'prop-types'

import uuid from 'uuid'

import RGL, { WidthProvider } from 'react-grid-layout'
import gridLayoutStyles from 'react-grid-layout/css/styles.css'

import ReactTooltip from 'react-tooltip'

import { runQuery, runDrilldown, cancelQuery } from '../../js/queryService'
import { formatElement, getgroupByObjectFromTable } from '../../js/Util'
import DashboardTile from './DashboardTile'

import chataTableStyles from '../ChataTable/ChataTable.css'
import styles from './DashboardTile.css'

const ReactGridLayout = WidthProvider(RGL)

export default class ChatDrawer extends React.Component {
  LIGHT_THEME = {
    '--chata-dashboard-accent-color': '#28a8e0',
    '--chata-dashboard-background-color': '#fff',
    '--chata-dashboard-border-color': '#d3d3d352',
    '--chata-dashboard-hover-color': '#ececec',
    '--chata-dashboard-text-color-primary': '#5d5d5d',
    '--chata-dashboard-text-color-placeholder': '#0000009c'
  }

  DARK_THEME = {
    '--chata-dashboard-accent-color': '#525252', // dark gray
    // '--chata-dashboard-accent-color': '#193a48', // dark blue
    '--chata-dashboard-background-color': '#636363',
    '--chata-dashboard-border-color': '#d3d3d329',
    '--chata-dashboard-hover-color': '#5a5a5a',
    '--chata-dashboard-text-color-primary': '#fff',
    '--chata-dashboard-text-color-placeholder': '#ffffff9c'
  }

  static propTypes = {
    apiKey: PropTypes.string,
    customerId: PropTypes.string,
    userId: PropTypes.string,
    domain: PropTypes.string,
    runDashboardOnMount: PropTypes.bool,
    theme: PropTypes.string,
    enableDrilldowns: PropTypes.bool,
    enableSafetyNet: PropTypes.bool,
    enableAutocomplete: PropTypes.bool,
    enableAutocomplete: PropTypes.bool,
    accentColor: PropTypes.string,
    demo: PropTypes.bool,
    debug: PropTypes.bool,
    chataDashboardState: PropTypes.shape({}),
    isEditable: PropTypes.bool
  }

  static defaultProps = {
    apiKey: undefined,
    customerId: undefined,
    userId: undefined,
    domain: undefined,
    theme: 'light',
    enableDrilldowns: true,
    enableAutocomplete: true,
    accentColor: undefined,
    enableSafetyNet: true,
    enableAutocomplete: true,
    demo: false,
    debug: false,
    runDashboardOnMount: true,
    chataDashboardState: {},
    isEditable: false
  }

  state = {
    tiles: [
      {
        key: 'wefijwofiejwoeifjweofijweof',
        i: 'wefijwofiejwoeifjweofijweof',
        w: 6,
        h: 2,
        x: 0,
        y: 0,
        maxH: 12,
        minW: 2
      },
      {
        key: 'wwefijweof',
        i: 'wwefijweof',
        w: 6,
        h: 2,
        x: 6,
        y: 0,
        maxH: 12,
        minW: 2
      },
      {
        key: 'wwweefijweof',
        i: 'wwweefijweof',
        w: 12,
        h: 3,
        x: 0,
        y: 2,
        maxH: 12,
        minW: 2
      }
    ],
    ...this.props.chataDashboardState
  }

  componentDidMount = () => {
    this.setStyles()

    // Listen for esc press to cancel queries while they are running
    document.addEventListener('keydown', this.escFunction, false)

    // There is a bug with react tooltips where it doesnt bind properly right when the component mounts
    setTimeout(() => {
      ReactTooltip.rebuild()
    }, 100)
  }

  componentDidUpdate = prevProps => {
    if (this.props.theme && this.props.theme !== prevProps.theme) {
      this.setStyles()
    }
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.escFunction, false)
  }

  escFunction = event => {
    if (this.props.isVisible && event.keyCode === 27) {
      cancelQuery()
    }
  }

  setStyles = () => {
    const themeStyles =
      this.props.theme === 'light' ? this.LIGHT_THEME : this.DARK_THEME
    for (let property in themeStyles) {
      document.documentElement.style.setProperty(
        property,
        themeStyles[property]
      )
    }
    if (this.props.accentColor) {
      document.documentElement.style.setProperty(
        '--chata-drawer-accent-color',
        this.props.accentColor
      )
    }
  }

  onSuggestionClick = suggestion => {
    this.addRequestMessage(suggestion)
    this.setState({ isChataThinking: true })

    if (suggestion === 'None of these') {
      setTimeout(() => {
        this.addResponseMessage({ content: 'Thank you for your feedback.' })
        this.setState({ isChataThinking: false })
      }, 1000)
      return
    }

    runQuery(
      suggestion,
      this.props.demo,
      this.props.debug,
      this.props.enableSafetyNet,
      this.props.domain,
      this.props.apiKey,
      this.props.customerId,
      this.props.userId
    )
      .then(response => {
        this.onResponse(response)
      })
      .catch(error => {
        this.onResponse(error)
      })
  }

  onResponse = response => {
    this.addResponseMessage({ response })
    this.setState({ isChataThinking: false })
    if (this.chatBarRef) {
      this.chatBarRef.focus()
    }
  }

  processDrilldown = (rowData, columns, queryID, singleValueResponse) => {
    if (this.props.enableDrilldowns) {
      const groupByObject = getgroupByObjectFromTable(rowData, columns, true)

      if (
        !singleValueResponse &&
        (!groupByObject || JSON.stringify(groupByObject) === JSON.stringify({}))
      ) {
        return
      }

      // This is a hack.
      // How do we get the right text?? Can we make an api call to get the text first?
      const drilldownText = `Drill down on ${columns[0].title} "${formatElement(
        rowData[0],
        columns[0]
      )}"`

      this.addRequestMessage(drilldownText)
      this.setState({ isChataThinking: true })

      runDrilldown(
        queryID,
        groupByObject,
        this.props.demo,
        this.props.debug,
        this.props.apiKey,
        this.props.customerId,
        this.props.userId
      )
        .then(response => {
          this.addResponseMessage({
            response: { ...response, isDrilldownDisabled: true }
          })
          this.setState({ isChataThinking: false })
        })
        .catch(() => {
          this.setState({ isChataThinking: false })
        })
    }
  }

  setChatBarRef = ref => {
    this.chatBarRef = ref
  }

  render = () => {
    return (
      <Fragment>
        <style>{`${styles}`}</style>
        <style>{`${chataTableStyles}`}</style>
        <style>{`${gridLayoutStyles}`}</style>
        <div
          className="chata-dashboard-container"
          style={{
            height: '100%',
            width: '100%',
            'overflow-x': 'hidden',
            'overflow-y': 'auto'
          }}
        >
          <ReactGridLayout
            onLayoutChange={layout => this.setState({ layout })}
            // onDragStart    = {this.onMoveStart}
            // onResizeStart  = {this.onMoveStart}
            // onDragStop     = {this.onMoveEnd}
            // onResizeStop   = {this.onMoveEnd}
            className="chata-dashboard"
            rowHeight={130}
            cols={12}
            isDraggable={this.props.isEditable}
            isResizable={this.props.isEditable}
            draggableHandle=".chata-dashboard-tile-drag-handle"
            layout={this.state.tiles}
            margin={[20, 20]}
          >
            {this.state.tiles.map(tile => (
              <DashboardTile key={tile.key} tile={tile} />
            ))}
          </ReactGridLayout>
        </div>
      </Fragment>
    )
  }
}
