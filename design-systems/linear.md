# Linear Design System Preset

Inspired by Linear's industry-leading software craft, high-contrast dark graphite palette, keyboard accessibility, and subtle micro-interactions.

## Color Tokens
```css
:root {
  --bg-primary: #08090a;
  --bg-secondary: #0f1012;
  --bg-tertiary: #17181c;
  --bg-surface: #1e1f24;
  
  --border-subtle: rgba(255, 255, 255, 0.06);
  --border-medium: rgba(255, 255, 255, 0.12);
  --border-strong: rgba(255, 255, 255, 0.20);
  
  --text-primary: #f7f8f8;
  --text-secondary: #8a8f98;
  --text-tertiary: #62666d;
  
  --accent-brand: #5e6ad2;
  --accent-hover: #6875e2;
  --accent-subtle: rgba(94, 106, 210, 0.15);
  
  --status-success: #4cb782;
  --status-warning: #f59e0b;
  --status-error: #ef4444;
}
```

## Typography & Spacing
- **Font Stack**: `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
- **Scale**: `12px` (captions/tags), `13px` (subtext), `14px` (body/inputs), `16px` (modal headers), `20px` (section headers), `28px` (page headers)
- **Border Radius**: Inputs/Buttons: `6px`; Cards/Modals: `10px`
- **Shadows**: Clean, sharp, multi-layered dark shadows:
  ```css
  box-shadow: 0 1px 1px rgba(0, 0, 0, 0.4), 0 4px 12px rgba(0, 0, 0, 0.3);
  ```

## Motion & Micro-Interactions
- **Transition**: `cubic-bezier(0.16, 1, 0.3, 1)` for snappy, physical spring ease.
- **Button Hover**: Subtle brightness increase, zero jarring layout shifts, `150ms` ease.
- **Keyboard Shortcuts**: Every action must support a 1-key or 2-key command shortcut.
