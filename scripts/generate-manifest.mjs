// Scans photos/<scene>/* and writes manifest.json describing each scene's sorted image list.
import { readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const PHOTOS_DIR = 'photos';
const OUTPUT_FILE = 'manifest.json';
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

function isImage(filename) {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
}

function humanize(id) {
  return id.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildManifest() {
  let sceneDirs = [];
  try {
    sceneDirs = readdirSync(PHOTOS_DIR).filter((name) =>
      statSync(join(PHOTOS_DIR, name)).isDirectory()
    );
  } catch {
    // photos/ doesn't exist yet - emit an empty manifest.
    return { scenes: [] };
  }

  const scenes = sceneDirs
    .sort((a, b) => a.localeCompare(b))
    .map((id) => {
      const images = readdirSync(join(PHOTOS_DIR, id))
        .filter(isImage)
        .sort((a, b) => a.localeCompare(b));
      return { id, name: humanize(id), images };
    })
    .filter((scene) => scene.images.length > 0);

  return { scenes };
}

const manifest = buildManifest();
writeFileSync(OUTPUT_FILE, JSON.stringify(manifest, null, 2) + '\n');
console.log(`Wrote ${OUTPUT_FILE}: ${manifest.scenes.length} scene(s).`);
