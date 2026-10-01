# BFFA Money Check: Design System ("Playful Geometric, BFF-branded")

## Role
You are a senior frontend engineer and visual designer. Apply this design system to the app. Do not ask clarifying questions; everything needed is below. Make deliberate, distinctive choices (layout, motion, typography) instead of generic boilerplate UI. Leave the codebase cleaner than you found it: centralized tokens, reusable components, no one-off styles.

## Product context
Money Check is a financial literacy diagnostic for grades 6-8, run during BFF of America chapter workshops. Students type NUMERIC ESTIMATES for realistic money scenarios. The product is numbers, so numbers must always be the clearest thing on screen. Audience is 11-14 years old on phones and school Chromebooks.

## Philosophy
"Stable grid, wild decoration." Content (text, numbers, forms) lives in clean readable zones. Decoration lives in the margins and on non-task screens. Playful, tactile, sticker-book feel inspired by Memphis design, cleaned up for modern screens. It should feel like a game round, not a form.

## Visual signatures
- Hard offset shadows with no blur (sticker/cut-paper feel)
- 2px dark borders on cards, buttons, and inputs
- Primitive shapes (circles, triangles, squares, pills, squiggles) as decoration
- Pattern fills (dots, diagonal stripes) in margins only
- Mixed radii for asymmetric "blob" and "speech bubble" shapes
- Coin motif in BFF gold: progress = coin stack filling, submit = coin stamp

## Tokens (single source of truth: one tokens file, no raw hex anywhere else)
Colors:
- background: #FFFDF5 (warm cream)
- foreground: #1E293B
- muted: #F1F5F9
- mutedForeground: #64748B
- primary: #0077b5 (BFF Ledger Blue), text on it is white
- tertiary: #fece66 (BFF Lobby Gold), text on it is ALWAYS dark #1E293B, never white
- secondary: #F472B6 (pink) and quaternary: #34D399 (mint): decorative fills and shadows only, never as a background for white text
- border: #E2E8F0, input border: #CBD5E1, card: #FFFFFF, ring: #0077b5
- Verify the primary blue and gold against bffamerica's live site before finalizing.
- Verify WCAG AA numerically for every text/background pair and fix failures. Never rely on color alone for meaning.

Typography:
- Headings: "Outfit" 700-800
- Body: "Plus Jakarta Sans" 400-500
- ALL numbers use tabular numerals (font-variant-numeric: tabular-nums)
- Scale ratio 1.25. Minimum body size 16px.

Radius: sm 8, md 16, lg 24, full 9999. Border width 2px.
Shadows: pop 4px 4px 0 #1E293B; hover 6px 6px 0; active 2px 2px 0. Mobile pop shadow 2px.

## Components (build these once, use everywhere)
- Button (primary "candy": blue, pill, 2px dark border, pop shadow, lifts on hover, presses on active; secondary: transparent, fills gold on hover; min height 48px)
- Card ("sticker": white, 2px border, rounded-xl, hard shadow in #E2E8F0 or pink for featured)
- Input (white, 2px border; focus = blue border plus hard blue shadow; label bold, uppercase, small, tracked)
- NumberDisplay + Keypad (see below)
- ProgressCoins (coin-stack progress bar, always visible during items)
- StatTile (big tabular number, count-up animation, label, sticker border)
- ChartCard (sticker card wrapping a chart; always shows title, n, and date)
- Icon: Lucide, strokeWidth 2.5, round caps/joins, always inside a colored circle, never floating alone

## Number zones (critical)
The item screen is a plain white card with a huge live-formatted $ display and a custom on-screen keypad (also accept native inputMode="decimal" for accessibility and hardware keyboards). No patterns, confetti, rotating, or wiggling elements inside or behind this zone. Decoration only in margins.

## Motion
- Spring "pop" on screen entry and button press (cubic-bezier(0.34,1.56,0.64,1))
- Count-up on stat numbers; coin stamp on submit
- Item-to-item transition under 300ms
- No hover wiggle or rotation on quiz elements. Wiggle allowed only on landing/done screens.
- Respect prefers-reduced-motion: disable bounce, wiggle, and count-up.

## Signature screens (design these first)
1. Item screen: question card, giant number display, keypad, coin progress.
2. Reveal (after the last item): a log-scale number line showing "your guess" vs "the real number" with the gap animating in, then a one-line explanation. This screen is also filmed for the DECA presentation video, so it must look great in a screen capture.

## Analysis view
Same tokens, denser layout, reduced decoration. StatTiles with count-up on top, then ChartCards. Every chart is screenshot-ready (title, n, date, legible at presentation size). Gold highlights the headline finding (the item with the largest median error).

## Layout and responsive
- Container max-w-6xl on desktop; student flow is a single centered column max ~480px
- Mobile-first: stack everything, 48px+ tap targets, shadows 2px, hide floating shapes that could overlap text
- BFF logo on landing and footer

## Accessibility
Visible high-contrast focus states (thick blue border plus hard shadow), semantic HTML, labels on every input, keyboard-operable keypad, reduced-motion support, error messages in text plus icon (not color alone).
