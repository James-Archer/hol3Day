// Scans photos/<library>/<set>/* and writes manifest.json describing each library's sets and sorted image lists.
import { readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const PHOTOS_DIR = 'photos';
const OUTPUT_FILE = 'manifest.json';
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

function subDirs(dir) {
  return readdirSync(dir).filter((name) => statSync(join(dir, name)).isDirectory());
}

function isImage(filename) {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
}

function humanize(id) {
  return id.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildManifest() {
  let libraryDirs = [];
  try {
    libraryDirs = subDirs(PHOTOS_DIR);
  } catch {
    // photos/ doesn't exist yet - emit an empty manifest.
    return { libraries: [] };
  }

  const libraries = libraryDirs
    .sort((a, b) => a.localeCompare(b))
    .map((libraryId) => {
      const libraryPath = join(PHOTOS_DIR, libraryId);
      const sets = subDirs(libraryPath)
        .sort((a, b) => a.localeCompare(b))
        .map((setId) => {
          const images = readdirSync(join(libraryPath, setId))
            .filter(isImage)
            .sort((a, b) => a.localeCompare(b));
          return { id: setId, name: humanize(setId), images };
        })
        .filter((set) => set.images.length > 0);
      return { id: libraryId, name: humanize(libraryId), sets };
    })
    .filter((library) => library.sets.length > 0);

  return { libraries };
}

const manifest = buildManifest();
writeFileSync(OUTPUT_FILE, JSON.stringify(manifest, null, 2) + '\n');
console.log(`Wrote ${OUTPUT_FILE}: ${manifest.libraries.length} librar(y/ies).`);
