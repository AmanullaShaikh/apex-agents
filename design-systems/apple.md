# Apple Human Interface Guidelines (HIG) Preset

Inspired by Apple's Human Interface Guidelines: dynamic system typography, fluid spring animations, translucent materials, and strict accessibility.

## Color Tokens & Materials
```css
:root {
  --bg-primary: #000000;
  --bg-secondary: #1c1c1e;
  --bg-tertiary: #2c2c2e;
  
  --material-acrylic: rgba(30, 30, 30, 0.75);
  --material-blur: blur(20px);
  
  --border-hairline: rgba(255, 255, 255, 0.15);
  
  --text-primary: #ffffff;
  --text-secondary: rgba(235, 235, 245, 0.6);
  --text-tertiary: rgba(235, 235, 245, 0.3);
  
  --accent-blue: #0a84ff;
  --accent-green: #30d158;
  --accent-indigo: #5e5ce6;
  --accent-orange: #ff9f0a;
  --accent-pink: #ff375f;
  --accent-purple: #bf5af2;
  --accent-red: #ff453a;
}
```

## Typography & Fluid Layout
- **Font Stack**: `-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", sans-serif`
- **Dynamic Type**: Standardized hierarchical ratios maintaining comfortable tap targets (minimum 44x44px).
- **Border Radius**: Squircle-style continuous curves (`border-radius: 14px;`).
- **Spring Physics**: Mass 1, stiffness 100, damping 15 (`tension: 170, friction: 26`).
