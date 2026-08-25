(() => {
  const connect = document.querySelector('#connect-demo');
  const memberStatus = document.querySelector('#member-status');
  const memberName = document.querySelector('#member-name');
  connect?.addEventListener('click', () => {
    const connected = connect.dataset.connected === 'true';
    connect.dataset.connected = String(!connected);
    connect.setAttribute('aria-pressed', String(!connected));
    connect.textContent = connected ? 'Preview member state' : 'Member preview active';
    memberStatus.textContent = connected ? 'UNCONNECTED' : 'DEMO WALLET';
    memberName.textContent = connected ? 'CAPY #042' : 'CAPY #042 / YOU';
  });

  document.querySelectorAll('[data-mission]').forEach((card) => {
    const button = card.querySelector('.mission-button');
    button?.addEventListener('click', () => {
      card.classList.add('is-complete');
      button.textContent = 'Proof added';
      button.disabled = true;
      const proof = document.querySelector('.proof:not(.is-earned):not(.is-locked)');
      if (proof) { proof.classList.add('is-earned'); proof.querySelector('small').textContent = 'Completed just now'; proof.querySelector('b').textContent = 'LIVE'; }
    });
  });

  let selectedVote = null;
  document.querySelectorAll('[data-vote]').forEach((option) => option.addEventListener('click', () => {
    document.querySelectorAll('[data-vote]').forEach((item) => { item.classList.remove('is-selected'); item.setAttribute('aria-pressed', 'false'); });
    option.classList.add('is-selected'); option.setAttribute('aria-pressed', 'true'); selectedVote = option.dataset.vote;
  }));
  document.querySelector('#vote-submit')?.addEventListener('click', () => {
    const status = document.querySelector('#vote-status');
    if (!selectedVote) { status.textContent = 'Choose a direction first'; return; }
    status.textContent = 'Vote recorded for this session';
    document.querySelector('#vote-submit').textContent = 'Vote recorded';
  });

  document.querySelectorAll('.future-filter').forEach((filter) => filter.addEventListener('click', () => {
    document.querySelectorAll('.future-filter').forEach((item) => { item.classList.remove('is-active'); item.setAttribute('aria-pressed', 'false'); });
    filter.classList.add('is-active'); filter.setAttribute('aria-pressed', 'true');
    const value = filter.dataset.filter;
    document.querySelectorAll('.future-card').forEach((card) => card.classList.toggle('is-hidden', value !== 'all' && card.dataset.stage !== value));
  }));

  const stage = document.querySelector('.character-stage');
  const showcase = stage?.closest('.kentsugi-showcase');
  const canvas = document.querySelector('#character-canvas');
  const loading = document.querySelector('#character-loading');
  const angleLabel = document.querySelector('#character-angle');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fallback = () => { stage?.classList.add('is-fallback'); loading?.classList.add('is-ready'); };

  function startCharacterScene() {
    return;
    if (!stage || !canvas || !window.THREE) return fallback();
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas, antialias: !/Mobi/i.test(navigator.userAgent), alpha: true }); } catch { return fallback(); }
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, .1, 100);
    camera.position.set(0, 1.4, 8.8);
    const root = new THREE.Group(); scene.add(root);
    scene.add(new THREE.HemisphereLight(0xbfeee0, 0x10131a, 2.1));
    const key = new THREE.DirectionalLight(0xd6ff3f, 2.8); key.position.set(-3, 5, 5); scene.add(key);
    const rim = new THREE.PointLight(0xff7654, 12, 18); rim.position.set(3, 2, -2); scene.add(rim);
    const material = (color, rough = .65, metal = .05) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
    const add = (geometry, mat, position, scale, parent = root) => { const mesh = new THREE.Mesh(geometry, mat); mesh.position.set(...position); if (scale) mesh.scale.set(...scale); parent.add(mesh); return mesh; };
    const identity = new THREE.Group(); const fit = new THREE.Group(); const signal = new THREE.Group(); root.add(identity, fit, signal);
    const fur = material(0x9b664b, .9); const dark = material(0x17131a, .42, .18); const cream = material(0xf3eee4, .8); const orange = material(0xff7654, .6); const cyan = material(0x7bd6e4, .35, .3); const acid = material(0xd6ff3f, .45, .1);
    add(new THREE.SphereGeometry(1, 32, 24), fur, [0, .65, 0], [1.05, 1.35, .78], identity);
    add(new THREE.SphereGeometry(.92, 32, 24), fur, [0, 2.25, .05], [1.08, .82, .82], identity);
    add(new THREE.SphereGeometry(.34, 20, 16), material(0x82543f), [0, 2.05, .74], [.95, .68, .7], identity);
    add(new THREE.SphereGeometry(.18, 16, 12), dark, [-.37, 2.42, .73], [1.25, .55, .32], identity);
    add(new THREE.SphereGeometry(.18, 16, 12), dark, [.37, 2.42, .73], [1.25, .55, .32], identity);
    add(new THREE.SphereGeometry(.06, 10, 8), cream, [-.37, 2.42, .84], [1, 1, .5], identity);
    add(new THREE.SphereGeometry(.06, 10, 8), cream, [.37, 2.42, .84], [1, 1, .5], identity);
    add(new THREE.SphereGeometry(.28, 18, 14), dark, [0, 2.08, .99], [.8, .56, .45], identity);
    add(new THREE.BoxGeometry(1.9, .28, .86), acid, [0, 2.95, .02], null, fit);
    add(new THREE.BoxGeometry(1.62, .22, .72), dark, [0, 3.12, .02], null, fit);
    add(new THREE.BoxGeometry(.22, .7, .28), orange, [-.98, 1.2, .08], null, fit);
    add(new THREE.BoxGeometry(.22, .7, .28), orange, [.98, 1.2, .08], null, fit);
    add(new THREE.BoxGeometry(.5, 1.0, .45), dark, [-.57, -.18, .04], null, fit);
    add(new THREE.BoxGeometry(.5, 1.0, .45), dark, [.57, -.18, .04], null, fit);
    add(new THREE.BoxGeometry(.7, .22, 1.05), cyan, [-.57, -.7, .15], null, fit);
    add(new THREE.BoxGeometry(.7, .22, 1.05), cyan, [.57, -.7, .15], null, fit);
    const card = add(new THREE.BoxGeometry(.55, .86, .06), cream, [1.1, .98, .56], null, identity); card.rotation.z = -.15;
    add(new THREE.BoxGeometry(.4, .06, .02), orange, [1.1, 1.05, .6], null, identity);
    add(new THREE.TorusGeometry(1.42, .025, 8, 64), cyan, [0, 1.55, -.18], [1, .82, 1], signal).rotation.x = .05;
    const signalLight = new THREE.PointLight(0xd6ff3f, 1.7, 5); signalLight.position.set(0, 2, 1.8); signal.add(signalLight);
    let targetRotation = 0; let rotation = 0; let frame = 0;
    const resize = () => { const width = stage.clientWidth; const height = stage.clientHeight; renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, /Mobi/i.test(navigator.userAgent) ? 1 : 1.5)); renderer.setSize(width, height, false); camera.aspect = width / Math.max(height, 1); camera.updateProjectionMatrix(); };
    const onMove = (event) => { const rect = stage.getBoundingClientRect(); targetRotation = ((event.clientX - rect.left) / rect.width - .5) * .75; angleLabel.textContent = `ANGLE / ${String(Math.round((targetRotation + .75) * 240)).padStart(3, '0')}°`; };
    stage.addEventListener('pointermove', onMove, { passive: true }); window.addEventListener('resize', resize, { passive: true }); resize();
    loading?.classList.add('is-ready');
    const tick = () => { frame += 1; rotation += (targetRotation - rotation) * .08; root.rotation.y = rotation + (reduced ? 0 : Math.sin(frame * .012) * .04); if (!reduced) root.position.y = Math.sin(frame * .018) * .035; renderer.render(scene, camera); if (!reduced) requestAnimationFrame(tick); };
    tick();
    document.querySelectorAll('.layer-toggle').forEach((button) => button.addEventListener('click', () => { const active = button.classList.toggle('is-active'); button.setAttribute('aria-pressed', String(active)); const group = button.dataset.layer === 'identity' ? identity : button.dataset.layer === 'fit' ? fit : signal; group.visible = active; }));
  }
  startCharacterShowcase();

  function startCharacterShowcase() {
    if (!stage || !canvas || !window.THREE) return fallback();
    let renderer; try { renderer = new THREE.WebGLRenderer({ canvas, antialias: !/Mobi/i.test(navigator.userAgent), alpha: true }); } catch { return fallback(); }
    const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(31, 1, .1, 100); camera.position.set(0, .4, 8.6);
    const root = new THREE.Group(); scene.add(root); const key = new THREE.DirectionalLight(0xd6ff3f, 3.4); key.position.set(-4, 5, 6); scene.add(key); const rim = new THREE.PointLight(0xff7654, 18, 16); rim.position.set(4, 2, -2); scene.add(rim); const signal = new THREE.PointLight(0x9aecde, 4, 10); signal.position.set(-3, 1, 3); scene.add(signal); scene.add(new THREE.HemisphereLight(0xf7f2e7, 0x080b12, 1.4));
    const material = (color, rough=.6, metal=.05) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal }); const add = (geo, mat, pos, parent=root) => { const m = new THREE.Mesh(geo, mat); m.position.set(...pos); parent.add(m); return m; }; const identity = new THREE.Group(); const systems = new THREE.Group(); root.add(identity, systems); const loader = new THREE.TextureLoader();
    const plate = add(new THREE.BoxGeometry(2.72, 4.5, .18), material(0x18252a, .34, .28), [0, .8, -.32], identity); plate.rotation.y = -.06; add(new THREE.BoxGeometry(2.42, 4.2, .05), material(0xd6ff3f, .5), [0, .8, -.2], identity);
    const character = new THREE.Mesh(new THREE.PlaneGeometry(2.35, 4.05), new THREE.MeshBasicMaterial({ map: loader.load('/media/assets/CapyCrew_042_cutout.png'), transparent: true, depthWrite: false })); character.position.set(0, .98, .02); identity.add(character);
    const desktop = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 3.08), new THREE.MeshBasicMaterial({ map: loader.load('/static/crew-hub-desktop.png') })); desktop.position.set(2.15, .4, .72); desktop.rotation.y = -.28; systems.add(desktop); const desktopBack = add(new THREE.BoxGeometry(4.22, 3.1, .12), material(0x242830, .45, .25), [2.15, .4, .58], systems); desktopBack.rotation.y = -.28;
    const mobile = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.6), new THREE.MeshBasicMaterial({ map: loader.load('/static/crew-hub-mobile.png') })); mobile.position.set(-2.12, .18, .86); mobile.rotation.y = .26; systems.add(mobile); const mobileBack = add(new THREE.BoxGeometry(1.26, 2.66, .14), material(0x242830, .45, .25), [-2.12, .18, .68], systems); mobileBack.rotation.y = .26; add(new THREE.CylinderGeometry(1.75, 2.05, .22, 64), material(0x11181c, .32, .5), [0, -1.35, -.12]);
    let target = 0, rotation = 0, frame = 0, progress = 0, active = 0; const resize = () => { const w = stage.clientWidth, h = stage.clientHeight; renderer.setPixelRatio(Math.min(devicePixelRatio || 1, /Mobi/i.test(navigator.userAgent) ? 1 : 1.5)); renderer.setSize(w, h, false); camera.aspect = w / Math.max(h, 1); camera.updateProjectionMatrix(); }; const move = (event) => { const r = stage.getBoundingClientRect(); target = ((event.clientX - r.left) / r.width - .5) * .42; }; const scroll = () => { const r = stage.getBoundingClientRect(); progress = Math.max(0, Math.min(1, (innerHeight * .58 - r.top) / Math.max(r.height - innerHeight * .35, 1))); const step = Math.min(3, Math.floor(progress * 4)); if (step !== active) { active = step; document.querySelectorAll('.story-step').forEach((item) => item.classList.toggle('is-active', Number(item.dataset.step) === step)); } };
    stage.addEventListener('pointermove', move, { passive: true }); addEventListener('scroll', scroll, { passive: true }); addEventListener('resize', resize, { passive: true }); resize(); scroll(); loading?.classList.add('is-ready');
    const tick = () => { frame++; rotation += (target - rotation) * .08; root.rotation.y = rotation + progress * Math.PI * 1.15; root.position.y = Math.sin(frame * .012) * .025; desktop.position.x = 2.15 - progress * 3.1; mobile.position.x = -2.12 + progress * 3.7; desktopBack.position.x = desktop.position.x; mobileBack.position.x = mobile.position.x; camera.position.x += ((progress * 1.25) - camera.position.x) * .045; camera.position.y += ((.4 + progress * .4) - camera.position.y) * .045; key.intensity = 2.5 + progress * 2.4; rim.intensity = 12 + (1 - progress) * 16; signal.intensity = 2 + progress * 8; angleLabel.textContent = `FRAME / ${String(active + 1).padStart(2, '0')}`; renderer.render(scene, camera); if (!reduced) requestAnimationFrame(tick); }; tick();
  }
})();
