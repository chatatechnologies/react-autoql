import React from 'react'
import { Editor } from '@tiptap/core'
import { RB } from '../constants'
import { richTextExtensions, richTextHtml, richTextSliceHtml } from '../model/richText'

// A report's formatted text (model/richText.js): drawn on the page as HTML, and edited in place with
// ProseMirror (TipTap), whose formatting bar is the builder's (FormattingBar, on top of the block being
// edited). The editor being typed in, and its block, are handed to the builder through this context.

// { activate(editor, blockId), deactivate(editor, nextFocus) } from the builder; absent outside it.
export const RichTextContext = React.createContext(null)

// The text as the page shows it, measures it and prints it. The HTML comes from the editor's own schema
// (richTextHtml), so it carries nothing but the formatting. With `from` and `to`, only those of its pieces: a
// page's share of a text that goes on over the next (richTextSliceHtml).
export const RichTextView = React.memo(function RichTextView({ markdown, className, style, testId, from, to }) {
  const html = from == null ? richTextHtml(markdown) : richTextSliceHtml(markdown, from, to)
  return (
    <div
      className={`${RB}-rich${className ? ` ${className}` : ''}`}
      style={style}
      data-test={testId}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
})

// The text, editable where it sits. `value` is its Markdown and `onChange` gets the new Markdown as it's
// typed; a new `value` from outside (Analyze again, a reload) replaces what's shown. Esc gives the keyboard
// back to the block.
export class RichTextEditor extends React.Component {
  static contextType = RichTextContext

  static defaultProps = {
    value: '',
    editable: true,
  }

  host = React.createRef()

  componentDidMount() {
    const { value, placeholder, label, testId, editable } = this.props
    this.markdown = value || ''
    this.editor = new Editor({
      element: this.host.current,
      extensions: richTextExtensions({ placeholder }),
      content: this.markdown,
      contentType: 'markdown',
      editable,
      editorProps: {
        attributes: {
          class: `${RB}-rich ${RB}-rich-editor`,
          role: 'textbox',
          'aria-multiline': 'true',
          ...(label ? { 'aria-label': label } : {}),
          ...(testId ? { 'data-test': testId } : {}),
        },
        handleKeyDown: (view, event) => this.onKeyDown(event),
      },
      onUpdate: this.onUpdate,
      onFocus: () => {
        this.context?.activate(this.editor, this.blockId())
        this.props.onFocus?.()
      },
      onBlur: ({ event }) => {
        this.context?.deactivate(this.editor, event?.relatedTarget || null)
        this.props.onBlur?.()
      },
    })
  }

  componentDidUpdate(prevProps) {
    const { value, editable } = this.props
    if (!this.editor) {
      return
    }
    if (value !== prevProps.value && (value || '') !== this.markdown) {
      this.markdown = value || ''
      this.editor.commands.setContent(this.markdown, { contentType: 'markdown', emitUpdate: false })
    }
    if (editable !== prevProps.editable) {
      this.editor.setEditable(editable, false)
    }
  }

  componentWillUnmount() {
    if (!this.editor) {
      return
    }
    this.context?.deactivate(this.editor, null)
    this.editor.destroy()
    this.editor = null
  }

  onUpdate = ({ editor }) => {
    // Without the blank lines a list leaves at the end: nothing that shows.
    const markdown = editor.getMarkdown().replace(/\s+$/, '')
    if (markdown === this.markdown) {
      return
    }
    this.markdown = markdown
    this.props.onChange?.(markdown)
  }

  // The block the text is in, on the editor's page (Sheet's EditorBlock).
  blockElement = () => this.host.current?.closest?.('[data-block-id]') || null

  blockId = () => this.blockElement()?.getAttribute('data-block-id') || null

  onKeyDown = (event) => {
    if (event.key !== 'Escape') {
      return false
    }
    const block = this.blockElement()
    if (block) {
      block.focus()
    } else {
      this.editor?.commands.blur()
    }
    return true
  }

  render() {
    const { className, style } = this.props
    return <div ref={this.host} className={className} style={style} />
  }
}
