# Styling Guidelines

Part 1 covers mechanics (units, portals, headings). Part 2 is the **visual language** — the
shared radii, spacing, type, colour, elevation and interaction rules the Data Messenger,
Data Agent, chat thread and dashboard tiles were aligned to. New UI should be assembled
from the values below rather than inventing its own.

---

# Part 1 — Mechanics

## Units

### Font sizes — always use `rem`

All `font-size` values must be written in `rem`, not `px`. rem is relative to the browser's root font size (default 16px), which means the component library scales correctly with the host app's font settings without requiring a prop.

```scss
// ✅ correct
font-size: 0.875rem;   // 14px
font-size: 0.9375rem;  // 15px
font-size: 1rem;       // 16px

// ❌ wrong
font-size: 14px;
font-size: 16px;
```

**Quick reference:**

| px  | rem        |
|-----|------------|
| 10  | 0.625rem   |
| 11  | 0.6875rem  |
| 12  | 0.75rem    |
| 13  | 0.8125rem  |
| 14  | 0.875rem   |
| 15  | 0.9375rem  |
| 16  | 1rem       |
| 17  | 1.0625rem  |
| 18  | 1.125rem   |
| 20  | 1.25rem    |
| 22  | 1.375rem   |
| 24  | 1.5rem     |

### Spacing and sizing

Prefer `rem` for padding, margin, height, and width on UI chrome (toolbars, buttons, inputs) so they scale with font size. `px` is acceptable for fine details like borders and box shadows.

## Portals and modals

Components that render outside the react-autoql container (modals, popovers, tooltips) do not inherit scoped CSS variables or font sizes from the host app. Always set `font-size` and `font-family` explicitly on the root element of any portal-rendered component:

```scss
.my-popover-container {
  font-size: 0.9375rem;
  font-family: var(--react-autoql-font-family), sans-serif;
}
```

Wrap portal components with `withTheme` so CSS custom properties are guaranteed to be set on `:root`.

## Browser heading defaults

`h1`–`h6` elements have browser-default sizes that override inherited `font-size`. Always set `font-size` explicitly on headings inside components:

```scss
h3 {
  font-size: 1.125rem;
  font-weight: 600;
}
```

---

# Part 2 — Visual language

## Principles

1. **Everything is themed.** Never hardcode a colour. Every surface, text and border colour
   comes from a `--react-autoql-*` custom property with a sensible fallback, so an
   integrator's `configureTheme` override lands everywhere.
2. **Accent is a highlight, not a background.** In any one region, roughly one thing should
   be accent-coloured: the selected tab's dot, the active nav chip, the send button, the
   focused input's border. Controls at rest are placeholder-grey on a neutral wash.
3. **Quiet at rest, legible on hover.** Idle controls have no border and no shadow of their
   own; they earn a wash on hover. Hover changes colour, never size — the one deliberate
   exception is the drawer handle's 1px lift.
4. **The page speaks in pills.** Message bubbles, the query input, session tabs and the
   in-input controls are all fully rounded. A squared-off control inside that context reads
   as a different kit, so squared corners are reserved for chrome (see the radius table).
5. **One elevation vocabulary.** A hairline contact shadow plus a wide, tightly-spread
   ambient one, both in the theme's own shadow colour. Never stack flat-black shadows, and
   never paint the same shadow on two stacked elements.
6. **Comment the geometry.** Where a number is the result of a measured chain (a control
   positioned inside an input that has its own margin, padding that clears an absolute
   sibling), say so in a comment. Most of the recent regressions were an unexplained offset
   being "cleaned up".

## Theme tokens

Use these directly. The three most likely to be forgotten are the last three.

| Token | Use |
|---|---|
| `--react-autoql-background-color-primary` | Page/panel ground — drawer, header, thread background |
| `--react-autoql-background-color-secondary` | Raised surface — message bubbles, inputs, active tabs, menus |
| `--react-autoql-background-color-tertiary` | Neutral filled control (agent composer's idle button) |
| `--react-autoql-text-color-primary` | Body and active label text |
| `--react-autoql-text-color-placeholder` | Idle icons, secondary labels, placeholders, quiet buttons |
| `--react-autoql-text-color-accent` | Text/glyph **on** an accent fill |
| `--react-autoql-accent-color` | Highlight, focus, selection, send |
| `--react-autoql-border-color` | Every hairline |
| `--react-autoql-box-shadow-color` | Every shadow's colour (light grey in light theme, near-black in dark) |
| `--react-autoql-warning-color` / `-error-` / `-success-` / `-danger-` | Status only |
| `--react-autoql-accent-color-R/G/B` | Accent **channels**, for building `rgba()` washes |
| `--react-autoql-hover-color` | Menu-row hover only — it is tuned for list rows and is far too heavy for chips and icon buttons |
| `--react-autoql-dm-header-btn-hover` | The shared neutral wash, `rgba(128, 134, 142, 0.16)` |

### Washes

There is no `color-mix` dependency anywhere; washes are built from channels or from neutral
grey, both of which work unchanged in light and dark themes.

```scss
// Neutral wash — grey at a low alpha darkens a light theme and lightens a dark one,
// so one value covers both.
rgba(128, 134, 142, 0.08)   // sunken track (tab strip)
rgba(128, 134, 142, 0.12)   // hover on a chip/tab
rgba(128, 134, 142, 0.16)   // icon-button hover, resting fill of an in-input control
rgba(128, 134, 142, 0.22)   // a target inside an already-hovered target (a tab's ✕)

// Accent wash — always via the published channels, never a hardcoded rgba.
rgba(var(--react-autoql-accent-color-R), var(--react-autoql-accent-color-G), var(--react-autoql-accent-color-B), $a);
// $a: 0.10 focus ring · 0.12 available action · 0.14 selected/active · 0.22–0.28 its hover
```

## Radius

Radius is a **meaning**, not a taste. Pick from this table.

| Radius | What gets it |
|---|---|
| `999px` / `50%` | Icon-only discs and the ✕ on a tab — send, stop, mic, in-input filter lock, Quick Topics, new-tab "+", drawer handle, drawer maximize pill, scroll-to-bottom |
| `height / 2` (a true pill) | Anything with a **label** that names a selectable object or state — session tabs (17px on 34px), the tab track (23px on 46px), the query input (18px on 36px), the agent composer (24px), filter-lock chips, the model pill, clear-conversation |
| `12px` | Surfaces and containers — the drawer, dashboard tiles |
| `8–9px` | Persistent chrome and text buttons — header window/nav buttons (`9px`), clear-conversation in the header (`8px`), cards (`8px`) |
| `4px` | Menus and popovers (matches `Popover.scss`) |
| `2px` | Tiny glyph shapes, e.g. the stop square |

Rule of thumb: **transient action → circle; named object or state → pill; chrome → 8–9px;
surface → 12px; menu → 4px.** If a labelled pill and an icon disc sit inside the same
container (send + filter lock inside the input), both are fully round and the container is
too — three nested radii of different families is what made that corner look busy.

## Geometry and spacing

Sizes for chrome are the ones already in use; match them rather than adding a neighbouring value.

| Element | Size |
|---|---|
| Drawer header | `56px` (`--react-autoql-dm-header-height`) |
| Header window buttons (maximize, close, filter lock) | `32 × 32`, radius 9 |
| Header page-nav buttons | `30 × 30`, radius 9, `16px` svg |
| Header text button (clear conversation) | `28px` tall, `0 8px`, radius 8 |
| New-session / new-thread "+" | `30 × 30` circle |
| Tab close ✕ | `18 × 18` circle, `0.625rem` glyph |
| Session / thread tab | `148px` wide (`188px` active) × `34px`, `0 6px 0 14px` |
| Tab strip track | `6px` padding, `0.25rem 1.25rem 0.5rem` margin |
| Query input | `36px` tall, `8px 16px` text inset |
| In-input controls (filter lock, Quick Topics) | `24 × 24` disc, `0.9375rem` glyph |
| Send / stop / mic inside the input | `26 × 26` disc, `13px` svg |
| Agent composer buttons | `1.875rem` (30px) |
| Message bubble | `0.6875rem 1.0625rem` padding |
| Thread gutter | `1.25rem` — the alignment datum for everything stacked in the thread |

**Alignment datum.** `1.25rem` is the thread's left/right inset
(`.chat-message-and-rt-container`). The tab strip's margin and the composer's gutters are
derived from it so tabs, bubbles and the input all share one vertical edge. When you place
something in that column, work back to 1.25rem and note the arithmetic in a comment — the
query input reaches it as `2px` container padding + `10px` input margin.

Gaps: `2px` between header window buttons, `4px` between tabs, `8px` inside a control
(icon → label), `10px` between header groups.

## Type

Base is `0.9375rem` (15px). The thread and everything that feeds it is `0.875rem` (14px) —
typed text should be the same size as the message it becomes.

| Role | Size / weight |
|---|---|
| Empty-state title | `1.5rem` / 600 |
| Drawer header title | `1rem` / 600, `letter-spacing: -0.008em` |
| Component base (agent messenger) | `0.9375rem` |
| Message bubble, query input, composer, menu row | `0.875rem`, `letter-spacing: 0.04em` |
| Tab label | `0.875rem` / 500, active 600, `letter-spacing: -0.008em` |
| Watermark | `0.8125rem` |
| Micro labels — hints, counts, quiet text buttons | `0.75rem` / 500–600 |
| Menu section label | `0.6875rem` / 700, `0.08em`, uppercase |
| Tiny glyph (tab ✕) | `0.625rem` |

Tracking: `-0.008em` on titles and tab labels (display type), `0.04em` on body/input text.
Don't introduce a third value.

> **iOS:** inputs must be ≥16px while focused or Safari zooms in and never back out. The
> query input keeps `1rem` under `@media (hover: none) and (pointer: coarse)`.

## Surfaces, borders and elevation

Raised surfaces use the theme's secondary background, a 1px `--react-autoql-border-color`
hairline, and one of these shadows:

```scss
// Resting card / bubble / input / active tab
box-shadow: 0 1px 1px var(--react-autoql-box-shadow-color, rgba(16, 24, 40, 0.04)),
            0 2px 6px -3px var(--react-autoql-box-shadow-color, rgba(16, 24, 40, 0.07));

// Active / hovered bubble — same shape, lifted
box-shadow: 0 1px 2px var(--react-autoql-box-shadow-color, rgba(16, 24, 40, 0.05)),
            0 4px 10px -4px var(--react-autoql-box-shadow-color, rgba(16, 24, 40, 0.1));

// Panel-level surface (dashboard tile)
box-shadow: 0 1px 2px var(--react-autoql-box-shadow-color, rgba(16, 24, 40, 0.04)),
            0 8px 20px -8px var(--react-autoql-box-shadow-color, rgba(16, 24, 40, 0.08));

// Free-floating object over the page (drawer handle) — hover deepens, doesn't recolour
box-shadow: 0 1px 2px var(--react-autoql-box-shadow-color, rgba(16, 24, 40, 0.06)),
            0 8px 20px -6px var(--react-autoql-box-shadow-color, rgba(16, 24, 40, 0.18));

// Menu / popover
box-shadow: 0 4px 16px var(--react-autoql-box-shadow-color, rgba(0, 0, 0, 0.25));
```

Rules:
- Only **one** element in a stack carries the shadow. A tile and its inner div both painting
  it is what made tiles read as harsh.
- Status decoration is an `inset` bar, and replaces nothing else: `inset 0 3px 0 var(--react-autoql-warning-color)`.
- A hairline inside a hairline reads as clutter. A control sitting inside the input pill or
  a tab gets a **fill**, not a border.

### Glass

Panels and thread surfaces are glassmorphic: a themed background, a backdrop blur, and a
`::before` overlay of the same colour so content stays legible.

```scss
background-color: var(--react-autoql-background-color-primary);
backdrop-filter: blur(20px) saturate(180%);   // 10px on inner surfaces
-webkit-backdrop-filter: blur(20px) saturate(180%);
isolation: isolate;

&::before {
  content: '';
  position: absolute;
  inset: 0;
  background-color: var(--react-autoql-background-color-primary);
  opacity: 0.9;              // 0.85 on large panels
  border-radius: inherit;
  pointer-events: none;
  z-index: -1;
}

@supports not (backdrop-filter: blur(20px)) {
  &::before { opacity: 0.95; }
}
```

Glass is for **surfaces that hold content**, not for strips of chrome. The session tab bar
was blurred and transparent once; it was the only thing in the drawer behaving that way, and
that is exactly why it looked out of place. Chrome sits on a flat wash.

## Buttons

### Icon buttons (chrome)

```scss
background: transparent;
border: none;
color: var(--react-autoql-text-color-placeholder);
border-radius: 9px;              // circle for in-content discs
transition: background-color 0.2s ease, color 0.2s ease;

&:hover {
  background-color: var(--react-autoql-dm-header-btn-hover);
  color: var(--react-autoql-text-color-primary);
}

&.active {                       // selection, not hover
  background-color: rgba(var(--react-autoql-accent-color-R), …, 0.14);
  color: var(--react-autoql-accent-color);
}
```

### Accent disc (send)

Flat accent fill, `--react-autoql-text-color-accent` glyph, no shadow. Press feedback is a
darkening wash — `box-shadow: inset 0 0 0 999px rgba(0, 0, 0, 0.08)` — so the disc keeps its
footprint instead of scaling.

### Stop

Same disc, neutral fill (`--react-autoql-text-color-placeholder`), with an `8px` square,
`2px`-radius `currentColor` glyph. Different colour **and** different glyph, so it never
reads as another way to send.

### Quiet text button

`28px` tall, `0 8px–12px`, radius 8 (or a full pill when it floats over content),
`0.75rem` / 500, placeholder colour, accent on hover.

### Selected state

Selection is **width + material + weight**, not an accent bar or a connecting flare: the
active tab widens (148 → 188px), takes the secondary background, a hairline and the resting
shadow, and goes 600 weight. Absorb the border in the padding (`0 5px 0 13px` vs
`0 6px 0 14px`) so the label doesn't shift by a pixel when selected.

An element that is already "here" gets **no hover state** — hover is for things you could
move to.

## Inputs

```scss
border: 1px solid var(--react-autoql-border-color, rgba(0, 0, 0, 0.1));
background-color: var(--react-autoql-background-color-secondary);

&:not(:disabled):hover  { border-color: var(--react-autoql-accent-color); }

&:not(:disabled):focus {
  border-color: var(--react-autoql-accent-color);
  box-shadow: 0 0 0 2px rgba(var(--react-autoql-accent-color-R), …, 0.1),
              0 1px 2px var(--react-autoql-box-shadow-color, rgba(16, 24, 40, 0.04));
}

&::placeholder { color: var(--react-autoql-text-color-placeholder); opacity: 1; }
```

The accent border does the work; the 2px ring is a hint behind it, not a halo. Use
`:not(:disabled):focus` so focus outranks hover on an input that is both. Every input in the
library focuses identically — if you suppress the native outline (`outline: none !important`)
you **must** supply this.

Controls live **inside** the pill, absolutely positioned and vertically centred, with the
input padding the text out of their way — so the input's own box never changes as controls
appear. Left end is for scope/context (filter lock, Quick Topics); right end is for
send/stop, with the mic to its left.

## Motion

| Duration | Use |
|---|---|
| `0.2s ease` | Colour, background, border, shadow, opacity — the default for every hover/active change |
| `0.3s ease` | Geometry that animates (radius, width, padding) and surface fades |
| `0.5s ease` | Show/hide of a large object (drawer handle opacity) |
| `0.14s cubic-bezier(0.16, 1, 0.3, 1)` | Menu/popover pop-in |
| `0.9s ease` | One-off attention flash (a new tab's accent glow ring) |

Animate a **glow ring**, not a background, to draw attention to a selected element — its
background is load-bearing and animating it blanks the element out mid-flash.

Every animation needs an escape hatch:

```scss
@media (prefers-reduced-motion: reduce) {
  .my-thing { animation: none; transition: none !important; }
}
```

Also drop transitions during a drag: `&.is-resizing * { transition: none !important; }`.

## Gotchas worth knowing

- **Icon glyphs sit low in a circle.** The drawer's inherited `line-height: 22px` makes the
  glyph's box taller than an 18px disc. Every icon inside a sized disc needs
  `display: flex; align-items: center; justify-content: center; line-height: 1;`.
- **Optical centring.** A mark whose visual weight sits below its bounding box (the product
  logo) needs `transform: translateY(-1px)` at 24px — about 4%.
- **Badges.** On a ≥30px control the dot is absolutely positioned at the corner with a
  `1.5px` ring in the surface behind it. On a 24px control it would cover the icon it
  annotates — put it **beside** the glyph and let the button widen into a pill instead.
- **Specificity.** More-nested, later rules win. A shared class styled in two files (the
  filter lock was in both the header and the in-input block) will silently take the wrong
  one; scope the chrome rules tightly (`.chat-header-container button.foo`).
- **A state with its own geometry re-states its children.** The LLM empty state's taller
  input sets `padding-left` at a specificity that outranks the `.has-*` rules, so all the
  left-hand offsets are restated there against its own geometry.
- **Portals inherit nothing.** Re-declare the tokens, `font-size` and `font-family` on any
  portalled menu root (see Part 1).
- **Component-local tokens.** Declare derived values as custom properties on the component
  root (`--am-radius-pill`, `--react-autoql-session-tab-track`) rather than repeating an
  `rgba()` five times.

## Checklist for new UI

- [ ] Every colour is a `--react-autoql-*` token with a fallback; no hex outside a fallback.
- [ ] Radius picked from the table for its **meaning**.
- [ ] Sizes match an existing control rather than sitting 1–2px off one.
- [ ] Font sizes in `rem`, from the type table; tracking is `-0.008em` or `0.04em`.
- [ ] Idle = placeholder grey, no border, no shadow. Hover = wash. Active/selected = accent
      wash at 0.14. At most one accent element per region.
- [ ] Hover changes colour, not size. Focus uses the shared accent border + 2px ring.
- [ ] One shadow per stack, from the elevation list.
- [ ] `0.2s ease` transitions; animations wrapped in a `prefers-reduced-motion` opt-out.
- [ ] Icons inside sized discs get `display: flex` + `line-height: 1`.
- [ ] Any measured offset is explained in a comment.
- [ ] Checked in light **and** dark theme, and at the narrow drawer width.
