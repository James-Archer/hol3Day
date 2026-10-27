# 3D Photo Viewer

Static WebXR site for viewing series-shot photos as stereo 3D pairs on Meta Quest 3, using the [`stereo-img`](https://github.com/steren/stereo-img) web component.

## Adding photos

Photos are organized into libraries, each containing one or more sets. A "set" is a
folder of photos taken from a horizontal sweep of the same subject:

```
photos/
  <library-name>/
    <set-name>/
      01.jpg
      02.jpg
      03.jpg
      ...
```

Filenames just need to sort in shooting order (e.g. `01.jpg`, `02.jpg`, ...).

## How viewing works

Pick a library, then use the controls to navigate:

- **◀ Set / Set ▶** — switch to the previous/next set within the library.
- **Shift ◀ / Shift ▶** — move both photos forward/back together, keeping the same gap (`1&2 → 2&3`).
- **Contract − / Expand +** — narrow or widen the gap between the two photos (`1&2 → 1&3`), which changes the apparent 3D depth/parallax.

The `stereo-img` component adds its own "Enter VR" button for immersive viewing in the Meta Quest Browser.

## Controls while in VR

Once immersive, the page's HTML buttons aren't rendered to the headset, so navigation switches to the controllers:

- **Left trigger / Right trigger** — shift the pair back/forward (same as Shift ◀ / Shift ▶).
- **Left squeeze / Right squeeze** — switch to the previous/next set (same as ◀ Set / Set ▶).
- **Squeeze both grips at once** — exit VR (the "Exit VR" button is hidden too, so this is the only way back to 2D from inside the headset).

## Local testing

```bash
npm run build:manifest   # scans photos/ and writes manifest.json
npx http-server .        # or any static file server
```

Open the printed URL in a desktop browser to check the scene picker and controls. Full VR (`Enter VR` button on a Quest) requires a secure context, so test that part against the deployed GitHub Pages URL rather than a local plain-HTTP server.

## Deployment

A GitHub Actions workflow (`.github/workflows/deploy.yml`) regenerates `manifest.json` and deploys the site on every push to `main`. One-time setup: in the repo's **Settings → Pages**, set **Source** to **GitHub Actions**.
