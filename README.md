# roulette-game

Configurable prize wheel with inventory management, persistent history, and CSV export.
Built with vanilla HTML, CSS, and JavaScript — no server or build step required.

## Stack

- Vanilla HTML5 · CSS3 · JavaScript (ES6+)
- Canvas API (wheel drawing, confetti)
- Web Audio API (tick and win sound effects)
- localStorage (segment configuration and winner log)

## Features

- **Prize management** — configure segments with name, color, image URL, weight, and stock level
- **Weighted spin** — higher-weight segments are proportionally more likely to be selected; depleted segments are automatically excluded
- **Spin animation** — guaranteed 10–13 full rotations with easeOutCubic easing
- **Stock tracking** — reduces stock on each win; options to skip or auto-remove depleted prizes
- **History** — last 10 winners displayed on screen; full log (up to 2 500 entries) persisted in localStorage
- **CSV export** — downloads the complete winner log with timestamps
- **Keyboard shortcuts** — `F2` toggles between setup and play screens, `E` exports the CSV
- **Fullscreen mode** — single button to expand to full viewport

## Running

Open `index.html` in a browser. Configuration is saved automatically in localStorage
between sessions.
