import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import uuid from 'uuid'
import RGL, { WidthProvider } from 'react-grid-layout'
import gridLayoutStyles from 'react-grid-layout/css/styles.css'
import ReactTooltip from 'react-tooltip'

import DashboardTile from './DashboardTile'

import chataTableStyles from '../ChataTable/ChataTable.css'
import styles from './DashboardTile.css'

const ReactGridLayout = WidthProvider(RGL)

// We will want to
const executeDashboard = ref => {
  if (ref) {
    try {
      ref.executeDashboard()
    } catch (error) {
      console.error(error)
    }
  }
}

class Dashboard extends React.Component {
  tileRefs = {}

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
    tiles: PropTypes.arrayOf(PropTypes.shape({})),
    apiKey: PropTypes.string,
    customerId: PropTypes.string,
    userId: PropTypes.string,
    domain: PropTypes.string,
    executeOnMount: PropTypes.bool,
    executeOnStopEditing: PropTypes.bool,
    theme: PropTypes.string,
    enableDrilldowns: PropTypes.bool,
    enableSafetyNet: PropTypes.bool,
    enableAutocomplete: PropTypes.bool,
    enableAutocomplete: PropTypes.bool,
    accentColor: PropTypes.string,
    demo: PropTypes.bool,
    debug: PropTypes.bool,
    isEditing: PropTypes.bool,
    currencyCode: PropTypes.string,
    languageCode: PropTypes.string,
    fontFamily: PropTypes.string,
    onChangeCallback: PropTypes.func,
    notExecutedText: PropTypes.string,
    chartColors: PropTypes.arrayOf(PropTypes.string)
  }

  static defaultProps = {
    tiles: [],
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
    executeOnMount: true,
    executeOnStopEditing: true,
    isEditing: false,
    currencyCode: undefined,
    languageCode: undefined,
    fontFamily: undefined,
    notExecutedText: undefined,
    chartColors: undefined
  }

  state = {
    // tiles: this.props.defaultTileState,
    isDragging: false
  }

  componentDidMount = () => {
    this.setStyles()

    // There is a bug with react tooltips where it doesnt bind properly right when the component mounts
    // setTimeout(() => {
    //   ReactTooltip.rebuild()
    // }, 100)

    if (this.props.executeOnMount) {
      this.executeDashboard()
    }
  }

  componentDidUpdate = prevProps => {
    if (
      this.props.fontFamily &&
      this.props.fontFamily !== prevProps.fontFamily
    ) {
      this.setStyles()
    }

    // Re-run dashboard once exiting edit mode (if prop is set to true)
    if (
      prevProps.isEditing &&
      !this.props.isEditing &&
      this.props.executeOnStopEditing
    ) {
      this.executeDashboard()
    }

    if (prevProps.tiles.length < this.props.tiles.length) {
      setTimeout(() => {
        if (this.ref) {
          this.ref.scrollIntoView(false)
        }
      }, 200)
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
        '--chata-dashboard-accent-color',
        this.props.accentColor
      )
    }
    if (this.props.fontFamily) {
      document.documentElement.style.setProperty(
        '--chata-dashboard-font-family',
        this.props.fontFamily
      )
    }
  }

  executeDashboard = () => {
    for (var dashboardTile in this.tileRefs) {
      if (this.tileRefs[dashboardTile]) {
        this.tileRefs[dashboardTile].processTile()
      }
    }
  }

  onMoveStart = () => {
    this.setState({
      isDragging: true
    })
  }

  onMoveEnd = () => {
    setTimeout(() => {
      this.setState({
        isDragging: false
      })
    }, 100)
  }

  updateTileLayout = layout => {
    const tiles = this.props.tiles.map((tile, index) => {
      return {
        ...tile,
        ...layout[index]
      }
    })

    this.props.onChangeCallback(tiles)
  }

  addTile = () => {
    const tiles = [...this.props.tiles]
    const id = uuid.v4()
    tiles.push({
      key: id,
      i: id,
      w: 6,
      h: 5,
      x: (Object.keys(tiles).length * 6) % 12,
      y: Infinity,
      query: '',
      title: '',
      isNewTile: true
    })

    this.props.onChangeCallback(tiles)
  }

  deleteTile = id => {
    const tiles = [...this.props.tiles]
    const tileIndex = tiles.map(item => item.i).indexOf(id)
    ~tileIndex && tiles.splice(tileIndex, 1)

    this.props.onChangeCallback(tiles)
  }

  setParamForTile = (paramName, paramValue, id) => {
    const tiles = [...this.props.tiles]
    const tileIndex = tiles.map(item => item.i).indexOf(id)
    tiles[tileIndex][paramName] = paramValue

    if ((paramName = 'queryResponse')) {
      // Reset state specific response values
      if (tiles[tileIndex].selectedSuggestion) {
        tiles[tileIndex].query = tiles[tileIndex].selectedSuggestion
      }
      tiles[tileIndex].isNewTile = false
      tiles[tileIndex].selectedSuggestion = undefined
      tiles[tileIndex].safetyNetSelections = undefined
    }

    this.props.onChangeCallback(tiles)
  }

  render = () => {
    return (
      <Fragment>
        <style>{`${styles}`}</style>
        <style>{`${chataTableStyles}`}</style>
        <style>{`${gridLayoutStyles}`}</style>
        <div
          ref={ref => (this.ref = ref)}
          className={`chata-dashboard-container${
            this.props.isEditing ? ' edit-mode' : ''
          }`}
          style={{
            height: '100%',
            width: '100%',
            overflow: 'hidden'
          }}
        >
          <ReactGridLayout
            onLayoutChange={layout => {
              this.updateTileLayout(layout)
              this.setState({ layout })
            }}
            onDragStart={this.onMoveStart}
            onResizeStart={this.onMoveStart}
            onDragStop={this.onMoveEnd}
            onResizeStop={this.onMoveEnd}
            className="chata-dashboard"
            rowHeight={60}
            cols={12}
            isDraggable={this.props.isEditing}
            isResizable={this.props.isEditing}
            draggableHandle=".chata-dashboard-tile-inner-div"
            layout={this.props.tiles}
            margin={[20, 20]}
          >
            {this.props.tiles.map(tile => (
              <DashboardTile
                className={`chata-dashboard-tile${
                  this.state.isDragging ? ' dragging' : ''
                } ${tile.i}`}
                ref={ref => (this.tileRefs[tile.key] = ref)}
                key={tile.key}
                tile={{ ...tile, i: tile.key, maxH: 12, minH: 2, minW: 3 }}
                displayType={tile.displayType}
                queryResponse={tile.queryResponse}
                apiKey={this.props.apiKey}
                customerId={this.props.customerId}
                userId={this.props.userId}
                domain={this.props.domain}
                demo={this.props.demo}
                debug={this.props.debug}
                enableSafetyNet={this.props.enableSafetyNet}
                isEditing={this.props.isEditing}
                isDragging={this.state.isDragging}
                setParamForTile={this.setParamForTile}
                deleteTile={this.deleteTile}
                currencyCode={this.props.currencyCode}
                languageCode={this.props.languageCode}
                notExecutedText={this.props.notExecutedText}
                chartColors={this.props.chartColors}
              />
            ))}
          </ReactGridLayout>
        </div>
        <ReactTooltip
          className="chata-chart-tooltip"
          id="chart-element-tooltip"
          effect="solid"
          html
        />
        <ReactTooltip
          className="chata-dashboard-tooltip"
          id="chata-toolbar-btn-tooltip"
          effect="solid"
          delayShow={500}
          html
        />
      </Fragment>
    )
  }
}

export { Dashboard, executeDashboard }
