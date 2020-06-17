import React from 'react'
import PropTypes from 'prop-types'

// Icons
import {
  MdClose,
  MdError,
  MdContentCopy,
  MdFileDownload,
  MdInfoOutline,
  MdPlayCircleOutline,
} from 'react-icons/md'
import {
  FiBell,
  FiBellOff,
  FiCalendar,
  FiPlus,
  FiDatabase,
  FiFilter,
  FiCheck,
  FiEye,
  FiTrash2,
  FiAlertTriangle,
  FiMoreHorizontal,
  FiMoreVertical,
} from 'react-icons/fi'
import {
  IoIosSearch,
  IoIosGlobe,
  IoIosCloseCircleOutline,
} from 'react-icons/io'
import { TiSortNumerically } from 'react-icons/ti'
import {
  AiOutlineDashboard,
  AiOutlineFileText,
  AiOutlineBook,
  AiFillCaretRight,
  AiFillCaretLeft,
  AiOutlineEdit,
  AiOutlineBulb,
} from 'react-icons/ai'
import { GoReport } from 'react-icons/go'
import chataBubblesSVG from '../../images/chata-bubbles.svg'
import {
  bubblesIcon,
  bubblesIconFilled,
  bubblesIconFilledAlt,
  tableIcon,
  pivotTableIcon,
  columnChartIcon,
  barChartIcon,
  stackedBarIcon,
  stackedColumnIcon,
  stackedLineIcon,
  lineChartIcon,
  pieChartIcon,
  heatmapIcon,
  bubbleChartIcon,
  splitViewIcon,
  singleViewIcon,
} from '../../svgIcons.js'

import './Icon.scss'

export default class Icon extends React.Component {
  static propTypes = {
    type: PropTypes.string.isRequired,
    size: PropTypes.number, // used for the image icons ie. chata-bubbles
  }

  static defaultProps = {
    size: undefined,
  }

  render = () => {
    const nativeProps = { ...this.props, type: undefined, size: undefined }

    let icon = null
    switch (this.props.type) {
      case 'bar-chart': {
        icon = barChartIcon
        break
      }
      case 'stacked-bar-chart': {
        icon = stackedBarIcon
        break
      }
      case 'bubble-chart': {
        icon = bubbleChartIcon
        break
      }
      case 'calendar': {
        icon = <FiCalendar />
        break
      }
      case 'caret-right': {
        icon = <AiFillCaretRight />
        break
      }
      case 'caret-left': {
        icon = <AiFillCaretLeft />
        break
      }
      case 'chata-bubbles': {
        icon = (
          <img
            className="chata-bubbles-icon"
            src={chataBubblesSVG}
            alt="chata.ai"
            style={{ ...this.props.style, height: '1em', width: '1em' }}
            draggable="false"
          />
        )
        break
      }
      case 'chata-bubbles-outlined': {
        icon = bubblesIcon
        break
      }
      case 'chata-bubbles-filled': {
        icon = bubblesIconFilled
        break
      }
      case 'chata-bubbles-filled-alt': {
        icon = bubblesIconFilledAlt
        break
      }
      case 'check': {
        icon = <FiCheck />
        break
      }
      case 'close': {
        icon = <MdClose />
        break
      }
      case 'close-circle': {
        icon = <IoIosCloseCircleOutline />
        break
      }
      case 'column-chart': {
        icon = columnChartIcon
        break
      }
      case 'stacked-column-chart': {
        icon = stackedColumnIcon
        break
      }
      case 'copy': {
        icon = <MdContentCopy />
        break
      }
      case 'dashboard': {
        icon = <AiOutlineDashboard />
        break
      }
      case 'database': {
        icon = <FiDatabase />
        break
      }
      case 'description': {
        icon = <AiOutlineFileText />
        break
      }
      case 'download': {
        icon = <MdFileDownload />
        break
      }
      case 'edit': {
        icon = <AiOutlineEdit />
        break
      }
      case 'eye': {
        icon = <FiEye />
        break
      }
      case 'filter': {
        icon = <FiFilter />
        break
      }
      case 'globe': {
        icon = <IoIosGlobe />
        break
      }
      case 'heatmap': {
        icon = heatmapIcon
        break
      }
      case 'info': {
        icon = <MdInfoOutline />
        break
      }
      case 'light-bulb': {
        icon = <AiOutlineBulb />
        break
      }
      case 'line-chart': {
        icon = lineChartIcon
        break
      }
      case 'stacked-line-chart': {
        icon = stackedLineIcon
        break
      }
      case 'more-vertical': {
        icon = <FiMoreVertical />
        break
      }
      case 'more-horizontal': {
        icon = <FiMoreHorizontal />
        break
      }
      case 'notification': {
        icon = <FiBell />
        break
      }
      case 'notification-off': {
        icon = <FiBellOff />
        break
      }
      case 'numbers': {
        icon = <TiSortNumerically />
        break
      }
      case 'pie-chart': {
        icon = pieChartIcon
        break
      }
      case 'play': {
        icon = <MdPlayCircleOutline />
        break
      }
      case 'pivot-table': {
        icon = pivotTableIcon
        break
      }
      case 'plus': {
        icon = <FiPlus />
        break
      }
      case 'report': {
        icon = <GoReport />
        break
      }
      case 'search': {
        icon = <IoIosSearch />
        break
      }
      case 'split-view': {
        icon = splitViewIcon
        break
      }
      case 'single-view': {
        icon = singleViewIcon
        break
      }
      case 'table': {
        icon = tableIcon
        break
      }
      case 'title': {
        icon = <AiOutlineBook />
        break
      }
      case 'trash': {
        icon = <FiTrash2 />
        break
      }
      case 'warning': {
        icon = <MdError />
        break
      }
      case 'warning-triangle': {
        icon = <FiAlertTriangle />
        break
      }
      default: {
        break
      }
    }
    return (
      <span
        {...nativeProps}
        data-test="chata-icon"
        className={`chata-icon ${this.props.className || ''} ${
          this.props.type
        }`}
        style={{ ...this.props.style, fontSize: `${this.props.size}px` }}
      >
        {icon}
      </span>
    )
  }
}
