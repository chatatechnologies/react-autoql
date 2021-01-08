import React from 'react'
import PropTypes from 'prop-types'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

// Icons
import { BsArrowBarUp, BsArrowBarDown } from 'react-icons/bs'
import { BiLineChart } from 'react-icons/bi'
import {
  MdClose,
  MdError,
  MdContentCopy,
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
  FiDownload,
  FiSettings,
  FiSend,
  FiArrowLeft,
  FiPauseCircle,
} from 'react-icons/fi'
import {
  IoIosSearch,
  IoIosGlobe,
  IoIosCloseCircleOutline,
  IoIosHourglass,
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
  AiOutlineQuestionCircle,
} from 'react-icons/ai'
import { FaMicrophoneAlt } from 'react-icons/fa'
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

import slackLogo from '../../images/slack-logo.png'
import teamsLogo from '../../images/ms-teams-logo.png'

import './Icon.scss'

export default class Icon extends React.Component {
  static propTypes = {
    type: PropTypes.string.isRequired,
    size: PropTypes.number, // used for the image icons ie. react-autoql-bubbles
    showBadge: PropTypes.bool,
    color: PropTypes.string,
    warning: PropTypes.bool,
    danger: PropTypes.bool,
  }

  static defaultProps = {
    size: undefined,
    showBadge: false,
    color: undefined,
    warning: false,
    danger: false,
  }

  render = () => {
    const {
      type,
      size,
      showBadge,
      warning,
      danger,
      ...nativeProps
    } = this.props

    let icon = null
    switch (this.props.type) {
      case 'back': {
        icon = <FiArrowLeft />
        break
      }
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
      case 'react-autoql-bubbles': {
        icon = (
          <img
            className="react-autoql-bubbles-icon"
            src={chataBubblesSVG}
            alt="chata.ai"
            style={{ ...this.props.style, height: '1em', width: '1em' }}
            draggable="false"
          />
        )
        break
      }
      case 'react-autoql-bubbles-outlined': {
        icon = bubblesIcon
        break
      }
      case 'react-autoql-bubbles-filled': {
        icon = bubblesIconFilled
        break
      }
      case 'react-autoql-bubbles-filled-alt': {
        icon = bubblesIconFilledAlt
        break
      }
      case 'chart': {
        icon = <BiLineChart />
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
      case 'collapse': {
        icon = <BsArrowBarUp />
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
        icon = <FiDownload />
        break
      }
      case 'edit': {
        icon = <AiOutlineEdit />
        break
      }
      case 'expand': {
        icon = <BsArrowBarDown />
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
      case 'hour-glass': {
        icon = <IoIosHourglass />
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
      case 'teams': {
        icon = (
          <img
            className="slack-logo"
            src={teamsLogo}
            alt="Slack"
            style={{ ...this.props.style, height: '1em', width: '1em' }}
            draggable="false"
          />
        )
        break
      }
      case 'microphone': {
        icon = <FaMicrophoneAlt />
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
      case 'notification-pause': {
        icon = <FiPauseCircle />
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
      case 'question': {
        icon = <AiOutlineQuestionCircle />
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
      case 'send': {
        icon = <FiSend />
        break
      }
      case 'settings': {
        icon = <FiSettings />
        break
      }
      case 'slack': {
        icon = (
          <img
            className="slack-logo"
            src={slackLogo}
            alt="Slack"
            style={{ ...this.props.style, height: '1em', width: '1em' }}
            draggable="false"
          />
        )
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
      <ErrorBoundary>
        <span
          {...nativeProps}
          data-test="react-autoql-icon"
          className={`react-autoql-icon
            ${this.props.className || ''}
            ${this.props.type}
            ${this.props.warning ? ' warning' : ''}
            ${this.props.danger ? ' danger' : ''}`}
          style={{
            color: this.props.color,
            fontSize: `${this.props.size}px`,
            ...this.props.style, // Overwrite other styles if provided
          }}
        >
          {icon}
          {this.props.showBadge && <div className="react-autoql-badge" />}
        </span>
      </ErrorBoundary>
    )
  }
}
