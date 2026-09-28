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

async function init() {
  const response = await fetch('manifest.json');
  const manifest = await response.json();
  libraries = manifest.libraries;

  if (libraries.length === 0) {
    emptyState.textContent = 'No libraries found. Add photos under photos/<library>/<set>/ and rebuild the manifest.';
    emptyState.hidden = false;
    return;
  }

  for (const library of libraries) {
    const option = document.createElement('option');
    option.value = library.id;
    option.textContent = library.name;
    librarySelect.appendChild(option);
  }

  librarySelect.addEventListener('change', () => {
    libraryId = librarySelect.value;
    setIndex = 0;
    resetPair();
    render();
  });

  libraryId = libraries[0].id;
  resetPair();
  render();
}

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
  const library = currentLibrary();
  const set = currentSet();
  const images = set.images;

  if (images.length < 2) {
    viewer.hidden = true;
    controls.hidden = true;
    emptyState.hidden = false;
    return;
  }

  emptyState.hidden = true;
  viewer.hidden = false;
  controls.hidden = false;

  const path = (filename) =>
    ['photos', library.id, set.id, filename].map(encodeURIComponent).join('/');

  viewer.src = path(images[left]);
  viewer.setAttribute('src-right', path(images[right]));

  prevSetBtn.disabled = setIndex === 0;
  nextSetBtn.disabled = setIndex === library.sets.length - 1;
  shiftBackBtn.disabled = left === 0;
  shiftForwardBtn.disabled = right === images.length - 1;
  expandBtn.disabled = right === images.length - 1;
  contractBtn.disabled = right === left + 1;

  statusEl.textContent =
    `Set "${set.name}" (${setIndex + 1} of ${library.sets.length}) — ` +
    `photos ${left + 1} & ${right + 1} of ${images.length} (gap: ${right - left})`;
}

prevSetBtn.addEventListener('click', () => {
  if (setIndex === 0) return;
  setIndex -= 1;
  resetPair();
  render();
});

nextSetBtn.addEventListener('click', () => {
  if (setIndex === currentLibrary().sets.length - 1) return;
  setIndex += 1;
  resetPair();
  render();
});

shiftBackBtn.addEventListener('click', () => {
  if (left === 0) return;
  left -= 1;
  right -= 1;
  render();
});

shiftForwardBtn.addEventListener('click', () => {
  const images = currentSet().images;
  if (right === images.length - 1) return;
  left += 1;
  right += 1;
  render();
});

expandBtn.addEventListener('click', () => {
  const images = currentSet().images;
  if (right === images.length - 1) return;
  right += 1;
  render();
});

contractBtn.addEventListener('click', () => {
  if (right === left + 1) return;
  right -= 1;
  render();
});

init();
