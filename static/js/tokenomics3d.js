(() => {
  const stage = document.querySelector('.allocation-visual');
  const sceneHost = stage?.querySelector('.allocation-3d-scene');
  if (!stage || !sceneHost || !window.THREE) return;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (_) {
    return;
  }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  const model = new THREE.Group();
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2(2, 2);
  const meshes = [];
  const labels = [...sceneHost.querySelectorAll('[data-segment]')];
  const palette = [0xd6ff3f, 0x9aecde, 0xff4b3e, 0xd9d0c2, 0x252a31];
  const shares = [0.2, 0.2, 0.4, 0.1, 0.1];
  const innerRadius = 1.36;
  const outerRadius = 2.75;
  const depth = 0.5;
  const gap = 0.035;
  let startAngle = Math.PI * 0.5;
  let activeSegment = -1;
  let dragging = false;
  let previousX = 0;
  let previousY = 0;
  let targetX = -0.78;
  let targetZ = -0.18;
  let velocityZ = 0;
  let visible = true;
  let lastTime = performance.now();

  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, innerWidth < 720 ? 1.25 : 1.75));
  renderer.domElement.setAttribute('aria-hidden', 'true');
  sceneHost.prepend(renderer.domElement);

  camera.position.set(0, 0.15, 9.4);
  scene.add(new THREE.HemisphereLight(0xe8fff9, 0x06101e, 2.2));
  const keyLight = new THREE.DirectionalLight(0xffffff, 4.4);
  keyLight.position.set(-3.8, 4.8, 7);
  scene.add(keyLight);
  scene.add(model);

  const makeSegmentShape = (from, to) => {
    const shape = new THREE.Shape();
    const steps = 48;
    shape.moveTo(Math.cos(from) * outerRadius, Math.sin(from) * outerRadius);
    for (let i = 1; i <= steps; i += 1) {
      const angle = from + ((to - from) * i) / steps;
      shape.lineTo(Math.cos(angle) * outerRadius, Math.sin(angle) * outerRadius);
    }
    shape.lineTo(Math.cos(to) * innerRadius, Math.sin(to) * innerRadius);
    for (let i = steps; i >= 0; i -= 1) {
      const angle = from + ((to - from) * i) / steps;
      shape.lineTo(Math.cos(angle) * innerRadius, Math.sin(angle) * innerRadius);
    }
    shape.closePath();
    return shape;
  };

  shares.forEach((share, index) => {
    const span = share * Math.PI * 2;
    const geometry = new THREE.ExtrudeGeometry(makeSegmentShape(startAngle + gap, startAngle + span - gap), {
      depth,
      bevelEnabled: true,
      bevelSegments: 3,
      bevelSize: 0.055,
      bevelThickness: 0.07,
      curveSegments: 36,
    });
    geometry.center();
    const material = new THREE.MeshStandardMaterial({
      color: palette[index],
      roughness: 0.38,
      metalness: index === 4 ? 0.38 : 0.12,
      emissive: palette[index],
      emissiveIntensity: 0.02,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.z = 0;
    mesh.userData.index = index;
    model.add(mesh);
    meshes.push(mesh);
    startAngle += span;
  });

  const puckMaterial = new THREE.MeshStandardMaterial({ color: 0xf4f0e8, roughness: 0.28, metalness: 0.2 });
  const puck = new THREE.Mesh(new THREE.CylinderGeometry(1.08, 1.08, 0.68, 80, 1, false), puckMaterial);
  puck.rotation.x = Math.PI / 2;
  puck.position.z = 0.06;
  model.add(puck);

  const makeLabelTexture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, 512, 512);
    context.fillStyle = '#071323';
    context.textAlign = 'center';
    context.font = '700 132px Arial, sans-serif';
    context.fillText('1B', 256, 244);
    context.fillStyle = '#d9362f';
    context.font = '700 31px monospace';
    context.fillText('$MELLOW SUPPLY', 256, 304);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  };
  const cap = new THREE.Mesh(
    new THREE.CircleGeometry(0.94, 80),
    new THREE.MeshBasicMaterial({ map: makeLabelTexture(), transparent: true })
  );
  cap.position.z = 0.42;
  model.add(cap);

  model.rotation.set(targetX, 0, targetZ);

  const setActive = (index) => {
    if (activeSegment === index) return;
    activeSegment = index;
    labels.forEach((label, labelIndex) => label.classList.toggle('is-active', labelIndex === index));
  };

  const updateRaycast = (event) => {
    if (dragging) return;
    const bounds = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(meshes, false)[0];
    setActive(hit ? hit.object.userData.index : -1);
  };

  const pointerDown = (event) => {
    dragging = true;
    previousX = event.clientX;
    previousY = event.clientY;
    velocityZ = 0;
    sceneHost.classList.add('is-dragging');
    sceneHost.setPointerCapture(event.pointerId);
  };

  const pointerMove = (event) => {
    if (!dragging) {
      updateRaycast(event);
      return;
    }
    const deltaX = event.clientX - previousX;
    const deltaY = event.clientY - previousY;
    targetZ += deltaX * 0.009;
    targetX = THREE.MathUtils.clamp(targetX + deltaY * 0.006, -1.25, -0.2);
    velocityZ = deltaX * 0.0007;
    previousX = event.clientX;
    previousY = event.clientY;
  };

  const pointerUp = (event) => {
    dragging = false;
    sceneHost.classList.remove('is-dragging');
    if (sceneHost.hasPointerCapture(event.pointerId)) sceneHost.releasePointerCapture(event.pointerId);
  };

  const resize = () => {
    const width = sceneHost.clientWidth;
    const height = sceneHost.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  sceneHost.addEventListener('pointerdown', pointerDown);
  sceneHost.addEventListener('pointermove', pointerMove);
  sceneHost.addEventListener('pointerup', pointerUp);
  sceneHost.addEventListener('pointercancel', pointerUp);
  sceneHost.addEventListener('pointerleave', () => { if (!dragging) setActive(-1); });
  sceneHost.addEventListener('keydown', (event) => {
    const amount = event.shiftKey ? 0.25 : 0.1;
    if (event.key === 'ArrowLeft') targetZ -= amount;
    else if (event.key === 'ArrowRight') targetZ += amount;
    else if (event.key === 'ArrowUp') targetX = THREE.MathUtils.clamp(targetX - amount, -1.25, -0.2);
    else if (event.key === 'ArrowDown') targetX = THREE.MathUtils.clamp(targetX + amount, -1.25, -0.2);
    else return;
    event.preventDefault();
  });
  labels.forEach((label, index) => {
    label.addEventListener('pointerenter', () => setActive(index));
    label.addEventListener('pointerleave', () => setActive(-1));
  });

  new ResizeObserver(resize).observe(sceneHost);
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }, { rootMargin: '160px' }).observe(sceneHost);

  stage.classList.add('is-3d-ready');
  resize();

  const animate = (time) => {
    requestAnimationFrame(animate);
    if (!visible) return;
    const delta = Math.min((time - lastTime) / 16.67, 2);
    lastTime = time;
    if (!dragging && !reducedMotion) {
      targetZ += 0.00035 * delta;
      targetZ += velocityZ * delta;
      velocityZ *= 0.94;
    }
    model.rotation.x += (targetX - model.rotation.x) * 0.09;
    model.rotation.z += (targetZ - model.rotation.z) * 0.09;
    meshes.forEach((mesh, index) => {
      const targetScale = activeSegment === index ? 1.055 : 1;
      const nextScale = THREE.MathUtils.lerp(mesh.scale.x, targetScale, 0.12);
      mesh.scale.setScalar(nextScale);
      mesh.material.emissiveIntensity = THREE.MathUtils.lerp(mesh.material.emissiveIntensity, activeSegment === index ? 0.12 : 0.02, 0.12);
    });
    renderer.render(scene, camera);
  };
  requestAnimationFrame(animate);
})();
