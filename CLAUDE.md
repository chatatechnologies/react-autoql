# react-autoql

## Adding a new chart / visualization type

Display types are defined in **autoql-fe-utils** (sibling repo `../autoql-fe-utils`), so a new chart spans both repos. Use the treemap (`src/components/Charts/ChataTreemap`) as the reference implementation — it already follows every rule below.

### Wiring checklist

**autoql-fe-utils**
- `src/Constants/enums.ts`: add the type to `DisplayTypes`.
- `src/Constants/visualizationConstants.ts`: add it to `CHART_TYPES`, and to `CHARTS_WITHOUT_LEGENDS` / `CHARTS_WITHOUT_AGGREGATED_DATA` / `CHARTS_WITHOUT_AXES` as appropriate.
- `src/HelperFns/displayTypeHelpers.ts`: add `find<Type>Columns` + `supports<Type>` and push the type in `getSupportedDisplayTypes` (push late so it doesn't become the default chart). Add tests in `src/HelperFns/tests/displayTypeHelpers.test.js`.
- Don't build module-level constants from enums (e.g. `const X = [ColumnTypes.PERCENT]`) in `HelperFns` — circular imports mean the enum can be undefined at load time, which breaks ~20 test suites. Reference enums inside functions.
- To test locally before publishing: `npm run build` in fe-utils, then copy `dist/` into `react-autoql/node_modules/autoql-fe-utils/dist/`. After publishing, bump `autoql-fe-utils` in `package.json`.

**react-autoql**
- `ChataChart.js`: import + `renderChart` switch case, and add the type everywhere `DisplayTypes.SANKEY` is special-cased (MAX_CHART_ELEMENTS truncation, `adjustChartPosition`, data-limit warnings, loading classes).
- `QueryOutput.js`: add to the raw-data cases in `usePivotDataForChart` and `canUsePivotData`; add any persisted controls to the `initialChartControls` PropTypes.
- Icon: add to `src/svgIcons.js`, `Icon.js` (import + case), `src/js/displayTypeIcons.js`, and **both** `createVisButton` calls in `VizToolbar.js`. Expect `VizToolbar.test.js` button counts to change.

### Design standards (must match existing charts)

- **Icon**: 16×16 SVG. Set `fill='currentColor'` / `stroke='currentColor'` as attributes on every shape — don't rely only on the `chart-icon-svg-0` class.
- **Fills**: use the 3-stop gradient from `BAR_GRADIENT_OPACITY_STOPS` (`chartPropHelpers.js`) with colors from `getChartColorVars().chartColors`. No flat opaque fills.
- **Hover/active**: same feel as bars — `transition: fill-opacity 0.3s ease`, `fill-opacity: 0.7` on `:hover` and `.active`; keep the clicked element `.active`. Hover styles go in SCSS (not inline) so they don't affect PNG export.
- **Inline colors for export**: text/label colors set as attributes (via `getThemeValue`) because CSS vars don't resolve in exported PNGs.
- **Spacing**: leave a little padding at the top of the plot area (~10px) so content doesn't touch the edge.
- **Zoom & pan** (for non-axis charts like network/sankey/treemap): d3-zoom with wheel zoom + drag pan, `clickDistance` so clicks still drill down, double-click zoom disabled, and a "Fit to screen" button. Keep text a constant on-screen size while zoomed.
- **Text while zoomed**: never draw labels inside the zoomed/scaled group with `fontSize / k` — the browser lays out tiny text and scales it, which visibly widens letter spacing. Render labels in a separate screen-space layer at a normal font size, re-rendered when a zoom gesture ends (the treemap moves that layer with the gesture's relative transform until then). Keep labels inside the visible part of their element, and clip them to it.
- **Chart viewport**: put zoomable content in a nested `<svg>` with `style={{ overflow: 'hidden' }}` set inline — library CSS can make nested svgs overflow, letting zoomed content spill over the control buttons.
- **Control buttons** (right side): 30px, at `x = width - 37`, starting at `y = 10`, 35px apart — same as the network graph. Fit-to-screen button first.
- **Column settings popovers**: reuse `ChataSankeyDiagram/SankeyColumnSelector` (configurable via `minPathColumns`, `pathTitle`, `pathSubtitle`, `pathIconType`, etc.) so popover design and buttons match Sankey. Don't build a new selector.
- **Value / aggregate selector**: always include the **Count** option (`SANKEY_VALUE_COUNT_SENTINEL`) like Sankey and the network graph, and fall back to Count when there's no number column.
- **Drilldowns**: gate on `getAutoQLConfig(autoQLConfig).enableDrilldowns`; call `onChartClick({ groupBys: [{ name, drill_down, value }], activeKey })`.
- **Tooltips**: `data-tooltip-id={chartTooltipID}` + `data-tooltip-html`, HTML-escaped, values formatted with `formatElement`.
- **Persisted settings**: read from `initialChartControls`, save via `onChartControlsChange`; auto-corrections (e.g. hidden column) stay local so dashboards don't loop.
- **Persisted column picks**: save both the index and the column name (`getPersistedColumnName`), and read them back with `resolvePersistedColumnIndex(es)` from `chartPropHelpers.js` — name first, saved index as fallback (indices shift when columns are added; names can change). When `columns` changes while mounted, re-map current picks by name too (see ChataTreemap / ChataSankeyDiagram).
- **Count option**: only for list queries. On grouped data (`isAggregation(columns)`) hide it, and disable the value button with a tooltip when there's only one number column.
