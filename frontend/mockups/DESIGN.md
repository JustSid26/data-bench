---
name: DataBench
colors:
  surface: '#121315'
  surface-dim: '#121315'
  surface-bright: '#38393b'
  surface-container-lowest: '#0d0e10'
  surface-container-low: '#1b1c1e'
  surface-container: '#1f2022'
  surface-container-high: '#292a2c'
  surface-container-highest: '#343537'
  on-surface: '#e3e2e5'
  on-surface-variant: '#c7c4d8'
  inverse-surface: '#e3e2e5'
  inverse-on-surface: '#303033'
  outline: '#918fa1'
  outline-variant: '#464555'
  surface-tint: '#c3c0ff'
  primary: '#c3c0ff'
  on-primary: '#1d00a5'
  primary-container: '#4f46e5'
  on-primary-container: '#dad7ff'
  inverse-primary: '#4d44e3'
  secondary: '#c3c0ff'
  on-secondary: '#2a276a'
  secondary-container: '#413f82'
  on-secondary-container: '#b0aef9'
  tertiary: '#ffb695'
  on-tertiary: '#571f00'
  tertiary-container: '#a44100'
  on-tertiary-container: '#ffd2be'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e2dfff'
  primary-fixed-dim: '#c3c0ff'
  on-primary-fixed: '#0f0069'
  on-primary-fixed-variant: '#3323cc'
  secondary-fixed: '#e2dfff'
  secondary-fixed-dim: '#c3c0ff'
  on-secondary-fixed: '#140f54'
  on-secondary-fixed-variant: '#413f82'
  tertiary-fixed: '#ffdbcc'
  tertiary-fixed-dim: '#ffb695'
  on-tertiary-fixed: '#351000'
  on-tertiary-fixed-variant: '#7b2f00'
  background: '#121315'
  on-background: '#e3e2e5'
  surface-variant: '#343537'
typography:
  headline-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  table-data:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-xs:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  sidebar-width: 220px
  gutter: 16px
  container-padding: 24px
  cell-padding-x: 12px
  cell-padding-y: 8px
---

## Brand & Style

The design system is engineered for high-performance data workflows, emphasizing a "Data-First" philosophy. It draws heavily from **Minimalism** and **Modern Corporate** aesthetics, specifically optimized for desktop usage where density and precision are paramount.

The brand personality is clinical, reliable, and unobtrusive. It seeks to reduce cognitive load by using a neutral foundation, allowing the user's data to be the primary visual focus. The interface utilizes a high-fidelity execution characterized by "hairline" precision, subtle tonal shifts instead of heavy shadows, and a structured layout that balances expansive workspace with high-density information display.

## Colors

The system employs a dual-theme architecture designed for long-form analytical work.

### Theme Specifications
- **Light Mode**: Utilizes `#FAFAFA` for the global workspace background and `#FFFFFF` for elevated surfaces (cards, modals). Borders should use a subtle gray (10% opacity black).
- **Dark Mode**: Utilizes `#0B0C0E` for the background and `#141619` for surfaces. Borders use a subtle silver (15% opacity white).
- **Accent**: The primary indigo `#4F46E5` is reserved strictly for high-priority actions and active selection states.

### Semantic Data Colors
Data type indicators use a specific palette to ensure cross-table consistency:
- **Numeric**: Blue
- **Categorical**: Purple
- **Boolean**: Green
- **Datetime**: Amber
- **Text**: Grey
- **Identifier**: Slate
- **Constant/Empty**: Faded Red

## Typography

This design system uses **Inter** exclusively to maintain a systematic, utilitarian aesthetic. 

The core of the system is the `table-data` style, which leverages OpenType features to enable **Tabular Numerals** (`tnum`). This ensures that columns of numbers align perfectly for visual scanning. 

- Use **Regular (400)** weight for standard data entry and body text.
- Use **Medium (500)** or **Semi-Bold (600)** for column headers and UI labels.
- For information-dense views, line heights are kept tight (approx 1.3x) to maximize vertical real estate.

## Layout & Spacing

The layout is designed for a desktop workbench experience with a persistent **220px left sidebar** for navigation and resource management.

- **The Workbench**: A fluid main content area that expands to the full viewport width.
- **The Card Model**: Major functional modules (SQL editor, Table preview, Chart builder) are housed in cards with 24px external margins to create "calm" whitespace between sections.
- **Internal Density**: Within cards and tables, padding is reduced (`cell-padding`) to ensure high data density.
- **Grid**: A standard 8px-based spacing system is used for all layout offsets.

## Elevation & Depth

This design system eschews traditional drop shadows in favor of **Tonal Layering** and **Hairline Borders**.

- **Depth**: Conveyed through color value changes (e.g., a darker background with slightly lighter cards in Dark Mode).
- **Borders**: All interactive elements and containers feature a 1px solid border. In Dark Mode, these should be low-contrast (e.g., `rgba(255,255,255,0.1)`).
- **Z-Index**: Modals or dropdowns may use a "border-only" elevation, appearing to float through a slightly higher contrast border or a subtle 10% backdrop dimming rather than a heavy shadow.

## Shapes

The shape language is structured and professional.
- **Containers & Cards**: Use a consistent 8px radius (`rounded-lg` per variables).
- **Inputs & Buttons**: Follow the 8px standard to maintain a unified look.
- **Data Badges**: Use "Pill" shapes (full rounding) to visually distinguish metadata from clickable UI buttons or input fields.

## Components

### Buttons & Inputs
- **Primary Button**: Solid Indigo `#4F46E5` with white text. 8px radius.
- **Secondary/Ghost Button**: Transparent background, 1px border.
- **Text Inputs**: 1px border, 8px radius. Active state indicated by a 1px Indigo border and a subtle 2px Indigo outer glow (0% blur).

### Data Badges (Pills)
- Used for column types (e.g., "Numeric", "String").
- Styling: Small, uppercase text, pill-shaped.
- Backgrounds: 10% opacity of the assigned semantic color; text is the 100% saturation of that color.

### Data Tables
- **Header**: Sticky top, Medium weight text, subtle bottom border.
- **Rows**: Alternating stripes are avoided; use a subtle hover state (`#FFFFFF05`) to track lines.
- **Cells**: Use `table-data` typography. Right-align numeric columns; left-align text/id columns.

### Sidebar
- Permanent 220px width.
- Background should be the base color (Light: `#FAFAFA`, Dark: `#0B0C0E`).
- Nav items use a 4px left-accent bar or subtle background fill when active.