const folderPicker = document.getElementById('folderPicker');
const librarySelect = document.getElementById('library-select');
const viewer = document.getElementById('viewer');
const controls = document.getElementById('controls');
const emptyState = document.getElementById('empty-state');
const statusEl = document.getElementById('status');
const prevSetBtn = document.getElementById('prev-set');
const nextSetBtn = document.getElementById('next-set');
const shiftBackBtn = document.getElementById('shift-back');
const shiftForwardBtn = document.getElementById('shift-forward');
const expandBtn = document.getElementById('expand');
const contractBtn = document.getElementById('contract');

let libraries = [];
let libraryId = null;
let setIndex = 0;
let left = 0;
let right = 1;

// Large photos can take a while to fetch/decode, and the stereo-img component
// has no way to report success/failure - so we validate loads ourselves and
// block overlapping navigation that was observed to leave it stuck mid-render.
const LOAD_TIMEOUT_MS = 25000;
let busy = false;
let loadToken = 0;
// File -> Blob, read once per file. stereo-img revokes every object URL it's
// given as soon as it finishes decoding it, so a fresh URL must be minted from
// this Blob on every display - reusing a URL across navigations always fails.
let fileBlobCache = new Map();

folderPicker.addEventListener('change', (event) => {
  const files = Array.from(event.target.files);
  
  // Clean up previous Object URLs to prevent memory leaks
  cleanupObjectUrls();
  libraries = [];
  const libMap = new Map();

  // Process and group files based on their relative folder path
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;

    // e.g. "photos/Vacation/Beach/img01.jpg"
    const pathParts = file.webkitRelativePath.split('/');
    
    const filename = pathParts.pop(); // "img01.jpg"
    const setName = pathParts.length > 0 ? pathParts.pop() : 'Default Set'; // "Beach"
    const libName = pathParts.length > 0 ? pathParts.join('/') : 'Default Library'; // "photos/Vacation"

    // Create library if it doesn't exist
    if (!libMap.has(libName)) {
      libMap.set(libName, { id: libName, name: libName, sets: new Map() });
    }
    const lib = libMap.get(libName);

    // Create set if it doesn't exist
    if (!lib.sets.has(setName)) {
      lib.sets.set(setName, { id: setName, name: setName, images: [] });
    }
    const set = lib.sets.get(setName);

    // Keep the File reference only - creating object URLs for every photo in
    // every set up front exceeded the browser's blob storage on large folders
    // and caused intermittent ERR_FILE_NOT_FOUND. URLs are created lazily instead.
    set.images.push({
      name: filename,
      file
    });
  }

  // Convert Maps to Arrays and sort them for consistent viewing
  for (const lib of libMap.values()) {
    const setsArray = Array.from(lib.sets.values());
    
    // Sort sets alphabetically
    setsArray.sort((a, b) => a.name.localeCompare(b.name));
    
    // Sort images within each set alphabetically
    setsArray.forEach(set => {
      set.images.sort((a, b) => a.name.localeCompare(b.name));
    });

    libraries.push({
      id: lib.id,
      name: lib.name,
      sets: setsArray
    });
  }

  // Sort libraries alphabetically
  libraries.sort((a, b) => a.name.localeCompare(b.name));

  populateLibrarySelect();
});

function cleanupObjectUrls() {
  fileBlobCache.clear();
}

// Reads a file's bytes into memory once (cached), but always mints a brand new
// object URL from the cached Blob - see fileBlobCache comment for why.
async function urlForFile(file) {
  let blob = fileBlobCache.get(file);
  if (!blob) {
    const buffer = await file.arrayBuffer();
    blob = new Blob([buffer], { type: file.type });
    fileBlobCache.set(file, blob);
  }
  return URL.createObjectURL(blob);
}

function populateLibrarySelect() {
  librarySelect.innerHTML = ''; // Clear existing options
  
  if (libraries.length === 0) {
    librarySelect.disabled = true;
    emptyState.textContent = 'No valid images found in the selected folder.';
    emptyState.hidden = false;
    viewer.hidden = true;
    controls.hidden = true;
    return;
  }

  for (const library of libraries) {
    const option = document.createElement('option');
    option.value = library.id;
    option.textContent = library.name;
    librarySelect.appendChild(option);
  }

  librarySelect.disabled = false;
  libraryId = libraries[0].id;
  setIndex = 0;
  resetPair();
  render();
}

librarySelect.addEventListener('change', () => {
  libraryId = librarySelect.value;
  setIndex = 0;
  resetPair();
  render();
});

function currentLibrary() {
  return libraries.find((library) => library.id === libraryId);
}

function currentSet() {
  return currentLibrary().sets[setIndex];
}

function resetPair() {
  left = 0;
  right = currentSet().images.length > 1 ? 1 : 0;
}

// stereo-img reads each blob URL itself (EXIF probe, then pixel decode) - an extra
// fetch() of ours beforehand was found to make that second internal read fail
// intermittently, so we no longer pre-validate and rely on the timeout below instead.

function timeout(ms, message) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms));
}

// stereo-img replaces its THREE.js group on every src change but never disposes
// the old geometry/textures, leaking GPU memory that eventually makes new,
// large photos fail to decode - free the previous pair's resources ourselves.
// Must only be called on a group that's already been detached from the scene -
// disposing the live group while it's still rendering spams "no image data" warnings.
function disposeStereoResources(group) {
  if (!group || typeof group.traverse !== 'function') return;
  try {
    group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const material of materials) {
        if (!material) continue;
        if (material.map) {
          material.map.dispose();
          material.map.image = null;
        }
        if (material.displacementMap) {
          material.displacementMap.dispose();
          material.displacementMap.image = null;
        }
        material.dispose();
      }
    });
  } catch (err) {
    console.warn('Could not dispose previous stereo image resources:', err);
  }
}

// Waits for the viewer's internal loading indicator to go true then false,
// rather than trusting a single read, since it may not have flipped on yet.
function waitForViewerReady(token) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + LOAD_TIMEOUT_MS;
    let sawLoading = false;
    (function poll() {
      if (token !== loadToken) return resolve();
      const loading = Boolean(viewer.loadingIndicator && viewer.loadingIndicator.visible);
      if (loading) sawLoading = true;
      if (sawLoading && !loading) return resolve();
      if (Date.now() > deadline) return reject(new Error('Timed out waiting for the viewer to finish loading.'));
      requestAnimationFrame(poll);
    })();
  });
}

async function loadPair(leftFile, rightFile) {
  const token = ++loadToken;
  busy = true;
  updateNavDisabled();
  statusEl.textContent = 'Loading photos…';
  // Captured now, disposed only once the new group below confirms it's detached.
  const previousGroup = viewer.stereoImageGroup;
  let leftUrl;
  let rightUrl;

  try {
    [leftUrl, rightUrl] = await Promise.all([urlForFile(leftFile), urlForFile(rightFile)]);
    if (token !== loadToken) return;

    viewer.src = leftUrl;
    viewer.setAttribute('src-right', rightUrl);

    await Promise.race([
      waitForViewerReady(token),
      timeout(LOAD_TIMEOUT_MS, 'Timed out loading photos.'),
    ]);
    if (token !== loadToken) return;

    disposeStereoResources(previousGroup);
    updateStatusText();
  } catch (err) {
    if (token !== loadToken) return;
    console.error('Failed to display stereo pair:', err);
    statusEl.textContent = 'Could not load this photo pair (see console for details). Try again.';
  } finally {
    // stereo-img already revokes these itself on success; revoking an
    // already-revoked URL is a harmless no-op, so this just covers error paths.
    if (leftUrl) URL.revokeObjectURL(leftUrl);
    if (rightUrl) URL.revokeObjectURL(rightUrl);
    if (token === loadToken) {
      busy = false;
      updateNavDisabled();
    }
  }
}

function updateNavDisabled() {
  if (libraries.length === 0) return;
  const library = currentLibrary();
  const set = currentSet();
  const images = set.images;
  prevSetBtn.disabled = busy || setIndex === 0;
  nextSetBtn.disabled = busy || setIndex === library.sets.length - 1;
  shiftBackBtn.disabled = busy || left === 0;
  shiftForwardBtn.disabled = busy || right === images.length - 1;
  expandBtn.disabled = busy || right === images.length - 1;
  contractBtn.disabled = busy || right === left + 1;
}

function updateStatusText() {
  const library = currentLibrary();
  const set = currentSet();
  const images = set.images;
  statusEl.textContent =
    `Set "${set.name}" (${setIndex + 1} of ${library.sets.length}) — ` +
    `photos ${left + 1} & ${right + 1} of ${images.length} (gap: ${right - left})`;
}

function render() {
  if (libraries.length === 0) return;

  const set = currentSet();
  const images = set.images;

  // Handle cases where a folder doesn't have enough photos for a stereo pair
  if (images.length < 2) {
    viewer.hidden = true;
    controls.hidden = true;
    emptyState.textContent = `The set "${set.name}" needs at least two photos to form a stereo pair.`;
    emptyState.hidden = false;
    return;
  }

  emptyState.hidden = true;
  viewer.hidden = false;
  controls.hidden = false;

  updateNavDisabled();
  loadPair(images[left].file, images[right].file);
}

function prevSet() {
  if (busy || setIndex === 0) return;
  setIndex -= 1;
  resetPair();
  render();
}

function nextSet() {
  if (busy || setIndex === currentLibrary().sets.length - 1) return;
  setIndex += 1;
  resetPair();
  render();
}

function shiftBack() {
  if (busy || left === 0) return;
  left -= 1;
  right -= 1;
  render();
}

function shiftForward() {
  const images = currentSet().images;
  if (busy || right === images.length - 1) return;
  left += 1;
  right += 1;
  render();
}

function expandGap() {
  const images = currentSet().images;
  if (busy || right === images.length - 1) return;
  right += 1;
  render();
}

function contractGap() {
  if (busy || right === left + 1) return;
  right -= 1;
  render();
}

prevSetBtn.addEventListener('click', prevSet);
nextSetBtn.addEventListener('click', nextSet);
shiftBackBtn.addEventListener('click', shiftBack);
shiftForwardBtn.addEventListener('click', shiftForward);
expandBtn.addEventListener('click', expandGap);
contractBtn.addEventListener('click', contractGap);

// The headset renders stereo-img's canvas exclusively once immersive, so our page
// buttons become invisible - map controller triggers to the same actions instead.
function hookVRControls() {
  if (!viewer.renderer) {
    requestAnimationFrame(hookVRControls);
    return;
  }

  const squeezeHeld = { left: false, right: false };
  let comboTriggered = false;

  viewer.renderer.xr.addEventListener('sessionstart', () => {
    const session = viewer.renderer.xr.getSession();
    squeezeHeld.left = false;
    squeezeHeld.right = false;
    comboTriggered = false;

    session.addEventListener('selectstart', (event) => {
      if (libraries.length === 0) return;
      if (event.inputSource.handedness === 'left') shiftBack();
      else if (event.inputSource.handedness === 'right') shiftForward();
    });

    session.addEventListener('squeezestart', (event) => {
      const hand = event.inputSource.handedness;
      if (hand !== 'left' && hand !== 'right') return;
      squeezeHeld[hand] = true;
      // Squeezing both grips at once exits VR - the only way back to 2D
      // since the "Exit VR" button is also hidden during the session.
      if (squeezeHeld.left && squeezeHeld.right) {
        comboTriggered = true;
        session.end();
      }
    });

    session.addEventListener('squeezeend', (event) => {
      const hand = event.inputSource.handedness;
      if (hand !== 'left' && hand !== 'right') return;
      squeezeHeld[hand] = false;
      if (comboTriggered) {
        if (!squeezeHeld.left && !squeezeHeld.right) comboTriggered = false;
        return;
      }
      if (libraries.length === 0) return;
      if (hand === 'left') prevSet();
      else nextSet();
    });
  });
}

hookVRControls();