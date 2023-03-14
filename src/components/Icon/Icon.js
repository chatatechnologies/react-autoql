import React from 'react'
import PropTypes from 'prop-types'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

import { AiFillCaretDown } from '@react-icons/all-files/ai/AiFillCaretDown'
import { AiFillCaretLeft } from '@react-icons/all-files/ai/AiFillCaretLeft'
import { AiFillCaretRight } from '@react-icons/all-files/ai/AiFillCaretRight'
import { AiFillCaretUp } from '@react-icons/all-files/ai/AiFillCaretUp'
import { AiOutlineBook } from '@react-icons/all-files/ai/AiOutlineBook'
import { AiOutlineBulb } from '@react-icons/all-files/ai/AiOutlineBulb'
import { AiOutlineDashboard } from '@react-icons/all-files/ai/AiOutlineDashboard'
import { AiOutlineEdit } from '@react-icons/all-files/ai/AiOutlineEdit'
import { AiOutlineFileText } from '@react-icons/all-files/ai/AiOutlineFileText'
import { AiOutlineMenu } from '@react-icons/all-files/ai/AiOutlineMenu'
import { AiOutlineQuestionCircle } from '@react-icons/all-files/ai/AiOutlineQuestionCircle'
import { AiOutlineTag } from '@react-icons/all-files/ai/AiOutlineTag'
import { AiOutlineFileSearch } from '@react-icons/all-files/ai/AiOutlineFileSearch'

import { BiLineChart } from '@react-icons/all-files/bi/BiLineChart'
import { BiSearchAlt } from '@react-icons/all-files/bi/BiSearchAlt'
import { BiBookmark } from '@react-icons/all-files/bi/BiBookmark'
import { BiBook } from '@react-icons/all-files/bi/BiBook'
import { BiNote } from '@react-icons/all-files/bi/BiNote'
import { BiAbacus } from '@react-icons/all-files/bi/BiAbacus'
import { BsChevronDown } from '@react-icons/all-files/bs/BsChevronDown'
import { BsArrowBarDown } from '@react-icons/all-files/bs/BsArrowBarDown'

import { BsArrowBarUp } from '@react-icons/all-files/bs/BsArrowBarUp'

import { FaMicrophoneAlt } from '@react-icons/all-files/fa/FaMicrophoneAlt'

import { FiAlertTriangle } from '@react-icons/all-files/fi/FiAlertTriangle'
import { FiArrowLeft } from '@react-icons/all-files/fi/FiArrowLeft'
import { FiBell } from '@react-icons/all-files/fi/FiBell'
import { FiBellOff } from '@react-icons/all-files/fi/FiBellOff'
import { FiCalendar } from '@react-icons/all-files/fi/FiCalendar'
import { FiCheck } from '@react-icons/all-files/fi/FiCheck'
import { FiDatabase } from '@react-icons/all-files/fi/FiDatabase'
import { FiDownload } from '@react-icons/all-files/fi/FiDownload'
import { FiEye } from '@react-icons/all-files/fi/FiEye'
import { RiFilterLine } from '@react-icons/all-files/ri/RiFilterLine'
import { RiFilterOffLine } from '@react-icons/all-files/ri/RiFilterOffLine'
import { FiMoreHorizontal } from '@react-icons/all-files/fi/FiMoreHorizontal'
import { FiMoreVertical } from '@react-icons/all-files/fi/FiMoreVertical'
import { FiPauseCircle } from '@react-icons/all-files/fi/FiPauseCircle'
import { FiPlus } from '@react-icons/all-files/fi/FiPlus'
import { FiSend } from '@react-icons/all-files/fi/FiSend'
import { FiSettings } from '@react-icons/all-files/fi/FiSettings'
import { FiTrash2 } from '@react-icons/all-files/fi/FiTrash2'
import { FiMaximize } from '@react-icons/all-files/fi/FiMaximize'
import { FiMinimize } from '@react-icons/all-files/fi/FiMinimize'
import { FiRefreshCw } from '@react-icons/all-files/fi/FiRefreshCw'

import { GoReport } from '@react-icons/all-files/go/GoReport'

import { IoIosCloseCircleOutline } from '@react-icons/all-files/io/IoIosCloseCircleOutline'
import { IoIosGlobe } from '@react-icons/all-files/io/IoIosGlobe'
import { IoIosHourglass } from '@react-icons/all-files/io/IoIosHourglass'
import { IoIosSearch } from '@react-icons/all-files/io/IoIosSearch'

import { MdClose } from '@react-icons/all-files/md/MdClose'
import { MdContentCopy } from '@react-icons/all-files/md/MdContentCopy'
import { MdError } from '@react-icons/all-files/md/MdError'
import { MdInfoOutline } from '@react-icons/all-files/md/MdInfoOutline'
import { MdLock } from '@react-icons/all-files/md/MdLock'
import { MdLockOpen } from '@react-icons/all-files/md/MdLockOpen'
import { MdPlayCircleOutline } from '@react-icons/all-files/md/MdPlayCircleOutline'
import { MdAttachMoney } from '@react-icons/all-files/md/MdAttachMoney'

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
  gradCapIcon,
  columnLineIcon,
} from '../../svgIcons.js'

import './Icon.scss'

export default class Icon extends React.Component {
  static propTypes = {
    type: PropTypes.string,
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
    const { type, size, showBadge, warning, danger, ...nativeProps } = this.props

    let icon = null

    if (!this.props.type) {
      return null
    }

    switch (this.props.type) {
      case 'back': {
        icon = <FiArrowLeft />
        break
      }
      case 'bar-chart': {
        icon = barChartIcon
        break
      }
      case 'book': {
        icon = <BiBook />
        break
      }
      case 'bookmark': {
        icon = <BiBookmark />
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
      case 'caret-down': {
        icon = <AiFillCaretDown />
        break
      }
      case 'caret-up': {
        icon = <AiFillCaretUp />
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
      case 'maximize': {
        icon = <FiMaximize />
        break
      }
      case 'minimize': {
        icon = <FiMinimize />
        break
      }
      case 'money': {
        icon = <MdAttachMoney />
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
      case 'column-line-chart': {
        icon = columnLineIcon
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
      case 'dropdown': {
        icon = <BsChevronDown />
        break
      }
      case 'eye': {
        icon = <FiEye />
        break
      }
      case 'filter': {
        icon = <RiFilterLine />
        break
      }
      case 'filter-off': {
        icon = <RiFilterOffLine />
        break
      }
      case 'grad-cap': {
        icon = gradCapIcon
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
      case 'lock': {
        icon = <MdLock />
        break
      }
      case 'stacked-line-chart': {
        icon = stackedLineIcon
        break
      }
      case 'menu': {
        icon = <AiOutlineMenu />
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
      case 'note': {
        icon = <BiNote />
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
      case 'abacus': {
        icon = <BiAbacus />
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
      case 'preview': {
        icon = <AiOutlineFileSearch />
        break
      }
      case 'question': {
        icon = <AiOutlineQuestionCircle />
        break
      }
      case 'refresh': {
        icon = <FiRefreshCw />
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
      case 'data-search': {
        icon = <BiSearchAlt />
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
      case 'tag': {
        icon = <AiOutlineTag />
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
      case 'unlock': {
        icon = <MdLockOpen />
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
          data-test='react-autoql-icon'
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
          {this.props.showBadge && <div className='react-autoql-badge' />}
        </span>
      </ErrorBoundary>
    )
  }
}
