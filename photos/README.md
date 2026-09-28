Add your library folders here, each containing one or more sets, e.g.:

```
photos/
  backyard/
    set-1/
      01.jpg
      02.jpg
      03.jpg
    set-2/
      01.jpg
      02.jpg
```

A "set" is one horizontal sweep of photos of the same subject. A "library" can hold
multiple sets (e.g. different angles or times of day) that you switch between with
the Set buttons in the viewer.

Then run `npm run build:manifest` to regenerate manifest.json for local testing
(the GitHub Actions workflow regenerates it automatically on push).
