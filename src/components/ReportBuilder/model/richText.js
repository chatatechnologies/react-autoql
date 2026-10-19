import { Extension, generateHTML } from '@tiptap/core'
import { StarterKit } from '@tiptap/starter-kit'
import { Placeholder } from '@tiptap/extensions'
import { Markdown, MarkdownManager } from '@tiptap/markdown'

// A report's text as it can be formatted (RW-346), as Jira's editor formats it: bold, italic, underline and
// strikethrough, links, bulleted and numbered lists, and headings within the text. Text blocks and an
// analysis's wording are kept as Markdown (underline as ++text++), edited with ProseMirror (TipTap), and drawn
// on the page from the same schema, so what's edited is what prints. Plain text reads as it always did; a
// single line break is a line break.

// What `marked` reads the Markdown with: GitHub's flavour (~~strikethrough~~), and a single line break kept.
const MARKED_OPTIONS = { breaks: true, gfm: true }

// The link a pasted or typed address becomes; only web and mail links.
export const LINK_PROTOCOLS = ['http', 'https', 'mailto']

// ⌘K / Ctrl+K asks the formatting bar for a link; the bar listens for this.
export const LINK_REQUEST_EVENT = 'react-autoql-link-request'

const LinkShortcut = Extension.create({
  name: 'reactAutoqlLinkShortcut',
  addKeyboardShortcuts() {
    return {
      'Mod-k': () => {
        this.editor.emit(LINK_REQUEST_EVENT)
        return true
      },
    }
  },
})

// The schema and its Markdown: everything a report's text can hold. `placeholder` is shown in an empty editor.
export const richTextExtensions = ({ placeholder } = {}) => [
  StarterKit.configure({
    link: {
      openOnClick: false,
      autolink: true,
      linkOnPaste: true,
      defaultProtocol: 'https',
      protocols: LINK_PROTOCOLS,
    },
  }),
  Markdown.configure({ markedOptions: MARKED_OPTIONS }),
  LinkShortcut,
  ...(placeholder ? [Placeholder.configure({ placeholder })] : []),
]

const STATIC_EXTENSIONS = richTextExtensions()
let manager = null
const markdownManager = () => {
  if (!manager) {
    manager = new MarkdownManager({ extensions: STATIC_EXTENSIONS, markedOptions: MARKED_OPTIONS })
  }
  return manager
}

const textOf = (markdown) => (typeof markdown === 'string' ? markdown : '')

// The page's HTML for some Markdown, built from the editor's own schema, so nothing outside it (raw HTML,
// scripts, a javascript: link) gets through. Kept for the page's life: the same text is drawn on the sheet,
// measured and printed.
const htmlCache = new Map()
const HTML_CACHE_MAX = 300

export const richTextHtml = (markdown) => {
  const text = textOf(markdown)
  if (!text) return ''
  let html = htmlCache.get(text)
  if (html === undefined) {
    html = generateHTML(markdownManager().parse(text), STATIC_EXTENSIONS)
    if (htmlCache.size >= HTML_CACHE_MAX) htmlCache.clear()
    htmlCache.set(text, html)
  }
  return html
}

const EMAIL = /^[^\s@/:]+@[^\s@/:]+\.[^\s@/:]+$/
// Another scheme (javascript:, ftp:), but not an address with a port (example.com:8080).
const OTHER_SCHEME = /^[a-z][a-z0-9+.-]*:(?!\d)/i
const DOMAIN = /^[^\s.]+(\.[^\s.]+)+$/

// A link as typed in the formatting bar: an address gets https://, an email address mailto:. Anything else
// (javascript: and the like) isn't a link, and gives null.
export const linkHref = (input) => {
  const text = String(input ?? '').trim()
  if (!text) return null
  if (/^(https?:\/\/[^\s]+|mailto:[^\s]+)$/i.test(text)) return text
  if (EMAIL.test(text)) return `mailto:${text}`
  if (OTHER_SCHEME.test(text)) return null
  return DOMAIN.test(text) ? `https://${text}` : null
}
