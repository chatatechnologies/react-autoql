import React from 'react'
import PropTypes from 'prop-types'
import { dataFormattingDefault, getDataFormatting } from 'autoql-fe-utils'

import { Button } from '../Button'
import { Icon } from '../Icon'
import { dataFormattingType } from '../../props/types'
import { getIconForDisplayType } from '../../js/displayTypeIcons'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

import './DataTruncatedNotice.scss'

/**
 * Says that an answer's data was dropped to save memory, and offers it back.
 *
 * Two shapes, because the two cases are not equally safe to show:
 *
 *   'banner' sits above a table that is still showing its first few rows. Those rows
 *   are real, so the message still reads as an answer - the banner's job is to make
 *   sure nobody mistakes ten rows for the whole result.
 *
 *   'card' replaces a chart, or a pivot table, entirely. Either one drawn from the
 *   preview would look finished and be wrong, and unlike a plain table it gives the
 *   reader no way to tell - a pivot's cells are aggregates, so nothing on screen is
 *   even one of the rows that survived. Neither is drawn until the data is back.
 */
const DataTruncatedNotice = ({
  variant,
  error,
  previewRowCount,
  displayType,
  isRestoring,
  onRestore,
  dataFormatting,
  tooltipID,
  className,
}) => {
  const languageCode = getDataFormatting(dataFormatting).languageCode
  const format = (value) => new Intl.NumberFormat(languageCode, {}).format(value ?? 0)

  // The shared Button rather than a bespoke one, so it matches every other control in
  // the messenger - and so the loading state is Button's own small spinner instead of
  // something sized for a whole empty panel.
  //
  // Borderless in both variants. The two notices say the same thing about the same
  // answer and are swapped between by nothing more than which view the message is on,
  // so a control that changes shape between them reads as a different control. The
  // label and icon in the accent colour carry it without an outline.
  const restoreButton = (
    <Button
      className='react-autoql-data-truncated-restore'
      type='default'
      size='medium'
      icon='refresh'
      border={false}
      loading={isRestoring}
      onClick={onRestore}
      tooltip='Re-run this query to load the full result'
      tooltipID={tooltipID}
    >
      {error ? 'Try again' : 'Restore data'}
    </Button>
  )

  // Sits with the control that failed rather than replacing the notice: the preview is
  // still valid and still worth reading, the fetch just didn't land.
  // role='alert' so a screen reader hears the failure - the button's label changing to
  // "Try again" is not announced on its own.
  const errorText = error ? (
    <span className='react-autoql-data-truncated-error' role='alert'>
      {error}
    </span>
  ) : null

  if (variant === 'card') {
    // A pivot table aggregates the rows it is given, so like a chart it would present a
    // finished-looking wrong answer off the preview - it gets the card too, and has to
    // name itself rather than claim to be a chart.
    const subject = displayType === 'pivot_table' ? 'Pivot table' : 'Chart'

    return (
      <ErrorBoundary>
        <div className={`react-autoql-data-truncated-card ${className ?? ''}`}>
          {/* The icon is the view they were looking at, so the card reads as that view's
              empty frame rather than as an error. Display type names and icon names are
              not the same vocabulary - see getIconForDisplayType. */}
          <Icon type={getIconForDisplayType(displayType)} size={32} className='react-autoql-data-truncated-card-icon' />
          <div className='react-autoql-data-truncated-card-text'>
            <strong>{subject} data was cleared to save memory</strong>
          </div>
          {errorText}
          {restoreButton}
        </div>
      </ErrorBoundary>
    )
  }

  return (
    <ErrorBoundary>
      <div className={`react-autoql-data-truncated-banner ${className ?? ''}`}>
        {/* Sized explicitly rather than left to inherit: .react-autoql-icon is a 1em
            box, so the glyph tracks whatever font-size happens to win in this part of
            the tree - which is how it ended up smaller than the warning sitting right
            below it. */}
        <Icon type='info' size={18} />
        {/* No total: the response has no field that counts the rows. `count_rows` stops
            at one past the row limit to mean "more than this", so quoting it would
            state a number nobody measured. What we can say is what is on screen. */}
        <span className='react-autoql-data-truncated-banner-text'>
          Showing a preview of the first <strong>{format(previewRowCount)}</strong> rows
        </span>
        {errorText}
        {restoreButton}
      </div>
    </ErrorBoundary>
  )
}

DataTruncatedNotice.propTypes = {
  variant: PropTypes.oneOf(['banner', 'card']),
  // Shown alongside the restore control when the re-run failed.
  error: PropTypes.string,
  previewRowCount: PropTypes.number,
  // Chooses the card's icon, via getIconForDisplayType.
  displayType: PropTypes.string,
  isRestoring: PropTypes.bool,
  onRestore: PropTypes.func,
  dataFormatting: dataFormattingType,
  tooltipID: PropTypes.string,
  className: PropTypes.string,
}

DataTruncatedNotice.defaultProps = {
  variant: 'banner',
  error: null,
  previewRowCount: 0,
  displayType: undefined,
  isRestoring: false,
  onRestore: () => {},
  dataFormatting: dataFormattingDefault,
  tooltipID: undefined,
  className: undefined,
}

export default DataTruncatedNotice
