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

    // Generate a local browser URL for this specific file
    set.images.push({
      name: filename,
      url: URL.createObjectURL(file) 
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
  libraries.forEach(lib => {
    lib.sets.forEach(set => {
      set.images.forEach(img => {
        URL.revokeObjectURL(img.url);
      });
    });
  });
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

function render() {
  if (libraries.length === 0) return;

  const library = currentLibrary();
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

  // Apply the local Object URLs directly to the viewer
  viewer.src = images[left].url;
  viewer.setAttribute('src-right', images[right].url);

  // Update button states based on array bounds
  prevSetBtn.disabled = setIndex === 0;
  nextSetBtn.disabled = setIndex === library.sets.length - 1;
  shiftBackBtn.disabled = left === 0;
  shiftForwardBtn.disabled = right === images.length - 1;
  expandBtn.disabled = right === images.length - 1;
  contractBtn.disabled = right === left + 1;

  // Update status text
  statusEl.textContent = 
    `Set "${set.name}" (${setIndex + 1} of ${library.sets.length}) — ` +
    `photos ${left + 1} & ${right + 1} of ${images.length} (gap: ${right - left})`;
}

function prevSet() {
  if (setIndex === 0) return;
  setIndex -= 1;
  resetPair();
  render();
}

function nextSet() {
  if (setIndex === currentLibrary().sets.length - 1) return;
  setIndex += 1;
  resetPair();
  render();
}

function shiftBack() {
  if (left === 0) return;
  left -= 1;
  right -= 1;
  render();
}

function shiftForward() {
  const images = currentSet().images;
  if (right === images.length - 1) return;
  left += 1;
  right += 1;
  render();
}

function expandGap() {
  const images = currentSet().images;
  if (right === images.length - 1) return;
  right += 1;
  render();
}

function contractGap() {
  if (right === left + 1) return;
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