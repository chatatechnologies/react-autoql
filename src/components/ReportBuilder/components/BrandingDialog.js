import React from 'react'
import { RB } from '../constants'
import { STRINGS } from '../strings'
import { Icon } from './icons'
import { Field, Note, Segmented } from './controls'
import { BrandFonts, RunningHeader } from './PageFurniture'
import {
  BRAND_NAME_MAX,
  FONT_MAX_BYTES,
  FONT_TYPES,
  IMAGE_MAX_BYTES,
  IMAGE_TYPES,
  MAX_BRAND_COLOURS,
  normalizeBranding,
  paperFontStyle,
  parseColour,
} from '../model/branding'

// The organisation's branding, as the prototype's Branding dialog has it, with what RW-332 asks for: its name,
// a logo and a wordmark and where they sit, brand colours (HEX or RGB) for the colour pickers, and the fonts a
// report on the theme's typeface is set in. The builder saves it for the organisation (onSave, to AutoQL);
// images and fonts are read here as data: URLs.

const B = STRINGS.branding

// The draft's fonts preview under families of their own, so the pages keep the saved ones meanwhile.
const DRAFT_FAMILIES = { heading: 'react-autoql-brand-heading-draft', body: 'react-autoql-brand-body-draft' }
const FOCUSABLE = 'button:not([disabled]), input:not([disabled]):not([type="file"]), select:not([disabled])'

// A file as a data: URL. A font is labelled with the type its extension names, which browsers often leave out.
const readFile = (file, mime) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      resolve(mime ? result.replace(/^data:[^;,]*;base64,/, `data:${mime};base64,`) : result)
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })

const extensionOf = (fileName) => ((String(fileName).match(/\.([a-z0-9]+)$/i) || [])[1] || '').toLowerCase()

// What AutoQL keeps in a font's name, which ends up in CSS: letters, digits, spaces, - and _. Made at run time so
// the build doesn't spell out every letter for browsers that can't read \p{…}; those keep to plain ASCII.
const NOT_IN_FONT_NAME = (() => {
  try {
    return new RegExp('[^\\p{L}\\p{M}\\p{Nd} _-]+', 'gu')
  } catch (error) {
    return /[^A-Za-z0-9 _-]+/g
  }
})()

// A font's name, from its file's: "Lato-Bold (1).ttf" → "Lato Bold 1". Anything AutoQL wouldn't keep becomes a
// space, and it's cut to the 80 characters AutoQL allows.
const fontNameOf = (fileName) => {
  const name = String(fileName)
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(NOT_IN_FONT_NAME, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return Array.from(name).slice(0, BRAND_NAME_MAX).join('').trim() || B.fontFallbackName
}

// Whether the browser can set type in it, where it can tell (FontFace); elsewhere it's taken on trust.
const isUsableFont = async (url) => {
  if (typeof FontFace === 'undefined') {
    return true
  }
  try {
    await new FontFace('react-autoql-font-check', `url("${url}")`).load()
    return true
  } catch (error) {
    return false
  }
}

let colourKeys = 0
const colourRow = (text = '') => {
  colourKeys += 1
  return { key: colourKeys, text }
}

const draftOf = (branding) => {
  const b = normalizeBranding(branding)
  return {
    name: b.name,
    logoUrl: b.logoUrl || '',
    wordmarkUrl: b.wordmarkUrl || '',
    position: b.position,
    colours: b.colors.map((hex) => colourRow(hex.toUpperCase())),
    headingFont: b.headingFont || null,
    bodyFont: b.bodyFont || null,
  }
}

// The whole branding the draft comes to, as saved: what's left out is cleared, and a colour row left empty
// isn't a colour. Null while a colour can't be read.
const brandingOf = (draft) => {
  const texts = draft.colours.map((row) => row.text.trim()).filter(Boolean)
  const colors = texts.map(parseColour)
  if (colors.some((hex) => !hex)) {
    return null
  }
  return {
    name: draft.name.trim(),
    position: draft.position,
    colors,
    ...(draft.logoUrl ? { logoUrl: draft.logoUrl } : {}),
    ...(draft.wordmarkUrl ? { wordmarkUrl: draft.wordmarkUrl } : {}),
    ...(draft.headingFont ? { headingFont: draft.headingFont } : {}),
    ...(draft.bodyFont ? { bodyFont: draft.bodyFont } : {}),
  }
}

// What counts as a change.
const comparable = (branding) => JSON.stringify(normalizeBranding(branding))

// An image the organisation uploads: its preview, or none, with Upload/Replace and Remove.
const ImageField = ({ label, note, url, error, testId, onFile, onRemove }) => {
  const fileRef = React.useRef(null)
  return (
    <>
      <Field label={label}>
        <div className={`${RB}-asset-row`}>
          {url ? (
            <img className={`${RB}-asset-thumb`} src={url} alt={label} data-test={`${testId}-image`} />
          ) : (
            <span className={`${RB}-asset-none`}>{B.none}</span>
          )}
          <span className={`${RB}-asset-actions`}>
            <button
              type='button'
              className={`${RB}-button`}
              aria-label={`${url ? B.replace : B.upload} ${label}`}
              data-test={`${testId}-upload`}
              onClick={() => fileRef.current?.click()}
            >
              {url ? B.replace : B.upload}
            </button>
            {url ? (
              <button
                type='button'
                className={`${RB}-button`}
                aria-label={`${B.remove} ${label}`}
                data-test={`${testId}-remove`}
                onClick={onRemove}
              >
                {B.remove}
              </button>
            ) : null}
          </span>
          <input
            ref={fileRef}
            type='file'
            accept={IMAGE_TYPES.join(',')}
            hidden
            tabIndex={-1}
            aria-hidden='true'
            data-test={`${testId}-file`}
            onChange={(e) => {
              const file = e.target.files?.[0]
              // So choosing the same file again still reads it.
              e.target.value = ''
              if (file) {
                onFile(file)
              }
            }}
          />
        </div>
      </Field>
      {error ? <Note tone='warning'>{error}</Note> : <Note>{note}</Note>}
    </>
  )
}

// A font the organisation uploads: its name, set in it, with Upload/Replace and Remove.
const FontField = ({ label, font, family, error, testId, onFile, onRemove }) => {
  const fileRef = React.useRef(null)
  return (
    <>
      <Field label={label}>
        <div className={`${RB}-asset-row`}>
          {font ? (
            <span className={`${RB}-font-sample`} style={{ fontFamily: `'${family}', sans-serif` }} data-test={testId}>
              <b>{font.name || B.fontSample}</b> {B.fontSample}
            </span>
          ) : (
            <span className={`${RB}-asset-none`}>{B.none}</span>
          )}
          <span className={`${RB}-asset-actions`}>
            <button
              type='button'
              className={`${RB}-button`}
              aria-label={`${font ? B.replace : B.upload} ${label} ${B.fonts.toLowerCase()}`}
              data-test={`${testId}-upload`}
              onClick={() => fileRef.current?.click()}
            >
              {font ? B.replace : B.upload}
            </button>
            {font ? (
              <button
                type='button'
                className={`${RB}-button`}
                aria-label={`${B.remove} ${label} ${B.fonts.toLowerCase()}`}
                data-test={`${testId}-remove`}
                onClick={onRemove}
              >
                {B.remove}
              </button>
            ) : null}
          </span>
          <input
            ref={fileRef}
            type='file'
            accept={Object.keys(FONT_TYPES)
              .map((ext) => `.${ext}`)
              .join(',')}
            hidden
            tabIndex={-1}
            aria-hidden='true'
            data-test={`${testId}-file`}
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) {
                onFile(file)
              }
            }}
          />
        </div>
      </Field>
      {error ? <Note tone='warning'>{error}</Note> : null}
    </>
  )
}

let dialogIds = 0

export class BrandingDialog extends React.Component {
  constructor(props) {
    super(props)
    dialogIds += 1
    const id = (part) => `${RB}-branding-${part}-${dialogIds}`
    this.ids = { title: id('title'), what: id('what'), name: id('name') }
    this.dialogRef = React.createRef()
    this.nameRef = React.createRef()
    this.colourInputs = {}
    this.state = { draft: draftOf(props.branding), saving: false, error: null, assetErrors: {} }
  }

  componentDidMount() {
    this.mounted = true
    this.nameRef.current?.focus?.()
  }

  componentWillUnmount() {
    this.mounted = false
  }

  setDraft = (change) => this.setState(({ draft }) => ({ draft: { ...draft, ...change }, error: null }))

  setAssetError = (field, message) =>
    this.setState(({ assetErrors }) => ({ assetErrors: { ...assetErrors, [field]: message } }))

  close = () => {
    if (!this.state.saving) {
      this.props.onClose()
    }
  }

  onImage = async (field, file) => {
    if (!IMAGE_TYPES.includes(file.type)) {
      return this.setAssetError(field, B.imageWrongType)
    }
    if (file.size > IMAGE_MAX_BYTES) {
      return this.setAssetError(field, B.imageTooLarge(Math.ceil(file.size / 1024)))
    }
    try {
      const url = await readFile(file)
      if (!this.mounted) {
        return
      }
      if (!url.startsWith('data:image/')) {
        return this.setAssetError(field, B.imageUnreadable)
      }
      this.setAssetError(field, null)
      this.setDraft({ [field]: url })
    } catch (error) {
      if (this.mounted) {
        this.setAssetError(field, B.imageUnreadable)
      }
    }
  }

  onFont = async (field, file) => {
    const type = FONT_TYPES[extensionOf(file.name)]
    if (!type) {
      return this.setAssetError(field, B.fontWrongType)
    }
    if (file.size > FONT_MAX_BYTES) {
      return this.setAssetError(field, B.fontTooLarge(Math.ceil(file.size / 1024)))
    }
    try {
      const url = await readFile(file, type.mime)
      const usable = await isUsableFont(url)
      if (!this.mounted) {
        return
      }
      if (!usable) {
        return this.setAssetError(field, B.fontUnreadable)
      }
      this.setAssetError(field, null)
      this.setDraft({ [field]: { name: fontNameOf(file.name), url } })
    } catch (error) {
      if (this.mounted) {
        this.setAssetError(field, B.fontUnreadable)
      }
    }
  }

  setColour = (key, text) =>
    this.setDraft({ colours: this.state.draft.colours.map((row) => (row.key === key ? { ...row, text } : row)) })

  // The new row's box takes focus as soon as it's drawn, so typing that follows the click lands in it.
  addColour = () => {
    const row = colourRow()
    this.setState(
      ({ draft }) => ({ draft: { ...draft, colours: [...draft.colours, row] }, error: null }),
      () => this.colourInputs[row.key]?.focus?.(),
    )
  }

  removeColour = (key) => this.setDraft({ colours: this.state.draft.colours.filter((row) => row.key !== key) })

  discard = () => this.setState({ draft: draftOf(this.props.branding), error: null, assetErrors: {} })

  save = async () => {
    const branding = brandingOf(this.state.draft)
    if (this.state.saving || !branding || !branding.name) {
      return
    }
    this.setState({ saving: true, error: null })
    try {
      await this.props.onSave(branding)
      if (this.mounted) {
        this.props.onClose()
      }
    } catch (error) {
      if (this.mounted) {
        this.setState({ saving: false, error: B.saveFailed })
      }
    }
  }

  // Escape closes it, and Tab stays inside it while it's open.
  onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      this.close()
      return
    }
    if (e.key !== 'Tab') {
      return
    }
    const focusable = Array.from(this.dialogRef.current?.querySelectorAll(FOCUSABLE) || [])
    if (!focusable.length) {
      return
    }
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  renderColours() {
    const { colours } = this.state.draft
    const invalid = colours.some((row) => row.text.trim() && !parseColour(row.text))
    return (
      <>
        <Field label={B.colours}>
          <div className={`${RB}-colour-list`} data-test='report-builder-branding-colours'>
            {colours.map((row, i) => {
              const hex = parseColour(row.text)
              const bad = !!row.text.trim() && !hex
              return (
                <div key={row.key} className={`${RB}-colour-row`}>
                  <input
                    type='color'
                    className={`${RB}-colour-swatch`}
                    value={hex || '#000000'}
                    aria-label={B.colourPick(i + 1)}
                    onChange={(e) => this.setColour(row.key, e.target.value.toUpperCase())}
                  />
                  <input
                    ref={(el) => {
                      this.colourInputs[row.key] = el
                    }}
                    type='text'
                    className={`${RB}-input`}
                    value={row.text}
                    placeholder={B.colourPlaceholder}
                    aria-label={B.colourLabel(i + 1)}
                    aria-invalid={bad || undefined}
                    spellCheck={false}
                    onChange={(e) => this.setColour(row.key, e.target.value)}
                  />
                  <button
                    type='button'
                    className={`${RB}-icon-button`}
                    aria-label={B.removeColour(i + 1)}
                    title={B.removeColour(i + 1)}
                    onClick={() => this.removeColour(row.key)}
                  >
                    <Icon name='close' />
                  </button>
                </div>
              )
            })}
            {colours.length < MAX_BRAND_COLOURS ? (
              <button
                type='button'
                className={`${RB}-button ${RB}-colour-add`}
                data-test='report-builder-branding-add-colour'
                onClick={this.addColour}
              >
                {B.addColour}
              </button>
            ) : null}
          </div>
        </Field>
        {invalid ? <Note tone='warning'>{B.colourInvalid}</Note> : <Note>{B.coloursNote(MAX_BRAND_COLOURS)}</Note>}
      </>
    )
  }

  render() {
    const { reportTitle } = this.props
    const { draft, saving, error, assetErrors } = this.state
    const branding = brandingOf(draft)
    const named = !!draft.name.trim()
    const dirty = !branding || comparable(branding) !== comparable(this.props.branding)
    const status = error || (dirty ? B.unsaved : B.saved)
    // The sample is drawn with what's typed; a colour still being typed leaves the last good ones.
    const sample = branding || brandingOf({ ...draft, colours: [] })
    return (
      <>
        <div className={`${RB}-modal-backdrop`} onMouseDown={this.close} />
        <div
          ref={this.dialogRef}
          className={`${RB}-modal ${RB}-branding`}
          role='dialog'
          aria-modal='true'
          aria-labelledby={this.ids.title}
          aria-describedby={this.ids.what}
          data-test='report-builder-branding'
          onKeyDown={this.onKeyDown}
        >
          <BrandFonts branding={sample} families={DRAFT_FAMILIES} />
          <div className={`${RB}-modal-header`}>
            <h2 className={`${RB}-modal-title`} id={this.ids.title}>
              {B.title}
            </h2>
            <button
              type='button'
              className={`${RB}-icon-button`}
              aria-label={STRINGS.close}
              disabled={saving}
              onClick={this.close}
            >
              <Icon name='close' />
            </button>
          </div>
          <div className={`${RB}-modal-body`}>
            <p className={`${RB}-modal-what`} id={this.ids.what}>
              {B.what}
            </p>
            <figure className={`${RB}-branding-sample`}>
              {/* The page's own header, drawn as it prints, with what's chosen here. */}
              <div
                className={`${RB}-paper ${RB}-branding-paper`}
                style={paperFontStyle({ typeface: 'theme' }, sample, DRAFT_FAMILIES)}
                data-test='report-builder-branding-sample'
              >
                <RunningHeader branding={normalizeBranding(sample)} title={reportTitle} />
                {sample.bodyFont ? <p className={`${RB}-branding-sample-body`}>{B.sampleBody}</p> : null}
              </div>
              <figcaption className={`${RB}-details-caption`}>{B.sample}</figcaption>
            </figure>

            <Field label={B.name} htmlFor={this.ids.name}>
              <input
                ref={this.nameRef}
                id={this.ids.name}
                type='text'
                className={`${RB}-input`}
                value={draft.name}
                maxLength={BRAND_NAME_MAX}
                autoComplete='organization'
                aria-invalid={!named || undefined}
                data-test='report-builder-branding-name'
                onChange={(e) => this.setDraft({ name: e.target.value })}
              />
            </Field>
            {named ? null : <Note tone='warning'>{B.nameRequired}</Note>}

            <ImageField
              label={B.logo}
              note={`${B.logoNote} ${B.imageNote}`}
              url={draft.logoUrl}
              error={assetErrors.logoUrl}
              testId='report-builder-branding-logo'
              onFile={(file) => this.onImage('logoUrl', file)}
              onRemove={() => this.setDraft({ logoUrl: '' })}
            />
            <ImageField
              label={B.wordmark}
              note={`${B.wordmarkNote} ${B.imageNote}`}
              url={draft.wordmarkUrl}
              error={assetErrors.wordmarkUrl}
              testId='report-builder-branding-wordmark'
              onFile={(file) => this.onImage('wordmarkUrl', file)}
              onRemove={() => this.setDraft({ wordmarkUrl: '' })}
            />
            <Segmented
              label={B.position}
              value={draft.position}
              options={B.positions}
              testId='report-builder-branding-position'
              onChange={(position) => this.setDraft({ position })}
            />
            <Note>{B.positionNote}</Note>

            {this.renderColours()}

            <div className={`${RB}-section-label`}>{B.fonts}</div>
            <FontField
              label={B.headingFont}
              font={draft.headingFont}
              family={DRAFT_FAMILIES.heading}
              error={assetErrors.headingFont}
              testId='report-builder-branding-heading-font'
              onFile={(file) => this.onFont('headingFont', file)}
              onRemove={() => this.setDraft({ headingFont: null })}
            />
            <FontField
              label={B.bodyFont}
              font={draft.bodyFont}
              family={DRAFT_FAMILIES.body}
              error={assetErrors.bodyFont}
              testId='report-builder-branding-body-font'
              onFile={(file) => this.onFont('bodyFont', file)}
              onRemove={() => this.setDraft({ bodyFont: null })}
            />
            <Note>{B.fontNote}</Note>
          </div>
          <div className={`${RB}-modal-actions`}>
            <p
              className={`${RB}-modal-status`}
              role='status'
              data-tone={error ? 'error' : undefined}
              data-test='report-builder-branding-status'
            >
              {status}
            </p>
            <button
              type='button'
              className={`${RB}-button`}
              disabled={!dirty || saving}
              data-test='report-builder-branding-discard'
              onClick={this.discard}
            >
              {B.discard}
            </button>
            <button
              type='button'
              className={`${RB}-button`}
              data-variant='primary'
              disabled={!dirty || saving || !named || !branding}
              data-test='report-builder-branding-save'
              onClick={this.save}
            >
              {saving ? B.saving : B.save}
            </button>
          </div>
        </div>
      </>
    )
  }
}
