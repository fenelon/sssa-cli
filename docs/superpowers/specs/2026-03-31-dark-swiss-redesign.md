# Dark Swiss Redesign — Shamir's Secret Sharing Web UI

**Date:** 2026-03-31
**Status:** Approved
**Scope:** CSS-only redesign of `sssa-web/css/style.css`. No HTML or JS changes.

## Problem

The current light Swiss design has invisible inputs (bottom-border-only on white), weak visual grouping, and low interactivity cues. The UI is hard to navigate — controls blend into the background and nothing guides the eye.

## Direction

Dark mode with Swiss typographic discipline. Three dark tones create depth layers. Red accent reserved for actions and data output. Recessed input fields with visible borders replace bottom-border-only fields.

## Color Palette

| Role         | Value     | Usage                                        |
|--------------|-----------|----------------------------------------------|
| Background   | `#0a0a0a` | Page body                                    |
| Surface      | `#111111` | Cards, share slots, banner, modal            |
| Raised       | `#1a1a1a` | Dividers, subtle borders between sections    |
| Border       | `#2a2a2a` | Input borders, card borders                  |
| Border light | `#222222` | Card outlines, section dividers              |
| Accent       | `#e00000` | Primary button, active tab, focus glow, share hex |
| Text primary | `#e0e0e0` | Body text, input values                      |
| Text heading | `#ffffff` | h1 title                                     |
| Text muted   | `#555555` | Labels, subtitle, secondary info             |
| Text dim     | `#333333` | Byte counter, footer, placeholder hints      |
| Valid         | `#00aa00` | Combine mode "valid" status (brighter green for dark bg) |
| Invalid      | `#e00000` | Combine mode "invalid" status (same as accent) |

## CSS Custom Properties (updated `:root`)

```css
:root {
  --color-bg: #0a0a0a;
  --color-surface: #111111;
  --color-input: #0f0f0f;
  --color-raised: #1a1a1a;
  --color-text: #e0e0e0;
  --color-text-heading: #ffffff;
  --color-accent: #e00000;
  --color-secondary: #555555;
  --color-border: #2a2a2a;
  --color-light-border: #222222;
  --color-dim: #333333;
  --font-stack: 'Helvetica Neue', Helvetica, sans-serif;
  --max-width: 640px;
}
```

## Component Specifications

### Download Banner
- Background: `var(--color-surface)`
- Bottom border: `1px solid var(--color-raised)`
- Text/link color: `var(--color-secondary)`
- Link hover: `var(--color-text)`

### Header
- Accent bar: unchanged (`#e00000`)
- h1 color: `var(--color-text-heading)` (white)
- Subtitle: `var(--color-secondary)`

### Mode Toggle (Tabs)
- Bottom border: `1px solid var(--color-raised)`
- Inactive tab: `var(--color-secondary)`, transparent bottom border
- Inactive hover: `var(--color-text)`
- Active tab: `var(--color-text-heading)` (white), bottom border `var(--color-accent)` (red, not black)

### Inputs — Recessed Fields
All text inputs and textareas switch from bottom-border-only to recessed fields:

- Background: `var(--color-input)` (`#0f0f0f`)
- Border: `1px solid var(--color-border)` (`#2a2a2a`)
- Border radius: `4px`
- Padding: `10px 12px` (textarea), `4px 0` becomes centered for number inputs
- Color: `var(--color-text)` (`#e0e0e0`)
- Placeholder: `#444444`
- Focus: border-color `var(--color-accent)`, box-shadow `0 0 0 1px rgba(224, 0, 0, 0.15)`

### Threshold Inputs
- Same recessed style as above
- Width: `56px`, height: `40px`, text-align: center
- Font-size: `18px`, font-weight: 500
- "of" text: `var(--color-secondary)`

### Textarea
- Same recessed style
- Full-width, `border-radius: 4px`
- `resize: vertical` preserved
- Readonly state: border-color `var(--color-light-border)`, no focus glow

### Byte Counter
- Color: `var(--color-dim)` (`#333`)
- Over-limit: `var(--color-accent)`
- Warning: `#e06000` (unchanged)

### Buttons

**Primary (Split, Combine):**
- Background: `var(--color-accent)` (red)
- Color: `#ffffff`
- Border: none
- Hover: `#ff1a1a` (slightly brighter red)
- Disabled: `opacity: 0.3`, `cursor: not-allowed`

**Secondary (Print, Copy, Add Share):**
- Background: transparent
- Color: `#cccccc`
- Border: `1px solid var(--color-dim)` (`#333`)
- Hover: border-color `#888`, color `#fff`
- Disabled: `opacity: 0.3`

**Small (per-share Copy, Save PDF):**
- Background: transparent
- Color: `var(--color-secondary)` (`#555`)
- Border: `1px solid var(--color-border)` (`#2a2a2a`)
- Hover: color `#ccc`, border-color `var(--color-secondary)`

**Close (modal):**
- Color: `var(--color-text)`
- Hover: `var(--color-accent)`

### Share Cards (Split output)
- Background: `var(--color-surface)` (`#111`)
- Border: `1px solid var(--color-light-border)` (`#222`)
- Border-radius: `6px`
- Padding: `20px`
- Share label: `var(--color-secondary)`
- QR canvas: no wrapper needed — canvas already renders white cells; the dark card surface provides natural contrast
- Share hex text: `var(--color-accent)` (`#e00000`), monospace, `opacity: 0.8`
- Share hex hover: `opacity: 1`
- Copied tooltip: background `var(--color-text)`, color `var(--color-bg)`

### Share Slots (Combine mode)
- Background: `var(--color-surface)` (`#111`)
- Border: `1px solid var(--color-light-border)` (`#222`)
- Border-radius: `6px`
- Header border-bottom: `1px solid var(--color-light-border)`
- Header label: `var(--color-secondary)`
- Status "valid": `#00aa00` (brighter green for dark bg readability)
- Status "invalid": `var(--color-accent)`
- Inner input: recessed field style (same as above)
- Input placeholder font-family/size: unchanged

### Recovered Secret
- Textarea: recessed field style with `border-radius: 4px`, padding `12px`
- Read-only border: `var(--color-light-border)`
- Hint text: `var(--color-secondary)`, italic

### Camera Modal
- Overlay: `rgba(0, 0, 0, 0.85)` (darker to match theme)
- Modal content background: `var(--color-surface)` (`#111`)
- Header border: `1px solid var(--color-raised)`
- Header text: `var(--color-secondary)`
- Video background: `#000` (unchanged)

### Footer
- Border-top: `1px solid var(--color-light-border)`
- Text: `var(--color-dim)` (`#333`)

### Output Section Headers
- h2: `var(--color-secondary)`, unchanged size/weight
- Dividers: `var(--color-light-border)`

## Print Styles

No changes. Print remains white background for ink economy and QR scanability. The entire `@media print` block is preserved as-is.

## Scope Exclusions

- No HTML structure changes
- No JavaScript changes
- No new CSS classes needed (all changes are to existing selectors)
- No responsive breakpoint changes
- No font changes (same Helvetica Neue stack)
- No animation/transition timing changes (keep 0.15s)

## Implementation Notes

- This is a single-file change: `sssa-web/css/style.css`
- The QR canvas renders its own white background — no wrapper needed. The dark card surface provides natural contrast.
- Share hex color change (to red) requires a CSS change to `.share-text` color. The existing hover behavior (color change) should shift to an opacity change instead since color is now accent-red.
- The `border-radius: 6px` on cards and inputs is the only new geometric property. Everything else is color/background swaps.
- New CSS variables (`--color-surface`, `--color-input`, `--color-raised`, `--color-text-heading`, `--color-dim`) are additive — existing variables are updated in place, new ones are added.
