# ThreatCaddy Desktop Wrapper

This folder contains a minimal Electron wrapper for ThreatCaddy so macOS can provide a truly transparent native window behind the app shell.

## What it enables

- Native transparent window on macOS
- ThreatCaddy's existing `Window opacity` and `Window blur` sliders can reveal the desktop behind the app
- Hidden inset title bar on macOS for a more app-like window

## Run in development

1. Install dependencies from the project root:

   ```sh
   pnpm install
   ```

2. Start the renderer in one terminal:

   ```sh
   pnpm desktop:dev:renderer
   ```

3. Start Electron in a second terminal:

   ```sh
   pnpm desktop:dev:main
   ```

## Run against a production build

1. Build the renderer:

   ```sh
   pnpm build
   ```

2. Launch the desktop shell:

   ```sh
   pnpm desktop:start
   ```

## Notes

- This wrapper is intentionally minimal. It is enough to prove the native-window path for real transparency.
- Browser extensions and standalone HTML files cannot provide the same desktop-behind-the-window effect on their own.
- On non-macOS platforms, the wrapper still runs, but the visual effect will depend on platform transparency support.
