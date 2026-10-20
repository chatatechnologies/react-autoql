import React from 'react'
import { RB } from '../constants'
import { STRINGS } from '../strings'
import { Icon } from './icons'
import { SelectBox } from './controls'
import { LINK_REQUEST_EVENT, linkHref } from '../model/richText'
import { isMacKeyboard } from '../keyboard'

// The text formatting (RW-346), as Jira's editor has it, on top of the block whose text is being edited (Sheet's
// EditorBlock): a text style, bold, italic, underline, strikethrough, bulleted and numbered lists, a link, and
// clearing it all. It's drawn at the builder's own size whatever the zoom. `editor` is the TipTap editor that
// has the caret, or null (every control is then off). Its buttons never take focus, so the selection they act
// on stays where it was; the link field does, and the builder keeps the editor meanwhile (data-formatting-bar).

const F = STRINGS.formatting

// A shortcut as the keyboard names it: ⌘⇧S on a Mac, Ctrl+Shift+S elsewhere.
const shortcut = (keys) =>
  isMacKeyboard()
    ? keys.replace(/Mod-/g, '⌘').replace(/Shift-/g, '⇧')
    : keys.replace(/Mod-/g, 'Ctrl+').replace(/Shift-/g, 'Shift+')

const MARKS = [
  { name: 'bold', label: F.bold, keys: 'Mod-B', glyph: 'B', toggle: (chain) => chain.toggleBold() },
  { name: 'italic', label: F.italic, keys: 'Mod-I', glyph: 'I', toggle: (chain) => chain.toggleItalic() },
  { name: 'underline', label: F.underline, keys: 'Mod-U', glyph: 'U', toggle: (chain) => chain.toggleUnderline() },
  { name: 'strike', label: F.strike, keys: 'Mod-Shift-S', glyph: 'S', toggle: (chain) => chain.toggleStrike() },
]

const LISTS = [
  {
    name: 'bulletList',
    label: F.bulletList,
    keys: 'Mod-Shift-8',
    icon: 'list-bulleted',
    toggle: (chain) => chain.toggleBulletList(),
  },
  {
    name: 'orderedList',
    label: F.orderedList,
    keys: 'Mod-Shift-7',
    icon: 'list-numbered',
    toggle: (chain) => chain.toggleOrderedList(),
  },
]

// Headings within text: two sizes, Heading (h3) and Subheading (h4); Auto Analyze's bigger ones read as Heading.
const styleOf = (editor) => {
  if (!editor) return 'paragraph'
  for (const level of [1, 2, 3]) if (editor.isActive('heading', { level })) return 'heading'
  for (const level of [4, 5, 6]) if (editor.isActive('heading', { level })) return 'subheading'
  return 'paragraph'
}

export class FormattingBar extends React.Component {
  state = { tick: 0, link: null }
  linkInput = React.createRef()

  componentDidMount() {
    this.listen(this.props.editor)
  }

  componentDidUpdate(prevProps) {
    if (prevProps.editor !== this.props.editor) {
      this.unlisten(prevProps.editor)
      this.listen(this.props.editor)
      if (this.state.link) this.setState({ link: null })
    }
  }

  componentWillUnmount() {
    this.unlisten(this.props.editor)
  }

  listen(editor) {
    editor?.on('transaction', this.refresh)
    editor?.on(LINK_REQUEST_EVENT, this.openLink)
  }

  unlisten(editor) {
    editor?.off('transaction', this.refresh)
    editor?.off(LINK_REQUEST_EVENT, this.openLink)
  }

  refresh = () => this.setState(({ tick }) => ({ tick: tick + 1 }))

  usable = () => !!this.props.editor && this.props.editor.isEditable && !this.props.editor.isDestroyed

  // Pressing a button mustn't move the caret out of the text.
  keepSelection = (e) => e.preventDefault()

  run = (command) => {
    if (!this.usable()) return
    command(this.props.editor.chain().focus()).run()
  }

  setStyle = (style) =>
    this.run((chain) =>
      style === 'paragraph' ? chain.setParagraph() : chain.setHeading({ level: style === 'heading' ? 3 : 4 }),
    )

  clearFormatting = () => this.run((chain) => chain.unsetAllMarks().clearNodes())

  openLink = () => {
    if (!this.usable()) return
    const href = this.props.editor.getAttributes('link').href || ''
    this.setState({ link: { text: href, error: null, editing: !!href } }, () => {
      this.linkInput.current?.focus()
      this.linkInput.current?.select()
    })
  }

  closeLink = () => {
    this.setState({ link: null })
    if (this.usable()) this.props.editor.commands.focus()
  }

  applyLink = (e) => {
    e.preventDefault()
    const { editor } = this.props
    const typed = this.state.link?.text || ''
    const href = linkHref(typed)
    if (!href) {
      this.setState(({ link }) => ({ link: { ...link, error: F.linkInvalid } }))
      return
    }
    if (!this.usable()) return
    const chain = editor.chain().focus()
    if (editor.state.selection.empty && !editor.isActive('link')) {
      // Nothing selected: the address goes in, as its own link.
      chain.insertContent({ type: 'text', text: typed.trim(), marks: [{ type: 'link', attrs: { href } }] })
    } else {
      chain.extendMarkRange('link').setLink({ href })
    }
    chain.run()
    this.setState({ link: null })
  }

  removeLink = () => {
    this.run((chain) => chain.extendMarkRange('link').unsetLink())
    this.setState({ link: null })
  }

  // The focus left the bar (its link field or style menu) for somewhere other than the text: nothing to format.
  onBarBlur = (e) => {
    const next = e.relatedTarget
    if (next && (e.currentTarget.contains(next) || next.closest?.('.ProseMirror'))) return
    if (this.state.link) this.setState({ link: null })
    this.props.onLeave?.()
  }

  onLinkKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      this.closeLink()
    }
  }

  renderLink() {
    const { link } = this.state
    return (
      <form className={`${RB}-format-link`} onSubmit={this.applyLink} data-test='report-builder-format-link'>
        <input
          ref={this.linkInput}
          type='text'
          className={`${RB}-input`}
          value={link.text}
          placeholder={F.linkPlaceholder}
          aria-label={F.linkAddress}
          aria-invalid={link.error ? 'true' : undefined}
          onChange={(e) => this.setState({ link: { ...link, text: e.target.value, error: null } })}
          onKeyDown={this.onLinkKeyDown}
        />
        <button type='submit' className={`${RB}-button`} data-variant='primary'>
          {F.linkApply}
        </button>
        {link.editing ? (
          <button type='button' className={`${RB}-button`} onClick={this.removeLink}>
            {F.linkRemove}
          </button>
        ) : null}
        <button type='button' className={`${RB}-button`} onClick={this.closeLink}>
          {F.linkCancel}
        </button>
        {link.error ? (
          <span className={`${RB}-format-error`} role='alert'>
            {link.error}
          </span>
        ) : null}
      </form>
    )
  }

  render() {
    const { editor } = this.props
    const usable = this.usable()
    const active = (name) => usable && editor.isActive(name)
    const button = ({ name, label, keys, glyph, icon, onPress, pressed }) => (
      <button
        key={name}
        type='button'
        className={`${RB}-format-button`}
        data-format={name}
        aria-label={label}
        aria-pressed={pressed === undefined ? undefined : !!pressed}
        title={keys ? `${label} (${shortcut(keys)})` : label}
        disabled={!usable}
        onMouseDown={this.keepSelection}
        onClick={onPress}
      >
        {icon ? <Icon name={icon} /> : <span className={`${RB}-format-glyph`}>{glyph}</span>}
      </button>
    )
    return (
      <div
        className={`${RB}-format-bar`}
        role='toolbar'
        aria-label={F.toolbar}
        data-formatting-bar=''
        data-test='report-builder-format-bar'
        data-active={usable || undefined}
        onBlur={this.onBarBlur}
      >
        <SelectBox inline>
          <select
            className={`${RB}-format-style`}
            aria-label={F.style}
            value={styleOf(usable ? editor : null)}
            disabled={!usable}
            onChange={(e) => this.setStyle(e.target.value)}
          >
            <option value='paragraph'>{F.paragraph}</option>
            <option value='heading'>{F.heading}</option>
            <option value='subheading'>{F.subheading}</option>
          </select>
        </SelectBox>
        <span className={`${RB}-format-sep`} aria-hidden='true' />
        {MARKS.map((mark) => button({ ...mark, pressed: active(mark.name), onPress: () => this.run(mark.toggle) }))}
        <span className={`${RB}-format-sep`} aria-hidden='true' />
        {LISTS.map((list) => button({ ...list, pressed: active(list.name), onPress: () => this.run(list.toggle) }))}
        <span className={`${RB}-format-sep`} aria-hidden='true' />
        {button({
          name: 'link',
          label: F.link,
          keys: 'Mod-K',
          icon: 'link',
          pressed: active('link'),
          onPress: this.openLink,
        })}
        {button({ name: 'clear', label: F.clear, icon: 'clear-format', onPress: this.clearFormatting })}
        {this.state.link && usable ? (
          this.renderLink()
        ) : !usable ? (
          <span className={`${RB}-format-hint`}>{F.hint}</span>
        ) : null}
      </div>
    )
  }
}
