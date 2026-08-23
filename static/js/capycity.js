(function () {
  "use strict";

  var stage = document.getElementById("scene-stage");
  if (!stage) return;
  var worldVideo = stage.querySelector(".world-video");

  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var saveData = navigator.connection && navigator.connection.saveData;
  var mobile = window.matchMedia && window.matchMedia("(max-width: 760px)").matches;
  var states = ["world", "signal", "crew", "roadmap", "store", "mint"];

  function fallback() {
    stage.classList.add("scene-fallback");
    stage.dataset.renderer = "fallback";
    if (!stage.querySelector(".scene-fallback-copy")) stage.insertAdjacentHTML("beforeend", '<div class="scene-fallback-copy"><b>CAPYCITY / 2026</b><span>WORLD SIGNAL ACTIVE</span></div>');
  }

  if (reduced || saveData || !window.THREE) {
    fallback();
    return;
  }

  var THREE = window.THREE;
  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: !mobile, alpha: false, powerPreference: "high-performance" });
  } catch (error) {
    fallback();
    return;
  }
  renderer.setPixelRatio(mobile ? 1 : Math.min(window.devicePixelRatio || 1, 1.35));
  renderer.setClearColor(0x07110e, 1);
  renderer.domElement.setAttribute("aria-hidden", "true");
  renderer.domElement.setAttribute("role", "presentation");
  stage.appendChild(renderer.domElement);
  stage.dataset.renderer = "webgl";

  var scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x07110e, 14, 40);
  var camera = new THREE.PerspectiveCamera(42, 1, 0.1, 70);
  camera.position.set(0, 3.8, 12.5);
  var cameraTarget = camera.position.clone();
  var look = new THREE.Vector3(0, 2, -3);
  var lookTarget = look.clone();
  var groups = {};
  var active = "world";
  var clock = new THREE.Clock();
  var pointer = { x: 0, y: 0 };
  var cars = [];
  var windows = [];
  var beacons = [];
  var rainDrops = [];
  var rain;
  var particles;
  var heroHalo;
  var heroBillboard;

  function mat(color, opacity, wireframe) {
    var m = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: opacity, wireframe: !!wireframe, depthWrite: false });
    m.userData.baseOpacity = opacity;
    return m;
  }

  function makeGroup(name) {
    var group = new THREE.Group();
    group.name = name;
    group.userData.visibility = name === "world" ? 1 : 0;
    scene.add(group);
    groups[name] = group;
    return group;
  }

  function addWindow(group, x, y, z, material) {
    var windowMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.11), material);
    windowMesh.position.set(x, y, z);
    group.add(windowMesh);
    windows.push(material);
  }

  var world = makeGroup("world");
  var island = new THREE.Mesh(new THREE.CylinderGeometry(8.4, 8.8, 0.65, 8), mat(0x173c31, 1, false));
  island.position.y = -0.42;
  world.add(island);
  var islandTop = new THREE.Mesh(new THREE.CylinderGeometry(8.1, 8.1, 0.08, 8), mat(0x245746, 1, false));
  islandTop.position.y = -0.05;
  world.add(islandTop);

  var boulevardCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.05, 7),
    new THREE.Vector3(0.3, 0.08, 2),
    new THREE.Vector3(-0.25, 0.1, -3),
    new THREE.Vector3(0, 0.12, -7)
  ]);
  world.add(new THREE.Mesh(new THREE.TubeGeometry(boulevardCurve, 34, 1.35, 6, false), mat(0x0c211b, 1, false)));
  world.add(new THREE.Mesh(new THREE.TubeGeometry(boulevardCurve, 34, 0.035, 6, false), mat(0xd6ff3f, 0.86, false)));
  [-2.5, -9].forEach(function (z) {
    var crossStreet = new THREE.Mesh(new THREE.PlaneGeometry(13, 1.6), mat(0x102b23, 1, false));
    crossStreet.rotation.x = -Math.PI / 2;
    crossStreet.position.set(0, 0.055, z);
    world.add(crossStreet);
    var crossLine = new THREE.Mesh(new THREE.PlaneGeometry(10, 0.04), mat(0x6cd3b2, 0.62, false));
    crossLine.rotation.x = -Math.PI / 2;
    crossLine.position.set(0, 0.07, z);
    world.add(crossLine);
  });

  var cityPalette = [0x194438, 0x215442, 0x28614d, 0x315f4c];
  function building(x, z, width, height, depth, color, focal) {
    var body = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), mat(color, 1, false));
    body.position.set(x, height / 2, z);
    world.add(body);
    var facadeZ = z + depth / 2 + 0.015;
    for (var row = 0; row < Math.floor(height / 0.72); row += 1) {
      for (var col = 0; col < Math.max(2, Math.floor(width / 0.5)); col += 1) {
        addWindow(world, x - width * 0.38 + col * 0.42, 0.5 + row * 0.72, facadeZ, mat((row + col) % 3 === 0 ? 0xff9e61 : 0xd6ff3f, 0.65 + (row + col) % 3 * 0.1, false));
      }
    }
    if (focal) {
      var cap = new THREE.Mesh(new THREE.CylinderGeometry(width * 0.48, width * 0.62, 0.7, 6), mat(0xd6ff3f, 0.96, false));
      cap.position.set(x, height + 0.35, z);
      world.add(cap);
      var beacon = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), mat(0xd6ff3f, 1, false));
      beacon.position.set(x, height + 0.85, z);
      world.add(beacon);
      beacons.push(beacon);
    }
  }
  building(-5.1, -0.8, 2.7, 4.8, 2.8, cityPalette[0], false);
  building(5, -0.6, 2.9, 5.8, 3, cityPalette[1], false);
  building(-6.4, -5.8, 2.2, 3.5, 2.5, cityPalette[2], false);
  building(6.2, -5.5, 2.25, 4, 2.6, cityPalette[3], false);
  building(0, -5.8, 3.35, 6.8, 2.65, 0x2b6d53, true);

  heroHalo = new THREE.Mesh(new THREE.TorusGeometry(2.15, 0.04, 10, 64), mat(0x6cd3b2, 0.65, false));
  heroHalo.position.set(0, 3.8, -7.25);
  heroHalo.rotation.x = 0.16;
  world.add(heroHalo);

  var billboardCanvas = document.createElement("canvas");
  billboardCanvas.width = 512;
  billboardCanvas.height = 220;
  var billboardContext = billboardCanvas.getContext("2d");
  billboardContext.fillStyle = "#102d24";
  billboardContext.fillRect(0, 0, 512, 220);
  billboardContext.strokeStyle = "#d6ff3f";
  billboardContext.lineWidth = 5;
  billboardContext.strokeRect(12, 12, 488, 196);
  billboardContext.fillStyle = "#d6ff3f";
  billboardContext.font = "700 36px monospace";
  billboardContext.fillText("CAPYCITY", 38, 92);
  billboardContext.fillStyle = "#8de5c0";
  billboardContext.font = "17px monospace";
  billboardContext.fillText("STAY MELLOW / KEEP MOVING", 38, 138);
  heroBillboard = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(billboardCanvas), transparent: true, opacity: 0.92, depthWrite: false }));
  heroBillboard.material.userData.baseOpacity = 0.92;
  heroBillboard.position.set(0, 5.6, -7.15);
  world.add(heroBillboard);

  var moon = new THREE.Mesh(new THREE.SphereGeometry(1.05, 18, 18), mat(0xd6ff3f, 0.9, false));
  moon.position.set(-6.8, 7.6, -15);
  world.add(moon);
  var stars = new THREE.BufferGeometry();
  var starPositions = new Float32Array(420 * 3);
  for (var starIndex = 0; starIndex < 420; starIndex += 1) {
    starPositions[starIndex * 3] = (Math.random() - 0.5) * 28;
    starPositions[starIndex * 3 + 1] = Math.random() * 14 + 1;
    starPositions[starIndex * 3 + 2] = -Math.random() * 26 - 3;
  }
  stars.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
  particles = new THREE.Points(stars, new THREE.PointsMaterial({ color: 0x8de5c0, size: mobile ? 0.035 : 0.05, transparent: true, opacity: 0.6, depthWrite: false }));
  world.add(particles);

  var carColors = [0xd6ff3f, 0x6cd3b2, 0xff7765, 0x9be9d0];
  for (var carIndex = 0; carIndex < 6; carIndex += 1) {
    var car = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.22, 1.1), mat(carColors[carIndex % carColors.length], 0.96, false));
    car.position.set(carIndex % 2 ? 0.95 : -0.95, 0.28, 8 - carIndex * 4.3);
    world.add(car);
    cars.push({ mesh: car, direction: carIndex % 2 ? -1 : 1, speed: 0.045 + (carIndex % 3) * 0.012 });
  }
  var hood = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.22, 1.4), mat(0x173c31, 1, false));
  hood.position.set(0, 0.48, 9.4);
  world.add(hood);
  var hoodLine = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.03, 0.05), mat(0xd6ff3f, 0.8, false));
  hoodLine.position.set(0, 0.61, 8.72);
  world.add(hoodLine);

  var rainGeometry = new THREE.BufferGeometry();
  var rainPositions = new Float32Array(220 * 3);
  for (var rainIndex = 0; rainIndex < 220; rainIndex += 1) {
    rainPositions[rainIndex * 3] = (Math.random() - 0.5) * 18;
    rainPositions[rainIndex * 3 + 1] = Math.random() * 12 + 1;
    rainPositions[rainIndex * 3 + 2] = -Math.random() * 24 + 8;
  }
  rainGeometry.setAttribute("position", new THREE.BufferAttribute(rainPositions, 3));
  rain = new THREE.Points(rainGeometry, new THREE.PointsMaterial({ color: 0x8de5c0, size: mobile ? 0.035 : 0.05, transparent: true, opacity: 0.28, depthWrite: false }));
  world.add(rain);
  rainDrops = rainGeometry.attributes.position.array;

  var signal = makeGroup("signal");
  for (var signalIndex = 0; signalIndex < 5; signalIndex += 1) {
    var signalScreen = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.4, 0.12), mat(0x6cd3b2, 0.8, true));
    signalScreen.position.set((signalIndex - 2) * 3.5, 3.2 + Math.abs(signalIndex - 2) * 0.4, -signalIndex * 0.8);
    signal.add(signalScreen);
  }
  var crew = makeGroup("crew");
  for (var crewIndex = 0; crewIndex < 8; crewIndex += 1) {
    var crewCard = new THREE.Mesh(new THREE.BoxGeometry(2.1, 3.2, 0.12), mat(0xd6ff3f, 0.75, true));
    var crewAngle = crewIndex / 8 * Math.PI * 2;
    crewCard.position.set(Math.cos(crewAngle) * 5.4, 3, Math.sin(crewAngle) * 3);
    crewCard.lookAt(0, 2.8, 0);
    crew.add(crewCard);
  }
  var roadmap = makeGroup("roadmap");
  var routePoints = [new THREE.Vector3(-8, 0.5, 2), new THREE.Vector3(-4, 1, -2), new THREE.Vector3(0, 0.5, 0), new THREE.Vector3(4, 1.3, -3), new THREE.Vector3(8, 0.6, -6)];
  roadmap.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(routePoints), 48, 0.08, 6, false), mat(0xd6ff3f, 0.95, false)));
  routePoints.forEach(function (point) { var ring = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.07, 8, 24), mat(0x6cd3b2, 0.95, false)); ring.position.copy(point); ring.rotation.x = Math.PI / 2; roadmap.add(ring); });
  var store = makeGroup("store");
  for (var storeIndex = 0; storeIndex < 9; storeIndex += 1) { var crate = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.5, 1.8), mat(0x6cd3b2, 0.75, true)); crate.position.set((storeIndex % 3 - 1) * 3.1, 1.25, (Math.floor(storeIndex / 3) - 1) * -3.2); store.add(crate); }
  var mint = makeGroup("mint");
  var portal = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.14, 12, 64), mat(0xd6ff3f, 0.95, false));
  portal.position.set(0, 3.4, -2);
  mint.add(portal);

  var cameraStates = {
    world: { pos: [0, 2.45, 12.2], look: [0, 1.7, -9] },
    signal: { pos: [0, 5, 15], look: [0, 3, -1] },
    crew: { pos: [7, 4.8, 14], look: [0, 2.8, 0] },
    roadmap: { pos: [7, 6.4, 14], look: [0, 1, -2] },
    store: { pos: [7, 5.5, 14], look: [0, 1.2, -2] },
    mint: { pos: [0, 4.5, 14], look: [0, 3.2, -2] }
  };

  function setState(name) {
    if (states.indexOf(name) < 0) name = "world";
    active = name;
    cameraTarget.fromArray(cameraStates[name].pos);
    lookTarget.fromArray(cameraStates[name].look);
    stage.dataset.scene = name;
    if (worldVideo) {
      worldVideo.hidden = name !== "world";
      if (name === "world") worldVideo.play().catch(function () {});
    }
    if (groups.world) groups.world.visible = name !== "world";
  }

  var sections = Array.prototype.slice.call(document.querySelectorAll("[data-scene]"));
  function chooseSection() {
    if (!sections.length) return;
    var focus = window.innerHeight * 0.42;
    var nearest = sections.reduce(function (best, section) { var distance = Math.abs(section.getBoundingClientRect().top - focus); return !best || distance < best.distance ? { section: section, distance: distance } : best; }, null);
    if (nearest) setState(nearest.section.dataset.scene);
  }
  sections.forEach(function (section) { if (window.IntersectionObserver) new IntersectionObserver(chooseSection, { rootMargin: "-20% 0px -35%" }).observe(section); });
  window.addEventListener("scroll", chooseSection, { passive: true });
  chooseSection();
  window.addEventListener("pointermove", function (event) { pointer.x = (event.clientX / window.innerWidth - 0.5) * 0.4; pointer.y = (event.clientY / window.innerHeight - 0.5) * 0.22; }, { passive: true });
  function resize() { var width = stage.clientWidth || window.innerWidth; var height = stage.clientHeight || window.innerHeight; renderer.setSize(width, height, false); camera.aspect = width / Math.max(height, 1); camera.updateProjectionMatrix(); }
  window.addEventListener("resize", resize, { passive: true });
  resize();
  function render() {
    var elapsed = clock.getElapsedTime();
    camera.position.lerp(cameraTarget, 0.045);
    look.lerp(lookTarget, 0.05);
    camera.position.x += pointer.x * 0.14;
    camera.position.y -= pointer.y * 0.08;
    camera.lookAt(look);
    Object.keys(groups).forEach(function (name) {
      var group = groups[name];
      var target = name === active ? 1 : 0;
      group.userData.visibility += (target - group.userData.visibility) * 0.08;
      group.position.z += ((target ? 0 : -12) - group.position.z) * 0.06;
      group.traverse(function (node) { if (!node.material) return; var materials = Array.isArray(node.material) ? node.material : [node.material]; materials.forEach(function (material) { material.opacity = (material.userData.baseOpacity == null ? 1 : material.userData.baseOpacity) * group.userData.visibility; }); });
    });
    cars.forEach(function (car) { car.mesh.position.z += car.speed * car.direction; if (car.direction > 0 && car.mesh.position.z > 13) car.mesh.position.z = -14; if (car.direction < 0 && car.mesh.position.z < -14) car.mesh.position.z = 13; });
    for (var rainIndex = 0; rainIndex < rainDrops.length; rainIndex += 3) {
      rainDrops[rainIndex + 1] -= 0.08;
      rainDrops[rainIndex] += 0.012;
      if (rainDrops[rainIndex + 1] < 0) {
        rainDrops[rainIndex + 1] = 13;
        rainDrops[rainIndex] = (Math.random() - 0.5) * 18;
      }
    }
    rain.geometry.attributes.position.needsUpdate = true;
    windows.forEach(function (windowMaterial, index) { windowMaterial.opacity = (0.46 + Math.sin(elapsed * (0.65 + index * 0.015) + index) * 0.2) * groups.world.userData.visibility; });
    beacons.forEach(function (beacon, index) { beacon.scale.setScalar(0.85 + Math.sin(elapsed * 1.8 + index) * 0.16); });
    heroHalo.rotation.z = elapsed * 0.2;
    heroHalo.material.opacity = (0.36 + Math.sin(elapsed * 1.1) * 0.1) * groups.world.userData.visibility;
    heroBillboard.material.opacity = (0.75 + Math.sin(elapsed * 1.4) * 0.12) * groups.world.userData.visibility;
    particles.rotation.y = elapsed * 0.008;
    signal.position.y = Math.sin(elapsed * 0.6) * 0.1;
    crew.rotation.y += 0.003 * groups.crew.userData.visibility;
    portal.rotation.z = elapsed * 0.5;
    renderer.render(scene, camera);
  }
  renderer.setAnimationLoop(render);
}());
