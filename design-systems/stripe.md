# Stripe Design System Preset

Inspired by Stripe's financial-grade precision, high-contrast typography, crisp layered elevations, and vibrant animated accents.

## Color Tokens
```css
:root {
  --bg-primary: #ffffff;
  --bg-secondary: #f6f9fc;
  --bg-tertiary: #e3e8ee;
  
  --border-subtle: #e3e8ee;
  --border-focus: #635bff;
  
  --text-primary: #0a2540;
  --text-secondary: #425466;
  --text-muted: #697386;
  
  --accent-brand: #635bff;
  --accent-hover: #0a2540;
  --accent-cyan: #00d4ff;
  
  --status-success: #00d924;
  --status-error: #df1b41;
}
```

## Typography & Elevation
- **Font Stack**: `sohne-var, "Helvetica Neue", Arial, sans-serif`
- **Scale**: `13px` (labels/hints), `15px` (body), `18px` (subtitles), `24px` (cards), `36px` (hero headers)
- **Border Radius**: `4px` to `8px`
- **Elevation**:
  ```css
  box-shadow: 0 4px 6px -1px rgba(50, 50, 93, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  ```

## UI Craft Principles
- Extreme data clarity: numeric metrics, amounts, and dates are formatted with tabular figures (`font-variant-numeric: tabular-nums`).
- Input states: Explicit 2px focus rings with brand blue color glow.
