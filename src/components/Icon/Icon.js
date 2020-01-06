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
  MdEdit
} from 'react-icons/md'
import { FaRegTrashAlt, FaEye, FaDatabase } from 'react-icons/fa'
import { FiBell, FiBellOff, FiCalendar, FiPlus } from 'react-icons/fi'
import {
  IoIosSearch,
  IoIosGlobe,
  IoIosCloseCircleOutline
} from 'react-icons/io'
import { TiSortNumerically } from 'react-icons/ti'
import chataBubblesSVG from '../../images/chata-bubbles.svg'
import { bubblesIcon } from '../../svgIcons.js'

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
        icon = <FiCalendar {...nativeProps} />
        break
      }
      case 'chata-bubbles': {
        icon = (
          <img
            className="chata-bubbles-icon"
            src={chataBubblesSVG}
            alt="chata.ai"
            height={this.props.size || '22px'}
            width={this.props.size || '22px'}
            draggable="false"
            {...nativeProps}
          />
        )
        break
      }

      case 'chata-bubbles-outline': {
        icon = (
          <div
            {...nativeProps}
            style={{ display: 'inline-block', ...this.props.style }}
          >
            {bubblesIcon}
          </div>
        )
        break
      }
      case 'close': {
        icon = <MdClose {...nativeProps} />
        break
      }
      case 'close-circle': {
        icon = <IoIosCloseCircleOutline {...nativeProps} />
        break
      }
      case 'copy': {
        icon = <MdContentCopy {...nativeProps} />
        break
      }
      case 'database': {
        icon = <FaDatabase {...nativeProps} />
        break
      }
      case 'download': {
        icon = <MdFileDownload {...nativeProps} />
        break
      }
      case 'edit': {
        icon = <MdEdit {...nativeProps} />
        break
      }
      case 'eye': {
        icon = <FaEye {...nativeProps} />
        break
      }
      case 'filter': {
        icon = <MdFilterList {...nativeProps} />
        break
      }
      case 'globe': {
        icon = <IoIosGlobe {...nativeProps} />
        break
      }
      case 'info': {
        icon = <MdInfoOutline {...nativeProps} />
        break
      }
      case 'light-bulb': {
        icon = <MdLightbulbOutline {...nativeProps} />
        break
      }
      case 'notification': {
        icon = <FiBell {...nativeProps} />
        break
      }
      case 'notification-off': {
        icon = <FiBellOff {...nativeProps} />
        break
      }
      case 'numbers': {
        icon = <TiSortNumerically {...nativeProps} />
        break
      }
      case 'play': {
        icon = <MdPlayCircleOutline {...nativeProps} />
        break
      }
      case 'plus': {
        icon = <FiPlus {...nativeProps} />
        break
      }
      case 'search': {
        icon = <IoIosSearch {...nativeProps} />
        break
      }
      case 'trash': {
        icon = <FaRegTrashAlt {...nativeProps} />
        break
      }
      case 'warning': {
        icon = <MdError {...nativeProps} />
        break
      }
      default: {
        break
      }
    }
    return <Fragment data-test="chata-icon">{icon}</Fragment>
  }
}
