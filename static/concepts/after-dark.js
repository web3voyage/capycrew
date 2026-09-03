/* ==========================================================================
   CapyCrew concept - motion system
   1. City: one continuous scroll-driven camera descent through CapyCity
   2. Reveal: clip-wipe entrances, staggered
   3. Rail: district progress
   4. Deck: transmission channel switching
   5. Reel: focus-follows-centre casting reel with drag + keys
   6. Board: pointer-driven parallax tilt
   ========================================================================== */
(function () {
  "use strict";

  var root = document.documentElement;
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var touch = matchMedia("(hover: none)").matches;
  var narrow = matchMedia("(max-width: 760px)").matches;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function token(name) { return getComputedStyle(root).getPropertyValue(name).trim(); }

  /* ---------------- page + section progress ---------------- */
  var progress = 0;
  function pageProgress() {
    var max = document.body.scrollHeight - innerHeight;
    return max > 0 ? clamp(scrollY / max, 0, 1) : 0;
  }

  var routeList = document.querySelector(".route-list");
  function writeProgress() {
    progress = pageProgress();
    root.style.setProperty("--page-progress", progress.toFixed(4));
    if (routeList) {
      var box = routeList.getBoundingClientRect();
      var span = box.height + innerHeight * 0.5;
      var p = clamp((innerHeight * 0.75 - box.top) / span, 0, 1);
      routeList.style.setProperty("--route-progress", p.toFixed(4));
    }
  }
  addEventListener("scroll", writeProgress, { passive: true });
  addEventListener("resize", writeProgress, { passive: true });
  writeProgress();
  /* ---------------- 2 / reveal ---------------- */
  var revealables = document.querySelectorAll("[data-reveal], .route-list li");
  if (!("IntersectionObserver" in window)) {
    revealables.forEach(function (el) { el.classList.add("is-in"); });
  } else {
    var revealer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        revealer.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0 });
    /* threshold stays at 0 on purpose. The hidden state clips the element with
       clip-path: inset(0 0 100% 0), and Chromium folds a target's own clip-path
       into its intersectionRatio - so a revealable reports 0.0000 no matter how
       much of it is on screen, and any threshold above 0 can never be met. The
       element would wait forever for the observer that is supposed to show it.
       The "wait until it is properly in view" part is the rootMargin's job
       anyway: -12% at the bottom holds the reveal until the element has cleared
       the last eighth of the viewport. */
    revealables.forEach(function (el) { revealer.observe(el); });
  }

  /* ---------------- 3 / district rail ---------------- */
  var railLinks = Array.prototype.slice.call(document.querySelectorAll(".district-rail a"));
  var districts = Array.prototype.slice.call(document.querySelectorAll("[data-district]"));
  var currentDistrict = "world";

  if (districts.length && "IntersectionObserver" in window) {
    var railObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        currentDistrict = entry.target.dataset.district;
        railLinks.forEach(function (link) {
          link.classList.toggle("is-here", link.dataset.rail === currentDistrict);
        });
      });
    }, { rootMargin: "-42% 0px -42% 0px" });
    districts.forEach(function (section) { railObserver.observe(section); });
  }

  /* ---------------- number roll ---------------- */
  function rollNumber(el) {
    var target = parseInt(el.dataset.count, 10);
    if (!target || reduced) return;
    var started = null;
    function step(now) {
      if (!started) started = now;
      var t = clamp((now - started) / 1100, 0, 1);
      var eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(target * eased).toLocaleString("en-US");
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  document.querySelectorAll("[data-count]").forEach(function (el) {
    if (!("IntersectionObserver" in window)) return;
    var once = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      rollNumber(el);
      once.disconnect();
    }, { threshold: 0.6 });
    once.observe(el);
  });

  /* ---------------- 4 / transmission deck ---------------- */
  var deckStage = document.querySelector(".deck-stage");
  var deckPlayer = document.getElementById("deck-player");
  var deckTitle = document.getElementById("deck-title");
  var deckSub = document.getElementById("deck-sub");
  var deckTabs = Array.prototype.slice.call(document.querySelectorAll(".deck-list button"));
  var deckTimer = null;
  var deckIndex = 0;

  function selectChannel(index, userDriven) {
    var tab = deckTabs[index];
    if (!tab || !deckPlayer) return;
    deckIndex = index;
    deckTabs.forEach(function (other, i) {
      other.classList.toggle("is-active", i === index);
      other.setAttribute("aria-selected", i === index ? "true" : "false");
    });
    deckStage.classList.add("is-swapping");
    setTimeout(function () {
      deckPlayer.src = tab.dataset.src;
      deckPlayer.play().catch(function () {});
      deckTitle.textContent = tab.dataset.title;
      deckSub.innerHTML = tab.dataset.sub;
      deckStage.classList.remove("is-swapping");
    }, reduced ? 0 : 300);
    if (userDriven) restartDeckTimer();
  }

  function restartDeckTimer() {
    if (deckTimer) clearInterval(deckTimer);
    if (reduced || !deckTabs.length) return;
    deckTimer = setInterval(function () {
      selectChannel((deckIndex + 1) % deckTabs.length, false);
    }, 7600);
  }

  deckTabs.forEach(function (tab, index) {
    tab.addEventListener("click", function () { selectChannel(index, true); });
    tab.addEventListener("mouseenter", function () { tab.querySelector("video").play().catch(function () {}); });
    tab.addEventListener("mouseleave", function () { tab.querySelector("video").pause(); });
  });
  if (deckStage) {
    deckStage.addEventListener("mouseenter", function () { if (deckTimer) clearInterval(deckTimer); });
    deckStage.addEventListener("mouseleave", restartDeckTimer);
    restartDeckTimer();
  }
  /* ---------------- 5 / casting reel ---------------- */
  var reel = document.querySelector(".reel");
  var casts = Array.prototype.slice.call(document.querySelectorAll(".cast"));
  var reelIdle = null;
  var reelTouched = false;

  function markFocus() {
    if (!reel || !casts.length) return;
    var centre = reel.getBoundingClientRect().left + reel.clientWidth / 2;
    var best = null;
    casts.forEach(function (card) {
      var box = card.getBoundingClientRect();
      var distance = Math.abs(box.left + box.width / 2 - centre);
      if (!best || distance < best.distance) best = { card: card, distance: distance };
    });
    casts.forEach(function (card) { card.classList.toggle("is-focus", best && card === best.card); });
  }

  /* Idle drift keeps the reel alive until the visitor takes over. */
  function startDrift() {
    if (reduced || !reel || reelTouched) return;
    reelIdle = setInterval(function () {
      if (reelTouched) return;
      var end = reel.scrollWidth - reel.clientWidth;
      reel.scrollLeft = reel.scrollLeft >= end - 2 ? 0 : reel.scrollLeft + 1;
    }, 26);
  }
  function stopDrift() { reelTouched = true; if (reelIdle) clearInterval(reelIdle); }

  if (reel) {
    reel.addEventListener("scroll", markFocus, { passive: true });
    ["pointerdown", "wheel", "touchstart", "keydown"].forEach(function (type) {
      reel.addEventListener(type, stopDrift, { passive: true });
    });
    reel.addEventListener("keydown", function (event) {
      var step = reel.clientWidth * 0.7;
      if (event.key === "ArrowRight") { reel.scrollBy({ left: step, behavior: "smooth" }); event.preventDefault(); }
      if (event.key === "ArrowLeft") { reel.scrollBy({ left: -step, behavior: "smooth" }); event.preventDefault(); }
    });

    /* Drag to scroll on pointer devices. */
    var dragging = false, dragStart = 0, scrollStart = 0;
    reel.addEventListener("pointerdown", function (event) {
      if (event.pointerType === "touch") return;
      dragging = true; dragStart = event.clientX; scrollStart = reel.scrollLeft;
      reel.classList.add("is-dragging"); reel.setPointerCapture(event.pointerId);
    });
    reel.addEventListener("pointermove", function (event) {
      if (!dragging) return;
      reel.scrollLeft = scrollStart - (event.clientX - dragStart);
    });
    ["pointerup", "pointercancel"].forEach(function (type) {
      reel.addEventListener(type, function () { dragging = false; reel.classList.remove("is-dragging"); });
    });

    markFocus();
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) startDrift(); else if (reelIdle) clearInterval(reelIdle);
      }, { threshold: 0.35 }).observe(reel);
    }
  }
  /* ---------------- 6 / product board tilt ---------------- */
  var board = document.querySelector("[data-tilt]");
  if (board && !touch && !reduced) {
    board.addEventListener("pointermove", function (event) {
      var box = board.getBoundingClientRect();
      var x = (event.clientX - box.left) / box.width - 0.5;
      var y = (event.clientY - box.top) / box.height - 0.5;
      board.style.setProperty("--tx", (x * 9).toFixed(2) + "deg");
      board.style.setProperty("--ty", (-y * 6).toFixed(2) + "deg");
    });
    board.addEventListener("pointerleave", function () {
      board.style.setProperty("--tx", "0deg");
      board.style.setProperty("--ty", "0deg");
    });
  }

  /* ---------------- 7 / theme dock (concept only) ---------------- */
  var dockButtons = Array.prototype.slice.call(document.querySelectorAll("[data-theme-set]"));
  var themeHandlers = [];
  function onThemeChange(fn) { themeHandlers.push(fn); }
  /* The light rig travels with the direction: the paper direction is a daylight
     city plan, the two dark ones are after dark. capycity.js reads data-hour off
     the root at init, so this has to be set before that script runs - it is, both
     scripts are deferred and this one is first in the document. */
  var THEME_HOUR = { night: "night", chrome: "night", paper: "day" };
  function setTheme(name) {
    root.dataset.theme = name;
    root.dataset.hour = THEME_HOUR[name] || "night";
    dockButtons.forEach(function (other) {
      other.classList.toggle("is-active", other.dataset.themeSet === name);
    });
    themeHandlers.forEach(function (fn) { fn(); });
  }
  dockButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      var name = button.dataset.themeSet;
      /* CapyCity reads the 63-name palette once and bakes it into per-instance
         colour attributes, so restyling in place would move the page and leave the
         city painted in the direction you just left. Where it is live on the plate
         the dock reloads into the theme instead. Concept-page affordance only -
         the shipped design has no dock, so it has nothing to reload for. */
      var plate = document.getElementById("city-stage");
      if (plate && plate.dataset.city === "capycity"
          && plate.dataset.renderer === "webgl" && name !== root.dataset.theme) {
        location.search = "?theme=" + name;
        return;
      }
      setTheme(name);
    });
  });
  /* ?theme=paper opens a preview link straight into one direction. */
  var wanted = (location.search.match(/theme=(night|paper|chrome)/) || [])[1];
  if (wanted) setTheme(wanted);

  /* ==================================================================
     1 / THE CITY - a single continuous camera descent, driven by scroll
     ================================================================== */
  var stage = document.getElementById("city-stage");
  if (!stage) return;
  /* data-city="capycity" hands the plate over to capycity.js - the built city,
     the crew on the pavement, traffic, signals - and this simpler rain-and-towers
     descent stands down. Everything below is left intact and is one attribute
     away: drop data-city and this city comes back. */
  if (stage.dataset.city === "capycity") return;

  var saveData = navigator.connection && navigator.connection.saveData;
  if (reduced || saveData || !window.THREE) return;   /* CSS skyline stays visible */

  var THREE = window.THREE;
  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: !narrow, alpha: false, powerPreference: "high-performance" });
  } catch (error) { return; }

  renderer.setPixelRatio(narrow ? 1 : Math.min(devicePixelRatio || 1, 1.3));
  renderer.domElement.setAttribute("role", "presentation");
  stage.insertBefore(renderer.domElement, stage.querySelector(".city-scrim"));
  stage.dataset.renderer = "webgl";

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(46, 1, 0.5, 260);
  var clock = new THREE.Clock();
  var pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  /* ---- palette bridged from CSS tokens, so themes recolour the city ---- */
  var palette = {};
  var registry = { sky: [], road: [], bld: [], win: [], beacon: [], star: [] };

  function readPalette() {
    ["sky", "road", "bld", "win", "beacon", "star"].forEach(function (role) {
      palette[role] = new THREE.Color(token("--city-" + role));
    });
    palette.fogA = parseFloat(token("--city-fog-a")) || 13;
    palette.fogB = parseFloat(token("--city-fog-b")) || 46;
  }
  readPalette();

  scene.fog = new THREE.Fog(palette.sky.getHex(), palette.fogA, palette.fogB);
  renderer.setClearColor(palette.sky, 1);

  function mat(role, opacity, shade) {
    var material = new THREE.MeshBasicMaterial({
      color: palette[role].clone().multiplyScalar(shade || 1),
      transparent: opacity < 1, opacity: opacity, depthWrite: opacity >= 1
    });
    material.userData.role = role;
    material.userData.shade = shade || 1;
    material.userData.baseOpacity = opacity;
    registry[role].push(material);
    return material;
  }

  function applyPalette() {
    readPalette();
    renderer.setClearColor(palette.sky, 1);
    scene.fog.color.copy(palette.sky);
    scene.fog.near = palette.fogA;
    scene.fog.far = palette.fogB;
    Object.keys(registry).forEach(function (role) {
      registry[role].forEach(function (material) {
        material.color.copy(palette[role]).multiplyScalar(material.userData.shade);
      });
    });
    starMaterial.color.copy(palette.star);
    rainMaterial.color.copy(palette.star);
  }
  onThemeChange(applyPalette);

  /* ---- ground, boulevard, wet reflection ---- */
  var city = new THREE.Group();
  scene.add(city);

  var ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), mat("road", 1, 0.55));
  ground.rotation.x = -Math.PI / 2;
  city.add(ground);
  var boulevard = new THREE.Mesh(new THREE.PlaneGeometry(11, 220), mat("road", 1, 1));
  boulevard.rotation.x = -Math.PI / 2;
  boulevard.position.set(0, 0.02, -50);
  city.add(boulevard);

  /* Acid centreline, plus a dimmer copy just above it for a wet-street sheen. */
  var centreLine = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 220), mat("win", 0.9, 1));
  centreLine.rotation.x = -Math.PI / 2;
  centreLine.position.set(0, 0.05, -50);
  city.add(centreLine);

  var sheen = new THREE.Mesh(new THREE.PlaneGeometry(9, 220), mat("win", 0.05, 1));
  sheen.rotation.x = -Math.PI / 2;
  sheen.position.set(0, 0.04, -50);
  city.add(sheen);

  /* Cross streets every 22 units give the descent a sense of speed. */
  for (var cross = 6; cross > -110; cross -= 22) {
    var strip = new THREE.Mesh(new THREE.PlaneGeometry(46, 5.5), mat("road", 1, 0.82));
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(0, 0.03, cross);
    city.add(strip);
    var edge = new THREE.Mesh(new THREE.PlaneGeometry(46, 0.09), mat("star", 0.36, 1));
    edge.rotation.x = -Math.PI / 2;
    edge.position.set(0, 0.06, cross);
    city.add(edge);
  }

  /* ---- blocks: two rows of towers with lit facades ---- */
  var windowMaterials = [];
  function tower(x, z, width, depth, height, shade, focal) {
    var body = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), mat("bld", 1, shade));
    body.position.set(x, height / 2, z);
    city.add(body);

    var facing = x < 0 ? 1 : -1;
    var faceX = x + facing * (width / 2 + 0.02);
    var rows = Math.max(2, Math.floor(height / 1.5));
    var cols = Math.max(2, Math.floor(depth / 1.7));
    for (var r = 0; r < rows; r += 1) {
      for (var c = 0; c < cols; c += 1) {
        if (Math.random() > 0.72) continue;
        var warm = (r + c) % 4 === 0;
        var glass = mat(warm ? "beacon" : "win", 0.55 + Math.random() * 0.35, 1);
        var pane = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.5), glass);
        pane.position.set(faceX, 1.5 + r * 1.5, z - depth / 2 + 1 + c * 1.7);
        pane.rotation.y = facing * Math.PI / 2;
        city.add(pane);
        windowMaterials.push(glass);
      }
    }
    if (!focal) return;
    var crown = new THREE.Mesh(new THREE.CylinderGeometry(width * 0.14, width * 0.34, 1.5, 6), mat("beacon", 0.9, 1));
    crown.position.set(x, height + 0.75, z);
    city.add(crown);
    var lamp = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 10), mat("beacon", 1, 1));
    lamp.position.set(x, height + 1.9, z);
    city.add(lamp);
    beacons.push(lamp);
    /* A cheap light cone: additive cylinder, no lights in the scene. */
    var cone = new THREE.Mesh(new THREE.ConeGeometry(2.6, 9, 12, 1, true), new THREE.MeshBasicMaterial({
      color: palette.beacon.clone(), transparent: true, opacity: 0.05,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    }));
    cone.position.set(x, height - 3.2, z);
    city.add(cone);
    registry.beacon.push(cone.material);
    cone.material.userData.role = "beacon";
    cone.material.userData.shade = 1;
  }

  var beacons = [];
  var blockSeed = 7;
  function nextRandom() { blockSeed = (blockSeed * 9301 + 49297) % 233280; return blockSeed / 233280; }

  for (var z = 12; z > -108; z -= 11) {
    [-1, 1].forEach(function (side) {
      var offset = 7.2 + nextRandom() * 7;
      var height = 5 + nextRandom() * 20;
      var focal = height > 20;
      tower(side * offset, z - nextRandom() * 4, 4 + nextRandom() * 3.4,
        5 + nextRandom() * 4, height, 0.72 + nextRandom() * 0.5, focal);
    });
  }

  /* ---- moon, stars, rain ---- */
  var moon = new THREE.Mesh(new THREE.SphereGeometry(4.4, 22, 22), mat("win", 0.85, 1));
  moon.position.set(-34, 46, -128);
  city.add(moon);

  var starGeometry = new THREE.BufferGeometry();
  var starPositions = new Float32Array(700 * 3);
  for (var s = 0; s < 700; s += 1) {
    starPositions[s * 3] = (nextRandom() - 0.5) * 240;
    starPositions[s * 3 + 1] = 18 + nextRandom() * 70;
    starPositions[s * 3 + 2] = -nextRandom() * 220 + 30;
  }
  starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
  var starMaterial = new THREE.PointsMaterial({ color: palette.star.clone(), size: 0.32,
    transparent: true, opacity: 0.6, depthWrite: false, fog: false });
  scene.add(new THREE.Points(starGeometry, starMaterial));
  var rainCount = narrow ? 260 : 560;
  var rainGeometry = new THREE.BufferGeometry();
  var rainPositions = new Float32Array(rainCount * 3);
  for (var d = 0; d < rainCount; d += 1) {
    rainPositions[d * 3] = (nextRandom() - 0.5) * 70;
    rainPositions[d * 3 + 1] = nextRandom() * 40;
    rainPositions[d * 3 + 2] = (nextRandom() - 0.5) * 70;
  }
  rainGeometry.setAttribute("position", new THREE.BufferAttribute(rainPositions, 3));
  var rainMaterial = new THREE.PointsMaterial({ color: palette.star.clone(), size: 0.14,
    transparent: true, opacity: 0.3, depthWrite: false });
  var rain = new THREE.Points(rainGeometry, rainMaterial);
  scene.add(rain);
  var rainArray = rainGeometry.attributes.position.array;

  /* ---- traffic ---- */
  var traffic = [];
  for (var t = 0; t < 14; t += 1) {
    var lane = t % 2 ? 2.6 : -2.6;
    var car = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 2.4), mat(t % 3 ? "win" : "beacon", 0.95, 1));
    car.position.set(lane, 0.4, 10 - t * 8.4);
    city.add(car);
    traffic.push({ mesh: car, speed: 0.16 + (t % 4) * 0.05, direction: t % 2 ? -1 : 1 });
  }

  /* ==========  THE DESCENT  ==========
     One spline through the city. Scroll position maps to distance along it,
     so the whole page is a single continuous camera move. */
  var route = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 34, 54),
    new THREE.Vector3(4, 22, 30),
    new THREE.Vector3(-2.5, 11, 8),
    new THREE.Vector3(1.5, 3.8, -16),
    new THREE.Vector3(-3.5, 5.4, -42),
    new THREE.Vector3(4.5, 12, -68),
    new THREE.Vector3(0, 22, -98)
  ]);

  var travel = 0;
  var here = new THREE.Vector3();
  var ahead = new THREE.Vector3();
  var lookAt = new THREE.Vector3(0, 4, -40);

  function resize() {
    var width = stage.clientWidth || innerWidth;
    var height = stage.clientHeight || innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
  }
  addEventListener("resize", resize, { passive: true });
  resize();
  /* Pointer adds a gentle sway, so the city breathes with the cursor. */
  if (!touch) {
    addEventListener("pointermove", function (event) {
      pointer.tx = (event.clientX / innerWidth - 0.5) * 2;
      pointer.ty = (event.clientY / innerHeight - 0.5) * 2;
    }, { passive: true });
  }

  /* Lamps need transparency enabled up front so the pulse is visible. */
  beacons.forEach(function (lamp) {
    lamp.material.transparent = true;
    lamp.material.depthWrite = false;
  });

  var smoothed = 0;

  function render() {
    var delta = Math.min(clock.getDelta(), 0.05);
    var elapsed = clock.elapsedTime;

    /* Scroll maps to distance along the route; the lerp keeps it silky. */
    smoothed = lerp(smoothed, progress, 0.055);
    travel = clamp(smoothed, 0, 1);
    route.getPointAt(travel, here);
    route.getPointAt(Math.min(travel + 0.045, 1), ahead);

    pointer.x = lerp(pointer.x, pointer.tx, 0.05);
    pointer.y = lerp(pointer.y, pointer.ty, 0.05);

    camera.position.set(
      here.x + pointer.x * 1.7,
      here.y + Math.sin(elapsed * 0.5) * 0.18 - pointer.y * 0.9,
      here.z
    );
    lookAt.set(ahead.x, ahead.y - 1.5, ahead.z - 13);
    camera.lookAt(lookAt);
    camera.rotation.z = pointer.x * 0.013;

    /* Street level pulls the fog in close; the skyline lets it breathe out. */
    var street = 1 - clamp(Math.abs(here.y - 4) / 26, 0, 1);
    scene.fog.near = lerp(palette.fogA * 1.5, palette.fogA * 0.55, street);
    scene.fog.far = lerp(palette.fogB * 1.15, palette.fogB * 0.8, street);
    /* Traffic runs the boulevard and wraps at the ends. */
    traffic.forEach(function (unit) {
      unit.mesh.position.z += unit.direction * unit.speed * delta * 34;
      if (unit.mesh.position.z > 14) unit.mesh.position.z = -108;
      if (unit.mesh.position.z < -108) unit.mesh.position.z = 14;
    });

    /* Rain travels with the camera so the volume is never empty. */
    rain.position.set(camera.position.x, 0, camera.position.z - 20);
    for (var i = 1; i < rainArray.length; i += 3) {
      rainArray[i] -= delta * 27;
      if (rainArray[i] < 0) rainArray[i] = 40;
    }
    rainGeometry.attributes.position.needsUpdate = true;

    /* A few windows flicker each frame - the city is awake. */
    for (var f = 0; f < 3; f += 1) {
      var glass = windowMaterials[(Math.random() * windowMaterials.length) | 0];
      if (glass) glass.opacity = clamp(glass.userData.baseOpacity + (Math.random() - 0.5) * 0.45, 0.14, 1);
    }

    /* Rooftop beacons breathe out of phase with each other. */
    beacons.forEach(function (lamp, index) {
      var pulse = (Math.sin(elapsed * 1.6 + index * 1.3) + 1) / 2;
      lamp.material.opacity = 0.5 + pulse * 0.5;
      lamp.scale.setScalar(0.88 + pulse * 0.34);
    });

    starMaterial.opacity = 0.45 + Math.sin(elapsed * 0.7) * 0.08;
    renderer.render(scene, camera);
  }

  renderer.setAnimationLoop(render);
  document.addEventListener("visibilitychange", function () {
    renderer.setAnimationLoop(document.hidden ? null : render);
  });
  addEventListener("pagehide", function () { renderer.setAnimationLoop(null); });
}());
