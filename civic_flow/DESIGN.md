---
name: Civic Flow
colors:
  surface: '#fff8f5'
  surface-dim: '#fdd2ae'
  surface-bright: '#fff8f5'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#fff1e8'
  surface-container: '#ffeadb'
  surface-container-high: '#ffe3cd'
  surface-container-highest: '#ffdcbf'
  on-surface: '#2c1602'
  on-surface-variant: '#41474e'
  inverse-surface: '#442b12'
  inverse-on-surface: '#ffeee1'
  outline: '#72787f'
  outline-variant: '#c1c7cf'
  surface-tint: '#2f6388'
  primary: '#003b5a'
  on-primary: '#ffffff'
  primary-container: '#1a5276'
  on-primary-container: '#94c5ee'
  inverse-primary: '#9bccf6'
  secondary: '#006b58'
  on-secondary: '#ffffff'
  secondary-container: '#99f4da'
  on-secondary-container: '#00725d'
  tertiary: '#622400'
  on-tertiary: '#ffffff'
  tertiary-container: '#873400'
  on-tertiary-container: '#ffac86'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#cbe6ff'
  primary-fixed-dim: '#9bccf6'
  on-primary-fixed: '#001e30'
  on-primary-fixed-variant: '#0e4b6e'
  secondary-fixed: '#99f4da'
  secondary-fixed-dim: '#7dd7be'
  on-secondary-fixed: '#002019'
  on-secondary-fixed-variant: '#005142'
  tertiary-fixed: '#ffdbcc'
  tertiary-fixed-dim: '#ffb695'
  on-tertiary-fixed: '#351000'
  on-tertiary-fixed-variant: '#7b2f00'
  background: '#fff8f5'
  on-background: '#2c1602'
  surface-variant: '#ffdcbf'
typography:
  headline-lg:
    fontFamily: Public Sans
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Public Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  headline-md:
    fontFamily: Public Sans
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-bold:
    fontFamily: Public Sans
    fontSize: 14px
    fontWeight: '700'
    lineHeight: 20px
    letterSpacing: 0.05em
  status-badge:
    fontFamily: Public Sans
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 16px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  touch-target: 48px
  container-margin: 20px
  gutter: 16px
---

## Brand & Style
The brand personality is rooted in reliability, community stewardship, and civic duty. It is designed to feel like a public utility—permanent, dependable, and accessible to all residents regardless of technical proficiency.

The design style follows a **Modern-Functional** approach with a focus on high legibility and clear information hierarchy. It avoids ephemeral trends like glassmorphism or complex depth in favor of a flat, structured UI that mimics physical signage and official documentation. The emotional response should be one of confidence and agency, encouraging users to participate in the preservation of their village's most vital resource.

## Colors
The palette is inspired by natural water sources and the earth. 

- **Primary (Deep Blue):** Used for headers, primary actions, and branding to establish authority.
- **Secondary (Teal):** Used for success states, environmental indicators, and water-related data.
- **Tertiary (Terracotta):** Reserved for urgent alerts, warnings, and high-contrast call-to-actions.
- **Neutral (Sand):** Used as a subtle background tint and for secondary containers to soften the UI and prevent eye strain.

We strictly avoid pure black (#000000) to maintain a warmer, more organic feel, opting instead for a deep navy-charcoal for text. High contrast ratios (minimum 4.5:1) are maintained across all functional elements.

## Typography
The typography system prioritizes extreme clarity and ease of reading. 

**Public Sans** provides a sturdy, institutional feel for headings and labels. **Atkinson Hyperlegible Next** is utilized for all body copy and form descriptions to ensure maximum accessibility for older users or those with visual impairments. 

Line heights are generous to prevent text "crowding." For mobile devices, headline sizes scale down slightly to ensure headers don't wrap awkwardly while maintaining a strong visual anchor at the top of pages.

## Layout & Spacing
The layout uses a **fluid grid** model optimized for handheld devices. 

- **Mobile:** 4-column grid with 20px margins.
- **Tablet/Desktop:** 12-column grid with a max-width of 1024px.

A strict 4px baseline rhythm is used. Vertical spacing between different sections is kept wide (40px) to clearly demarcate separate tasks or information blocks. All interactive elements must adhere to a minimum **48px touch target** to accommodate users with varying levels of motor precision.

## Elevation & Depth
This design system intentionally avoids shadows and blurs to maintain a "printed" or "physical sign" aesthetic. 

Depth is conveyed through **Tonal Layering** and **High-Contrast Outlines**:
- **Background:** Sand tint (#FCF9F5).
- **Cards/Containers:** Pure white (#FFFFFF) with a 1px solid border in a muted neutral-gray (#D5D8DC).
- **Active States:** Elements use a thicker 2px border or a solid color fill rather than a shadow to indicate they are "raised" or selected.

This flat approach ensures the app remains performant on lower-end devices and stays legible in bright outdoor sunlight.

## Shapes
The shape language is conservative and professional. 

We use a **Soft** (4px) corner radius for most UI components (buttons, input fields, cards). This provides a friendly touch without losing the serious, civic-minded character of the application. Status badges and tags use a slightly more rounded 8px corner to distinguish them from interactive buttons. Icons should follow a consistent 2px stroke width with square caps to match the geometry of the containers.

## Components
- **Buttons:** Primary buttons are solid Deep Blue with white text. Secondary buttons are outlined with a 2px Teal border. Large, full-width buttons are preferred on mobile for reporting water issues.
- **Status Tags:** 
    - *Pending:* Terracotta background with white text, using a clock icon.
    - *Solved:* Secondary Teal background with white text, using a checkmark icon.
- **Input Fields:** Large text inputs (min-height 56px) with permanent labels above the field (no floating labels) to aid recall. 1px borders turn 2px Deep Blue on focus.
- **Civic Cards:** Used for listing local water reports. They contain a bold headline, a status badge in the top right, and a "last updated" timestamp at the bottom.
- **Progress Steppers:** Simple horizontal bars used in reporting flows to show the user how many steps remain (e.g., Photo > Location > Description).
- **Icons:** Simple, 24px line icons. Use universal symbols (leak = water droplet with slash; location = pin) to bridge gaps in digital literacy.