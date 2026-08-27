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
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  const model = new THREE.Group();
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2(2, 2);
  const meshes = [];
  const labels = [...sceneHost.querySelectorAll('[data-segment]')];
  const lines = [...sceneHost.querySelectorAll('[data-line]')];
  const anchors = [];
  const palette = [0xd6ff3f, 0x9aecde, 0xff4b3e, 0xd9d0c2, 0x252a31];
  // Ecosystem & missions, treasury & grants, liquidity, contributors, reserve.
  // Must stay in step with the allocation table in templates/whitepaper.html.
  const shares = [0.4, 0.25, 0.15, 0.1, 0.1];
  const innerRadius = 1.36;
  const outerRadius = 2.75;
  const depth = 0.5;
  const gap = 0.035;
  const projected = new THREE.Vector3();
  let startAngle = Math.PI * 0.5;
  let activeSegment = -1;
  let dragging = false;
  let previousX = 0;
  let previousY = 0;
  let targetX = -0.78;
  let targetY = 0.16;
  let velocityY = 0;
  let visible = true;
  let lastTime = performance.now();

  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, innerWidth < 720 ? 1.25 : 1.75));
  renderer.domElement.setAttribute('aria-hidden', 'true');
  sceneHost.prepend(renderer.domElement);

  camera.position.set(0, 0.15, 9.5);
  camera.lookAt(0, 0, 0);
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
    const middle = startAngle + span / 2;
    const geometry = new THREE.ExtrudeGeometry(makeSegmentShape(startAngle + gap, startAngle + span - gap), {
      depth,
      bevelEnabled: true,
      bevelSegments: 3,
      bevelSize: 0.055,
      bevelThickness: 0.07,
      curveSegments: 36,
    });
    geometry.translate(0, 0, -depth / 2);
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
    anchors.push(new THREE.Vector3(Math.cos(middle) * (outerRadius + 0.08), Math.sin(middle) * (outerRadius + 0.08), depth * 0.58));
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

  model.rotation.set(targetX, targetY, 0);

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
    velocityY = 0;
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
    targetY += deltaX * 0.009;
    targetX = THREE.MathUtils.clamp(targetX + deltaY * 0.006, -1.2, -0.16);
    velocityY = deltaX * 0.0007;
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

  // The model keeps rotating, so each label is placed from its projected anchor
  // every frame rather than from a fixed per-segment offset table.
  const placements = labels.map((label, index) => ({ index, label }));

  const layoutLabels = () => {
    const width = sceneHost.clientWidth;
    const height = sceneHost.clientHeight;
    if (!width || !height) return;
    placements.forEach((placement) => {
      projected.copy(anchors[placement.index]);
      model.localToWorld(projected);
      projected.project(camera);
      const label = placement.label;
      placement.anchorX = (projected.x * 0.5 + 0.5) * width;
      placement.anchorY = (-projected.y * 0.5 + 0.5) * height;
      placement.labelWidth = label.offsetWidth || 120;
      placement.labelHeight = label.offsetHeight || 48;
      placement.side = placement.anchorX >= width / 2 ? 1 : -1;
      const nudge = placement.anchorY >= height / 2 ? placement.labelHeight * 0.35 : placement.labelHeight * -0.35;
      const rawLeft = placement.side === 1 ? placement.anchorX + 30 : placement.anchorX - placement.labelWidth - 30;
      placement.left = THREE.MathUtils.clamp(rawLeft, 8, Math.max(8, width - placement.labelWidth - 8));
      placement.top = THREE.MathUtils.clamp(placement.anchorY - placement.labelHeight / 2 + nudge, 62, Math.max(62, height - placement.labelHeight - 8));
    });
    [-1, 1].forEach((side) => {
      const column = placements.filter((placement) => placement.side === side).sort((a, b) => a.top - b.top);
      column.forEach((placement, position) => {
        if (!position) return;
        const previous = column[position - 1];
        const minimum = previous.top + previous.labelHeight + 6;
        if (placement.top < minimum) placement.top = Math.min(minimum, Math.max(62, height - placement.labelHeight - 8));
      });
    });
    placements.forEach(({ index, label, anchorX, anchorY, labelWidth, labelHeight, left, top }) => {
      label.style.left = `${left}px`;
      label.style.top = `${top}px`;
      label.style.right = 'auto';
      label.style.bottom = 'auto';
      const labelIsRight = left > anchorX;
      const edgeX = labelIsRight ? left : left + labelWidth;
      const edgeY = top + labelHeight / 2;
      const elbowX = anchorX + (edgeX - anchorX) * 0.52;
      lines[index].setAttribute('d', `M ${anchorX.toFixed(1)} ${anchorY.toFixed(1)} L ${elbowX.toFixed(1)} ${anchorY.toFixed(1)} L ${edgeX.toFixed(1)} ${edgeY.toFixed(1)}`);
    });
  };

  sceneHost.addEventListener('pointerdown', pointerDown);
  sceneHost.addEventListener('pointermove', pointerMove);
  sceneHost.addEventListener('pointerup', pointerUp);
  sceneHost.addEventListener('pointercancel', pointerUp);
  sceneHost.addEventListener('pointerleave', () => { if (!dragging) setActive(-1); });
  sceneHost.addEventListener('keydown', (event) => {
    const amount = event.shiftKey ? 0.25 : 0.1;
    if (event.key === 'ArrowLeft') targetY -= amount;
    else if (event.key === 'ArrowRight') targetY += amount;
    else if (event.key === 'ArrowUp') targetX = THREE.MathUtils.clamp(targetX - amount, -1.2, -0.16);
    else if (event.key === 'ArrowDown') targetX = THREE.MathUtils.clamp(targetX + amount, -1.2, -0.16);
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
      targetY += 0.00035 * delta;
      targetY += velocityY * delta;
      velocityY *= 0.94;
    }
    model.rotation.x += (targetX - model.rotation.x) * 0.09;
    model.rotation.y += (targetY - model.rotation.y) * 0.09;
    meshes.forEach((mesh, index) => {
      const targetScale = activeSegment === index ? 1.055 : 1;
      const nextScale = THREE.MathUtils.lerp(mesh.scale.x, targetScale, 0.12);
      mesh.scale.setScalar(nextScale);
      mesh.material.emissiveIntensity = THREE.MathUtils.lerp(mesh.material.emissiveIntensity, activeSegment === index ? 0.12 : 0.02, 0.12);
    });
    layoutLabels();
    renderer.render(scene, camera);
  };
  requestAnimationFrame(animate);
})();
