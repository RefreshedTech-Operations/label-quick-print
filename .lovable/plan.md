

## Mobile-Friendly Pack Page Redesign

The current layout has excessive padding, cards with heavy borders, a large header, and a table that doesn't work well on narrow screens. Here's the plan:

### Changes to `src/pages/Pack.tsx`

1. **Compact header** — Shrink from `text-3xl` to `text-xl`, remove subtitle text, make it a single line with the station badge inline.

2. **Inline station selector** — Remove the station Card wrapper entirely. Show the station selector as a simple dropdown directly below the header, no card/border. If a station is already selected (persisted in localStorage), collapse it into a small pill that can be tapped to change.

3. **Scan area as the hero** — Make the scan input/camera the dominant element. Remove the Card wrapper; use the full-screen flash color effect on the outer container instead. Increase input height for easier tapping.

4. **Replace table with stacked cards for recent packs** — On mobile, the 4-column table is cramped. Replace with a simple stacked list showing buyer + product on one line, tracking + time on a second line. Keep it compact.

5. **Reduce spacing** — Change `space-y-6` to `space-y-3`, reduce container padding from `p-4` to `p-3`.

6. **Always show camera toggle on mobile** — Already conditional on `isMobile`, keep that but make the button more prominent (full-width toggle).

### No backend or routing changes needed — purely UI refactoring within `Pack.tsx`.

