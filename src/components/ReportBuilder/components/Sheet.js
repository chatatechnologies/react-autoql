import React from 'react'
import { BLOCK_INFO, RB, TYPEFACES } from '../constants'
import { STRINGS } from '../strings'
import { groupIntoRows } from '../layout/paginate'
import { Icon } from './icons'
import { boxStyleOf, PaperBlock } from './PaperBlock'
import { RunningFooter, RunningHeader } from './PageFurniture'

// The editing surface. It reflows to the space it has (never wider than the page) and doesn't paginate:
// the print preview, which lays out true Letter pages, is the source of truth for what prints.

const BlockTools = ({ id, isFirst, isLast, onAction, onAnalyze }) => (
  <div className={`${RB}-block-tools`} role='toolbar' aria-label={STRINGS.panel.block}>
    {onAnalyze ? (
      <>
        <button
          type='button'
          title={STRINGS.analyzeResult}
          aria-label={STRINGS.analyzeResult}
          data-accent=''
          data-test='report-builder-analyze-result'
          onClick={onAnalyze}
        >
          <Icon name='analysis' />
        </button>
        <span className={`${RB}-block-tools-sep`} />
      </>
    ) : null}
    <button
      type='button'
      title={STRINGS.moveUp}
      aria-label={STRINGS.moveUp}
      disabled={isFirst}
      onClick={() => onAction(id, 'up')}
    >
      <Icon name='up' />
    </button>
    <button
      type='button'
      title={STRINGS.moveDown}
      aria-label={STRINGS.moveDown}
      disabled={isLast}
      onClick={() => onAction(id, 'down')}
    >
      <Icon name='down' />
    </button>
    <button
      type='button'
      title={STRINGS.duplicate}
      aria-label={STRINGS.duplicate}
      onClick={() => onAction(id, 'duplicate')}
    >
      <Icon name='duplicate' />
    </button>
    <button
      type='button'
      title={STRINGS.remove}
      aria-label={STRINGS.remove}
      data-danger=''
      onClick={() => onAction(id, 'remove')}
    >
      <Icon name='remove' />
    </button>
  </div>
)

export const EditorBlock = React.memo(function EditorBlock({
  block,
  view,
  selected,
  isFirst,
  isLast,
  onSelect,
  onAction,
  onText,
  onAsk,
  onPickTiles,
  onAnalyzeResult,
  ...paperProps
}) {
  const label = BLOCK_INFO[block.type]?.label || block.type
  const select = () => {
    if (!selected) onSelect(block.id)
  }
  // Auto Analyze needs the answer's query id, so only a result kept with one offers it.
  const analyzable =
    !!onAnalyzeResult && block.type === 'data' && view?.state === 'ready' && !!block.capture?.data?.query_id
  return (
    <div
      className={`${RB}-block`}
      data-block-id={block.id}
      data-type={block.type}
      data-width={block.type === 'pagebreak' ? 'full' : block.width}
      data-selected={selected || undefined}
      style={boxStyleOf(block.style)}
      role='group'
      aria-label={label}
      tabIndex={['data', 'analysis', 'pagebreak'].includes(block.type) ? 0 : undefined}
      onMouseDown={select}
      onFocus={select}
    >
      {selected ? <span className={`${RB}-block-tag`}>{label}</span> : null}
      {selected ? (
        <BlockTools
          id={block.id}
          isFirst={isFirst}
          isLast={isLast}
          onAction={onAction}
          onAnalyze={analyzable ? () => onAnalyzeResult(block.id) : undefined}
        />
      ) : null}
      <PaperBlock
        block={block}
        view={view}
        mode='edit'
        onTextChange={(text) => onText(block.id, text)}
        onAsk={(query) => onAsk(block.id, query)}
        onPickTiles={onPickTiles ? () => onPickTiles(block.id) : undefined}
        {...paperProps}
      />
    </div>
  )
})

const frontMatterNote = (page) => {
  if (page.coverPage && page.tableOfContents) return STRINGS.frontMatter.both
  if (page.coverPage) return STRINGS.frontMatter.cover
  if (page.tableOfContents) return STRINGS.frontMatter.toc
  return null
}

export const Sheet = ({
  report,
  views,
  selectedId,
  geometry,
  branding,
  footerLeft,
  onSelect,
  onAction,
  onText,
  onAsk,
  dataFormatting,
  authentication,
  autoQLConfig,
  canRun,
  canCapture,
  onPickTiles,
  onAnalyzeResult,
  pending,
}) => {
  const { page, blocks } = report
  const stack = TYPEFACES[page.typeface]?.stack
  const note = frontMatterNote(page)
  const rows = groupIntoRows(blocks)
  const lastIndex = blocks.length - 1

  return (
    <div
      className={`${RB}-paper ${RB}-sheet`}
      data-orientation={geometry.orientation}
      style={{ maxWidth: `${geometry.widthIn}in`, padding: `${geometry.marginIn}in`, fontFamily: stack || undefined }}
    >
      {page.header ? <RunningHeader branding={branding} title={report.title} /> : null}
      {note ? <div className={`${RB}-front-matter-note`}>{note}</div> : null}

      {blocks.length ? (
        <div className={`${RB}-sheet-blocks`}>
          {rows.map((row) => (
            <div key={row[0].id} className={`${RB}-row`} data-count={row.length}>
              {row.map((block) => {
                const index = blocks.indexOf(block)
                return (
                  <EditorBlock
                    key={block.id}
                    block={block}
                    view={views[block.id]}
                    selected={block.id === selectedId}
                    isFirst={index === 0}
                    isLast={index === lastIndex}
                    onSelect={onSelect}
                    onAction={onAction}
                    onText={onText}
                    onAsk={onAsk}
                    showInterpretation={page.showInterpretation}
                    dataFormatting={dataFormatting}
                    authentication={authentication}
                    autoQLConfig={autoQLConfig}
                    canRun={canRun}
                    canCapture={canCapture}
                    onPickTiles={onPickTiles}
                    onAnalyzeResult={onAnalyzeResult}
                    // Its own entry only: the block is memoized.
                    pending={pending?.[block.id]}
                  />
                )
              })}
            </div>
          ))}
        </div>
      ) : (
        <div className={`${RB}-empty-report`}>
          <div className={`${RB}-empty-report-title`}>{STRINGS.emptyReportTitle}</div>
          <p>{STRINGS.emptyReportBody}</p>
        </div>
      )}

      {page.footer ? <RunningFooter left={footerLeft} right='' /> : null}
    </div>
  )
}
