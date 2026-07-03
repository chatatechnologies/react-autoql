# Styling Guidelines

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
