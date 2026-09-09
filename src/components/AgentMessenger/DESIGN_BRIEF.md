# AgentMessenger — UI design brief

A brief for redesigning the visual layer of a React chat component. The behaviour, state
model and API wiring are already built and working; **only the presentation needs work.**
Return CSS-level specs that map onto the existing class names listed here, so the result
can be dropped into the component's SCSS without restructuring the markup.

---

## 1. What the component is

A messenger-style chat surface for a data-analytics product. A user asks questions in
natural language ("How did the Eagles do against the spread this season?") and an LLM
agent answers with a mix of prose and data tables, over a multi-turn conversation.

Distinguishing features versus a generic chat UI:

- **Multiple concurrent threads**, switched through a pill + dropdown at the top. Each
  thread is a separate server session. Closing a thread destroys it.
- **Responses are a list of typed items**, not one blob: an answer can be markdown text,
  a data table, an error notice, or several of those in sequence (e.g. table then text).
- **A model picker** in the composer — the user can switch which LLM answers, mid-thread.
- Agent text **types out** character by character; tables appear after the text before
  them finishes.

## 2. Where it lives — the hard constraint

It is a **page inside a slide-out drawer**, not a full-screen app.

- The drawer's **minimum width is 400px** and the user can drag-resize it. Assume most
  usage sits between 400 and 700px wide.
- The drawer can be docked **right, left, top or bottom**, so the page can also be short
  and wide. Nothing may assume a tall, narrow shape or vice versa.
- A **60px app header** sits above the component (accent-colored bar with a title).
- Some responses contain tables with **20+ columns**, which scroll horizontally inside
  their own container. The page itself must never scroll horizontally.

This is the main reason the current design falls flat — it was laid out as if it had a
comfortable full-page width, and everything feels cramped and default-ish at 400px.

## 3. Theme system — please design within it

Colors must come from CSS custom properties that the host app can override. Do not
introduce a new palette; propose values only if you're recommending a change to these.

| Token                                       | Light       | Dark        |
| ------------------------------------------- | ----------- | ----------- |
| `--react-autoql-accent-color`               | `#28A8E0`   | `#193a48`   |
| `--react-autoql-accent-color-secondary`     | `#1EA0D8`   | `#1ea0d8`   |
| `--react-autoql-background-color-primary`   | `#F8F8F8`   | `#15191c`   |
| `--react-autoql-background-color-secondary` | `#FFFFFF`   | `#1d222b`   |
| `--react-autoql-background-color-tertiary`  | `#E8E8E8`   | `#292929`   |
| `--react-autoql-border-color`               | `#D8D8D8`   | `#43464b`   |
| `--react-autoql-hover-color`                | `#F7F7F7`   | `#4a4f56`   |
| `--react-autoql-text-color-primary`         | `#343434`   | `#ececec`   |
| `--react-autoql-text-color-secondary`       | `#8b8b8b`   | `#bababa`   |
| `--react-autoql-text-color-placeholder`     | `#0000008c` | `#ffffff6e` |
| `--react-autoql-danger-color`               | `#CA0B00`   | `#ff584e`   |
| `--react-autoql-warning-color`              | `#FFB600`   | `#FFD500`   |
| `--react-autoql-success-color`              | `#47b84c`   | `#47b84c`   |
| `--react-autoql-box-shadow-color`           | `#85858528` | `#00000066` |

Note the dark accent (`#193a48`) is a deep desaturated navy, **not** a bright blue — a
design that leans on accent-colored fills will look dull in dark mode. Worth solving
explicitly.

Also fixed by house style:

- Every `font-size` in **rem** (16px root). Padding/margins on chrome in rem too; px only
  for borders and shadows.
- Base font size is `0.875rem` (14px); font family `var(--react-autoql-font-family)`,
  default Roboto.
- Headings need explicit `font-size` (browser defaults otherwise win).
- The surrounding drawer uses a **glassmorphism** treatment (translucent background +
  `backdrop-filter: blur(20px) saturate(180%)`), and the component currently sits on top
  of it as a flat opaque panel. Either lean into the glass or deliberately break from it —
  the current in-between is part of what looks wrong.

## 4. Screens and states to design

Please cover all of these; several are what make the component feel unfinished today.

1. **Empty thread** — logo mark, a "What would you like to know?" headline, and 3–4
   clickable suggestion chips. This is the first thing a user sees and currently reads as
   a centered stack of defaults.
2. **Thread switcher** — a pill showing the active thread's title, opening a dropdown of
   up to 8 threads (each a truncated question title plus a close ×), with a `+` button and
   a thread count in the toolbar.
3. **User message** — short text, right-aligned bubble.
4. **Agent message** — avatar + a full-width block of markdown: paragraphs, bold, ordered
   and unordered lists, occasionally headings and inline code. Long answers (300+ words)
   are common.
5. **Agent message containing a table** — a bordered table card with a small header row
   (row/column count + a CSV download button). Design the card, the header, and how the
   table sits inside a 400px-wide column. See §7 for the real data shape.
6. **A response with several items** — e.g. table first, then a paragraph of commentary.
   The grouping should read as one answer, not three unrelated cards.
7. **Error item** — a failed request or server error, rendered inline where the answer
   would be.
8. **Status / unsupported-type item** — a muted informational notice.
9. **Thinking state** — while waiting for a response (an animated dots indicator exists).
10. **Composer** — auto-growing textarea, send button that becomes a stop button while a
    request is in flight, optional microphone button, and the model picker pill on a
    second row below the input.
11. **Model picker open** — a dropdown menu of models, each with a name and an optional
    one-line description.
12. **Scroll-to-bottom affordance** — a floating pill that appears when the user has
    scrolled up.
13. **Dark mode** for at least the empty state, an agent message with a table, and the
    composer.

## 5. Interaction and motion

Currently implemented, all easily restyled — tell me what to change:

- Message enter: 220ms fade + 8px slide-up, staggered per item.
- Typewriter reveal of agent text, with a blinking block caret at the tail. Clicking the
  transcript or pressing Escape skips to the full text.
- Tab open: fade + 4px slide-down. Active tab marked by a 2px bottom border in the accent
  color (a slide-along indicator would be nicer).
- Composer: focus ring on the input row, send button scales down on press.
- Everything is `transform`/`opacity` only and switched off under
  `prefers-reduced-motion: reduce` — please keep both properties true of any new motion.

## 6. Class name map — anchor your specs to these

The markup is stable; write specs against these hooks.

```
.react-autoql-agent-messenger            root, flex column, height 100%; defines the --am-* tokens
├── .react-autoql-agent-toolbar          2.5rem row above the transcript
│   ├── .react-autoql-agent-thread-pill  active thread (+ .is-open)
│   │   ├── .react-autoql-agent-thread-dot
│   │   ├── .react-autoql-agent-thread-pill-title
│   │   └── .react-autoql-agent-thread-caret
│   └── .react-autoql-agent-toolbar-right
│       ├── .react-autoql-agent-thread-count
│       └── .react-autoql-agent-icon-btn      the + button
├── .react-autoql-agent-threads          positioned container, all threads mounted
│   ├── .react-autoql-agent-menu-scrim
│   ├── .react-autoql-agent-thread-menu       the thread dropdown
│   │   ├── .react-autoql-agent-menu-label
│   │   ├── .react-autoql-agent-menu-row      (+ .is-active | .is-new)
│   │   │   ├── .react-autoql-agent-menu-row-title
│   │   │   └── .react-autoql-agent-menu-row-close
│   │   └── .react-autoql-agent-menu-divider
│   └── .react-autoql-agent-thread            one thread (+ .is-hidden when inactive)
│       ├── .react-autoql-agent-thread-scrollbars   scroll viewport
│       ├── .react-autoql-agent-thread-content      message column
│       │   ├── .react-autoql-agent-empty-state
│       │   │   ├── .react-autoql-agent-empty-state-logo
│       │   │   ├── .react-autoql-agent-empty-state-title
│       │   │   ├── .react-autoql-agent-empty-state-subtitle
│       │   │   └── .react-autoql-agent-suggestions
│       │   │       └── .react-autoql-agent-suggestion
│       │   │           └── .react-autoql-agent-suggestion-arrow
│       │   ├── .react-autoql-agent-message   (+ .is-user | .is-agent, .is-first, .follows-same-role)
│       │   │   ├── .react-autoql-agent-user-bubble
│       │   │   ├── .react-autoql-agent-avatar
│       │   │   └── .react-autoql-agent-message-body    carries the vertical rule
│       │   │       ├── .react-autoql-agent-model-label
│       │   │       └── .react-autoql-agent-item        one response item
│       │   │           ├── .react-autoql-agent-text-item        (+ .is-typing)
│       │   │           ├── .react-autoql-agent-table-item       (+ .animate-in)
│       │   │           │   ├── .react-autoql-agent-table-header
│       │   │           │   │   ├── .react-autoql-agent-table-meta
│       │   │           │   │   └── .react-autoql-agent-table-action
│       │   │           │   ├── .react-autoql-agent-table-body
│       │   │           │   │   ├── (SimpleTable markup)
│       │   │           │   │   ├── .react-autoql-agent-table-fade    (+ .is-hidden)
│       │   │           │   │   └── .react-autoql-agent-table-pager   (+ .is-hidden)
│       │   │           │   └── .react-autoql-agent-table-footer
│       │   │           │       ├── .react-autoql-agent-table-track
│       │   │           │       │   └── .react-autoql-agent-table-thumb
│       │   │           │       └── .react-autoql-agent-table-range
│       │   │           └── .react-autoql-agent-status-item      (+ .is-error | .is-info)
│       │   │               ├── .react-autoql-agent-status-title
│       │   │               ├── .react-autoql-agent-status-text
│       │   │               └── .react-autoql-agent-status-retry
│       │   └── .react-autoql-agent-thinking
│       │       └── .react-autoql-agent-thinking-dots
│       └── .react-autoql-agent-scroll-to-bottom
└── .react-autoql-agent-composer
    ├── .react-autoql-agent-composer-input-row      (+ .is-focused | .is-sending)
    │   ├── .react-autoql-agent-composer-input      textarea
    │   ├── .react-autoql-agent-composer-microphone
    │   └── .react-autoql-agent-composer-btn        (+ .is-send/.can-send | .is-stop)
    │       └── .react-autoql-agent-stop-glyph
    └── .react-autoql-agent-composer-toolbar
        ├── .react-autoql-agent-model-select        restyles the shared Select trigger
        └── .react-autoql-agent-composer-hint
```

Two markup notes: the **table body is rendered by an existing shared component** whose
internals shouldn't be restyled (only the card around it), and the **model picker wraps a
shared Select** — restyle its trigger pill freely, but the dropdown menu is shared with
the rest of the product.

## 7. Real content to design against

Use this actual API response rather than lorem ipsum — the density is the point.

**A text-only answer** (early clarifying turn):

> Yes. To make the comparison precise, please confirm:
>
> 1. Does **Eagles** mean the team listed as "Eagles" in the data?
> 2. Which two **season years** should I use for "last season" and "the season before"?
> 3. What should "performance" include? I can compare record, scoring (points for/against),
>    and team offensive statistics such as total yards, first downs, turnovers, rushing,
>    and passing—or focus on specific measures you prefer.
>
> I can present the results as a season-by-season comparison table with absolute and
> percentage changes, plus a short takeaway.

**A table + text answer.** The table has **22 columns and 17 rows**. Column headers and a
sample row:

| Game Date   | Season | Season Type    | Score | Opposition Score | Total Plays | Total Yards | First Downs | Turnovers | …   | Opposition Team       | Team                |
| ----------- | ------ | -------------- | ----- | ---------------- | ----------- | ----------- | ----------- | --------- | --- | --------------------- | ------------------- |
| Jan 4, 2026 | 2025   | Regular Season | 17    | 24               | 62          | 307         | 18          | 1         | …   | Washington Commanders | Philadelphia Eagles |

Column types are known (`DATE`, `QUANTITY`, `STRING`) and values are pre-formatted, so
right-aligning numbers and left-aligning text is available if useful. Followed by:

> Here are the game-level offensive team statistics for the Eagles in the 2025 and 2026
> seasons (regular season and postseason). Please review the data and confirm that it
> meets your expectations. Once confirmed, I will move on to the season-by-season
> comparison and provide both the table and narrative analysis.

Sample thread tab titles (truncated at 28 chars): `How did the Eagles do agains…`, `Compare to last season`, `New thread`.

Sample models for the picker: `GPT-4.1`, `GPT-5`.

> **Status:** the prototype returned from Claude Design has been implemented against
> this map, so §6 describes the current markup. §8 below records what was wrong with the
> _first_ pass and is kept as the rationale for the current design.

## 8. What I think is wrong with it today

My own read, for you to agree with or overrule:

- **No visual hierarchy between a message and a response item.** Text, tables and notices
  all sit in a flat vertical stack at the same weight, so a long multi-item answer reads
  as a wall.
- **The tab strip looks like browser chrome**, not part of the product, and eats vertical
  space that a 400px-wide drawer can't spare.
- **Accent-colored user bubbles fight the accent-colored app header** directly above them.
- **The table card is a plain bordered rectangle** with a cramped meta row; at 400px wide a
  22-column table is mostly a horizontal scrollbar, and nothing signals that.
- **The composer is undifferentiated** — a rounded rectangle with a circular send button,
  and the model pill below it reads as an afterthought rather than a control.
- **Spacing is uniform everywhere** (mostly 0.5–1rem), so nothing groups.
- **Dark mode was never really designed**, only token-substituted.

## 9. What I need back

Concrete enough to implement:

1. A spacing and type scale for the component (rem values).
2. Per-state specs keyed to the class names in §6: background, border, radius, padding,
   shadow, type size/weight/color — for **both** light and dark.
3. A point of view on hierarchy: how a user turn, an agent turn, and the items inside an
   agent turn should be visually distinguished.
4. The table card treatment, including how it signals horizontal scroll at narrow widths.
5. Composer and model-picker treatment.
6. Motion adjustments, if any (transform/opacity only).

Layout structure changes are fine to propose — I can change the markup if the payoff is
real. Just call them out explicitly so they don't get lost in the CSS.
