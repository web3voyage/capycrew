(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.querySelectorAll('.future-filter').forEach((filter) => filter.addEventListener('click', () => {
    document.querySelectorAll('.future-filter').forEach((item) => { item.classList.remove('is-active'); item.setAttribute('aria-pressed', 'false'); });
    filter.classList.add('is-active'); filter.setAttribute('aria-pressed', 'true');
    const value = filter.dataset.filter;
    document.querySelectorAll('.future-card').forEach((card) => card.classList.toggle('is-hidden', value !== 'all' && card.dataset.stage !== value));
  }));

  // Collection view: a true blueprint inspection surface. It deliberately uses
  // wireframe primitives only; the finished Capy artwork is presented separately
  // in the field-card mockup below the viewer.
  function startCollectionShowcase() {
    const stage = document.querySelector('[data-collection-stage]');
    const canvas = document.querySelector('#collection-canvas');
    const loading = document.querySelector('#collection-loading');
    const angleLabel = document.querySelector('#collection-angle');
    if (!stage || !canvas) return;
    // No THREE, or no WebGL context: show the finished cutout instead of an empty stage.
    const fallback = () => { stage.classList.add('is-fallback'); loading?.classList.add('is-ready'); };
    if (!window.THREE) { fallback(); return; }
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas, antialias: !/Mobi/i.test(navigator.userAgent), alpha: true }); } catch { fallback(); return; }
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(29, 1, .1, 40);
    camera.position.set(3.9, 2.9, 7.2);
    const root = new THREE.Group(); root.rotation.y = -.25; scene.add(root);
    scene.add(new THREE.HemisphereLight(0xbfeee0, 0x071018, 2.2));
    const identity = new THREE.Group(); const outfit = new THREE.Group(); const rails = new THREE.Group(); root.add(identity, outfit, rails);
    const addWire = (geometry, color, position, scale, parent) => { const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: .86 })); mesh.position.set(...position); mesh.scale.set(...scale); parent.add(mesh); return mesh; };
    const fur = 0x9aecde, accent = 0xd6ff3f, coral = 0xff7654, dark = 0x8aa7a0;
    addWire(new THREE.SphereGeometry(1, 24, 16), fur, [0, 1.55, 0], [1.08, 1.28, .82], identity);
    addWire(new THREE.SphereGeometry(.9, 24, 16), fur, [0, 2.82, .04], [1.02, .84, .82], identity);
    addWire(new THREE.SphereGeometry(.34, 18, 12), dark, [0, 2.62, .73], [.92, .7, .64], identity);
    addWire(new THREE.SphereGeometry(.17, 14, 10), coral, [-.38, 2.94, .72], [1.3, .55, .32], identity);
    addWire(new THREE.SphereGeometry(.17, 14, 10), coral, [.38, 2.94, .72], [1.3, .55, .32], identity);
    addWire(new THREE.SphereGeometry(.12, 14, 10), fur, [-.38, 2.94, .9], [1, 1, .5], identity);
    addWire(new THREE.SphereGeometry(.12, 14, 10), fur, [.38, 2.94, .9], [1, 1, .5], identity);
    addWire(new THREE.SphereGeometry(.26, 16, 10), coral, [0, 2.62, .96], [.82, .58, .44], identity);
    addWire(new THREE.SphereGeometry(.18, 14, 10), fur, [-.43, 3.4, 0], [.75, .42, .9], identity);
    addWire(new THREE.SphereGeometry(.18, 14, 10), fur, [.43, 3.4, 0], [.75, .42, .9], identity);
    addWire(new THREE.CylinderGeometry(.5, .5, 1, 20), accent, [-.52, .48, 0], [.56, .72, .42], outfit);
    addWire(new THREE.CylinderGeometry(.5, .5, 1, 20), accent, [.52, .48, 0], [.56, .72, .42], outfit);
    addWire(new THREE.BoxGeometry(1, 1, 1), dark, [-.53, -.46, 0], [.62, .72, .5], outfit);
    addWire(new THREE.BoxGeometry(1, 1, 1), dark, [.53, -.46, 0], [.62, .72, .5], outfit);
    addWire(new THREE.BoxGeometry(1, 1, 1), coral, [-.53, -1.08, .18], [.86, .2, 1.1], outfit);
    addWire(new THREE.BoxGeometry(1, 1, 1), coral, [.53, -1.08, .18], [.86, .2, 1.1], outfit);
    addWire(new THREE.CylinderGeometry(.5, .5, 1, 28), coral, [0, 3.72, 0], [1.14, .18, 1.14], rails);
    addWire(new THREE.CylinderGeometry(.5, .5, 1, 28), accent, [0, 3.94, 0], [.86, .34, .86], rails);
    addWire(new THREE.BoxGeometry(1, 1, 1), accent, [1.15, 1.48, .4], [.12, .4, .12], rails);
    const resize = () => { const w = stage.clientWidth, h = stage.clientHeight; renderer.setPixelRatio(Math.min(devicePixelRatio || 1, /Mobi/i.test(navigator.userAgent) ? 1 : 1.5)); renderer.setSize(w, h, false); camera.aspect = w / Math.max(h, 1); camera.updateProjectionMatrix(); };
    let target = -.25, rotation = -.25, frame = 0;
    const move = (event) => { const rect = stage.getBoundingClientRect(); target = -.25 + ((event.clientX - rect.left) / rect.width - .5) * .8; angleLabel.textContent = `ANGLE / ${String(Math.round((target + .65) * 240)).padStart(3, '0')}°`; };
    stage.addEventListener('pointermove', move, { passive: true }); addEventListener('resize', resize, { passive: true }); resize(); loading?.classList.add('is-ready');
    const tick = () => { frame += 1; rotation += (target - rotation) * .065; root.rotation.y = rotation + (reduced ? 0 : Math.sin(frame * .01) * .035); renderer.render(scene, camera); if (!reduced) requestAnimationFrame(tick); }; tick();
  }
  startCollectionShowcase();

  const collectionMockup = document.querySelector('#collection-mockup-image');
  const collectionName = document.querySelector('#collection-mockup-name');
  const collectionTrait = document.querySelector('#collection-mockup-trait');
  document.querySelectorAll('.collection-item').forEach((item) => item.addEventListener('click', () => {
    document.querySelectorAll('.collection-item').forEach((entry) => entry.classList.remove('is-active'));
    item.classList.add('is-active');
    if (collectionMockup) collectionMockup.src = item.dataset.image;
    if (collectionName) collectionName.textContent = `CAPY #${item.dataset.character}`;
    if (collectionTrait) collectionTrait.textContent = item.querySelector('small')?.textContent || 'collection archive';
  }));
})();
