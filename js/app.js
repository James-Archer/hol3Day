const sceneSelect = document.getElementById('scene-select');
const viewer = document.getElementById('viewer');
const controls = document.getElementById('controls');
const emptyState = document.getElementById('empty-state');
const statusEl = document.getElementById('status');
const shiftBackBtn = document.getElementById('shift-back');
const shiftForwardBtn = document.getElementById('shift-forward');
const expandBtn = document.getElementById('expand');
const contractBtn = document.getElementById('contract');

let scenes = [];
let sceneId = null;
let left = 0;
let right = 1;

async function init() {
  const response = await fetch('manifest.json');
  const manifest = await response.json();
  scenes = manifest.scenes;

  if (scenes.length === 0) {
    emptyState.textContent = 'No scenes found. Add photos under photos/<scene-name>/ and rebuild the manifest.';
    emptyState.hidden = false;
    return;
  }

  for (const scene of scenes) {
    const option = document.createElement('option');
    option.value = scene.id;
    option.textContent = scene.name;
    sceneSelect.appendChild(option);
  }

  sceneSelect.addEventListener('change', () => {
    sceneId = sceneSelect.value;
    resetPair();
    render();
  });

  sceneId = scenes[0].id;
  resetPair();
  render();
}

function currentScene() {
  return scenes.find((scene) => scene.id === sceneId);
}

function resetPair() {
  left = 0;
  right = currentScene().images.length > 1 ? 1 : 0;
}

function render() {
  const scene = currentScene();
  const images = scene.images;

  if (images.length < 2) {
    viewer.hidden = true;
    controls.hidden = true;
    emptyState.hidden = false;
    return;
  }

  emptyState.hidden = true;
  viewer.hidden = false;
  controls.hidden = false;

  viewer.src = `photos/${scene.id}/${images[left]}`;
  viewer.setAttribute('src-right', `photos/${scene.id}/${images[right]}`);

  shiftBackBtn.disabled = left === 0;
  shiftForwardBtn.disabled = right === images.length - 1;
  expandBtn.disabled = right === images.length - 1;
  contractBtn.disabled = right === left + 1;

  statusEl.textContent = `Photos ${left + 1} & ${right + 1} of ${images.length} (gap: ${right - left})`;
}

shiftBackBtn.addEventListener('click', () => {
  if (left === 0) return;
  left -= 1;
  right -= 1;
  render();
});

shiftForwardBtn.addEventListener('click', () => {
  const images = currentScene().images;
  if (right === images.length - 1) return;
  left += 1;
  right += 1;
  render();
});

expandBtn.addEventListener('click', () => {
  const images = currentScene().images;
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
