# Design system ("Microsoft Fluent"-like, warm brand)

- **Brand:** orange mascot square with two dark eyes (`.mark`), orange `#ff5b14`. Orange = brand + "New note"/primary create + Export backup. Blue `#1b5ef7` (dark `#6e98ff`) = interactive/selected states.
- **Header:** `--grad-head` warm orange (left ~35 %) melting into blue (~65 %) over a subtle `--grid`.
- **Surfaces:** canvas `--bg #eef0f5`, cards `--card #fff`, `--panel #f7f8fb`, hairlines `--line #dde1ea` / `--line2`; shadows `--sh-1/2/3`. Radii 8–16 px.
- **Type:** system Segoe UI / sans (`--sans`, `--display`); note paper text keeps a mono font.
- **Status colours:** open orange, done green, urgent red, highlight yellow, links pink, element violet — each has `-tint` / `-ink`.
- **Dark mode:** slate surfaces (not black), pastel status inks, deeper ember→indigo header; paper notes keep their colours.
- **Buttons:** `.btn` (blue gradient), `.btn.new` (orange gradient), `.btn.line` (outlined), `.btn.danger` (red outline).
- Respect `prefers-reduced-motion` for every animation.
- Visual references: `docs/images`, guetix.com `public/design/image copy 4.png`, `image copy 5.png`.
