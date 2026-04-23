# Fullscreen Timer

Fullscreen Timer is a simple presentation-friendly timer with stopwatch and countdown modes.

![animation](docs/animate.gif)

Try the online version at [djsutherland.github.io/fullscreen-timer](https://djsutherland.github.io/fullscreen-timer/).

## Development

Install dependencies and start the app locally with:

```bash
npm install
npm run dev
```

Create a production build with:

```bash
npm run build
```

Run the test suite with:

```bash
npm test
```

Deployment runs through GitHub Actions. Pushes to `main` run tests, build the app, and publish `dist/` to GitHub Pages.

## Keyboard Shortcut

- <kbd>F</kbd> toggles fullscreen mode.
- <kbd>←</kbd> <kbd>→</kbd> <kbd>↑</kbd> <kbd>↓</kbd> edits the timer.
- <kbd>Enter</kbd> toggles the active edit position.
- <kbd>R</kbd> resets the timer.
- <kbd>S</kbd> switches between countdown and stopwatch mode.
- <kbd>T</kbd> opens direct time entry.
- <kbd>Space</kbd> starts or pauses the timer.

## Licence

[MIT](./LICENSE)
