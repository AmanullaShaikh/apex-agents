# Raycast Density Design System Preset

Inspired by Raycast's hyper-dense command palette, zero-latency feedback, keyboard navigation, and dark glass aesthetics.

## Color Tokens
```css
:root {
  --bg-window: rgba(20, 20, 22, 0.85);
  --bg-selected: rgba(255, 255, 255, 0.08);
  --bg-badge: rgba(255, 255, 255, 0.1);
  
  --border-window: rgba(255, 255, 255, 0.1);
  --border-item: rgba(255, 255, 255, 0.05);
  
  --text-primary: #ededed;
  --text-secondary: #8e8e93;
  --text-dimmed: #636366;
  
  --accent-red: #ff6363;
  --accent-cyan: #54d6ff;
  --accent-amber: #ffb340;
}
```

## Layout & Interaction Constraints
- **Zero Layout Shifts**: Strict fixed row heights (40px per item) with overflow truncation (`text-overflow: ellipsis; white-space: nowrap;`).
- **Keyboard Navigation**: Full arrow-key up/down selection with instantaneous visual state shift (zero animation lag on selection).
- **Shortcut Badges**: Monospace keys styled with subtle background badges (`K`, `Enter`, `Esc`).
