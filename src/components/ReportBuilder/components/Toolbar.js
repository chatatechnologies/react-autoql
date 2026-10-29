import React from 'react'
import { RB } from '../constants'
import { STRINGS } from '../strings'
import { Icon } from './icons'
import { FIT, ZOOM_LEVELS } from './ZoomFrame'
import { ReportOptions } from './ReportOptions'

// Run, preview and print are the builder's own; a host adds nothing to make a report work. Run shows only
// when the builder runs reports itself (enableRunReport); otherwise blocks carry the data they were added with.
// `status` is the host's own element (toolbarStatus), set apart just before them. The zoom (ZoomFrame) is how
// large the pages show, in the editor and the preview alike. In the editor, the panel button beside Preview
// hides and shows the properties panel (`panelId`), and the report options menu (⋮) ends the row. Read-only, it's
// the report's title, how its pages are set up and the zoom: nothing that edits it, prints it or leaves the preview.
export const Toolbar = ({
  title,
  onTitleChange,
  runLabel,
  running,
  highlightRun,
  hasRun,
  canRun,
  onRun,
  onCancelRun,
  showRun = true,
  previewOpen,
  readOnly = false,
  previewMeta,
  onOpenPreview,
  onClosePreview,
  printing,
  onPrint,
  status,
  zoom = FIT,
  fitScale = 1,
  onZoomChange,
  panelOpen = true,
  panelId,
  onTogglePanel,
  optionsRef,
  onPageSetup,
  onBranding,
  onSaveAsTemplate,
  onRerunAll,
}) => (
  <div className={`${RB}-toolbar`} role='toolbar' aria-label={STRINGS.titleLabel}>
    {previewOpen ? (
      <div className={`${RB}-toolbar-title`} data-readonly=''>
        {/* Read-only, there's no editor to name it: the report's own title. */}
        <span className={`${RB}-toolbar-heading`} data-test='report-builder-toolbar-heading'>
          {readOnly ? title || STRINGS.untitled : STRINGS.preview.title}
        </span>
        {previewMeta ? <span className={`${RB}-toolbar-meta`}>{previewMeta}</span> : null}
      </div>
    ) : (
      <input
        type='text'
        className={`${RB}-title-input`}
        value={title}
        placeholder={STRINGS.titlePlaceholder}
        aria-label={STRINGS.titleLabel}
        data-test='report-builder-title'
        onChange={(e) => onTitleChange(e.target.value)}
      />
    )}
    <div className={`${RB}-toolbar-actions`}>
      {status ? (
        <>
          <div className={`${RB}-toolbar-status`} data-test='report-builder-toolbar-status'>
            {status}
          </div>
          <span className={`${RB}-toolbar-separator`} aria-hidden='true' />
        </>
      ) : null}
      {showRun ? (
        <>
          <span className={`${RB}-run-label`} data-attention={highlightRun || undefined} aria-live='polite'>
            {runLabel}
          </span>
          {running ? (
            <button type='button' className={`${RB}-button`} onClick={onCancelRun}>
              {STRINGS.cancelRun}
            </button>
          ) : (
            <button
              type='button'
              className={`${RB}-button`}
              data-variant={highlightRun ? 'primary' : undefined}
              disabled={!canRun}
              data-test='report-builder-run'
              onClick={onRun}
            >
              <Icon name='play' size={13} />
              {hasRun ? STRINGS.runAgain : STRINGS.run}
            </button>
          )}
          <span className={`${RB}-toolbar-separator`} aria-hidden='true' />
        </>
      ) : null}
      {onZoomChange ? (
        <span className={`${RB}-zoom`}>
          <select
            className={`${RB}-select ${RB}-zoom-select`}
            aria-label={STRINGS.zoom.label}
            title={STRINGS.zoom.title}
            value={String(zoom)}
            data-test='report-builder-zoom'
            onChange={(e) => onZoomChange(e.target.value === FIT ? FIT : Number(e.target.value))}
          >
            <option value={FIT}>{STRINGS.zoom.fit(Math.round(fitScale * 100))}</option>
            {ZOOM_LEVELS.map((level) => (
              <option key={level} value={String(level)}>
                {STRINGS.zoom.level(Math.round(level * 100))}
              </option>
            ))}
          </select>
          <Icon name='down' size={12} />
        </span>
      ) : null}
      {!previewOpen && onTogglePanel ? (
        <button
          type='button'
          className={`${RB}-button ${RB}-panel-toggle`}
          aria-label={STRINGS.panelToggle.label}
          aria-expanded={panelOpen}
          aria-controls={panelOpen ? panelId : undefined}
          title={panelOpen ? STRINGS.panelToggle.hide : STRINGS.panelToggle.show}
          data-test='report-builder-panel-toggle'
          onClick={onTogglePanel}
        >
          <Icon name='panel' size={15} />
        </button>
      ) : null}
      {readOnly ? null : previewOpen ? (
        <button
          type='button'
          className={`${RB}-button`}
          data-test='report-builder-close-preview'
          onClick={onClosePreview}
        >
          <Icon name='back' size={13} />
          {STRINGS.backToEditing}
        </button>
      ) : (
        <button
          type='button'
          className={`${RB}-button`}
          data-test='report-builder-open-preview'
          onClick={onOpenPreview}
        >
          <Icon name='eye' size={13} />
          {STRINGS.openPreview}
        </button>
      )}
      {readOnly ? null : (
        <button
          type='button'
          className={`${RB}-button`}
          data-variant='primary'
          title={STRINGS.printTitle}
          disabled={printing}
          data-test='report-builder-print'
          onClick={onPrint}
        >
          <Icon name='printer' size={13} />
          {printing ? STRINGS.printing : STRINGS.print}
        </button>
      )}
      {!previewOpen && onPageSetup ? (
        <ReportOptions
          ref={optionsRef}
          onPageSetup={onPageSetup}
          onBranding={onBranding}
          onSaveAsTemplate={onSaveAsTemplate}
          onRerunAll={onRerunAll}
        />
      ) : null}
    </div>
  </div>
)
