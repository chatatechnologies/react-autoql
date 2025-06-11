import React from 'react'
import PropTypes from 'prop-types'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

import { AiOutlineBook } from '@react-icons/all-files/ai/AiOutlineBook'
import { AiOutlineBulb } from '@react-icons/all-files/ai/AiOutlineBulb'
import { AiOutlineDashboard } from '@react-icons/all-files/ai/AiOutlineDashboard'
import { AiOutlineEdit } from '@react-icons/all-files/ai/AiOutlineEdit'
import { AiOutlineFileText } from '@react-icons/all-files/ai/AiOutlineFileText'
import { AiOutlineMenu } from '@react-icons/all-files/ai/AiOutlineMenu'
import { AiOutlineQuestionCircle } from '@react-icons/all-files/ai/AiOutlineQuestionCircle'
import { AiOutlineTag } from '@react-icons/all-files/ai/AiOutlineTag'
import { AiOutlineFileSearch } from '@react-icons/all-files/ai/AiOutlineFileSearch'
import { AiOutlineNumber } from '@react-icons/all-files/ai/AiOutlineNumber'

import { BiLineChart } from '@react-icons/all-files/bi/BiLineChart'
import { BiSearchAlt } from '@react-icons/all-files/bi/BiSearchAlt'
import { BiBookmark } from '@react-icons/all-files/bi/BiBookmark'
import { BiBook } from '@react-icons/all-files/bi/BiBook'
import { BiNote } from '@react-icons/all-files/bi/BiNote'
import { BiAbacus } from '@react-icons/all-files/bi/BiAbacus'
import { BiEnvelope } from '@react-icons/all-files/bi/BiEnvelope'
import { BiEnvelopeOpen } from '@react-icons/all-files/bi/BiEnvelopeOpen'
import { BiLayerPlus } from '@react-icons/all-files/bi/BiLayerPlus'
import { BiSelectMultiple } from '@react-icons/all-files/bi/BiSelectMultiple'
import { BsArrowBarUp } from '@react-icons/all-files/bs/BsArrowBarUp'
import { BsArrowBarDown } from '@react-icons/all-files/bs/BsArrowBarDown'
import { BsLightning } from '@react-icons/all-files/bs/BsLightning'

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
import { FiLayers } from '@react-icons/all-files/fi/FiLayers'
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
import { FiTool } from '@react-icons/all-files/fi/FiTool'
import { FiMinus } from '@react-icons/all-files/fi/FiMinus'
import { RiFilterLine } from '@react-icons/all-files/ri/RiFilterLine'
import { RiFilterOffLine } from '@react-icons/all-files/ri/RiFilterOffLine'
import { RiListSettingsLine } from '@react-icons/all-files/ri/RiListSettingsLine'
import { RiBroadcastFill } from '@react-icons/all-files/ri/RiBroadcastFill'
import { RiDivideFill } from '@react-icons/all-files/ri/RiDivideFill'

import { GoReport } from '@react-icons/all-files/go/GoReport'

import { IoIosCloseCircleOutline } from '@react-icons/all-files/io/IoIosCloseCircleOutline'
import { IoIosGlobe } from '@react-icons/all-files/io/IoIosGlobe'
import { IoIosHourglass } from '@react-icons/all-files/io/IoIosHourglass'
import { IoIosSearch } from '@react-icons/all-files/io/IoIosSearch'
import { IoIosArrowDown } from '@react-icons/all-files/io/IoIosArrowDown'
import { IoIosArrowUp } from '@react-icons/all-files/io/IoIosArrowUp'
import { IoIosArrowBack } from '@react-icons/all-files/io/IoIosArrowBack'
import { IoIosArrowForward } from '@react-icons/all-files/io/IoIosArrowForward'

import { MdClose } from '@react-icons/all-files/md/MdClose'
import { MdContentCopy } from '@react-icons/all-files/md/MdContentCopy'
import { MdError } from '@react-icons/all-files/md/MdError'
import { MdInfoOutline } from '@react-icons/all-files/md/MdInfoOutline'
import { MdLock } from '@react-icons/all-files/md/MdLock'
import { MdLockOpen } from '@react-icons/all-files/md/MdLockOpen'
import { MdPlayCircleOutline } from '@react-icons/all-files/md/MdPlayCircleOutline'
import { MdAttachMoney } from '@react-icons/all-files/md/MdAttachMoney'
import { MdFunctions } from '@react-icons/all-files/md/MdFunctions'

import { RxOpenInNewWindow } from 'react-icons/rx'
import { TfiArrowsCorner } from 'react-icons/tfi'
import { TfiArrowsVertical } from 'react-icons/tfi'
import {
  bubblesIcon,
  bubblesIconFilledAlt,
  tableIcon,
  pivotTableIcon,
  columnChartIcon,
  histogramIcon,
  scatterplotIcon,
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
  minimum,
  maximum,
  sum,
  median,
} from '../../svgIcons.js'

import './Icon.scss'

export default class Icon extends React.Component {
  static propTypes = {
    type: PropTypes.string,
    size: PropTypes.number, // used for the image icons ie. react-autoql-bubbles
    showBadge: PropTypes.bool,
    color: PropTypes.string,
    success: PropTypes.bool,
    warning: PropTypes.bool,
    danger: PropTypes.bool,
    spinning: PropTypes.bool,
    disabled: PropTypes.bool,
  }

  static defaultProps = {
    size: undefined,
    showBadge: false,
    color: undefined,
    success: false,
    warning: false,
    danger: false,
    spinning: false,
    disabled: false,
  }

  render = () => {
    const { type, size, showBadge, success, warning, danger, spinning, disabled, tooltip, tooltipID, ...nativeProps } =
      this.props

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
      case 'scatterplot': {
        icon = scatterplotIcon
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
        icon = <IoIosArrowForward />
        break
      }
      case 'caret-left': {
        icon = <IoIosArrowBack />
        break
      }
      case 'caret-down': {
        icon = <IoIosArrowDown />
        break
      }
      case 'caret-up': {
        icon = <IoIosArrowUp />
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
      case 'layers': {
        icon = <FiLayers />
        break
      }
      case 'layers-plus': {
        icon = <BiLayerPlus />
        break
      }
      case 'mark-read': {
        icon = <BiEnvelopeOpen />
        break
      }
      case 'mark-unread': {
        icon = <BiEnvelope />
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
      case 'minimum': {
        icon = minimum
        break
      }
      case 'minus': {
        icon = <FiMinus />
        break
      }
      case 'maximum': {
        icon = maximum
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
      case 'divide': {
        icon = <RiDivideFill />
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
      case 'function': {
        icon = <MdFunctions />
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
      case 'histogram-chart': {
        icon = histogramIcon
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
      case 'lightning': {
        icon = <BsLightning />
        break
      }
      case 'line-chart': {
        icon = lineChartIcon
        break
      }
      case 'list-settings': {
        icon = <RiListSettingsLine />
        break
      }
      case 'live': {
        icon = <RiBroadcastFill />
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
      case 'sum': {
        icon = sum
        break
      }
      case 'menu': {
        icon = <AiOutlineMenu />
        break
      }
      case 'median': {
        icon = median
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
      case 'number': {
        icon = <AiOutlineNumber />
        break
      }
      case 'abacus': {
        icon = <BiAbacus />
        break
      }
      case 'open-in-new': {
        icon = <RxOpenInNewWindow />
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
      case 'resize': {
        icon = <TfiArrowsCorner />
        break
      }
      case 'resize-vertical': {
        icon = <TfiArrowsVertical />
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
      case 'tool': {
        icon = <FiTool />
        break
      }
      case 'trash': {
        icon = <FiTrash2 />
        break
      }
      case 'select-multiple': {
        icon = <BiSelectMultiple />
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
            react-autoql-icon-${this.props.type}
            ${this.props.warning ? 'react-autoql-icon-warning' : ''}
            ${this.props.success ? 'react-autoql-icon-success' : ''}
            ${this.props.danger ? 'react-autoql-icon-danger' : ''}
            ${this.props.spinning ? 'react-autoql-icon-spinning' : ''}
            ${this.props.disabled ? 'react-autoql-icon-disabled' : ''}`}
          style={{
            color: this.props.color,
            fontSize: `${this.props.size}px`,
            ...this.props.style, // Overwrite other styles if provided
          }}
          data-tooltip-content={this.props.tooltip}
          data-tooltip-id={this.props.tooltipID}
        >
          {icon}
          {this.props.showBadge && <div className='react-autoql-badge' />}
        </span>
      </ErrorBoundary>
    )
  }
}
