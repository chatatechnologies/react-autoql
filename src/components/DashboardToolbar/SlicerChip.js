import React from 'react'
import PropTypes from 'prop-types'
import { Chip } from '../Chip'
import { Icon } from '../Icon'

const SlicerChip = ({ slicer, onDelete, tooltipID, readOnly = false }) => {
  if (!slicer) {
    return null
  }

  const displayName = slicer.format_txt || slicer.value
  const showMessage = slicer.show_message
  const tooltipText = showMessage
    ? `Applied only to tiles whose underlying data contains "${showMessage}"`
    : 'Applied only to tiles whose underlying data contains this value'

  return (
    <Chip onDelete={readOnly ? undefined : onDelete} tooltip={tooltipText} tooltipID={tooltipID}>
      <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        <Icon type='filter' />
        <span>
          <strong>{displayName}</strong> {showMessage && <em>({showMessage})</em>}
        </span>
      </span>
    </Chip>
  )
}

SlicerChip.propTypes = {
  slicer: PropTypes.shape({
    format_txt: PropTypes.string,
    value: PropTypes.string,
    show_message: PropTypes.string,
  }),
  onDelete: PropTypes.func,
  tooltipID: PropTypes.string,
  readOnly: PropTypes.bool,
}

SlicerChip.defaultProps = {
  slicer: null,
  onDelete: () => {},
  tooltipID: undefined,
  readOnly: false,
}

export default SlicerChip
