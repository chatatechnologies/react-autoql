import React, { Fragment } from 'react'
import PropTypes from 'prop-types'

// Icons
import {
  MdClose,
  MdLightbulbOutline,
  MdError,
  MdContentCopy,
  MdFileDownload,
  MdFilterList,
  MdInfoOutline,
  MdPlayCircleOutline,
  MdEdit,
  MdTitle,
  MdDescription
} from 'react-icons/md'
import { FaRegTrashAlt, FaEye, FaDatabase } from 'react-icons/fa'
import {
  FiBell,
  FiBellOff,
  FiCalendar,
  FiPlus,
  FiFileText
} from 'react-icons/fi'
import {
  IoIosSearch,
  IoIosGlobe,
  IoIosCloseCircleOutline
} from 'react-icons/io'
import { TiSortNumerically } from 'react-icons/ti'
import {
  AiOutlineDashboard,
  AiOutlineFileText,
  AiOutlineBook
} from 'react-icons/ai'
import chataBubblesSVG from '../../images/chata-bubbles.svg'
import {
  bubblesIcon,
  bubblesIconFilled,
  bubblesIconFilledAlt
} from '../../svgIcons.js'

import './Icon.scss'

export default class Icon extends React.Component {
  static propTypes = {
    type: PropTypes.string.isRequired,
    size: PropTypes.number // used for the image icons ie. chata-bubbles
  }

  static defaultProps = {
    size: undefined
  }

  render = () => {
    const nativeProps = { ...this.props, type: undefined, size: undefined }

    let icon = null
    switch (this.props.type) {
      case 'calendar': {
        icon = <FiCalendar />
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
      case 'close': {
        icon = <MdClose />
        break
      }
      case 'close-circle': {
        icon = <IoIosCloseCircleOutline />
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
        icon = <FaDatabase />
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
        icon = <MdEdit />
        break
      }
      case 'eye': {
        icon = <FaEye />
        break
      }
      case 'filter': {
        icon = <MdFilterList />
        break
      }
      case 'globe': {
        icon = <IoIosGlobe />
        break
      }
      case 'info': {
        icon = <MdInfoOutline />
        break
      }
      case 'light-bulb': {
        icon = <MdLightbulbOutline />
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
      case 'play': {
        icon = <MdPlayCircleOutline />
        break
      }
      case 'plus': {
        icon = <FiPlus />
        break
      }
      case 'search': {
        icon = <IoIosSearch />
        break
      }
      case 'title': {
        icon = <AiOutlineBook />
        break
      }
      case 'trash': {
        icon = <FaRegTrashAlt />
        break
      }
      case 'warning': {
        icon = <MdError />
        break
      }
      default: {
        break
      }
    }
    return (
      <span
        // style={{ verticalAlign: 'middle', lineHeight: '100%' }}
        {...nativeProps}
        data-test="chata-icon"
        className={`chata-icon ${this.props.className}`}
      >
        {icon}
      </span>
    )
  }
}
