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
    // The camera used to carry a position and no target, so it kept its default -Z aim
    // and the wireframe sat outside the frustum entirely: an empty plate, and not even
    // the fallback, because the renderer itself constructs fine. Frame it from the
    // group's own bounds rather than a hand-tuned position - it stands 5.3 units tall
    // about y = 1.47 and 2.5 wide once spun - and let resize() ride the eye back along
    // a fixed 3/4 axis until all of that clears the frustum at any stage size.
    const camera = new THREE.PerspectiveCamera(29, 1, .1, 40);
    // The look-at is 1.35, below the group's true centre of 1.465, because the
    // muzzle at z +1.07 and the foot plates at z +0.73 sit about a unit nearer the
    // eye than the focus plane: they project larger, and the feet reach further
    // down than the crown reaches up, which left the silhouette sitting low - 37px
    // under the top edge against 10px below the feet. Dropping the look-at lifts
    // it back. Half-extent about this focus is 2.76 above (y tops out at 4.11) and
    // 2.53 below, so fitting on 2.76 also leaves the slack where perspective
    // spends it.
    const focus = new THREE.Vector3(0, 1.35, 0), axis = new THREE.Vector3(3.9, 1.43, 7.2).normalize();
    // The model has to fit the clear band between the furniture, not the plate:
    // .stage-hud occupies the top of the plate and .stage-caption the bottom, and
    // fitting to the whole plate is what put the crown rail through the HUD's
    // "VIEW" and the foot plates across both caption lines at 430. Measure that
    // furniture instead of hard-coding it - the HUD is top: 20px plus its own
    // height, the caption is bottom: 18px plus its own, and the caption doubles to
    // two stacked rows under 560px, so the bottom band is 44px deep at desktop and
    // 59px at 430. A single symmetric constant tuned for one of those lands 2px
    // off the other. The model is centred, so the deeper of the two bands sets the
    // reservation at both ends, and GAP is the breathing room on top of it.
    //
    // GAP is 18 to buy 10px of measured clearance, because FIT is a vertical
    // half-extent about the focus while the points that actually reach the edge of
    // the silhouette - crown rail, foot plates - swing through z as the group spins
    // and project from about a unit nearer the eye than the focus plane. So the
    // silhouette over-reaches its fitted band: measured 8px at 1440 and 3px at 430.
    // Correcting FIT instead would be the tidier story, but the surcharge scales
    // with camera distance and camera distance is what FIT decides, so it is not a
    // constant; spending it out of the breathing room is honest and monotonic.
    const FIT = 2.76, GAP = 18;
    const reserve = () => { const s = stage.getBoundingClientRect(), hud = stage.querySelector('.stage-hud'), cap = stage.querySelector('.stage-caption');
      return Math.max(hud ? hud.getBoundingClientRect().bottom - s.top : 0, cap ? s.bottom - cap.getBoundingClientRect().top : 0, 0) + GAP; };
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
    const resize = () => { const w = stage.clientWidth, h = stage.clientHeight; renderer.setPixelRatio(Math.min(devicePixelRatio || 1, /Mobi/i.test(navigator.userAgent) ? 1 : 1.5)); renderer.setSize(w, h, false); camera.aspect = w / Math.max(h, 1); const reach = Math.tan(camera.fov * Math.PI / 360), clear = Math.max(.5, (h - reserve() * 2) / h); camera.position.copy(axis).multiplyScalar(Math.max(FIT / (clear * reach), 1.45 / (reach * camera.aspect))).add(focus); camera.lookAt(focus); camera.updateProjectionMatrix(); };
    let target = -.25, rotation = -.25, frame = 0;
    const move = (event) => { const rect = stage.getBoundingClientRect(); target = -.25 + ((event.clientX - rect.left) / rect.width - .5) * .8; angleLabel.textContent = `ANGLE / ${String(Math.round((target + .65) * 240)).padStart(3, '0')}°`; };
    stage.addEventListener('pointermove', move, { passive: true }); addEventListener('resize', resize, { passive: true }); resize(); loading?.classList.add('is-ready');
    // reserve() measures type, so the first fit can be made against the fallback
    // metrics: re-fit once DM Mono has actually landed.
    document.fonts?.ready.then(resize);
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
