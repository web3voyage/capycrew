/* ==========================================================================
   CapyCrew - concept 03 - CapyCity   (concept only, nothing shipped)

   An animated city: toon-shaded, sun-lit, shadow-cast, driven and walked.
   One unit is one metre - the same metre the 3.4-unit storeys are cut to -
   so a hatchback, a bus and a capybara all drop in at their real sizes.
   There is not a single texture on a surface in here: every paint is flat
   colour on a three-step ramp, which is how cel animation is actually
   painted, and it is why a city this dense fits in a few hundred draws.

   Two hosts, one city. capycity.html gives it the whole viewport and a
   preview dock. The Dispatch (concept 02) and After Dark (concept 01) mount
   the same city as the plate behind their type, take the palette from their
   own stylesheet, and fly the camera on page scroll.

   Three rules the whole file answers to:

     1. Nothing intersects anything. Every prop books its footprint on a
        grid before it is placed, every vehicle holds a lane and a clamped
        gap, every walker holds a lane and yields at a kerb. Interpenetration
        is prevented at placement time, not hoped for at render time.

     2. Anything that moves is a rig of parts with permanent instance slots,
        rewritten every frame. A wheel rolls by the distance it has actually
        travelled and steers about its own axle; a limb swings from a pivot
        at the hip. Nothing slides, nothing floats, nothing pops.

     3. The grade is the look. The scene renders linear into a half-float
        buffer and one composite pass does bloom, ACES, vignette and grain
        and encodes to sRGB. Toon shading without a grade reads like flat
        vector art; with one, it reads like a frame of film.
   ========================================================================== */
(() => {
  'use strict';

  /* Two hosts, one city. Standalone the scene owns the viewport and the dock
     flies it. Dropped into a page it becomes the plate behind the type: same
     city, same metre, but the page's own scroll flies the camera. */
  const stage = document.getElementById('city')
    || document.getElementById('city-stage');
  const T = window.THREE;
  if (!stage) return;
  const EMBED = stage.id === 'city-stage';
  const doc = document.documentElement;

  /* Every way this can fail ends here, and says why. A dead plate looks
     exactly like a plate that has nothing to show yet, so the reason goes to
     the console rather than nowhere. */
  const dead = (why) => {
    stage.classList.add('is-dead');
    stage.setAttribute('data-renderer', 'none');
    if (window.console && console.warn) console.warn('CapyCity: no city. ' + why);
  };
  if (!T || !T.MeshToonMaterial) {
    return dead('three.js is not loaded. Check the <script src="../three.min.js">'
      + ' path - a root-absolute /static/... src resolves to the drive root when'
      + ' the page is opened as a file:// URL.');
  }
  if (!T.WebGLRenderTarget || !T.ShaderMaterial) {
    return dead('this three.js build has no render targets or shader materials,'
      + ' so the composite pass cannot run. r160 or newer is expected.');
  }

  /* ---- the hour, resolved before anything is read or built ---------------
     Three grades: midday, golden, night. Two of the fields cannot be changed
     live and that is what fixes the order of this file.

     `lit` is the fraction of windows with a light on, decided per window during
     the build pass and baked into an instance colour. And the sky is a paint
     like every other paint - it comes out of the host stylesheet, which keys it
     off data-hour on <html>. So the hour has to be on the root element before
     the palette read below, or the city gets a night light rig under a midday
     sky: correct facades, glowing windows, and a bright blue afternoon
     overhead. That was the bug; this ordering is the fix.

     The hour can arrive on the query string, which is how the dock changes it -
     `lit` is baked, so switching hour is a reload, not a restyle. */
  const HOURS = {
    day: { az: 0.72, el: 0.86, sun: 1.42, hemi: 0.66, fill: 0.16, lobe: 0.55,
      tint: 0xfff4e2, lit: 0.06, exposure: 1.06, bloom: 0.34 },
    golden: { az: 2.32, el: 0.20, sun: 1.62, hemi: 0.50, fill: 0.24, lobe: 1.25,
      tint: 0xffc27a, lit: 0.34, exposure: 1.12, bloom: 0.62 },
    night: { az: 2.9, el: 0.15, sun: 0.30, hemi: 0.34, fill: 0.30, lobe: 0.22,
      tint: 0x9fb6ff, lit: 0.82, exposure: 1.24, bloom: 0.92 },
  };
  const qs = (k) => {
    const m = new RegExp('[?&]' + k + '=([^&#]*)').exec(location.search);
    return m ? decodeURIComponent(m[1]) : '';
  };
  let hourName = (qs('hour') || doc.dataset.hour || stage.dataset.hour || 'day');
  if (!HOURS[hourName]) hourName = 'day';
  const hour = HOURS[hourName];
  /* Written back so the sheet and the dock agree with the query string. */
  doc.dataset.hour = hourName;

  /* ---- palette, read straight out of the stylesheet ---------------------
     Sixty-three names, and not one colour of its own. The read is off the
     stage rather than off :root on purpose: custom properties inherit, so a
     sheet that declares them on :root still resolves here, but a host that
     would rather keep the city's paints out of its global scope can put them
     on #city-stage instead and nothing else changes. That matters because
     these are one-word names - --mark, --plate, --head, --trim, --post - and
     several of them would be a poor neighbour in a page-wide stylesheet.

     Adding a paint means adding it here AND to the city-plate block of every
     host sheet, or it silently falls back to #8b8b8b. */
  const css = getComputedStyle(stage);
  const NAMES = ('sky-top sky-mid sky-low sun cloud road road-2 mark kerb kerb-top walk walk-2 ' +
    'grate bld-a bld-b bld-c bld-d bld-e bld-f trim roof roof-2 glass glass-lit awning-a ' +
    'awning-b awning-c trunk leaf-a leaf-b leaf-c soil car-1 car-2 car-3 car-4 car-5 car-6 ' +
    'taxi tyre rim chrome plate head tail post lamp-glow sig-red sig-amber sig-green sig-off ' +
    'capy capy-2 capy-dark capy-nose fit-1 fit-2 fit-3 fit-4 fit-5 fit-6 fit-7 fit-8').split(' ');
  const C = {};
  let missing = 0;
  NAMES.forEach((n) => {
    const v = css.getPropertyValue('--' + n).trim();
    if (!v) missing++;
    C[n.replace(/-(\w)/g, (m, ch) => ch.toUpperCase())] = new T.Color(v || '#8b8b8b').getHex();
  });
  if (missing && window.console && console.warn) {
    console.warn('CapyCity: ' + missing + ' of ' + NAMES.length + ' paints are not'
      + ' declared on this page - those parts fall back to grey. Check the'
      + ' city-plate block of the host stylesheet.');
  }
  const CAR_TONES = [C.car1, C.car2, C.car3, C.car4, C.car5, C.car6];
  const FITS = [C.fit1, C.fit2, C.fit3, C.fit4, C.fit5, C.fit6, C.fit7, C.fit8];
  const WALLS = [C.bldA, C.bldB, C.bldC, C.bldD, C.bldE, C.bldF];
  const LEAVES = [C.leafA, C.leafB, C.leafC];
  const AWNINGS = [C.awningA, C.awningB, C.awningC];
  /* ---- deterministic randomness: the same city on every load -----------
     One seeded LCG feeds every placement decision in the file. The city has
     to be identical on every reload or the footprint grid would book a
     different set of parcels each time and the shot list would frame a
     different street - and a concept you cannot point at twice is no use in
     a review. */
  let seed = 20260902;
  const rand = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const pick = (a) => a[Math.floor(rand() * a.length)];
  const rng = (a, b) => a + rand() * (b - a);
  /* Symmetric positional jitter. Distinct from jit() below, which jitters a
     colour - two different kinds of wobble, and mixing them up puts a cloud at
     x = 15329601. */
  const off = (a) => (rand() - 0.5) * 2 * a;
  const tmpC = new T.Color();
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  /* Lightness jitter, because no two bricks are the same brick. */
  const jit = (hex, amt) => tmpC.setHex(hex)
    .offsetHSL(0, 0, clamp((rand() - 0.5) * amt, -0.35, 0.35)).getHex();

  /* ---- the city plan, in metres ----------------------------------------
     These numbers are a contract with three other things: the camera rail
     descends to eye height on this scale, the host stylesheets size their
     plate against this horizon, and every lane centreline below is derived
     from AVE. Changing one means re-checking all three. */
  const FLOOR = 3.4;                 /* one storey                         */
  const AVE = 8;                     /* avenue carriageway half-width      */
  const KERB = 0.15;                 /* kerb reveal above the asphalt      */
  const WALK_W = 5.4;                /* sidewalk width                     */
  const FRONT = AVE + WALK_W;        /* building line, 13.4                */
  const CROSS = 7;                   /* cross-street half-width            */
  const BLOCK = 68;                  /* avenue block pitch                 */
  const NEAR_Z = 54, FAR_Z = -900;
  const SPAN = NEAR_Z - FAR_Z;       /* 954 m of avenue                    */
  const CROSS_X = 190;               /* how far the cross streets run      */
  const crossZ = [];
  for (let z = 34; z > FAR_Z + 44; z -= BLOCK) crossZ.push(z);
  /* Downtown sits partway up the avenue, so the skyline has a peak. */
  const DOWNTOWN = -300;
  const heightAt = (z) => clamp(1 - Math.abs(z - DOWNTOWN) / 430, 0.06, 1);
  /* Every population below is quoted per 614 m, the span this plan was first
     drawn at, and scaled to whatever SPAN is now. Lengthening the avenue
     without this thins the city out instead of extending it. */
  const DENS = SPAN / 614;
  const per = (n) => Math.round(n * DENS);

  /* ---- the frame, and whether it is allowed to move --------------------
     The plate is a fixed box inside a document that scrolls, so the stage's
     own box is the frame - not the window. innerWidth counts a scrollbar the
     canvas never covers, which would push the render past the right edge and
     skew the aspect by about a percent. The || is for the case where the
     stage has no layout yet. */
  const boxW = () => stage.clientWidth || innerWidth;
  const boxH = () => stage.clientHeight || innerHeight;

  /* One still frame for anyone who has asked not to be moved, and for anyone
     paying for their bytes - the Dispatch made both of those promises. */
  const still = (typeof matchMedia === 'function'
      && matchMedia('(prefers-reduced-motion: reduce)').matches)
    || !!(navigator.connection && navigator.connection.saveData);
  /* ===== RULE 1: THE FOOTPRINT GRID =====================================
     The old city placed its props at random x and z and hoped. This one
     books ground before it builds on it.

     A half-metre lattice over the whole plan, one byte a cell. Every static
     thing - a building, a lamp, a tree, a bin, a bus shelter - asks for the
     rectangle it needs plus a clearance margin, and either gets it and marks
     it taken or is told no and asks somewhere else. It is the crudest
     possible spatial index and exactly the right one: placement happens once
     at build time, the lattice is a two-megabyte byte array at the current
     plan size, and a test is four adds and a loop over about forty bytes.

     The three zones of a real sidewalk fall out of it for free. The
     carriageway and the crossings are booked before anything else, so no
     tree can stand in the road. The walking corridor is booked too, which is
     what stops the shelter posts from landing in the middle of the pavement
     the way they used to - the walkers are dynamic and never consult the
     grid, so their lane has to be reserved on their behalf. What is left is
     a kerb-side furniture strip and a narrow strip against the shopfronts,
     and that is where the street furniture goes. */
  const CELL = 0.5;
  const GX0 = -CROSS_X - 44, GZ0 = FAR_Z - 44;
  const GW = Math.ceil((CROSS_X * 2 + 88) / CELL);
  const GD = Math.ceil((NEAR_Z - FAR_Z + 88) / CELL);
  const grid = new Uint8Array(GW * GD);

  /* Inclusive cell bounds for a world-space rect, clipped to the lattice.
     Anything wholly outside is reported as an empty span, which reads as
     "already taken" so a prop can never be placed off the plan. */
  const span = (x, z, w, d, pad) => {
    const m = pad === undefined ? 0.3 : pad;
    const i0 = Math.floor((x - w / 2 - m - GX0) / CELL);
    const i1 = Math.ceil((x + w / 2 + m - GX0) / CELL);
    const j0 = Math.floor((z - d / 2 - m - GZ0) / CELL);
    const j1 = Math.ceil((z + d / 2 + m - GZ0) / CELL);
    return [Math.max(i0, 0), Math.min(i1, GW - 1),
      Math.max(j0, 0), Math.min(j1, GD - 1),
      i0 >= 0 && i1 < GW && j0 >= 0 && j1 < GD];
  };
  const free = (x, z, w, d, pad) => {
    const s = span(x, z, w, d, pad);
    if (!s[4]) return false;
    for (let j = s[2]; j <= s[3]; j++) {
      const row = j * GW;
      for (let i = s[0]; i <= s[1]; i++) if (grid[row + i]) return false;
    }
    return true;
  };
  const mark = (x, z, w, d, pad) => {
    const s = span(x, z, w, d, pad);
    for (let j = s[2]; j <= s[3]; j++) {
      const row = j * GW;
      for (let i = s[0]; i <= s[1]; i++) grid[row + i] = 1;
    }
  };
  /* Test and set in one call: the only way a prop is allowed onto the plan. */
  const book = (x, z, w, d, pad) => {
    if (!free(x, z, w, d, pad)) return false;
    mark(x, z, w, d, pad);
    return true;
  };
  /* Ask for a spot up to `tries` times, each time from a fresh roll, and
     place at the first one that is clear. Returning null rather than forcing
     a placement is the whole point - a street with eleven trees on it and no
     tree inside a bus shelter is better than a street with twelve. */
  const spot = (roll, w, d, pad, tries) => {
    for (let n = 0; n < (tries || 24); n++) {
      const p = roll();
      if (p && book(p[0], p[1], w, d, pad)) return p;
    }
    return null;
  };

  /* The carriageways, booked before anything else is built. */
  mark(0, (NEAR_Z + FAR_Z) / 2, AVE * 2, SPAN + 60, 0);
  crossZ.forEach((cz) => mark(0, cz, CROSS_X * 2, CROSS * 2, 0));

  /* The walking corridor, reserved on the walkers' behalf. A real sidewalk
     is three strips: furniture at the kerb, a clear through-route in the
     middle, and a frontage strip where the awnings and the shop signs hang.
     WALK_W is 5.4, so 1.5 of furniture, 2.6 of corridor, 1.3 of frontage. */
  const FURN_0 = AVE, FURN_1 = AVE + 1.5;          /*  8.0 - 9.5  */
  const CORR_0 = FURN_1, CORR_1 = AVE + 4.1;       /*  9.5 - 12.1 */
  const FRONT_0 = CORR_1, FRONT_1 = FRONT;         /* 12.1 - 13.4 */
  const CORR_MID = (CORR_0 + CORR_1) / 2;
  [-1, 1].forEach((sx) => {
    mark(sx * CORR_MID, (NEAR_Z + FAR_Z) / 2, CORR_1 - CORR_0, SPAN + 60, 0);
  });
  /* Crossings punch through the furniture strip so a walker stepping off the
     kerb never has to walk through a bollard to reach the zebra - both at the
     corner itself and at the two step-off points, which sit a good 8.7 m up
     and down the avenue from the centre of the junction, on the far side of the
     cross street where the zebra is actually painted. */
  const ZEBRA = crossZ.slice();
  ZEBRA.forEach((cz) => {
    [-1, 1].forEach((sx) => {
      mark(sx * (AVE + WALK_W / 2), cz, WALK_W, 9, 0);
      [-1, 1].forEach((zs) => {
        mark(sx * (AVE + WALK_W / 2), cz + zs * (CROSS + 1.7), WALK_W, 4.4, 0);
      });
    });
  });
  /* ===== RULE 3: THE RENDERER AND THE GRADE =============================
     The scene never draws to the screen. It draws into a half-float buffer
     in linear light, and a composite pass reads that buffer, blooms the
     brightest parts of it, puts it through an ACES curve, vignettes it,
     lays grain over it and encodes to sRGB. The toon ramp does the drawing;
     the grade is what makes it read as film rather than as flat vector art.

     Half-float and not byte: a lit window and a headlamp are both above 1.0
     in linear light, and a byte buffer clips them to white before the bloom
     ever sees them, which is precisely the information bloom is made of. */
  let renderer;
  try {
    renderer = new T.WebGLRenderer({
      antialias: false,              /* the composite pass resolves edges   */
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
    });
  } catch (e) {
    return dead('the browser would not give this page a WebGL context.');
  }
  renderer.setSize(boxW(), boxH(), false);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  /* The composite pass encodes sRGB itself - a raw ShaderMaterial does not
     get three's colorspace chunk - so the renderer is told to leave the
     final buffer alone rather than convert it twice. */
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  renderer.toneMapping = T.NoToneMapping;   /* ACES lives in the composite  */
  renderer.setClearColor(C.skyMid, 1);
  stage.appendChild(renderer.domElement);
  stage.setAttribute('data-renderer', 'webgl');

  const scene = new T.Scene();
  scene.fog = new T.FogExp2(C.skyLow, 0.00082);
  const camera = new T.PerspectiveCamera(52, boxW() / boxH(), 0.4, 2800);

  /* Antialiasing without a multisampled buffer: the composite pass takes
     four taps a pixel off the scene buffer at the corners of a half-pixel
     box. It is cheap, it costs no extra memory, and on flat toon colour with
     hard silhouettes it does most of what MSAA would do. Where the build
     supports multisampling on a render target it is used as well, because
     the two are complementary - samples fix geometry edges, taps fix the
     ramp's own banding on a near-tangent surface. */
  const MSAA = 4;
  const HALF = T.HalfFloatType;
  const makeRT = (w, h, samples, depth) => {
    const rt = new T.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
      type: HALF,
      depthBuffer: !!depth,
      stencilBuffer: false,
      minFilter: T.LinearFilter,
      magFilter: T.LinearFilter,
      wrapS: T.ClampToEdgeWrapping,
      wrapT: T.ClampToEdgeWrapping,
    });
    /* Linear in, linear out: the composite does the encoding, so nothing in
       the chain may convert on sample or it would be graded twice. */
    if ('colorSpace' in rt.texture) rt.texture.colorSpace = T.LinearSRGBColorSpace;
    if (samples && 'samples' in rt) rt.samples = samples;
    rt.texture.generateMipmaps = false;
    return rt;
  };

  /* The bloom chain. Four halvings, each one blurred separately and summed
     back at the end: the tight levels put a bright rim on a headlamp, the
     broad ones put haze in the air above downtown. One chain of progressively
     smaller buffers is how every film bloom is built, and it is far cheaper
     than one wide blur at full resolution. */
  const LEVELS = 4;
  let sceneRT = null;
  const mip = [], scratch = [];
  const sizeTargets = () => {
    const dpr = renderer.getPixelRatio();
    const w = Math.max(2, Math.round(boxW() * dpr));
    const h = Math.max(2, Math.round(boxH() * dpr));
    if (!sceneRT) sceneRT = makeRT(w, h, MSAA, true);
    else sceneRT.setSize(w, h);
    for (let i = 0; i < LEVELS; i++) {
      const lw = Math.max(2, w >> (i + 1)), lh = Math.max(2, h >> (i + 1));
      if (!mip[i]) { mip[i] = makeRT(lw, lh, 0, false); scratch[i] = makeRT(lw, lh, 0, false); }
      else { mip[i].setSize(lw, lh); scratch[i].setSize(lw, lh); }
    }
  };
  sizeTargets();

  /* One triangle that covers the viewport, drawn with an identity camera.
     A triangle and not a quad: it is one primitive instead of two, it has no
     diagonal seam for the derivative to trip over, and clip space is exactly
     where a composite pass wants to work. */
  const fsGeo = new T.BufferGeometry();
  fsGeo.setAttribute('position', new T.BufferAttribute(
    new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  fsGeo.setAttribute('uv', new T.BufferAttribute(
    new Float32Array([0, 0, 2, 0, 0, 2]), 2));
  const fsCam = new T.Camera();
  const fsScene = new T.Scene();
  const fsMesh = new T.Mesh(fsGeo, null);
  fsMesh.frustumCulled = false;
  fsScene.add(fsMesh);
  const blit = (mat, target) => {
    fsMesh.material = mat;
    renderer.setRenderTarget(target || null);
    renderer.render(fsScene, fsCam);
  };
  const VERT = [
    'varying vec2 vUv;',
    'void main() {',
    '  vUv = uv;',
    '  gl_Position = vec4(position.xy, 0.0, 1.0);',
    '}',
  ].join('\n');

  /* Bright pass, which is also the first halving. A hard threshold on a toon
     scene puts a visible staircase along the edge of every lit window, so the
     cut has a soft knee: below the threshold nothing blooms, across the knee
     it comes up quadratically, above it the whole value passes. */
  const brightMat = new T.ShaderMaterial({
    uniforms: {
      tSrc: { value: null }, texel: { value: new T.Vector2() },
      threshold: { value: 1.05 }, knee: { value: 0.55 },
    },
    vertexShader: VERT,
    fragmentShader: [
      'uniform sampler2D tSrc;',
      'uniform vec2 texel;',
      'uniform float threshold;',
      'uniform float knee;',
      'varying vec2 vUv;',
      'void main() {',
      '  vec3 c = texture2D(tSrc, vUv + texel * vec2(-0.5, -0.5)).rgb;',
      '  c += texture2D(tSrc, vUv + texel * vec2(0.5, -0.5)).rgb;',
      '  c += texture2D(tSrc, vUv + texel * vec2(-0.5, 0.5)).rgb;',
      '  c += texture2D(tSrc, vUv + texel * vec2(0.5, 0.5)).rgb;',
      '  c *= 0.25;',
      '  float l = max(c.r, max(c.g, c.b));',
      '  float s = clamp((l - threshold + knee) / (2.0 * knee), 0.0, 1.0);',
      '  float w = max(l - threshold, s * s * knee) / max(l, 1e-4);',
      '  gl_FragColor = vec4(c * max(w, 0.0), 1.0);',
      '}',
    ].join('\n'),
    depthTest: false, depthWrite: false,
  });

  /* A plain four-tap box halving, to step down the chain. */
  const downMat = new T.ShaderMaterial({
    uniforms: { tSrc: { value: null }, texel: { value: new T.Vector2() } },
    vertexShader: VERT,
    fragmentShader: [
      'uniform sampler2D tSrc;',
      'uniform vec2 texel;',
      'varying vec2 vUv;',
      'void main() {',
      '  vec3 c = texture2D(tSrc, vUv + texel * vec2(-0.5, -0.5)).rgb;',
      '  c += texture2D(tSrc, vUv + texel * vec2(0.5, -0.5)).rgb;',
      '  c += texture2D(tSrc, vUv + texel * vec2(-0.5, 0.5)).rgb;',
      '  c += texture2D(tSrc, vUv + texel * vec2(0.5, 0.5)).rgb;',
      '  gl_FragColor = vec4(c * 0.25, 1.0);',
      '}',
    ].join('\n'),
    depthTest: false, depthWrite: false,
  });
  /* Separable gaussian, five taps standing in for nine by letting the
     hardware's own linear filter do half the averaging. Run once across and
     once down per level. */
  const blurMat = new T.ShaderMaterial({
    uniforms: { tSrc: { value: null }, dir: { value: new T.Vector2() } },
    vertexShader: VERT,
    fragmentShader: [
      'uniform sampler2D tSrc;',
      'uniform vec2 dir;',
      'varying vec2 vUv;',
      'void main() {',
      '  vec3 c = texture2D(tSrc, vUv).rgb * 0.227027;',
      '  vec2 o1 = dir * 1.3846153846;',
      '  vec2 o2 = dir * 3.2307692308;',
      '  c += (texture2D(tSrc, vUv + o1).rgb + texture2D(tSrc, vUv - o1).rgb) * 0.3162162162;',
      '  c += (texture2D(tSrc, vUv + o2).rgb + texture2D(tSrc, vUv - o2).rgb) * 0.0702702703;',
      '  gl_FragColor = vec4(c, 1.0);',
      '}',
    ].join('\n'),
    depthTest: false, depthWrite: false,
  });

  /* The composite. Everything that makes this look like a frame rather than a
     diagram happens in here, in one pass: resolve, bloom, expose, ACES,
     saturation trim, vignette, grain, encode.

     The ACES fit is Stephen Hill's two-matrix approximation of the full
     Academy transform. It matters more here than it would on a photographic
     scene: flat toon colour pushed straight through a linear-to-sRGB encode
     goes chalky in the highlights and the ramp's three steps turn into three
     visible bands, and the shoulder on this curve is what keeps a white
     stucco wall in sun reading as white stucco instead of as blown paper. */
  const compMat = new T.ShaderMaterial({
    uniforms: {
      tScene: { value: null },
      tB0: { value: null }, tB1: { value: null },
      tB2: { value: null }, tB3: { value: null },
      texel: { value: new T.Vector2() },
      res: { value: new T.Vector2() },
      aspect: { value: 1 },
      bloom: { value: 0.42 },
      exposure: { value: 1.06 },
      sat: { value: 1.04 },
      vignette: { value: 0.34 },
      grain: { value: 0.028 },
      time: { value: 0 },
    },
    vertexShader: VERT,
    fragmentShader: null,   /* assembled below, so the GLSL reads in order */
    depthTest: false, depthWrite: false,
  });
  compMat.fragmentShader = [
    'uniform sampler2D tScene;',
    'uniform sampler2D tB0;',
    'uniform sampler2D tB1;',
    'uniform sampler2D tB2;',
    'uniform sampler2D tB3;',
    'uniform vec2 texel;',
    'uniform vec2 res;',
    'uniform float aspect;',
    'uniform float bloom;',
    'uniform float exposure;',
    'uniform float sat;',
    'uniform float vignette;',
    'uniform float grain;',
    'uniform float time;',
    'varying vec2 vUv;',
    '',
    'const mat3 ACES_IN = mat3(',
    '  0.59719, 0.07600, 0.02840,',
    '  0.35458, 0.90834, 0.13383,',
    '  0.04823, 0.01566, 0.83777);',
    'const mat3 ACES_OUT = mat3(',
    '   1.60475, -0.10208, -0.00327,',
    '  -0.53108,  1.10813, -0.07276,',
    '  -0.07367, -0.00605,  1.07602);',
    '',
    'vec3 aces(vec3 c) {',
    '  c = ACES_IN * c;',
    '  vec3 a = c * (c + 0.0245786) - 0.000090537;',
    '  vec3 b = c * (0.983729 * c + 0.4329510) + 0.238081;',
    '  c = ACES_OUT * (a / b);',
    '  return clamp(c, 0.0, 1.0);',
    '}',
    '',
    'float hash(vec2 p) {',
    '  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);',
    '}',
    '',
    'vec3 encode(vec3 c) {',
    '  c = max(c, vec3(0.0));',
    '  vec3 lo = c * 12.92;',
    '  vec3 hi = 1.055 * pow(c, vec3(0.41666667)) - 0.055;',
    '  return mix(lo, hi, step(vec3(0.0031308), c));',
    '}',
  ].join('\n') + '\n';
  compMat.fragmentShader += [
    '',
    'void main() {',
    '  /* Four taps at the corners of a half-pixel box. On flat toon colour',
    '     with hard silhouettes this does most of what MSAA does, and it also',
    '     softens the ramp step on a surface turning away from the sun. */',
    '  vec3 s  = texture2D(tScene, vUv + texel * vec2(-0.25, -0.25)).rgb;',
    '  s      += texture2D(tScene, vUv + texel * vec2( 0.25, -0.25)).rgb;',
    '  s      += texture2D(tScene, vUv + texel * vec2(-0.25,  0.25)).rgb;',
    '  s      += texture2D(tScene, vUv + texel * vec2( 0.25,  0.25)).rgb;',
    '  s *= 0.25;',
    '',
    '  vec3 b = texture2D(tB0, vUv).rgb * 0.42',
    '         + texture2D(tB1, vUv).rgb * 0.28',
    '         + texture2D(tB2, vUv).rgb * 0.19',
    '         + texture2D(tB3, vUv).rgb * 0.11;',
    '',
    '  vec3 c = (s + b * bloom) * exposure;',
    '  c = aces(c);',
    '',
    '  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));',
    '  c = mix(vec3(l), c, sat);',
    '',
    '  float r = length((vUv - 0.5) * 2.0);',
    '  c *= mix(1.0, smoothstep(1.9, 0.7, r), vignette);',
    '',
    '  /* Grain weighted toward the mid-tones: film has almost none in the',
    '     highlights and none at all in solid black, and grain laid flat over',
    '     everything is the fastest way to make a clean render look dirty',
    '     rather than photographed. */',
    '  float n = hash(gl_FragCoord.xy + vec2(time * 91.3, time * 47.7));',
    '  c += (n - 0.5) * grain * (1.0 - abs(l * 2.0 - 1.0));',
    '',
    '  gl_FragColor = vec4(encode(c), 1.0);',
    '}',
  ].join('\n');
  /* Uninitialised half-float can read back as NaN, and a NaN multiplied by a
     bloom weight of zero is still a NaN, so every level is cleared once up
     front rather than trusted. */
  const clearMips = () => {
    for (let i = 0; i < LEVELS; i++) {
      renderer.setRenderTarget(mip[i]); renderer.clear(true, false, false);
      renderer.setRenderTarget(scratch[i]); renderer.clear(true, false, false);
    }
    renderer.setRenderTarget(null);
  };
  clearMips();

  let bloomOn = true;
  const composite = (t) => {
    if (bloomOn) {
      brightMat.uniforms.tSrc.value = sceneRT.texture;
      brightMat.uniforms.texel.value.set(1 / sceneRT.width, 1 / sceneRT.height);
      blit(brightMat, mip[0]);
      for (let i = 0; i < LEVELS; i++) {
        if (i > 0) {
          downMat.uniforms.tSrc.value = mip[i - 1].texture;
          downMat.uniforms.texel.value.set(1 / mip[i - 1].width, 1 / mip[i - 1].height);
          blit(downMat, mip[i]);
        }
        blurMat.uniforms.tSrc.value = mip[i].texture;
        blurMat.uniforms.dir.value.set(1 / mip[i].width, 0);
        blit(blurMat, scratch[i]);
        blurMat.uniforms.tSrc.value = scratch[i].texture;
        blurMat.uniforms.dir.value.set(0, 1 / mip[i].height);
        blit(blurMat, mip[i]);
      }
    }
    const u = compMat.uniforms;
    u.tScene.value = sceneRT.texture;
    u.tB0.value = mip[0].texture;
    u.tB1.value = mip[1].texture;
    u.tB2.value = mip[2].texture;
    u.tB3.value = mip[3].texture;
    u.texel.value.set(1 / sceneRT.width, 1 / sceneRT.height);
    u.res.value.set(sceneRT.width, sceneRT.height);
    u.aspect.value = sceneRT.width / sceneRT.height;
    u.time.value = t;
    blit(compMat, null);
  };

  /* Draw calls, read off the scene pass and nowhere else. renderer.info resets
     at the top of every render(), and the composite chain ends on a fullscreen
     triangle - so asking after the composite reports 1, every time, which is a
     true answer to the wrong question. */
  let sceneCalls = 0;
  const draw = (t) => {
    renderer.setRenderTarget(sceneRT);
    renderer.clear(true, true, false);
    renderer.render(scene, camera);
    sceneCalls = renderer.info.render.calls;
    composite(t);
  };
  /* ---- the ramp every lit surface in the city shades on -----------------
     Four steps, not a gradient: core shadow, a narrow terminator, the body
     tone and the lit face. The terminator is the step that does the work -
     it is the thin warm band a cel painter puts between the light and the
     shadow, and without it the shadow edge reads as a cut rather than as a
     turning surface. NearestFilter is what keeps them steps at all. */
  const ramp = (() => {
    const steps = [0.34, 0.52, 0.80, 1.0];
    const data = new Uint8Array(steps.length * 4);
    steps.forEach((v, i) => {
      const b = Math.round(clamp(v, 0, 1) * 255);
      data[i * 4] = b; data[i * 4 + 1] = b; data[i * 4 + 2] = b; data[i * 4 + 3] = 255;
    });
    const tex = new T.DataTexture(data, steps.length, 1, T.RGBAFormat);
    tex.minFilter = T.NearestFilter;
    tex.magFilter = T.NearestFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    return tex;
  })();

  /* ---- the hour --------------------------------------------------------
     az/el aim the sun, sun/hemi/fill set the rig, tint colours the key, and
     exposure/bloom shift the grade with the light - a golden hour that does
     not bloom more than noon is not a golden hour.

     The table itself is up at the top of the file, above the palette read,
     because the sky is one of the paints the stylesheet keys off data-hour and
     the read has to happen after the attribute is set. `hour` and `hourName`
     are already resolved by the time this section runs. */
  /* ---- light ------------------------------------------------------------
     Three lights and no more. A key that casts, a sky-and-ground hemisphere
     that fills the shadow with the colour of the pavement, and one weak
     unshadowed kick from behind the opposite shoulder so a wall that faces
     away from the sun still turns rather than going flat to the core step. */
  const hemi = new T.HemisphereLight(C.skyMid, C.walk2, hour.hemi);
  scene.add(hemi);

  const sun = new T.DirectionalLight(hour.tint, hour.sun);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.045;
  sun.shadow.radius = 2.2;
  /* The frustum is a 156 m box that travels with the camera's focus rather
     than trying to cover 614 m of avenue: a shadow map stretched over the
     whole plan would put four centimetres of texel on a kerb. */
  sun.shadow.camera.left = -78;
  sun.shadow.camera.right = 78;
  sun.shadow.camera.top = 78;
  sun.shadow.camera.bottom = -78;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 400;
  scene.add(sun);
  scene.add(sun.target);

  const kick = new T.DirectionalLight(C.skyLow, hour.fill);
  scene.add(kick);
  scene.add(kick.target);

  const sunDir = new T.Vector3();
  const kickDir = new T.Vector3();
  const aimLights = () => {
    sunDir.set(
      Math.cos(hour.az) * Math.cos(hour.el),
      Math.sin(hour.el),
      Math.sin(hour.az) * Math.cos(hour.el)).normalize();
    /* The kick comes from the far side and a little above the horizon. */
    kickDir.set(-sunDir.x, Math.abs(sunDir.y) * 0.35 + 0.28, -sunDir.z).normalize();
  };
  aimLights();
  /* ---- materials -------------------------------------------------------
     Every material is white and carries its colour per instance instead, so
     one pass can paint a whole block six shades of stucco without splitting
     into six draw calls. A pass is one geometry against one material, and
     the number of passes is the number of draws in the frame. */
  const toon = (extra) => new T.MeshToonMaterial(
    Object.assign({ color: 0xffffff, gradientMap: ramp }, extra || {}));
  const M = {
    wall: toon(),
    trim: toon(),
    roof: toon(),
    metal: toon(),
    ground: toon(),
    leaf: toon(),
    fur: toon(),
    fit: toon(),
    glass: toon({ emissive: 0x142833 }),
    cloth: toon({ side: T.DoubleSide }),
    shell: toon({ side: T.DoubleSide }),
    /* Clouds are UNLIT, and that is the whole reason they read as clouds. Under
       the toon ramp a cluster is mostly facing away from the sun, so every lobe
       quantised onto a dark step and #ffffff arrived as a grey lozenge - which
       cost about half the cloud-to-sky contrast the palette pays for. Unlit, the
       crown is actually white and the three per-instance tones below do all the
       modelling. Kept at 1.0, not above it, so the bright pass leaves them
       alone: clouds are not emitters. Fog off for the same reason as before -
       distance must not eat them. */
    cloud: new T.MeshBasicMaterial({ color: 0xffffff, fog: false }),
    /* Lamps, lenses and headlamps are unlit on purpose: an emitter that takes
       shading stops reading as an emitter. They are also the only things in
       the city written above 1.0, which is what the bright pass keys on -
       everything that blooms, blooms because it is one of these. */
    glow: new T.MeshBasicMaterial({ color: 0xffffff }),
    shade: new T.MeshBasicMaterial({
      color: C.grate, transparent: true, opacity: 0.18, depthWrite: false }),
    /* Road paint, gratings and asphalt patches are coplanar with the surface
       they sit on. A y offset alone holds up near the camera and starts to
       flicker at 400 m, where the depth buffer runs out of room, so the paint
       is pushed forward in depth as well as in space. */
    paint: toon({ polygonOffset: true, polygonOffsetFactor: -1.6,
      polygonOffsetUnits: -2 }),
  };

  /* ---- the parts bin --------------------------------------------------- */
  const G = {
    box: new T.BoxGeometry(1, 1, 1),
    slab: new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    /* A vertical quad facing +z, for anything applied to a wall: glazing,
       shop signs, posters. Yaw it a quarter turn for the side elevations. */
    pane: new T.PlaneGeometry(1, 1),
    disc: new T.CircleGeometry(0.5, 14).rotateX(-Math.PI / 2),
    tri: new T.CircleGeometry(0.5, 3).rotateX(-Math.PI / 2),
    cyl: new T.CylinderGeometry(0.5, 0.5, 1, 10),
    cyl6: new T.CylinderGeometry(0.5, 0.5, 1, 6),
    taper: new T.CylinderGeometry(0.34, 0.5, 1, 8),
    cone: new T.ConeGeometry(0.5, 1, 7),
    ball: new T.SphereGeometry(0.5, 11, 8),
    puff: new T.SphereGeometry(0.5, 7, 5),
    /* Axle along X, so a roll is a rotation about X and a steer is a yaw
       about Y - and because setAt composes in YXZ order, the yaw is applied
       first and the roll then happens about the wheel's own turned axle,
       which is exactly what a steered wheel does. */
    wheel: new T.CylinderGeometry(0.5, 0.5, 1, 14).rotateZ(Math.PI / 2),
    /* A limb hangs from the origin so a hip or a shoulder is just a rotation:
       unit length 2, unit radius 0.5, pivot at the top. */
    limb: new T.CapsuleGeometry(0.5, 1, 3, 8).translate(0, -1, 0),
  };
  const limbScale = (r, len) => [r * 2, len / 2, r * 2];
  /* ---- instancing: static ----------------------------------------------
     Static geometry is collected first and turned into InstancedMeshes only
     once the counts are in, so a pass is never over- or under-sized. Size,
     rotation and colour all ride on the instance. */
  const kinds = new Map();
  const dummy = new T.Object3D();
  dummy.rotation.order = 'YXZ';        /* yaw, then pitch, then roll        */
  const meshes = [];
  const pass = (name, geo, mat, cast, recv) => {
    kinds.set(name, { geo: geo, mat: mat, cast: !!cast, recv: !!recv, items: [] });
  };
  const add = (name, x, y, z, sx, sy, sz, col, yaw, pitch, roll) => {
    kinds.get(name).items.push([x, y, z, sx, sy, sz,
      col === undefined ? 0xffffff : col, yaw || 0, pitch || 0, roll || 0]);
  };
  const setAt = (mesh, i, x, y, z, sx, sy, sz, yaw, pitch, roll) => {
    dummy.position.set(x, y, z);
    dummy.rotation.set(pitch || 0, yaw || 0, roll || 0);
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  };
  /* Parked instances go under the world rather than to zero scale, which
     would hand the shader a degenerate normal matrix. */
  const hide = (mesh, i) => setAt(mesh, i, 0, -400, 0, 0.001, 0.001, 0.001, 0, 0, 0);
  const born = (geo, mat, count, cast) => {
    const mesh = new T.InstancedMesh(geo, mat, count);
    mesh.castShadow = !!cast;
    mesh.frustumCulled = false;        /* one mesh, city-wide: never cull   */
    scene.add(mesh);
    meshes.push(mesh);
    return mesh;
  };
  const bake = () => {
    kinds.forEach((k) => {
      if (!k.items.length) return;
      const mesh = born(k.geo, k.mat, k.items.length, k.cast);
      mesh.receiveShadow = k.recv;
      /* Kept so a baked pass can still be reached as a whole afterwards. The
         items are dropped below, so per-instance edits are gone for good, but
         moving the mesh itself is one transform - which is how the clouds
         drift without paying for 400 matrix rewrites a frame. */
      k.mesh = mesh;
      k.items.forEach((a, i) => {
        setAt(mesh, i, a[0], a[1], a[2], a[3], a[4], a[5], a[7], a[8], a[9]);
        /* A colour may arrive as a hex or as a Color already above 1.0 - lit
           windows and lamp lenses are authored over white on purpose. */
        mesh.setColorAt(i, a[6] instanceof T.Color ? a[6] : tmpC.setHex(a[6]));
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      k.items.length = 0;
    });
  };
  /* ---- instancing: rigs -------------------------------------------------
     Rule 2. Everything that moves is a rig: a body transform plus a fixed
     list of parts, each holding a permanent slot in a dynamic pass. Slots are
     handed out once, at build time, and never move again - so a frame is a
     matrix multiply per part, with no allocation and nothing to reconcile.
     A pass that runs out of slots throws at build time rather than silently
     dropping a wheel at run time. */
  const mBody = new T.Matrix4();
  const mPart = new T.Matrix4();
  const mLean = new T.Matrix4();
  const mDrop = new T.Matrix4();
  const mShell = new T.Matrix4();
  const qBody = new T.Quaternion();
  const qLean = new T.Quaternion();
  const eBody = new T.Euler(0, 0, 0, 'YXZ');
  const eLean = new T.Euler(0, 0, 0, 'YXZ');
  const vBody = new T.Vector3();
  const vLean = new T.Vector3();
  const vPiv = new T.Vector3();
  const vOne = new T.Vector3(1, 1, 1);
  const dyn = [];
  const dpass = (geo, mat, count, cast) => {
    const p = { mesh: born(geo, mat, count, cast), n: count, used: 0 };
    for (let i = 0; i < count; i++) hide(p.mesh, i);
    dyn.push(p);
    return p;
  };
  /* One part, bolted to a rig at a local offset.

       at   local position, before any channel adds to it
       s    local scale
       rot  the part's own rest rotation
       ch   what drives it each frame: an index into rig.ang, or a triple of
            drivers [x, y, z] where each is null, an index, 'spin' or 'steer'
       dy   an index into rig.ang added to at[1] - suspension travel
       pv   a point in rig space the part rotates *about*, instead of about its
            own origin. A wheel needs none: its geometry is centred on its axle.
            A muzzle on a turning head does.
       lean whether the part rides the body's pitch and roll. Default yes; a
            wheel says no, which is the whole reason the two are separate. A
            car that pitches under braking must pitch *about* its wheels, not
            with them, or the tyres saw into the road surface. */
  const bolt = (rig, p, o) => {
    if (p.used >= p.n) throw new Error('capycity: rig pass full (' + p.n + ')');
    const rot = o.rot, at = o.at, s = o.s;
    const part = {
      p: p, i: p.used++,
      ox: at[0], oy: at[1], oz: at[2],
      sx: s[0], sy: s[1], sz: s[2],
      rx: rot ? rot[0] : 0, ry: rot ? rot[1] : 0, rz: rot ? rot[2] : 0,
      ch: o.ch === undefined ? null : o.ch,
      dy: o.dy === undefined ? null : o.dy,
      pv: o.pv === undefined ? null : o.pv,
      lean: o.lean !== false,
    };
    p.mesh.setColorAt(part.i, o.col instanceof T.Color ? o.col
      : tmpC.setHex(o.col === undefined ? 0xffffff : o.col));
    if (p.mesh.instanceColor) p.mesh.instanceColor.needsUpdate = true;
    rig.parts.push(part);
    return part;
  };
  const rigOf = () => ({
    x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, pivotY: 0, bob: 0,
    spin: 0, steer: 0, ang: [0, 0, 0, 0, 0, 0, 0, 0], parts: [],
  });
  /* A driver is null, one of the two named vehicle channels, or an index into
     rig.ang - the eight general-purpose angles a rig animates. */
  const drive = (rig, d) => {
    if (d === null || d === undefined) return 0;
    if (typeof d === 'number') return rig.ang[d];
    if (d === 'spin') return rig.spin;
    if (d === 'steer') return rig.steer;
    return 0;
  };
  /* One rig, one frame. Two frames of reference are built: the chassis, which
     is position and heading only, and the shell, which is the chassis with the
     body's pitch, roll and bob applied about a pivot at axle height. Each part
     is multiplied into whichever of the two it belongs to. Bob rides the shell
     alone, so the sprung mass can breathe over a bump while the tyres stay
     welded to the road.

     Part rotation is YXZ, so a steered wheel yaws first and then rolls about
     its own turned axle - the only order that looks right. */
  const place = (rig) => {
    eBody.set(0, rig.yaw, 0);
    qBody.setFromEuler(eBody);
    vBody.set(rig.x, rig.y, rig.z);
    mBody.compose(vBody, qBody, vOne);
    let shell = mBody;
    if (rig.pitch || rig.roll || rig.bob) {
      eLean.set(rig.pitch, 0, rig.roll);
      qLean.setFromEuler(eLean);
      vLean.set(0, rig.pivotY + rig.bob, 0);
      mLean.compose(vLean, qLean, vOne);
      mLean.multiply(mDrop.makeTranslation(0, -rig.pivotY, 0));
      shell = mShell.multiplyMatrices(mBody, mLean);
    }
    const parts = rig.parts;
    for (let k = 0; k < parts.length; k++) {
      const t = parts[k];
      let ax = t.rx, ay = t.ry, az = t.rz;
      const ch = t.ch;
      if (ch !== null) {
        if (typeof ch === 'number') ax += rig.ang[ch];
        else {
          ax += drive(rig, ch[0]);
          ay += drive(rig, ch[1]);
          az += drive(rig, ch[2]);
        }
      }
      dummy.position.set(t.ox, t.dy === null ? t.oy : t.oy + rig.ang[t.dy], t.oz);
      dummy.rotation.set(ax, ay, az);
      dummy.scale.set(t.sx, t.sy, t.sz);
      /* A part with a pivot orbits that point instead of spinning in place:
         p = pv + R(p - pv). This is how a muzzle stays on the front of a head
         that turns, without the rig needing a joint hierarchy. */
      if (t.pv !== null) {
        vPiv.set(dummy.position.x - t.pv[0], dummy.position.y - t.pv[1],
          dummy.position.z - t.pv[2]).applyEuler(dummy.rotation);
        dummy.position.set(t.pv[0] + vPiv.x, t.pv[1] + vPiv.y, t.pv[2] + vPiv.z);
      }
      dummy.updateMatrix();
      mPart.multiplyMatrices(t.lean ? shell : mBody, dummy.matrix);
      t.p.mesh.setMatrixAt(t.i, mPart);
    }
  };
  const flush = () => {
    for (let i = 0; i < dyn.length; i++) dyn[i].mesh.instanceMatrix.needsUpdate = true;
  };
  /* ---- sky ---------------------------------------------------------------
     A three-stop vertical gradient with the sun written straight into it: a
     broad forward-scatter lobe and a tight core. The core is authored above
     1.0, so the bright pass finds it and the sun blooms because it is bright
     rather than because a sprite was pasted over it. */
  const skyMat = new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false, depthTest: false, fog: false,
    uniforms: {
      top: { value: new T.Color(C.skyTop) },
      mid: { value: new T.Color(C.skyMid) },
      low: { value: new T.Color(C.skyLow) },
      sunCol: { value: new T.Color(C.sun) },
      sunDir: { value: sunDir },
      lobe: { value: hour.lobe },
    },
    vertexShader: [
      'varying vec3 vDir;',
      'void main() {',
      '  vDir = normalize(position);',
      '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
      '}',
    ].join('\n'),
    fragmentShader: [
      'uniform vec3 top; uniform vec3 mid; uniform vec3 low;',
      'uniform vec3 sunCol; uniform vec3 sunDir; uniform float lobe;',
      'varying vec3 vDir;',
      'void main() {',
      '  float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);',
      '  vec3 c = mix(low, mid, smoothstep(0.44, 0.57, h));',
      '  c = mix(c, top, smoothstep(0.56, 0.95, h));',
      '  float d = max(dot(vDir, sunDir), 0.0);',
      '  c += sunCol * pow(d, 5.0) * lobe * 0.42;',
      '  c += sunCol * pow(d, 64.0) * lobe * 0.90;',
      '  c += sunCol * smoothstep(0.9975, 0.9993, d) * lobe * 5.5;',
      '  gl_FragColor = vec4(c, 1.0);',
      '}',
    ].join('\n'),
  });
  const sky = new T.Mesh(new T.SphereGeometry(1500, 32, 20), skyMat);
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  scene.add(sky);
  /* Clouds are clusters of flattened puffs, fog-exempt so the horizon does not
     eat them. Three things about this field are deliberate.

     It is PERIODIC in x. Every cluster is emitted twice, once at cx and once at
     cx - CLOUD_TILE, so the pass covers two tiles side by side. Drifting the
     baked mesh by anything in [0, CLOUD_TILE) leaves the middle window fully
     covered, and CLOUD_TILE maps the copy set exactly onto itself - so the wrap
     is invisible and the whole sky moves for one transform a frame. Emitting a
     single tile and wrapping would tear a CLOUD_TILE-wide hole across the sky.

     Height is CORRELATED WITH DISTANCE. The rail runs 5 to 54 m up and the open
     frame pitches 10 deg down; a cloud only lands in frame if its rise over the
     horizon is inside the vertical half-FOV, so the near ones have to sit low.
     Sorting height by depth also does the work perspective would: the far bank
     stacks up toward the horizon instead of scattering.

     The DEPTH SPREAD is tuned for apparent size, not for value. M.cloud is built
     with fog off, so a cloud 1800 m out is painted exactly as bright as one
     200 m out - distance costs nothing in colour here and everything in angle.
     A field weighted toward the far end therefore arrives as a thin band of
     specks pinned to the horizon, which is what the first draft did: it was
     written when the only sky in frame was the sliver at the vanishing point.
     Now that the rail opens above the rooflines the bias runs the other way, and
     the band lands between 6.5 and 12 deg of elevation from point 0.

     There are THREE tones, not two, and the material is unlit, so these tones
     are the only shading a cloud gets. A single crown paint against a pale sky
     is the 1.05 contrast ratio this scene had before - invisible. The crown
     takes --cloud, the flank a step down toward --sky-mid, and the underside
     leans toward --sky-low so it reads as a shadowed base sitting in the same
     air as the sky. */
  const CLOUD_TILE = 2600;
  pass('cloud', G.puff, M.cloud, false, false);
  (function clouds() {
    const flank = new T.Color(C.cloud).lerp(new T.Color(C.skyMid), 0.30).getHex();
    const under = new T.Color(C.cloud).lerp(new T.Color(C.skyLow), 0.52)
      .multiplyScalar(0.86).getHex();
    /* NEAR is 140 m in FRONT of the plan's near edge, not behind it: the rail
       starts at z 128 and only ever runs away from the viewer, so a cloud
       emitted behind that is geometry nobody will ever see. */
    const NEAR = NEAR_Z - 140, DEEP = FAR_Z - 300;
    for (let i = 0, n = 54; i < n; i++) {
      const cx = off(CLOUD_TILE / 2);
      const t = Math.pow(rand(), 1.25);   /* biased near - see the note above  */
      const cz = lerp(NEAR, DEEP, t);
      /* Floor lifted off 52: rail points 6 and 7 sit at y 39 and 54, and a near
         cloud at eye level reads as a mistake rather than as weather. */
      const cy = lerp(84, 190, t) + off(26);
      const s = lerp(30, 52, t) * (0.8 + rand() * 0.5);
      const lobes = 5 + Math.floor(rand() * 4);
      const seed = [];
      for (let k = 0; k < lobes; k++) {
        const r = s * (0.5 + rand() * 0.6);
        /* The y numbers are the cloud's vertical development. At off(s * 0.2)
           and a 0.4-0.6 height ratio every cluster was a pancake, which from an
           elevated camera reads as a grey pebble rather than as weather. */
        seed.push([
          off(s * 1.6), off(s * 0.42), off(s * 1.15),
          r, r * (0.55 + rand() * 0.3), r * 0.86,
          k === 0 ? under : k % 3 === 0 ? flank : C.cloud,
          rand() * 6.283,
        ]);
      }
      /* copy 0 at cx, copy 1 a whole tile to the left - see the note above */
      for (let c = 0; c < 2; c++) {
        const ox = cx - c * CLOUD_TILE;
        for (let k = 0; k < seed.length; k++) {
          const a = seed[k];
          add('cloud', ox + a[0], cy + a[1], cz + a[2],
            a[3], a[4], a[5], a[6], a[7], 0, 0);
        }
      }
    }
  }());

  /* ---- ground, roads, kerbs, walks ---------------------------------------
     The ground is three passes: flat surfaces that take shadow, paint that is
     coplanar with them, and kerb stones. Everything here is axis-aligned and
     laid out from the plan constants, so it is collision-free by construction
     - the grid bookings exist for the props that come later. A slab is a
     one-sided plane in XZ, so its y scale is always 1 and its height is its
     position. */
  pass('flat', G.slab, M.ground, false, true);
  pass('paint', G.slab, M.paint, false, true);
  pass('kerb', G.box, M.ground, false, true);

  const MID_Z = (NEAR_Z + FAR_Z) / 2;
  const flat = (x, y, z, w, d, col) => add('flat', x, y, z, w, 1, d, col);
  const paint = (x, y, z, w, d, col, yaw) => add('paint', x, y, z, w, 1, d, col, yaw);

  /* World plate, then the avenue, then every cross street. */
  flat(0, -0.05, MID_Z, 2400, SPAN + 900, C.walk2);
  flat(0, 0, MID_Z, AVE * 2, SPAN + 140, C.road);
  for (let i = 0; i < crossZ.length; i++) {
    flat(0, 0.002, crossZ[i], CROSS_X * 2, CROSS * 2, C.road2);
  }

  /* The sidewalk runs in segments, broken at every cross street; the corner
     squares belong to the cross-street walks, which reach in as far as the
     avenue kerb. Segment edges are derived, never listed, so moving a cross
     street cannot leave a slab hanging over the road. */
  const KERB_W = 0.34;
  const SW_N = NEAR_Z + 60, SW_F = FAR_Z - 60;
  const segs = [];
  (function cutSegments() {
    let z0 = SW_N;
    crossZ.slice().sort((a, b) => b - a).forEach((cz) => {
      if (cz + CROSS < z0) segs.push([z0, cz + CROSS]);
      z0 = Math.min(z0, cz - CROSS);
    });
    if (z0 > SW_F) segs.push([z0, SW_F]);
  }());

  /* A kerb stone plus its lit top face, and a run of paving panels in two
     tones. The kerb strip is booked so no bollard ends up straddling it. */
  const kerbRun = (cx, cz, w, d, col) => {
    add('kerb', cx, KERB / 2, cz, w, KERB, d, col);
    flat(cx, KERB + 0.002, cz, w, d, C.kerbTop);
    mark(cx, cz, w, d, 0);
  };
  const paveRun = (x0, x1, z0, z1) => {
    const w = Math.abs(x1 - x0), cx = (x0 + x1) / 2;
    const len = Math.abs(z1 - z0), n = Math.max(1, Math.round(len / 3.6));
    const step = len / n, near = Math.max(z0, z1);
    for (let i = 0; i < n; i++) {
      flat(cx, KERB, near - step * (i + 0.5), w, step * 0.985,
        jit(i % 2 ? C.walk : C.walk2, 0.05));
    }
  };
  segs.forEach((s) => {
    const d = s[0] - s[1], cz = (s[0] + s[1]) / 2;
    [-1, 1].forEach((sx) => {
      kerbRun(sx * (AVE + KERB_W / 2), cz, KERB_W, d, C.kerb);
      paveRun(sx * (AVE + KERB_W), sx * FRONT, s[0], s[1]);
    });
  });
  /* Cross-street walks, which reach in to the avenue kerb and so form the
     corner squares. Panels run along x here instead of z. */
  const paveRunX = (z0, z1, x0, x1) => {
    const d = Math.abs(z1 - z0), cz = (z0 + z1) / 2;
    const len = Math.abs(x1 - x0), n = Math.max(1, Math.round(len / 3.6));
    const step = len / n, lo = Math.min(x0, x1);
    for (let i = 0; i < n; i++) {
      flat(lo + step * (i + 0.5), KERB, cz, step * 0.985, d,
        jit(i % 2 ? C.walk : C.walk2, 0.05));
    }
  };
  crossZ.forEach((cz) => {
    [-1, 1].forEach((zs) => {
      [-1, 1].forEach((xs) => {
        const kz = cz + zs * (CROSS + KERB_W / 2);
        kerbRun(xs * (AVE + (CROSS_X - AVE) / 2), kz, CROSS_X - AVE, KERB_W, C.kerb);
        paveRunX(cz + zs * (CROSS + KERB_W), cz + zs * (CROSS + WALK_W),
          xs * AVE, xs * CROSS_X);
      });
    });
  });

  /* ---- road paint --------------------------------------------------------
     Centre line, lane dashes, stop bars and zebras, all derived from AVE and
     the crossing list. The dashes stop short of each intersection because a
     lane marking that runs through a junction is the first thing that reads
     as wrong in a city that is otherwise fine. */
  const onCross = (z, m) => {
    for (let i = 0; i < crossZ.length; i++) {
      if (Math.abs(z - crossZ[i]) < CROSS + (m === undefined ? 2.4 : m)) return true;
    }
    return false;
  };
  /* Double centre line, laid as short pieces so the junctions can be skipped. */
  for (let z = SW_N; z > SW_F; z -= 4) {
    if (onCross(z)) continue;
    paint(-0.32, 0.02, z, 0.14, 3.9, C.mark);
    paint(0.32, 0.02, z, 0.14, 3.9, C.mark);
  }
  /* Lane dashes at the two inner lane boundaries. */
  [-4, 4].forEach((lx) => {
    for (let z = SW_N; z > SW_F; z -= 8) {
      if (onCross(z)) continue;
      paint(lx, 0.02, z, 0.13, 3.4, C.mark);
    }
  });
  /* Zebras and stop bars. Traffic on the avenue runs along z, so the zebra
     bars are long in z and repeat across x - the other way round is the most
     common mistake in a painted crossing. The east lanes run down the avenue
     and the west lanes run up it, so each stop bar sits on the side of the
     junction its own traffic arrives from, and the pair is not symmetric. */
  crossZ.forEach((cz) => {
    [1, -1].forEach((zs) => {
      const zc = cz + zs * (CROSS + 1.7);
      for (let x = -AVE + 0.62; x < AVE - 0.3; x += 1.18) {
        paint(x, 0.024, zc, 0.62, 2.7, C.mark);
      }
      const sb = cz + zs * (CROSS + 3.7);
      paint(zs > 0 ? (AVE - 0.15) / 2 + 0.17 : -((AVE - 0.15) / 2 + 0.17),
        0.024, sb, AVE - 0.5, 0.44, C.mark);
    });
    /* The cross street gets a centre line of its own, cut at the avenue. */
    for (let x = -CROSS_X + 6; x < CROSS_X - 6; x += 5) {
      if (Math.abs(x) < AVE + 3.6) continue;
      paint(x, 0.02, cz, 3.1, 0.13, C.mark);
    }
  });

  /* Repairs and drainage. Patches go on before the paint in height order, so a
     lane dash always reads over the asphalt it crosses, and every horizontal
     surface in the city now sits at or below 0.024 - which is the number the
     vehicle ride height below is set against. */
  for (let i = 0; i < 52; i++) {
    const pw = rng(1.4, 4.2), pd = rng(1.6, 5.4);
    flat(rng(-AVE + pw / 2, AVE - pw / 2), 0.008,
      FAR_Z + rand() * (SPAN + 40), pw, pd, jit(C.road2, 0.09));
  }
  for (let z = SW_N - 12; z > SW_F; z -= 33) {
    if (onCross(z, 5)) continue;
    [-1, 1].forEach((sx) => {
      flat(sx * (AVE - 0.5), 0.014, z, 0.78, 0.52, C.grate);
      flat(sx * (AVE - 0.5), 0.016, z, 0.78, 0.1, jit(C.grate, 0.22));
    });
  }
  /* ---- the block ---------------------------------------------------------
     Parcels are cut from the runs between cross streets, so a building can
     never stand in a junction, and each one books its own footprint before it
     is built - which is what stops the second row from growing back through
     the first. Party walls are shared: neighbours touch, and the seam is a
     pilaster rather than a gap you can see the sky through. */
  pass('wall', G.box, M.wall, true, true);
  pass('trim', G.box, M.trim, true, true);
  pass('roof', G.box, M.roof, true, true);
  pass('metal', G.box, M.metal, true, true);
  pass('tube', G.cyl, M.metal, true, true);
  pass('cloth', G.box, M.cloth, true, true);
  pass('dark', G.pane, M.glass, false, false);
  pass('lit', G.pane, M.glow, false, false);
  pass('signpane', G.pane, M.trim, false, false);

  const LIT = hour.lit;
  /* A window is either dark glass that takes the toon ramp or a light that is
     written above 1.0 and therefore blooms. Which one is decided here, once,
     and baked into the instance colour - see the note on HOURS.lit. Not named
     `window`, for the obvious reason. */
  const litCol = new T.Color(C.glassLit);
  const glazing = (x, y, z, w, h, yaw) => {
    if (rand() < LIT) {
      add('lit', x, y, z, w, h, 1,
        litCol.clone().multiplyScalar(1.35 + rand() * 0.7), yaw);
    } else {
      add('dark', x, y, z, w, h, 1, jit(C.glass, 0.12), yaw);
    }
  };
  /* Cut each run into parcels of 13 to 26 m. The remainder is folded into the
     last parcel rather than left as a sliver, so a block always ends on a
     corner building wide enough to carry a return elevation. */
  const parcels = [];
  segs.forEach((seg) => {
    const top = seg[0], bot = seg[1], len = top - bot;
    if (len < 12) return;
    const cuts = [];
    let z = top;
    while (z - bot > 26) {
      const w = rng(13, 26);
      if (z - w - bot < 12) break;
      cuts.push([z, z - w]);
      z -= w;
    }
    cuts.push([z, bot]);
    cuts.forEach((c, i) => {
      [-1, 1].forEach((sx) => {
        parcels.push({
          sx: sx, z0: c[0], z1: c[1], w: c[0] - c[1], cz: (c[0] + c[1]) / 2,
          corner: i === 0 || i === cuts.length - 1,
          depth: rng(17, 29),
        });
      });
    });
  });

  /* One building. Everything is measured off the parcel, so no two masses can
     share ground: the parcel grid guarantees separation in z, the building
     line does it in x, and the footprint is marked so the street furniture
     placed later cannot grow into the wall. */
  const FLOOR_H = FLOOR;
  const build = (p) => {
    const sx = p.sx, out = sx > 0 ? 1 : -1;
    const x0 = sx * FRONT;                  /* the building line             */
    const storeys = Math.max(2, Math.round(lerp(2.2, 13, heightAt(p.cz))
      + rng(-1.2, 1.2)));
    const h = storeys * FLOOR_H;
    const d = p.depth;
    const xc = sx * (FRONT + d / 2);
    mark(xc, p.cz, d, p.w, 0);
    const wall = pick(WALLS);
    /* The avenue elevation faces the road, so its normal points back towards
       x = 0: a quarter turn one way on the east side and the other way on the
       west. Everything applied to that face uses fy. */
    const fy = -sx * Math.PI / 2;
    const GH = FLOOR_H * 1.18;              /* a taller commercial ground     */
    const face = sx * (FRONT - 0.03);

    /* Ground floor, then the mass above it set back by 12 cm so the cornice
       between them catches a highlight instead of dying in a flat corner. */
    add('trim', xc, GH / 2, p.cz, d, GH, p.w, jit(C.trim, 0.06));
    add('wall', sx * (FRONT + 0.12 + d / 2), GH + (h - GH) / 2, p.cz,
      d, h - GH, p.w - 0.24, jit(wall, 0.05));
    add('trim', sx * (FRONT + 0.02 + d / 2), GH + 0.16, p.cz,
      d, 0.32, p.w + 0.1, jit(C.trim, 0.04));

    /* Shopfront: glazing between pilasters, a door, an awning and a sign. */
    const bays = Math.max(2, Math.floor(p.w / 5));
    const inner = p.w - 1.9;
    const bw = inner / bays;
    for (let b = 0; b < bays; b++) {
      const bz = p.z1 + 0.95 + bw * (b + 0.5);
      if (b === bays - 1) {
        add('dark', face, 1.28, bz, bw * 0.5, 2.4, 1, jit(C.glass, 0.2), fy);
        add('trim', sx * (FRONT - 0.09), 1.28, bz, 0.18, 2.56, bw * 0.56,
          jit(C.trim, 0.08));
      } else {
        add('dark', face, 1.86, bz, bw * 0.86, 2.9, 1, jit(C.glass, 0.14), fy);
      }
      add('trim', sx * (FRONT - 0.06), 0.22, bz, 0.2, 0.44, bw * 0.94,
        jit(C.trim, 0.05));
    }
    /* Awning: a box rolled about the avenue axis so it slopes down and out.
       The roll is about z on the east side and -z on the west, which is what
       `out` is for - a single sign flip instead of two code paths. */
    if (rand() < 0.72) {
      const aw = pick(AWNINGS);
      add('cloth', sx * (FRONT - 1.05), 3.05, p.cz, 2.3, 0.1, p.w - 1.4,
        aw, 0, 0, out * 0.30);
      [-1, 1].forEach((e) => {
        add('trim', sx * (FRONT - 0.9), 2.72, p.cz + e * (p.w - 1.5) / 2,
          1.9, 0.1, 0.1, jit(C.trim, 0.06), 0, 0, out * 0.30);
      });
    }
    /* Fascia sign. At night a fraction of them are written above white so they
       bloom with the windows rather than sitting flat against a lit street. */
    const sc = pick(AWNINGS);
    if (rand() < 0.6 + LIT * 0.3) {
      add('lit', sx * (FRONT - 0.13), 3.62, p.cz, p.w * 0.5, 0.62, 1,
        tmpC.clone().setHex(sc).multiplyScalar(0.7 + LIT * 1.5), fy);
    } else {
      add('signpane', sx * (FRONT - 0.13), 3.62, p.cz, p.w * 0.52, 0.6, 1,
        jit(sc, 0.1), fy);
    }

    /* The upper elevation. A regular grid, because the thing that makes a city
       block read as a city block is repetition with one thing changed - here
       the light behind each pane. */
    const uface = sx * (FRONT + 0.09);
    const ups = Math.max(1, Math.round((h - GH) / FLOOR_H));
    const fh = (h - GH) / ups;
    const cols = Math.max(2, Math.floor((p.w - 1.4) / 2.55));
    const cw = (p.w - 1.4) / cols;
    for (let f = 0; f < ups; f++) {
      const fy0 = GH + fh * (f + 0.5);
      for (let b = 0; b < cols; b++) {
        const bz = p.z1 + 0.7 + cw * (b + 0.5);
        glazing(uface, fy0, bz, Math.min(1.5, cw * 0.62), fh * 0.5, fy);
      }
      /* A spandrel band between floors ties the grid together. */
      if (f) {
        add('trim', sx * (FRONT + 0.1 + d / 2), GH + fh * f, p.cz,
          d - 0.04, 0.1, p.w - 0.2, jit(C.trim, 0.05));
      }
    }
    /* Corner parcels show a return elevation to the cross street. */
    if (p.corner) {
      const ez = p.cz > 0 ? 1 : -1;
      const zf = (ez > 0 ? p.z0 : p.z1) + ez * 0.04;
      const rn = Math.max(2, Math.floor((d - 2) / 3.1));
      for (let f = 0; f < ups; f++) {
        for (let b = 0; b < rn; b++) {
          glazing(sx * (FRONT + 1 + ((d - 2) / rn) * (b + 0.5)),
            GH + fh * (f + 0.5), zf, 1.3, fh * 0.5, ez > 0 ? 0 : Math.PI);
        }
      }
    }
    /* Cornice, deck, parapet. The deck is a slab and not a box because nothing
       ever sees its underside, and the parapet is four thin boxes rather than
       one hollow shell for the same reason. */
    const uxc = sx * (FRONT + 0.12 + d / 2);
    const uw = p.w - 0.24;
    add('trim', uxc, h + 0.11, p.cz, d + 0.22, 0.22, uw + 0.22, jit(C.trim, 0.05));
    flat(uxc, h + 0.23, p.cz, d - 0.1, uw - 0.1, jit(rand() < 0.5 ? C.roof : C.roof2, 0.06));
    const par = jit(C.trim, 0.05);
    add('trim', uxc, h + 0.46, p.cz + uw / 2 - 0.08, d, 0.46, 0.16, par);
    add('trim', uxc, h + 0.46, p.cz - uw / 2 + 0.08, d, 0.46, 0.16, par);
    add('trim', uxc - sx * (d / 2 - 0.08), h + 0.46, p.cz, 0.16, 0.46, uw, par);
    add('trim', uxc + sx * (d / 2 - 0.08), h + 0.46, p.cz, 0.16, 0.46, uw, par);

    /* Rooftop kit, kept inside the parapet by construction. */
    const rf = (fx, fz) => [uxc + sx * (d / 2 - 1.4) * fx, p.cz + (uw / 2 - 1.4) * fz];
    if (rand() < 0.8) {
      const t = rf(rng(-0.6, 0.6), rng(-0.7, 0.7));
      const tr = rng(0.7, 1.15), th = rng(1.5, 2.4);
      add('tube', t[0], h + 0.9 + th / 2, t[1], tr * 2, th, tr * 2, jit(C.roof2, 0.08));
      [-1, 1].forEach((a) => [-1, 1].forEach((b) => {
        add('metal', t[0] + a * tr * 0.6, h + 0.68, t[1] + b * tr * 0.6,
          0.12, 0.9, 0.12, C.chrome);
      }));
    }
    for (let v = 0, n = 1 + Math.floor(rand() * 3); v < n; v++) {
      const t = rf(rng(-0.8, 0.8), rng(-0.85, 0.85));
      const vh = rng(0.5, 1.1);
      add('metal', t[0], h + 0.23 + vh / 2, t[1], rng(0.7, 1.5), vh,
        rng(0.7, 1.5), jit(C.chrome, 0.12));
    }
    if (storeys > 6) {
      const t = rf(rng(-0.5, 0.5), rng(-0.6, 0.6));
      add('wall', t[0], h + 0.23 + 1.5, t[1], 3.2, 3, 2.6, jit(wall, 0.04));
      add('tube', t[0] + sx * 1.1, h + 5.6, t[1], 0.1, 5.4, 0.1, C.chrome);
      add('lit', t[0] + sx * 1.1, h + 8.4, t[1], 0.34, 0.34, 1,
        tmpC.clone().setHex(C.sigRed).multiplyScalar(2.2), 0);
    }
  };
  parcels.forEach(build);
  /* ---- the second row ----------------------------------------------------
     Everything behind the frontage. These go through book(), which is the
     whole reason the first row marked its footprint: the old city grew row two
     straight back through row one and there was nothing to catch it. */
  for (let i = 0, n = per(110); i < n; i++) {
    const side = rand() < 0.5 ? -1 : 1;
    const ex = rng(15, 33), ez = rng(15, 33);
    const p = spot(() => [
      side * rng(FRONT + 20 + ex / 2, CROSS_X - 4 - ex / 2),
      FAR_Z - 16 + rand() * (SPAN + 52),
    ], ex, ez, 3.2, 16);
    if (!p) continue;
    const cz = p[1];
    const storeys = Math.max(2, Math.round(lerp(2, 15, heightAt(cz)) + rng(-2, 2)));
    const h = storeys * FLOOR_H;
    const wall = pick(WALLS);
    add('wall', p[0], h / 2, cz, ex, h, ez, jit(wall, 0.05));
    add('trim', p[0], h + 0.16, cz, ex + 0.3, 0.32, ez + 0.3, jit(C.trim, 0.05));
    flat(p[0], h + 0.33, cz, ex - 0.2, ez - 0.2,
      jit(rand() < 0.5 ? C.roof : C.roof2, 0.07));
    /* Glazed on the two elevations the camera can actually see. */
    const ups = Math.max(1, Math.round(h / FLOOR_H) - 1);
    const fh = h / (ups + 1);
    const yaw = -side * Math.PI / 2;
    const nx = Math.max(2, Math.floor(ez / 3.4));
    const nz = Math.max(2, Math.floor(ex / 3.4));
    for (let f = 1; f <= ups; f++) {
      for (let b = 0; b < nx; b++) {
        glazing(p[0] - side * (ex / 2 + 0.03), fh * (f + 0.5),
          cz - ez / 2 + (ez / nx) * (b + 0.5), 1.5, fh * 0.46, yaw);
      }
      for (let b = 0; b < nz; b++) {
        glazing(p[0] - ex / 2 + (ex / nz) * (b + 0.5), fh * (f + 0.5),
          cz + ez / 2 + 0.03, 1.5, fh * 0.46, 0);
      }
    }
  }
  /* ---- the skyline -------------------------------------------------------
     Beyond the plan the grid does not reach, so the far towers keep their own
     list of rectangles and test against it. Same rule, cruder index: 60 towers
     is 1,800 comparisons at build time and none at all after. */
  (function skyline() {
    const taken = [];
    const clear = (x, z, w, d) => {
      for (let i = 0; i < taken.length; i++) {
        const t = taken[i];
        if (Math.abs(x - t[0]) < (w + t[2]) / 2 + 8
          && Math.abs(z - t[1]) < (d + t[3]) / 2 + 8) return false;
      }
      return true;
    };
    for (let i = 0, n = per(64); i < n; i++) {
      const w = rng(24, 62), d = rng(24, 62);
      let x = 0, z = 0, ok = false;
      for (let n = 0; n < 20 && !ok; n++) {
        const side = rand() < 0.5 ? -1 : 1;
        x = side * rng(CROSS_X + 40, CROSS_X + 470);
        z = FAR_Z - 220 + rand() * (SPAN + 380);
        ok = clear(x, z, w, d);
      }
      if (!ok) continue;
      taken.push([x, z, w, d]);
      const far = clamp(1 - (Math.abs(x) - CROSS_X) / 560, 0.1, 1);
      const h = rng(18, 96) * (0.4 + far * 0.9) * (0.5 + heightAt(z) * 0.9);
      add('wall', x, h / 2, z, w, h, d, jit(pick(WALLS), 0.05));
      add('trim', x, h + 0.5, z, w + 0.6, 1, d + 0.6, jit(C.trim, 0.05));
      /* One lit band per tower is enough to place it in the hour without
         glazing sixty buildings nobody will look at twice. */
      if (LIT > 0.2) {
        for (let f = 2; f < h / FLOOR_H - 1; f += 3) {
          add('lit', x, f * FLOOR_H, z + d / 2 + 0.04, w * 0.72, 0.5, 1,
            litCol.clone().multiplyScalar(0.5 + LIT * 0.8), 0);
        }
      }
    }
  }());
  /* ---- street furniture --------------------------------------------------
     Two kinds of placement, and the difference matters. A *designed* position
     - a signal at a corner, a shelter at a stop - is computed and then marked
     unconditionally, because the city needs one there. A *rolled* position
     goes through book() and is simply skipped if the ground is taken. Designed
     placements all happen first, so the rolls can only ever lose to them.

     Useful free width, after the kerb strip and the walking corridor are
     spoken for: 8.34 to 9.50 at the kerb, and 12.10 to 13.40 at the frontage.
     Nothing below is wider than that, which is why nothing below overlaps. */
  pass('trunk', G.taper, M.wall, true, true);
  pass('leaf', G.puff, M.leaf, true, false);
  pass('shell', G.pane, M.shell, false, false);
  pass('lamp', G.ball, M.glow, false, false);
  const FURN_X = 8.92, FURN_MAX = 1.1;
  const FRONT_X = 12.75, FRONT_MAX = 1.2;

  /* Street lighting: a pole at the kerb, an arm out over the carriageway and a
     lens on the end, written above white so it is a source and not a shape. */
  const lampGlow = new T.Color(C.lampGlow);
  const streetLamp = (sx, z) => {
    mark(sx * FURN_X, z, 0.5, 0.5, 0.1);
    add('tube', sx * FURN_X, KERB + 4.2, z, 0.17, 8.4, 0.17, jit(C.post, 0.06));
    add('tube', sx * FURN_X, KERB + 0.16, z, 0.42, 0.32, 0.42, jit(C.post, 0.04));
    add('metal', sx * (FURN_X - 1.55), 8.42, z, 3.1, 0.13, 0.13, jit(C.post, 0.05));
    add('metal', sx * (FURN_X - 3.0), 8.24, z, 0.9, 0.2, 0.42, jit(C.post, 0.05));
    add('lamp', sx * (FURN_X - 3.0), 8.08, z, 0.72, 0.2, 0.4,
      lampGlow.clone().multiplyScalar(0.55 + LIT * 2.1));
  };
  for (let z = SW_N - 8; z > SW_F; z -= 26) {
    if (onCross(z, 4)) continue;
    streetLamp(1, z);
    streetLamp(-1, z - 13);
  }
  /* Signals. One mast per approach, on the near-side kerb, arm out over the
     lanes it governs. The three lenses are not baked with everything else -
     they change through the cycle - so only the ironwork goes in the static
     passes and the heads are collected for a small mesh of their own. */
  const heads = [];
  crossZ.forEach((cz, ci) => {
    /* dir is the direction of the traffic this mast governs: +1 is northbound
       on the west kerb, -1 is southbound on the east kerb. */
    [[1, -1], [-1, 1]].forEach((pair) => {
      const sx = pair[0], dir = pair[1];
      const z = cz + dir * -(CROSS + 1.5);
      mark(sx * FURN_X, z, 0.6, 0.6, 0.1);
      add('tube', sx * FURN_X, KERB + 3.3, z, 0.2, 6.6, 0.2, jit(C.post, 0.05));
      add('tube', sx * FURN_X, KERB + 0.18, z, 0.5, 0.36, 0.5, jit(C.post, 0.04));
      add('metal', sx * (FURN_X - 2.6), 6.62, z, 5.1, 0.14, 0.14, jit(C.post, 0.05));
      const hx = sx * (FURN_X - 5.0);
      add('metal', hx, 5.72, z, 0.44, 1.5, 0.5, jit(C.post, 0.06));
      add('metal', hx, 6.44, z, 0.5, 0.1, 0.56, jit(C.post, 0.04));
      heads.push({ x: hx, y: 5.72, z: z, dir: dir, sx: sx, cz: cz, ci: ci });
      /* Pedestrian head on the mast itself, facing across the avenue. */
      add('metal', sx * (FURN_X - 0.32), 2.9, z, 0.36, 0.52, 0.4, jit(C.post, 0.05));
    });
  });

  /* Street trees. The pit is 0.9 m so it clears the kerb strip; the canopy is
     allowed to overhang the corridor and the road, because that is what a
     canopy does - the grid governs ground, not air. Radius is capped at 2.1 so
     it stops short of the awning line at 11.2. */
  const treeAt = (sx, z) => {
    const x = sx * FURN_X;
    if (!book(x, z, 0.92, 0.92, 0.12)) return false;
    flat(x, KERB + 0.004, z, 1.02, 1.02, jit(C.soil, 0.08));
    add('kerb', x, KERB + 0.07, z, 1.1, 0.14, 1.1, jit(C.kerb, 0.05));
    const th = rng(2.3, 3.4);
    add('trunk', x, KERB + th / 2, z, 0.3, th, 0.3, jit(C.trunk, 0.09));
    const lc = pick(LEAVES);
    for (let k = 0, n = 4 + Math.floor(rand() * 3); k < n; k++) {
      const r = rng(1.15, 2.1);
      add('leaf', x + off(0.85), KERB + th + rng(0.1, 1.5) + r * 0.25,
        z + off(0.85), r * 2, r * 1.5, r * 2, jit(lc, 0.13),
        rand() * 6.283);
    }
    return true;
  };
  /* Trees on a loose rhythm rather than a strict pitch, so the rows read as
     planted over decades. A pit that loses its roll is simply not planted. */
  [-1, 1].forEach((sx) => {
    for (let z = SW_N - 4; z > SW_F; z -= rng(9, 15)) {
      if (onCross(z, 3)) continue;
      treeAt(sx, z);
    }
  });

  /* Bus shelters, one per block on alternating sides: a glazed back, two ends,
     a roof and a bench. Designed positions, marked before the small props roll,
     because a shelter is the largest thing on the pavement and everything else
     has to work around it rather than the other way about. */
  crossZ.forEach((cz, i) => {
    const sx = i % 2 ? 1 : -1;
    const z = cz - (i % 2 ? 22 : -22);
    if (z > SW_N || z < SW_F) return;
    const x = sx * 9.02;
    mark(x, z, 1.2, 4.6, 0.1);
    add('metal', x, KERB + 1.3, z, 0.1, 2.6, 4.4, jit(C.post, 0.05));
    add('shell', sx * 8.96, KERB + 1.32, z, 4.2, 2.4, 1,
      jit(C.glass, 0.1), -sx * Math.PI / 2);
    [-1, 1].forEach((e) => {
      add('metal', x, KERB + 1.3, z + e * 2.2, 1.3, 2.6, 0.1, jit(C.post, 0.05));
    });
    add('roof', x - sx * 0.62, KERB + 2.68, z, 2.5, 0.14, 4.7, jit(C.roof2, 0.06));
    add('trim', x, KERB + 0.46, z, 0.52, 0.1, 3.6, jit(C.trim, 0.06));
    add('metal', x, KERB + 0.24, z, 0.1, 0.44, 3.6, jit(C.post, 0.05));
    /* Lit route panel at one end - a small source, and a reason for the glass
       to have an edge at night. */
    add('lit', sx * 8.9, KERB + 1.5, z + 2.14, 0.9, 1.5, 1,
      litCol.clone().multiplyScalar(0.35 + LIT * 1.4), 0);
  });

  /* Small props. All rolled, all booked, all skipped if the ground is gone. */
  const smallProp = (sx, z, kind) => {
    const x = sx * FURN_X;
    if (kind === 0) {                       /* litter bin                     */
      if (!book(x, z, 0.72, 0.72, 0.2)) return;
      add('metal', x, KERB + 0.48, z, 0.66, 0.96, 0.66, jit(C.post, 0.08));
      add('trim', x, KERB + 1.0, z, 0.76, 0.1, 0.76, jit(C.trim, 0.06));
    } else if (kind === 1) {                /* hydrant                        */
      if (!book(x, z, 0.5, 0.5, 0.2)) return;
      add('tube', x, KERB + 0.34, z, 0.28, 0.68, 0.28, C.sigRed);
      add('tube', x, KERB + 0.72, z, 0.36, 0.12, 0.36, C.sigRed);
      [-1, 1].forEach((e) => add('tube', x + e * 0.2, KERB + 0.44, z,
        0.16, 0.16, 0.16, C.chrome, 0, 0, Math.PI / 2));
    } else if (kind === 2) {                /* bollard                        */
      if (!book(x, z, 0.34, 0.34, 0.2)) return;
      add('tube', x, KERB + 0.42, z, 0.24, 0.84, 0.24, jit(C.post, 0.07));
      add('lamp', x, KERB + 0.86, z, 0.24, 0.14, 0.24,
        lampGlow.clone().multiplyScalar(0.2 + LIT * 0.9));
    }
  };
  for (let i = 0; i < 150; i++) {
    const sx = rand() < 0.5 ? -1 : 1;
    const z = SW_F + rand() * (SW_N - SW_F);
    if (onCross(z, 3)) continue;
    smallProp(sx, z, Math.floor(rand() * 3));
  }

  /* Benches face the road, so they go in the furniture strip too, but they are
     long enough to need their own roll. */
  for (let i = 0; i < 26; i++) {
    const sx = rand() < 0.5 ? -1 : 1;
    const p = spot(() => {
      const z = SW_F + rand() * (SW_N - SW_F);
      return onCross(z, 4) ? null : [sx * FURN_X, z];
    }, 0.8, 2.0, 0.25, 12);
    if (!p) continue;
    add('trim', p[0], KERB + 0.44, p[1], 0.62, 0.09, 1.8, jit(C.trunk, 0.1));
    add('trim', p[0] + sx * 0.26, KERB + 0.72, p[1], 0.1, 0.56, 1.8,
      jit(C.trunk, 0.1), 0, 0, -sx * 0.16);
    [-1, 1].forEach((e) => add('metal', p[0], KERB + 0.22, p[1] + e * 0.72,
      0.56, 0.44, 0.09, jit(C.post, 0.06)));
  }

  /* The frontage strip: what a shop puts out on the pavement. Narrower band,
     smaller things, and they lean against the wall rather than the kerb. */
  for (let i = 0; i < 110; i++) {
    const sx = rand() < 0.5 ? -1 : 1;
    const z = SW_F + rand() * (SW_N - SW_F);
    if (onCross(z, 3)) continue;
    const x = sx * FRONT_X;
    const kind = Math.floor(rand() * 3);
    if (kind === 0) {                       /* planter                        */
      if (!book(x, z, 1.0, 1.0, 0.15)) continue;
      add('trim', x, KERB + 0.28, z, 0.94, 0.56, 0.94, jit(C.trunk, 0.09));
      flat(x, KERB + 0.57, z, 0.8, 0.8, jit(C.soil, 0.07));
      const lc = pick(LEAVES);
      for (let k = 0; k < 3; k++) {
        add('leaf', x + off(0.22), KERB + rng(0.75, 1.05), z + off(0.22),
          rng(0.4, 0.72), rng(0.35, 0.6), rng(0.4, 0.72), jit(lc, 0.12),
          rand() * 6.283);
      }
    } else if (kind === 1) {                /* A-board                        */
      if (!book(x, z, 0.7, 0.9, 0.15)) continue;
      const aw = pick(AWNINGS);
      [-1, 1].forEach((e) => add('signpane', x + e * 0.16, KERB + 0.45, z,
        0.8, 0.9, 1, jit(aw, 0.1), e > 0 ? 0.28 : Math.PI - 0.28));
    } else {                                /* stacked crates                 */
      if (!book(x, z, 0.9, 1.3, 0.15)) continue;
      for (let k = 0, n = 2 + Math.floor(rand() * 2); k < n; k++) {
        add('trim', x + off(0.07), KERB + 0.19 + k * 0.34, z + off(0.09),
          0.8, 0.32, 1.2, jit(C.trunk, 0.12), off(0.2));
      }
    }
  }
  /* Everything static is now known, so the passes are sized to exactly what
     they hold and turned into meshes. Nothing may call add() after this. */
  bake();

  /* ---- signal lenses -----------------------------------------------------
     Three lenses per head, in one mesh of their own because their colour
     changes through the cycle and a baked pass cannot. Off is not black: an
     unlit lens still catches the sky, and painting it black is the difference
     between a signal and a hole. */
  const SIG_ON = 2.4, SIG_OFF = 0.22;
  const sigCols = [C.sigRed, C.sigAmber, C.sigGreen];
  const sigMesh = born(G.ball, M.glow, heads.length * 3, false);
  const sigTmp = new T.Color();
  heads.forEach((hd, n) => {
    for (let k = 0; k < 3; k++) {
      setAt(sigMesh, n * 3 + k, hd.x, hd.y + 0.52 - k * 0.52,
        hd.z - hd.dir * 0.27, 0.32, 0.32, 0.36, 0, 0, 0);
    }
    hd.slot = n * 3;
    hd.lamp = 0;                    /* 0 red, 1 amber, 2 green               */
  });
  const paintHead = (hd) => {
    for (let k = 0; k < 3; k++) {
      sigMesh.setColorAt(hd.slot + k, sigTmp.setHex(k === hd.lamp
        ? sigCols[k] : C.sigOff).multiplyScalar(k === hd.lamp ? SIG_ON : SIG_OFF));
    }
    sigMesh.instanceColor.needsUpdate = true;
  };
  heads.forEach(paintHead);
  /* ---- the vehicles ------------------------------------------------------
     A vehicle is a rig. Panels, glass, lamps and plates ride the shell so they
     pitch and roll with the body; the four wheels ride the chassis so they
     stay on the road while it does. Every wheel is two instances - a tyre and
     a rim inside it - and both are driven by the same roll channel, so a rim
     can never rotate out of its own tyre.

     Passes are allocated to an upper bound and then trimmed to what was
     actually used: InstancedMesh cannot be resized, but mesh.count is exactly
     the number of instances drawn, so the tail costs a matrix each and nothing
     in the frame. bolt() throws if a cap is ever reached, which is the whole
     point - the old city silently dropped a wheel instead. */

  /* ---- the census --------------------------------------------------------
     Every cap below is arithmetic rather than a round number, because a round
     number is what fails: parked cars were added after the first set of caps
     were chosen and the tyre pass ran out mid-build. So the populations are
     declared once, here, and the caps are derived from them.

     Worst case per body, counted off the builders further down:

               tyre  panel  glass  trim  lamp  plate
       car       12      7      4     5     5      2
       van       12      6      3     4     4      1
       bus       18      5      8     2     5      1
       capy       -      -      -     -     -      -   (4 limb, 5 fur, 4 fit)

     A bus only ever runs; a kerbside bay holds a car or a van. That is the one
     asymmetry, and it is why tyre and glass count the two populations apart
     while the rest just take the worst case across all three. */
  const N_LANE = 4, PER_LANE = 11;          /* four running lanes, eleven each  */
  const N_DRIVE = N_LANE * PER_LANE;
  const N_PARK = crossZ.length * 2 * 2 * 5; /* crossings x 2 kerbs x 2 sides x 5 */
  const PER_WALK = 32, N_CREW = 4 * PER_WALK;
  const CAP = {
    tyre: N_DRIVE * 18 + N_PARK * 12,
    panel: (N_DRIVE + N_PARK) * 7,
    glass: N_DRIVE * 8 + N_PARK * 4,
    trim: (N_DRIVE + N_PARK) * 5,
    lamp: (N_DRIVE + N_PARK) * 5,
    plate: (N_DRIVE + N_PARK) * 2,
    limb: N_CREW * 4,
    fur: N_CREW * 5,
    fit: N_CREW * 4,
  };
  const P = {
    panel: dpass(G.box, M.wall, CAP.panel, true),
    trim: dpass(G.box, M.metal, CAP.trim, true),
    glass: dpass(G.box, M.glass, CAP.glass, false),
    tyre: dpass(G.wheel, M.wall, CAP.tyre, true),
    lamp: dpass(G.box, M.glow, CAP.lamp, false),
    plate: dpass(G.pane, M.trim, CAP.plate, false),
    fur: dpass(G.ball, M.fur, CAP.fur, true),
    limb: dpass(G.limb, M.fur, CAP.limb, true),
    fit: dpass(G.box, M.fit, CAP.fit, true),
  };
  /* Unused slots are hidden, and trimDyn() drops mesh.count to what was really
     bolted, so a generous cap costs an allocation and nothing per frame. */
  const trimDyn = () => dyn.forEach((p) => { p.mesh.count = p.used; });

  /* Local axes for every vehicle: +z is the way it points, +x is its left,
     y = 0 is the road. Tyres are set so their contact patch lands at 0.035 -
     just clear of the 0.024 the tallest piece of road paint reaches, which is
     the whole reason the paint heights were written down. */
  const CONTACT = 0.035;
  const wheelOn = (rig, ox, oz, tr, tw, susp, steer) => {
    const ch = steer ? ['spin', 'steer', null] : ['spin', null, null];
    bolt(rig, P.tyre, { at: [ox, tr + CONTACT, oz], s: [tw, tr * 2, tr * 2],
      col: jit(C.tyre, 0.06), ch: ch, dy: susp, lean: false });
    bolt(rig, P.tyre, { at: [ox + (ox > 0 ? 0.012 : -0.012), tr + CONTACT, oz],
      s: [tw * 0.94, tr * 1.24, tr * 1.24], col: jit(C.rim, 0.05),
      ch: ch, dy: susp, lean: false });
    bolt(rig, P.tyre, { at: [ox + (ox > 0 ? 0.02 : -0.02), tr + CONTACT, oz],
      s: [tw * 0.9, tr * 0.5, tr * 0.5], col: C.chrome,
      ch: ch, dy: susp, lean: false });
  };
  /* A car. One silhouette, two rear ends: boot = 1 is a saloon, boot = 0 is a
     hatch that carries its roofline back to the tail. Suspension travel gets
     one ang channel per wheel, 0 to 3, front left first. */
  const makeCar = (tone, boot, taxi) => {
    const rig = rigOf();
    rig.pivotY = 0.36;                    /* pitch about axle height          */
    rig.len = 4.5; rig.wide = 1.9; rig.tr = 0.33;
    const paint = tone, dark = jit(C.tyre, 0.1);
    const glassC = jit(C.glass, 0.08);
    wheelOn(rig, 0.79, 1.35, 0.33, 0.24, 0, 1);
    wheelOn(rig, -0.79, 1.35, 0.33, 0.24, 1, 1);
    wheelOn(rig, 0.79, -1.35, 0.33, 0.24, 2, 0);
    wheelOn(rig, -0.79, -1.35, 0.33, 0.24, 3, 0);
    const body = (at, s, col, rot) => bolt(rig, P.panel,
      { at: at, s: s, col: col, rot: rot });
    const metal = (at, s, col, rot) => bolt(rig, P.trim,
      { at: at, s: s, col: col, rot: rot });
    const glass = (at, s, rot) => bolt(rig, P.glass,
      { at: at, s: s, col: glassC, rot: rot });
    const lamp = (at, s, col) => bolt(rig, P.lamp, { at: at, s: s, col: col });

    body([0, 0.60, 0], [1.86, 0.40, 4.42], paint);
    body([0, 0.41, -0.1], [1.9, 0.16, 3.5], jit(paint, 0.09));
    body([0, 0.86, 1.45], [1.78, 0.16, 1.26], paint);
    body([0, 1.05, boot ? -0.12 : 0.05], [1.74, 0.5, boot ? 2.3 : 2.9], paint);
    body([0, 1.31, boot ? -0.18 : -0.1], [1.6, 0.1, boot ? 1.9 : 2.3], jit(paint, 0.05));
    if (boot) body([0, 0.9, -1.62], [1.78, 0.18, 1.0], paint);
    /* Windscreen and rear screen are thin boxes pitched onto the line between
       the panel edges they span, so the glass meets the metal instead of
       poking through it. */
    glass([0, 1.09, 0.68], [1.66, 0.05, 0.9], [-0.545, 0, 0]);
    if (boot) glass([0, 1.12, -1.32], [1.62, 0.05, 0.68], [0.58, 0, 0]);
    else glass([0, 1.06, -1.5], [1.62, 0.05, 0.92], [0.72, 0, 0]);
    [-1, 1].forEach((e) => {
      glass([e * 0.875, 1.06, boot ? -0.15 : 0.0], [0.05, 0.4, 2.0]);
      metal([e * 0.99, 1.02, 0.86], [0.24, 0.11, 0.12], C.chrome);
      lamp([e * 0.6, 0.74, 2.2], [0.44, 0.18, 0.07],
        tmpC.clone().setHex(C.head).multiplyScalar(1.5 + LIT * 1.9));
      lamp([e * 0.66, 0.78, -2.21], [0.4, 0.16, 0.06],
        tmpC.clone().setHex(C.tail).multiplyScalar(1.15 + LIT * 1.1));
    });
    metal([0, 0.5, 2.26], [1.9, 0.24, 0.26], C.chrome);
    metal([0, 0.5, -2.26], [1.9, 0.24, 0.26], C.chrome);
    metal([-0.6, 0.36, -2.34], [0.12, 0.12, 0.22], dark);
    bolt(rig, P.plate, { at: [0, 0.52, 2.4], s: [0.44, 0.14, 1], col: C.plate });
    bolt(rig, P.plate, { at: [0, 0.52, -2.4], s: [0.44, 0.14, 1], col: C.plate,
      rot: [0, Math.PI, 0] });
    if (taxi) {
      body([0, 1.45, 0.1], [0.52, 0.2, 0.92], C.taxi);
      lamp([0, 1.45, 0.1], [0.54, 0.16, 0.5],
        tmpC.clone().setHex(C.taxi).multiplyScalar(0.9 + LIT * 1.4));
    }
    return rig;
  };
  /* A van: cab, box body, and a taller ride than a car. */
  const makeVan = (tone) => {
    const rig = rigOf();
    rig.pivotY = 0.4;
    rig.len = 5.7; rig.wide = 2.1; rig.tr = 0.37;
    const paint = tone, glassC = jit(C.glass, 0.08);
    wheelOn(rig, 0.86, 1.72, 0.37, 0.26, 0, 1);
    wheelOn(rig, -0.86, 1.72, 0.37, 0.26, 1, 1);
    wheelOn(rig, 0.86, -1.68, 0.37, 0.26, 2, 0);
    wheelOn(rig, -0.86, -1.68, 0.37, 0.26, 3, 0);
    bolt(rig, P.panel, { at: [0, 0.72, 0], s: [2.06, 0.5, 5.5], col: paint });
    bolt(rig, P.panel, { at: [0, 1.62, -1.0], s: [2.06, 1.34, 3.5], col: paint });
    bolt(rig, P.panel, { at: [0, 1.32, 1.35], s: [2.0, 0.76, 1.7], col: paint });
    bolt(rig, P.panel, { at: [0, 2.31, -1.0], s: [1.96, 0.1, 3.4],
      col: jit(paint, 0.06) });
    bolt(rig, P.glass, { at: [0, 1.5, 2.24], s: [1.86, 0.72, 0.06],
      col: glassC, rot: [-0.22, 0, 0] });
    /* One panel on each flank in a second tone, which is what a van is for. */
    [-1, 1].forEach((e) => {
      bolt(rig, P.panel, { at: [e * 1.04, 1.6, -1.05], s: [0.03, 1.0, 2.9],
        col: jit(paint, 0.16) });
      bolt(rig, P.glass, { at: [e * 1.0, 1.46, 1.5], s: [0.05, 0.56, 1.1],
        col: glassC });
      bolt(rig, P.trim, { at: [e * 1.12, 1.62, 2.0], s: [0.26, 0.12, 0.12],
        col: C.chrome });
      bolt(rig, P.lamp, { at: [e * 0.7, 0.86, 2.78], s: [0.4, 0.2, 0.07],
        col: tmpC.clone().setHex(C.head).multiplyScalar(1.5 + LIT * 1.9) });
      bolt(rig, P.lamp, { at: [e * 0.78, 1.0, -2.78], s: [0.3, 0.5, 0.06],
        col: tmpC.clone().setHex(C.tail).multiplyScalar(1.15 + LIT * 1.1) });
    });
    bolt(rig, P.trim, { at: [0, 0.6, 2.82], s: [2.0, 0.3, 0.24], col: C.chrome });
    bolt(rig, P.trim, { at: [0, 0.6, -2.82], s: [2.0, 0.3, 0.24], col: C.chrome });
    bolt(rig, P.plate, { at: [0, 0.62, 2.96], s: [0.46, 0.15, 1], col: C.plate });
    return rig;
  };
  /* A bus. Six wheels: a steering pair at the front and two duals at the back.
     The duals are the reason this is worth spelling out - the old city sat them
     30 mm inside one another, so the inner tyre lived inside the outer one for
     the whole run. Outer faces span 0.95 to 1.23 and inner 0.64 to 0.92, which
     leaves 30 mm of daylight instead of 30 mm of overlap. */
  const makeBus = (tone) => {
    const rig = rigOf();
    rig.pivotY = 0.5;
    rig.len = 11.2; rig.wide = 2.55; rig.tr = 0.47;
    const paint = tone, glassC = jit(C.glass, 0.06);
    wheelOn(rig, 1.08, 3.55, 0.47, 0.3, 0, 1);
    wheelOn(rig, -1.08, 3.55, 0.47, 0.3, 1, 1);
    [1, -1].forEach((e) => {
      wheelOn(rig, e * 1.09, -3.2, 0.47, 0.28, e > 0 ? 2 : 3, 0);
      wheelOn(rig, e * 0.78, -3.2, 0.47, 0.28, e > 0 ? 2 : 3, 0);
    });
    bolt(rig, P.panel, { at: [0, 1.62, 0], s: [2.5, 2.1, 10.8], col: paint });
    bolt(rig, P.panel, { at: [0, 0.66, 0], s: [2.44, 0.5, 10.4],
      col: jit(paint, 0.12) });
    bolt(rig, P.panel, { at: [0, 2.73, 0], s: [2.42, 0.14, 10.5],
      col: jit(C.roof2, 0.05) });
    bolt(rig, P.glass, { at: [0, 2.05, 5.42], s: [2.3, 1.3, 0.06],
      col: glassC, rot: [-0.1, 0, 0] });
    bolt(rig, P.glass, { at: [0, 2.0, -5.42], s: [2.3, 1.1, 0.06], col: glassC });
    [-1, 1].forEach((e) => {
      [3.0, 0.4, -2.2].forEach((zz) => {
        bolt(rig, P.glass, { at: [e * 1.26, 2.06, zz], s: [0.05, 1.1, 2.3],
          col: glassC });
      });
      bolt(rig, P.panel, { at: [e * 1.24, 1.3, 4.0], s: [0.06, 1.5, 1.1],
        col: jit(paint, 0.2) });
      bolt(rig, P.lamp, { at: [e * 0.86, 0.86, 5.62], s: [0.44, 0.24, 0.07],
        col: tmpC.clone().setHex(C.head).multiplyScalar(1.5 + LIT * 1.9) });
      bolt(rig, P.lamp, { at: [e * 0.94, 1.0, -5.62], s: [0.34, 0.56, 0.06],
        col: tmpC.clone().setHex(C.tail).multiplyScalar(1.15 + LIT * 1.1) });
    });
    /* Destination blind: always a source, day or night. */
    bolt(rig, P.lamp, { at: [0, 2.52, 5.46], s: [1.5, 0.3, 0.06],
      col: tmpC.clone().setHex(C.awningA).multiplyScalar(1.3 + LIT * 1.2) });
    bolt(rig, P.trim, { at: [0, 0.68, 5.7], s: [2.44, 0.34, 0.22], col: C.chrome });
    bolt(rig, P.trim, { at: [0, 0.68, -5.7], s: [2.44, 0.34, 0.22], col: C.chrome });
    bolt(rig, P.plate, { at: [0, 0.68, 5.84], s: [0.48, 0.16, 1], col: C.plate });
    return rig;
  };
  /* ---- the traffic -------------------------------------------------------
     Each lane is a ring, not a strip. A vehicle's position is an arc length s
     in [0, RING), and the world z is read off it - so nothing is ever pinned
     at the end of the road with its wheels spinning, and nothing is ever
     respawned into the space another vehicle is already using.

     The ring is also what makes interpenetration impossible rather than
     unlikely: within a lane the order of vehicles never changes, so vehicle i
     always follows vehicle i+1 and the gap between them is exact. There is no
     search, no pair test, and no case where two cars can be found to have
     swapped places. */
  const Z0 = FAR_Z - 70, Z1 = NEAR_Z + 70, RING = Z1 - Z0;
  const LANES = [
    { x: -6.05, dir: 1 }, { x: -2.0, dir: 1 },
    { x: 2.0, dir: -1 }, { x: 6.05, dir: -1 },
  ];
  const laneZ = (dir, s) => (dir > 0 ? Z0 + s : Z1 - s);
  const wrap = (s) => ((s % RING) + RING) % RING;
  const ahead = (from, to) => wrap(to - from);

  /* Stop lines, in each direction's own arc length, with the index of the
     crossing they belong to so a vehicle can ask that crossing for its phase.
     Nine entries per direction - few enough that finding the nearest one is a
     scan, not a search. */
  const STOPS = { 1: [], '-1': [] };
  crossZ.forEach((cz, ci) => {
    STOPS[1].push({ s: wrap((cz - CROSS - 3.9) - Z0), ci: ci });
    STOPS['-1'].push({ s: wrap(Z1 - (cz + CROSS + 3.9)), ci: ci });
  });
  STOPS[1].sort((a, b) => a.s - b.s);
  STOPS['-1'].sort((a, b) => a.s - b.s);

  /* The cycle, offset per crossing so the greens run up the avenue as a wave
     instead of all switching at once - 5.2 s is how long a car at 13 m/s takes
     to cover the 68 m between crossings, so northbound traffic that catches one
     green tends to keep catching them. Green, amber, red, in that order, which
     is the order the lenses are numbered in: 0 red, 1 amber, 2 green.

     The red is long because it has to be. A capybara crossing four lanes covers
     18 m, and the walkers below will not step off unless the whole crossing
     fits inside the red with the clearance interval taken off the front. Shorten
     the red and you do not get impatient walkers, you get none. */
  const CYC = [16.0, 2.6, 14.0];
  const CYC_T = CYC[0] + CYC[1] + CYC[2];
  const phaseAt = (ci, t) => {
    const u = ((t + ci * 5.2) % CYC_T + CYC_T) % CYC_T;
    if (u < CYC[0]) return 2;
    if (u < CYC[0] + CYC[1]) return 1;
    return 0;
  };
  /* How long the crossing has been red, which is what the walkers wait on. */
  const redFor = (ci, t) => {
    const u = ((t + ci * 5.2) % CYC_T + CYC_T) % CYC_T;
    return u < CYC[0] + CYC[1] ? -1 : u - CYC[0] - CYC[1];
  };
  /* The roster. Vehicles are laid down in arc order at spawn, evenly spaced
     with only as much jitter as keeps that order intact - which is what lets
     the follower relation be an array index for the rest of the run. */
  const vehicles = [];
  const lists = LANES.map(() => []);
  /* The caps were derived from N_LANE, so a lane added to the table above
     without touching it would overrun a pass mid-build. Say so here instead. */
  if (LANES.length !== N_LANE) throw new Error('capycity: lane count is not ' + N_LANE);
  LANES.forEach((ln, li) => {
    const step = RING / PER_LANE;
    for (let i = 0; i < PER_LANE; i++) {
      const r = rand();
      let rig, v0, cls;
      const tone = pick(CAR_TONES);
      if (r < 0.1) { rig = makeBus(tone); v0 = rng(9, 12); cls = 4; }
      else if (r < 0.26) { rig = makeVan(tone); v0 = rng(10, 13.5); cls = 3; }
      else if (r < 0.42) { rig = makeCar(C.taxi, 1, 1); v0 = rng(12, 17); cls = 2; }
      else if (r < 0.68) { rig = makeCar(tone, 0, 0); v0 = rng(11, 15); cls = 1; }
      else { rig = makeCar(tone, 1, 0); v0 = rng(12, 16); cls = 0; }
      const v = {
        rig: rig, cls: cls, len: rig.len, v0: v0, tr: rig.tr,
        s: wrap(i * step + off(Math.min(16, step * 0.3))),
        v: v0 * rng(0.7, 1), dir: ln.dir, lane: li, tgt: -1, blend: 0,
        cool: rng(2, 26), x: ln.x, fx: ln.x, tx: ln.x, acc: 0, ax: 0, lat: 0,
      };
      vehicles.push(v);
      lists[li].push(v);
    }
    lists[li].sort((a, b) => a.s - b.s);
  });

  /* Intelligent-driver following. Two constraints, whichever bites harder: the
     vehicle in front, and the next stop line that is not green. Amber is only
     obeyed if there is room to stop for it, which is what stops a bus from
     standing on its nose at every junction. */
  const S0 = 2.4, HEAD_T = 1.35, A_MAX = 1.7, B_MAX = 2.6;
  const AB = 2 * Math.sqrt(A_MAX * B_MAX);
  const idm = (v, gap, dv) => {
    const g = Math.max(gap, 0.25);
    const want = S0 + Math.max(0, v.v * HEAD_T + v.v * dv / AB);
    const sp = v.v / v.v0;
    return A_MAX * (1 - sp * sp * sp * sp - (want / g) * (want / g));
  };
  /* Bumper-to-bumper gap between two vehicles on the same ring. Centre-to-
     centre arc minus both half-lengths, so zero means paint touching paint. */
  const gapOf = (a, b) => ahead(a.s, b.s) - (a.len + b.len) / 2;

  /* Where the list order comes from. A lane list is in ring order, not sorted
     order: list[i + 1] leads list[i], and that stays true when s wraps past
     RING, because ahead() is cyclic. So the array is built once and never
     re-sorted - the only writes are the splices a lane change makes.
     insertAt() finds the follower whose gap to v is smallest and puts v
     directly in front of it, which is the one slot that keeps ring order. */
  const insertAt = (list, v) => {
    if (!list.length) { list.push(v); return; }
    let bi = 0, bd = Infinity;
    for (let i = 0; i < list.length; i++) {
      const d = ahead(list[i].s, v.s);
      if (d < bd) { bd = d; bi = i; }
    }
    list.splice(bi + 1, 0, v);
  };
  const dropFrom = (list, v) => {
    const i = list.indexOf(v);
    if (i >= 0) list.splice(i, 1);
  };

  /* Nearest signal a vehicle has to answer to, as a distance or -1. A green
     light is not a constraint. An amber is one only if there is still room to
     stop for it - past that point the honest thing is to keep going, which is
     what a driver does and what keeps the junction from being blocked by a car
     braking to a halt across the zebra. Once the stop line is behind the
     vehicle, ahead() returns most of a ring and the term dies on its own. */
  const stopAhead = (v, t) => {
    const arr = STOPS[v.dir];
    let best = -1;
    for (let i = 0; i < arr.length; i++) {
      const d = ahead(v.s, arr[i].s);
      if (d > 190 || (best >= 0 && d >= best)) continue;
      const ph = phaseAt(arr[i].ci, t);
      if (ph === 2) continue;
      if (ph === 1 && d < v.v * v.v / (2 * B_MAX) + 1.4) continue;
      best = d;
    }
    return best;
  };
  /* Lane changes, and the one thing that makes them safe. A changing vehicle is
     entered into the target lane's list *before* it starts moving sideways and
     stays in both lists until it arrives, so for the whole manoeuvre it is a
     leader that two followers are yielding to. There is no window in which a
     car is unaccounted for in the lane it is entering.

     The gate is a plain courtesy test against the pair it would slot between,
     with the follower's own speed in its half - the same MOBIL-style safety
     criterion, minus the politeness term nobody would see. Lanes pair by
     sibling index: 0 with 1 and 2 with 3 share a direction, so li ^ 1. */
  const CHG_T = 2.3;
  const wantChange = (v, list) => {
    if (v.tgt >= 0 || v.cool > 0 || v.v < 3.2 || v.cls === 4) return false;
    const i = list.indexOf(v);
    const lead = list.length > 1 ? list[(i + 1) % list.length] : null;
    if (!lead) return false;
    const g = gapOf(v, lead);
    if (g > 16 || lead.v > v.v - 0.9) return false;   /* not actually blocked */
    return true;
  };
  const tryChange = (v, list) => {
    const ti = v.lane ^ 1;
    const dst = lists[ti];
    let ld = null, fl = null, la = Infinity, fa = Infinity;
    for (let i = 0; i < dst.length; i++) {
      const u = dst[i];
      const a = ahead(v.s, u.s), b = ahead(u.s, v.s);
      if (a < la) { la = a; ld = u; }
      if (b < fa) { fa = b; fl = u; }
    }
    if (ld && la - (v.len + ld.len) / 2 < 7 + v.v * 0.55) return;
    if (fl && fa - (v.len + fl.len) / 2 < 7 + fl.v * 0.85) return;
    v.tgt = ti;
    v.blend = 0;
    v.fx = LANES[v.lane].x;
    v.tx = LANES[ti].x;
    insertAt(dst, v);
  };
  /* One frame of traffic, in two passes. The first reads gaps and writes no
     positions; the second integrates and drives the rigs. Splitting them is
     what makes the update synchronous - every vehicle answers to the same
     snapshot of the road, so the result does not depend on list order. */
  const smoo = (u) => u * u * (3 - 2 * u);
  const traffic = (dt, t) => {
    for (let k = 0; k < vehicles.length; k++) vehicles[k].acc = A_MAX;
    for (let li = 0; li < lists.length; li++) {
      const list = lists[li], n = list.length;
      if (n < 2) continue;
      for (let i = 0; i < n; i++) {
        const v = list[i], lead = list[(i + 1) % n];
        if (lead === v) continue;
        const a = idm(v, gapOf(v, lead), v.v - lead.v);
        if (a < v.acc) v.acc = a;
      }
    }
    for (let k = 0; k < vehicles.length; k++) {
      const v = vehicles[k], rig = v.rig;
      /* A red light is a stationary leader parked on its stop line. */
      const sd = stopAhead(v, t);
      if (sd >= 0) {
        const a = idm(v, sd - v.len / 2 - 0.9, v.v);
        if (a < v.acc) v.acc = a;
      }
      const acc = clamp(v.acc, -B_MAX * 2.4, A_MAX);
      const v1 = Math.max(0, v.v + acc * dt);
      const dist = (v.v + v1) * 0.5 * dt;
      v.ax = (v1 - v.v) / dt;
      v.v = v1;
      v.s = wrap(v.s + dist);

      /* Lane bookkeeping. Leaving the old list is the last thing that happens,
         after the body has finished arriving. */
      if (v.tgt >= 0) {
        v.blend += dt / CHG_T;
        if (v.blend >= 1) {
          dropFrom(lists[v.lane], v);
          v.lane = v.tgt; v.tgt = -1; v.blend = 0;
          v.fx = v.tx = LANES[v.lane].x;
          v.cool = rng(9, 26);
        }
      } else if (v.cool > 0) v.cool -= dt;
      else if (wantChange(v, lists[v.lane])) tryChange(v, lists[v.lane]);
      /* Lateral position, and the heading that follows from it. The sideways
         motion is a smoothstep across the lane spacing, so its derivative is
         known exactly - no differencing, no jitter in the steering. */
      let lat = 0;
      if (v.tgt >= 0) {
        const u = Math.min(1, v.blend);
        v.x = v.fx + (v.tx - v.fx) * smoo(u);
        lat = (v.tx - v.fx) * 6 * u * (1 - u) / CHG_T;
      } else v.x = LANES[v.lane].x;

      /* World +x is the car's left when it faces +z and its right when it
         faces -z, so the local rate carries the direction. */
      const loc = v.dir * lat;
      const hd = Math.atan2(loc, Math.max(v.v, 0.6));
      const latA = (loc - v.lat) / dt;
      v.lat = loc;

      rig.x = v.x;
      rig.z = laneZ(v.dir, v.s);
      rig.yaw = (v.dir > 0 ? 0 : Math.PI) + hd;
      /* The front wheels turn further than the body does. */
      rig.steer = clamp(hd * 2.7, -0.42, 0.42);
      /* The only thing that turns a tyre: the ground it has covered. */
      rig.spin += dist / v.tr;
      /* Weight transfer. Positive pitch about local x tips the nose down, so
         braking wants the positive sign and the throttle the negative one. */
      rig.pitch = clamp(-v.ax * 0.010, -0.045, 0.045);
      rig.roll = clamp(latA * 0.011, -0.045, 0.045);
      rig.bob = Math.sin(v.s * 0.86 + v.len) * 0.005 - Math.abs(rig.pitch) * 0.06;
      const g = rig.ang;
      g[0] = Math.sin(v.s * 1.7) * 0.007;
      g[1] = Math.sin(v.s * 1.7 + 1.9) * 0.007;
      g[2] = Math.sin(v.s * 1.31 + 3.6) * 0.006;
      g[3] = Math.sin(v.s * 1.31 + 5.2) * 0.006;
      place(rig);
    }
  };
  /* The lenses. Repainted only on the frames a phase actually turns over. */
  const tickSignals = (t) => {
    for (let i = 0; i < heads.length; i++) {
      const hd = heads[i], ph = phaseAt(hd.ci, t);
      if (ph !== hd.lamp) { hd.lamp = ph; paintHead(hd); }
    }
  };

  /* ---- parked ------------------------------------------------------------
     Kerbside cars, on the cross streets only. The avenue is four running lanes
     from kerb to kerb with no bay to park in, so putting a car there would mean
     a lane with something standing in it; the cross streets carry no traffic at
     all, which makes them the one place a parked car can sit and be safe by
     construction rather than by test. Their whole rectangle is already booked
     as carriageway, so nothing else can land on them either.

     They are rigs, placed once and never touched again - the cheapest thing in
     the file, and they read as the same machines that are driving past. */
  const parked = [];
  crossZ.forEach((cz) => {
    [1, -1].forEach((sx) => {
      [1, -1].forEach((side) => {
        if (rand() < 0.34) return;
        let x = sx * rng(21, 30);
        const n = 2 + Math.floor(rand() * 4);
        for (let k = 0; k < n; k++) {
          const r = rand();
          const rig = r < 0.16 ? makeVan(pick(CAR_TONES))
            : makeCar(r < 0.3 ? C.taxi : pick(CAR_TONES), r < 0.62 ? 1 : 0, r < 0.3 ? 1 : 0);
          rig.x = x + sx * rig.len / 2;
          rig.z = cz + side * (CROSS - 1.05) + off(0.14);
          rig.yaw = sx > 0 ? Math.PI / 2 : -Math.PI / 2;
          rig.yaw += off(0.026);
          place(rig);
          parked.push(rig);
          x += sx * (rig.len + rng(0.9, 2.4));
          if (Math.abs(x) > 118) break;
        }
      });
    });
  });
  /* ---- the crew ----------------------------------------------------------
     A capybara, upright, about 1.5 m to the top of the cap - which is what it
     takes to read as a figure on a pavement 30 m away. Blunt muzzle, small high
     ears, heavy in the hindquarters: the silhouette does the work, so the
     geometry can stay a handful of balls and four capsules.

     The legs are bolted to the chassis frame and the torso to the shell, for
     the same reason a wheel is: the body bobs through the stride and the feet
     stay on the paving. The hip joint slides a couple of centimetres inside the
     jacket hem where nothing can see it.

     Channels: 0 left leg, 1 right leg, 2 left arm, 3 right arm, 4 head turn,
     5 head nod, 6 the free hand's carry. */
  const WALK_Y = KERB + 0.006;
  const makeCapy = () => {
    const rig = rigOf();
    const skin = rand() < 0.34 ? C.capy2 : C.capy;
    const coat = pick(FITS);
    const HIP = 0.62, SH = 1.14;
    rig.pivotY = HIP;
    rig.tall = 1.52;
    /* legs, then arms - the two pairs differ only in what frame they ride */
    bolt(rig, P.limb, { at: [0.135, HIP, 0], s: [0.15, HIP / 2, 0.15],
      col: jit(C.capyDark, 0.05), ch: [0, null, null], lean: false });
    bolt(rig, P.limb, { at: [-0.135, HIP, 0], s: [0.15, HIP / 2, 0.15],
      col: jit(C.capyDark, 0.05), ch: [1, null, null], lean: false });
    bolt(rig, P.limb, { at: [0.285, SH, 0], s: [0.115, 0.25, 0.115],
      col: jit(skin, 0.05), ch: [2, null, null] });
    bolt(rig, P.limb, { at: [-0.285, SH, 0], s: [0.115, 0.25, 0.115],
      col: jit(skin, 0.05), ch: [3, null, null] });
    /* torso: a fur barrel with a boxy garment over it, so a collar and a hem of
       fur show and the shoulders stay square */
    bolt(rig, P.fur, { at: [0, 0.92, 0], s: [0.42, 0.54, 0.36], col: jit(skin, 0.04) });
    bolt(rig, P.fit, { at: [0, 0.9, 0], s: [0.44, 0.48, 0.38], col: coat });
    if (rand() < 0.5) {
      bolt(rig, P.fit, { at: [0, 0.66, 0], s: [0.4, 0.22, 0.35], col: pick(FITS) });
    }
    /* head, muzzle, ears - all five parts orbit the same point at the base of
       the neck, so a glance turns the whole face and not just the skull */
    const NECK = [0, 1.14, -0.02];
    bolt(rig, P.fur, { at: [0, 1.3, 0.01], s: [0.33, 0.31, 0.36],
      col: jit(skin, 0.03), ch: [5, 4, null], pv: NECK });
    bolt(rig, P.fur, { at: [0, 1.26, 0.2], s: [0.19, 0.16, 0.2],
      col: jit(C.capyNose, 0.04), ch: [5, 4, null], pv: NECK });
    [0.15, -0.15].forEach((ex) => {
      bolt(rig, P.fur, { at: [ex, 1.45, -0.03], s: [0.1, 0.11, 0.07],
        col: jit(C.capyDark, 0.05), ch: [5, 4, null], pv: NECK });
    });
    if (rand() < 0.62) {
      const cc = pick(FITS);
      bolt(rig, P.fit, { at: [0, 1.47, -0.01], s: [0.37, 0.11, 0.39], col: cc,
        ch: [5, 4, null], pv: NECK });
      bolt(rig, P.fit, { at: [0, 1.44, 0.24], s: [0.31, 0.05, 0.19], col: cc,
        ch: [5, 4, null], pv: NECK });
    }
    return rig;
  };
  /* ---- the crowd ---------------------------------------------------------
     Walkers get their own ring, one per (side, direction). Same guarantee as
     the traffic and for the same reason: within a list the order never changes,
     so a walker's leader is the next index and the gap between them is exact.
     The two directions also get their own half of the 2.6 m corridor, and the
     halves do not overlap, so nobody has to dodge anybody coming the other way.

     Crossing the avenue is the one thing that takes a walker out of its list,
     and it is the one place a body could end up somewhere unaccounted for. Two
     locks make that impossible rather than unlikely:

       - a zebra lane token. Each of the eighteen zebra bands is split into two
         lanes 1.5 m apart; a walker must own a lane for the whole kerb-to-kerb
         trip, so at most two cross a band at once and never in the same line.
       - the commit test. A walker steps off only if the entire crossing fits
         inside what is left of the red, after the clearance interval that lets
         the junction empty. It arrives before the light changes, always - the
         crossing is atomic in time, not merely likely to finish.

     Rejoining is gated too: the walker stands on the far kerb until the gap it
     would drop into is genuinely clear, then splices itself in. */
  const W0 = SW_F + 8, W1 = SW_N - 8, WRING = W1 - W0;
  const wwrap = (s) => ((s % WRING) + WRING) % WRING;
  const wahead = (a, b) => wwrap(b - a);
  const wz = (dir, s) => (dir > 0 ? W0 + s : W1 - s);
  const wsOf = (dir, z) => wwrap(dir > 0 ? z - W0 : W1 - z);
  const BAND = { 1: [CORR_0 + 0.32, CORR_MID - 0.12],
    '-1': [CORR_MID + 0.12, CORR_1 - 0.32] };
  const KERB_X = AVE + 1.0;                 /* where a walker waits to cross  */
  const crew = [];
  const walks = {};                         /* eight lists, keyed side:dir    */
  const wkey = (side, dir) => (side > 0 ? 'e' : 'w') + (dir > 0 ? 'n' : 's');
  [1, -1].forEach((side) => [1, -1].forEach((dir) => { walks[wkey(side, dir)] = []; }));
  /* Zebra lane tokens: crossing index, which side of the junction, which of the
     two lanes across that band. Held for the whole trip. */
  const lanesFree = {};
  const tkey = (ci, zs, k) => ci + ':' + zs + ':' + k;
  crossZ.forEach((cz, ci) => {
    [1, -1].forEach((zs) => { lanesFree[tkey(ci, zs, 0)] = 1; lanesFree[tkey(ci, zs, 1)] = 1; });
  });
  const zebraZ = (ci, zs, k) => crossZ[ci] + zs * (CROSS + 1.7) + (k ? 0.75 : -0.75);
  /* Thirty-two to a list, which is a walker every 22 m of pavement in each
     direction: quiet, but never empty, and it holds at any point on the rail.
     PER_WALK is declared with the census, because the fur, limb and fit caps
     are derived from it. */
  const W_LEN = 0.58;                        /* front to back, for the gap     */
  [1, -1].forEach((side) => {
    [1, -1].forEach((dir) => {
      const list = walks[wkey(side, dir)];
      const step = WRING / PER_WALK;
      const band = BAND[dir];
      for (let i = 0; i < PER_WALK; i++) {
        const rig = makeCapy();
        const w = {
          rig: rig, side: side, dir: dir,
          s: wwrap(i * step + off(step * 0.34)),
          v: 0, v0: rng(1.05, 1.62), vx: rng(1.85, 2.3),
          bx: side * rng(band[0], band[1]),  /* its lane inside the corridor   */
          x: 0, lx: 0, ph: rand() * 6.283, st: 0,
          cap: 0, mv: 0, ss: 0, cx: 0,
          ci: -1, zs: 0, zk: 0, zz: 0, tok: null, hold: rng(1, 30),
          turn: 0, nod: 0, want: rand() * 6.283,
        };
        w.x = w.bx;
        crew.push(w);
        list.push(w);
      }
      list.sort((a, b) => a.s - b.s);
    });
  });
  trimDyn();
  /* Ring-order insertion for a walker, same argument as the vehicles' - go in
     front of whoever is nearest behind you and the order stays consistent. */
  const winsert = (list, w) => {
    if (!list.length) { list.push(w); return; }
    let bi = 0, bd = Infinity;
    for (let i = 0; i < list.length; i++) {
      const d = wahead(list[i].s, w.s);
      if (d < bd) { bd = d; bi = i; }
    }
    list.splice(bi + 1, 0, w);
  };
  /* The gap a walker would land in if it rejoined here, as [ahead, behind]. */
  const wgaps = (list, s, out) => {
    out[0] = WRING; out[1] = WRING;
    for (let i = 0; i < list.length; i++) {
      const a = wahead(s, list[i].s), b = wahead(list[i].s, s);
      if (a < out[0]) out[0] = a;
      if (b < out[1]) out[1] = b;
    }
    return out;
  };
  const gapBuf = [0, 0];
  const CLEAR = 2.4;                  /* how long the junction gets to empty  */
  const HIP = 0.62;
  /* Hunt for a zebra band this walker could reach: far enough ahead that it can
     slow to a stop at the kerb, near enough that it is a decision and not a
     plan. Returns 1 if a lane token was claimed. */
  const seekCrossing = (w) => {
    let bd = Infinity, bci = -1, bzs = 0, bk = 0, bs = 0;
    for (let ci = 0; ci < crossZ.length; ci++) {
      for (let j = 0; j < 2; j++) {
        const zs = j ? -1 : 1;
        for (let k = 0; k < 2; k++) {
          if (!lanesFree[tkey(ci, zs, k)]) continue;
          const zz = zebraZ(ci, zs, k);
          const s = wsOf(w.dir, zz);
          const d = wahead(w.s, s);
          if (d < 12 || d > 48 || d >= bd) continue;
          bd = d; bci = ci; bzs = zs; bk = k; bs = s; w.zz = zz;
        }
      }
    }
    if (bci < 0) return 0;
    w.ci = bci; w.zs = bzs; w.zk = bk; w.ss = bs;
    w.zz = zebraZ(bci, bzs, bk);
    w.tok = tkey(bci, bzs, bk);
    lanesFree[w.tok] = 0;
    return 1;
  };
  /* One frame of pavement. Same two-pass shape as the traffic: read all the
     gaps, then move everybody. States: 0 strolling, 1 heading for a kerb,
     2 waiting on it, 3 out on the zebra, 4 standing on the far kerb waiting for
     a gap to step back into. */
  const crowd = (dt, t) => {
    for (let i = 0; i < crew.length; i++) crew[i].cap = crew[i].v0;
    for (const key in walks) {
      const list = walks[key], n = list.length;
      if (n < 2) continue;
      for (let i = 0; i < n; i++) {
        const w = list[i], ld = list[(i + 1) % n];
        const c = (wahead(w.s, ld.s) - W_LEN - 0.28) * 1.5;
        if (c < w.cap) w.cap = c > 0 ? c : 0;
      }
    }
    for (let i = 0; i < crew.length; i++) {
      const w = crew[i], rig = w.rig, band = BAND[w.dir];
      let tx = w.bx, sp = 0;
      if (w.st === 0) {
        sp = w.cap;
        w.hold -= dt;
        if (w.hold <= 0) { w.hold = rng(9, 46); if (seekCrossing(w)) w.st = 1; }
      } else if (w.st === 1) {
        tx = w.side * KERB_X;
        const ds = wahead(w.s, w.ss);
        if (ds < 0.12 || ds > WRING * 0.5) w.st = 2;
        else sp = Math.min(w.cap, ds * 1.5);
      } else if (w.st === 2) {
        /* Step off only if the whole crossing fits in what is left of the red,
           with the clearance interval taken off the front. */
        tx = w.side * KERB_X;
        const rf = redFor(w.ci, t);
        if (rf >= CLEAR && CYC[2] - rf >= 2 * KERB_X / w.vx + 0.8) {
          dropFrom(walks[wkey(w.side, w.dir)], w);
          w.cx = 0;
          w.st = 3;
        }
      } else if (w.st === 3) {
        sp = w.vx;
        w.cx += sp * dt / (2 * KERB_X);
        tx = lerp(w.side * KERB_X, -w.side * KERB_X, Math.min(1, w.cx));
        if (w.cx >= 1) {
          w.side = -w.side;
          w.bx = w.side * rng(band[0], band[1]);
          w.st = 4;
        }
      } else {
        tx = w.side * KERB_X;
        const list = walks[wkey(w.side, w.dir)];
        const ns = wsOf(w.dir, w.zz);
        wgaps(list, ns, gapBuf);
        if (gapBuf[0] > 1.7 && gapBuf[1] > 1.7) {
          w.s = ns;
          winsert(list, w);
          lanesFree[w.tok] = 1;
          w.tok = null; w.ci = -1; w.st = 0; w.hold = rng(16, 60);
        }
      }
      if (w.st === 0 || w.st === 1) w.s = wwrap(w.s + sp * dt);
      w.mv = sp;
      /* Out on the zebra the walker is where the interpolation says it is; the
         rest of the time it drifts to its lane, which is what makes stepping
         across the furniture strip read as a diagonal and not a sidestep. */
      if (w.st === 3) w.x = tx;
      else w.x += (tx - w.x) * (1 - Math.pow(0.02, dt * 0.9));
      const lat = w.dir * (w.x - w.lx) / dt;
      w.lx = w.x;

      /* The stride is locked to the ground it covers: one half cycle per stride
         length, so a foot that is down stays put. The hips drop by exactly what
         the scissor costs, which is what keeps the feet on the paving instead of
         skating above it. */
      const A = 0.3 + Math.min(0.2, sp * 0.1);
      w.ph += (sp * dt / (2 * HIP * Math.sin(A))) * Math.PI;
      const th = Math.sin(w.ph) * A;
      const g = rig.ang;
      g[0] = th; g[1] = -th;
      g[2] = -th * 0.64; g[3] = th * 0.64;
      /* A glance: at the road while waiting to cross, idle drift otherwise. */
      const tTurn = w.st === 2 ? 0.62 * -w.side * w.dir
        : w.st === 3 ? 0 : Math.sin(t * 0.31 + w.want) * 0.21;
      w.turn += (tTurn - w.turn) * (1 - Math.pow(0.05, dt));
      w.nod += ((w.st === 2 ? -0.07 : Math.sin(t * 0.44 + w.want * 2) * 0.05)
        - w.nod) * (1 - Math.pow(0.08, dt));
      g[4] = w.turn;
      g[5] = w.nod;

      rig.x = w.x;
      rig.z = w.st >= 2 ? w.zz : wz(w.dir, w.s);
      rig.y = WALK_Y - HIP * (1 - Math.cos(th));
      rig.yaw = w.st === 3 ? -w.side * Math.PI / 2
        : (w.dir > 0 ? 0 : Math.PI) + Math.atan2(lat, Math.max(sp, 0.5));
      rig.bob = Math.cos(w.ph * 2) * 0.005;
      rig.pitch = clamp(sp * 0.012, 0, 0.03);
      rig.roll = clamp(-lat * 0.06, -0.05, 0.05)
        + (sp < 0.06 ? Math.sin(t * 1.15 + w.want) * 0.016 : 0);
      place(rig);
    }
  };
  /* ---- the camera --------------------------------------------------------
     One rail, three ways to ride it, and a damper they all go through.

       drive  a camera on a car, low and close behind it. The traffic model is
              the point of this shot: you see a tyre roll, a nose dip at a red,
              and the queue in front build and release.
       fly    the eight-point Catmull-Rom rail down the avenue, and what the
              embedded plate uses - there the page's own scroll is the input,
              standalone it advances by itself and the wheel scrubs it.
       orbit  a slow turn around downtown, for looking at the massing.

     Nothing writes to the camera except the commit at the end of aimCam. */
  /* POINT 0 IS THE MOST-LOOKED-AT FRAME IN THE SCENE. Both embedded plates hold
     u = 0 until the reader scrolls, so whatever it frames is what most visitors
     ever see. It therefore opens ABOVE the city, not inside it: at y 38, z 128 -
     36 m in front of the frontage, which starts at SW_N = NEAR_Z + 60 - looking
     10.2 deg down the avenue. Three things follow from that geometry and each is
     load-bearing:

       - The cloud bank sits at 6-12 deg of elevation from here. With a 29 deg
         vertical half-FOV and the aim only 10 deg down, it lands comfortably in
         the upper frame. A street-level opening cannot show it at all: 34 m
         walls at 13.4 m subtend ~68 deg, which is the whole sky.
       - Near rooftops are ~34 m, so they sit just under the horizon while the
         downtown mass at z -300 rises above it. That is what makes a skyline.
       - There is ground to look down at. The world plate is 2400 x (SPAN + 900)
         centred on MID_Z -423, so it runs z 504 to -1350, and the bottom of the
         frame meets it ~46 m ahead at z 82 - inside the asphalt, which ends at
         z 124. The road-end seam is below the frame, not across it.

     Points 2 and 3 dive back into the traffic layer for the detail that only
     reads from street level, and there they obey the same two numbers the rest
     of the file does: x -4.1 is the -4.0 lane line, the gap between lane centres
     -6.05 and -2.0, and y stays above 3.2 m, a bus roof. A camera the traffic
     can drive through is the interpenetration rule broken at the lens. From
     point 4 the rail is above the rooflines again and free to weave. */
  const RAIL = [
    [-6.0, 38.0, 128], [-5.2, 20.0, 44], [-4.1, 5.6, -26], [-2.2, 9.0, -120],
    [1.0, 18.0, -230], [3.0, 28.0, -350], [-2.0, 39.0, -510], [-9.5, 54.0, -740],
  ];
  const AIM = [
    [-1.0, 16.0, 6], [-0.5, 9.0, -46], [0.0, 3.4, -106], [0.4, 5.4, -200],
    [0.0, 8.5, -310], [-1.0, 11.0, -440], [0.4, 13.0, -590], [2.4, 15.0, -820],
  ];
  const spline = (rows) => new T.CatmullRomCurve3(
    rows.map((r) => new T.Vector3(r[0], r[1], r[2])), false, 'catmullrom', 0.5);
  const railEye = spline(RAIL);
  const railAim = spline(AIM);

  const eyeT = new T.Vector3(), aimT = new T.Vector3();
  const eyeC = new T.Vector3(), aimC = new T.Vector3();
  let fovT = 58, fovC = 58, primed = false;
  let mode = EMBED ? 'fly' : (qs('cam') || doc.dataset.cam || stage.dataset.cam || 'drive');
  if (mode !== 'fly' && mode !== 'orbit') mode = 'drive';
  let flyU = 0.02, orbA = 0.9;
  /* The car the drive shot is riding. It is reassigned when that car wraps off
     the end of the ring, which is also the one place this shot has to cut.
     Saloons, hatches and taxis only (cls < 3): the shot is about a car. */
  let chase = null, chaseS = 0;
  const pickChase = () => {
    const pool = [];
    for (let i = 0; i < vehicles.length; i++) if (vehicles[i].cls < 3) pool.push(vehicles[i]);
    chase = pool.length ? pool[Math.floor(rand() * pool.length)] : vehicles[0];
    chaseS = chase.s;
    primed = false;
  };
  pickChase();
  /* Drag look, all three modes: an offset applied to the aim point and never to
     the position, so a shot keeps its framing while the operator looks around. */
  let dragging = false, dragX = 0, dragY = 0, yawOff = 0, pitchOff = 0;
  const spin = new T.Vector3();
  let flyHold = 0;
  /* Downtown, for the orbit: the middle crossing of the nine, so the shot turns
     around a real junction rather than around a number typed in here. */
  const ORB_Z = crossZ[Math.max(0, Math.floor(crossZ.length / 2))] || -150;

  /* Document scroll, 0 to 1. Read off the document rather than off the stage so
     it works whether the host pins the plate with `fixed` or with `sticky`. */
  const scrollAt = () => {
    const max = (doc.scrollHeight - (innerHeight || 1)) || 1;
    return clamp((window.pageYOffset || doc.scrollTop || 0) / max, 0, 1);
  };
  const aimCam = (dt) => {
    if (mode === 'fly') {
      /* Embedded, the page's scroll is the position on the rail and there is no
         drift - the plate must not move when the reader is not moving. */
      if (EMBED) flyU = scrollAt();
      else {
        flyHold = Math.max(0, flyHold - dt);
        if (!flyHold) flyU = (flyU + dt * 0.021) % 1;
      }
      railEye.getPoint(flyU, eyeT);
      railAim.getPoint(flyU, aimT);
      fovT = 58;
    } else if (mode === 'drive') {
      /* Set back from the car's tail rather than from its centre - 8.6 m from the
         middle of an 11.2 m bus is 3 m from the back of it, which is a shot of a
         roof. Then 3.6 m off the near shoulder, because dead astern is the one
         angle that hides all four wheels, and the wheels are the point: this is
         the shot where you can see a tyre roll and a nose dip at a red. The
         offset lands the subject right of centre and above the dock, between the
         two corners the card and the dock have already taken. */
      if (chase.s < chaseS - RING * 0.5) pickChase();
      chaseS = chase.s;
      const yw = chase.rig.yaw, fx = Math.sin(yw), fz = Math.cos(yw);
      const cx = chase.rig.x, cz = chase.rig.z;
      const back = chase.len * 0.5 + 7.2, fwd = chase.len * 0.5 + 6;
      eyeT.set(cx - fx * back + fz * 3.6, 3.0 + chase.len * 0.06,
        cz - fz * back - fx * 3.6);
      aimT.set(cx + fx * fwd, 0.85, cz + fz * fwd);
      fovT = 48;
    } else {
      /* Outside the block and above it. A tighter circle spends half its turn
         looking at the back of the nearest wall: at 148 m and 86 m up, the
         sightline down to the junction clears the roofline by several metres for
         the whole revolution, so the avenue reads as a canyon rather than as a
         gap between two roofs. */
      orbA += dt * 0.055;
      eyeT.set(Math.sin(orbA) * 148, 86, ORB_Z + Math.cos(orbA) * 148);
      aimT.set(0, 5, ORB_Z);
      fovT = 40;
    }
    /* Drag look: swing the aim point around the eye. Done after the mode has
       written its framing so it composes with all three of them. */
    if (yawOff || pitchOff) {
      spin.subVectors(aimT, eyeT);
      const r = Math.max(0.001, spin.length());
      const ya = Math.atan2(spin.x, spin.z) + yawOff;
      const pa = clamp(Math.asin(clamp(spin.y / r, -1, 1)) + pitchOff, -1.15, 1.15);
      const cp = Math.cos(pa);
      aimT.set(eyeT.x + Math.sin(ya) * cp * r, eyeT.y + Math.sin(pa) * r,
        eyeT.z + Math.cos(ya) * cp * r);
    }

    if (!primed) {
      eyeC.copy(eyeT); aimC.copy(aimT); fovC = fovT; primed = true;
    } else {
      /* Drive tracks tightly or the car drives out of frame; the rail and the
         orbit are slow moves and want the long lag. */
      const k = 1 - Math.pow(0.02, dt * (mode === 'drive' ? 3.6 : EMBED ? 1.7 : 1.2));
      eyeC.lerp(eyeT, k);
      aimC.lerp(aimT, k);
      fovC += (fovT - fovC) * k;
    }
    camera.position.copy(eyeC);
    camera.lookAt(aimC);
    if (Math.abs(camera.fov - fovC) > 0.008) {
      camera.fov = fovC;
      camera.updateProjectionMatrix();
    }
    /* The shadow box is 156 m across and the city is 614 m long, so the box has
       to travel. It follows what the camera is looking at, not where it is - a
       long lens down the avenue would otherwise leave its own subject outside
       the only part of the city that casts. */
    sun.target.position.set(aimC.x, 0, aimC.z);
    sun.position.set(aimC.x + sunDir.x * 172, sunDir.y * 172 + 18, aimC.z + sunDir.z * 172);
    kick.target.position.set(aimC.x, 0, aimC.z);
    kick.position.set(aimC.x + kickDir.x * 130, kickDir.y * 130 + 12, aimC.z + kickDir.z * 130);
  };
  /* ---- size, quality, input ----------------------------------------------
     Three tiers, and the only honest way to drop one: fewer pixels, no bloom
     chain, a smaller shadow map. Nothing is removed from the city - a preview
     that shows a different scene at a different setting is not a preview. */
  const resize = () => {
    const w = boxW(), h = boxH();
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    sizeTargets();
  };
  const QS = [
    { n: 'low', pr: 1, bloom: 0, shadow: 0, map: 1024 },
    { n: 'mid', pr: 1.35, bloom: 1, shadow: 1, map: 1536 },
    { n: 'high', pr: 2, bloom: 1, shadow: 1, map: 2048 },
  ];
  let qi = 2;
  const applyQ = (n) => {
    qi = Math.round(clamp(n, 0, QS.length - 1));
    const q = QS[qi];
    bloomOn = !!q.bloom;
    if (!bloomOn) clearMips();
    renderer.shadowMap.enabled = !!q.shadow;
    sun.castShadow = !!q.shadow;
    if (sun.shadow.mapSize.width !== q.map) {
      sun.shadow.mapSize.set(q.map, q.map);
      /* A shadow map only changes size if the old one is thrown away. */
      if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    }
    renderer.shadowMap.needsUpdate = true;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, q.pr));
    resize();
  };
  /* A phone gets the middle tier and a small window gets it too - the deciding
     factor is how many pixels the composite has to touch, not what the device
     claims about itself. */
  applyQ(qs('q') ? parseInt(qs('q'), 10) : (boxW() * boxH() > 1100000 ? 1 : 2));

  let sized = boxW() + 'x' + boxH();
  addEventListener('resize', () => {
    const now = boxW() + 'x' + boxH();
    if (now === sized) return;
    sized = now;
    resize();
  }, { passive: true });

  if (!EMBED) {
    const el = renderer.domElement;
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', (e) => {
      dragging = true; dragX = e.clientX; dragY = e.clientY;
      if (el.setPointerCapture) el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      yawOff -= (e.clientX - dragX) * 0.0034;
      pitchOff = clamp(pitchOff - (e.clientY - dragY) * 0.0026, -0.7, 0.7);
      dragX = e.clientX; dragY = e.clientY;
      flyHold = 2.4;            /* the rail does not drift out from under a drag */
    });
    el.addEventListener('wheel', (e) => {
      /* The hint says scroll to move down the avenue, and standalone there is no
         document to scroll - so the wheel scrubs the rail directly. */
      if (mode !== 'fly') return;
      e.preventDefault();
      flyU = clamp(flyU + (e.deltaY > 0 ? 1 : -1) * 0.012, 0, 1);
      flyHold = 2.4;
    }, { passive: false });
    const up = () => { dragging = false; };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }
  /* The grade follows the light: the hour's own exposure and bloom weight are
     written into the composite here rather than left at the day defaults. The
     sky shader already took hour.lobe when it was built. */
  compMat.uniforms.exposure.value = hour.exposure;
  compMat.uniforms.bloom.value = hour.bloom;
  /* ---- the preview dock (concept only, would not ship) -------------------
     Three rows of buttons in the corner of the standalone page. Camera and
     quality switch live. The hour cannot: the fraction of windows with a light
     on is baked into instance colour when the city is built, so changing the
     hour means building the city again - the button reloads with ?hour= rather
     than pretending to restyle in place. */
  const dock = document.querySelector('.dock');
  if (dock && !EMBED) {
    /* Scoped to the dock on purpose: <html> carries the same three data
       attributes, and a document-wide query would pick it up as a button. */
    const rowOf = (attr, val) => {
      dock.querySelectorAll('button[data-' + attr + ']').forEach((b) => {
        b.classList.toggle('is-active', b.dataset[attr] === val);
      });
    };
    rowOf('cam', mode);
    dock.querySelectorAll('button[data-cam]').forEach((b) => {
      b.addEventListener('click', () => {
        mode = b.dataset.cam;
        doc.dataset.cam = mode;
        rowOf('cam', mode);
        /* A mode change is a cut, not a move: drop the damper and the drag. */
        primed = false;
        yawOff = 0;
        pitchOff = 0;
        if (mode === 'drive') pickChase();
        if (mode === 'orbit') orbA = 0.9;
      });
    });
    const QN = { lite: 0, balanced: 1, high: 2 };
    rowOf('quality', QS[qi].n === 'low' ? 'lite' : QS[qi].n === 'mid' ? 'balanced' : 'high');
    dock.querySelectorAll('button[data-quality]').forEach((b) => {
      b.addEventListener('click', () => {
        const v = b.dataset.quality;
        applyQ(QN[v] === undefined ? 2 : QN[v]);
        doc.dataset.quality = v;
        rowOf('quality', v);
      });
    });
    rowOf('hour', hourName);
    dock.querySelectorAll('button[data-hour]').forEach((b) => {
      b.addEventListener('click', () => {
        if (b.dataset.hour === hourName) return;
        const keep = qs('q');
        location.search = '?hour=' + encodeURIComponent(b.dataset.hour)
          + (keep ? '&q=' + encodeURIComponent(keep) : '');
      });
    });
  }
  /* ---- readouts ----------------------------------------------------------
     The title card claims a crew and a traffic count; both are read back off
     the rosters that were actually built rather than off the constants they
     were asked for, so a clamp or a failed footprint booking shows up here
     instead of hiding. Draw calls come from the renderer after the first
     frame - it is the number that decides whether the batching worked. */
  const $ = (id) => document.getElementById(id);
  const elFps = $('hud-fps'), elCapy = $('stat-capy');
  const elCars = $('stat-cars'), elDraw = $('stat-draw');
  if (elCapy) elCapy.textContent = crew.length + ' walking';
  if (elCars) {
    elCars.textContent = vehicles.length + ' moving · ' + parked.length + ' parked';
  }

  /* ---- the loop ----------------------------------------------------------
     dt is clamped. A tab left in the background, a breakpoint, or a slow first
     compile all hand back a dt measured in seconds, and every integrator in
     this file - IDM, the walk phase, the lane blend - would step straight
     through a gap it should have resolved. 50 ms is the widest step that still
     keeps a 13 m/s car inside its own following distance. */
  const DT_MAX = 0.05;
  let last = 0, elapsed = 0, raf = 0, awake = true;
  let fpsN = 0, fpsAt = 0, drawn = false;

  /* The whole cloud bank on one transform. The field is two tiles wide and
     periodic, so the modulo is seamless - see the note over the cloud block.
     3.1 m/s is a light breeze at this scale: over a minute of reading the sky
     moves about 190 m, which is a drift you notice only if you look. */
  const cloudPass = kinds.get('cloud');
  const driftClouds = (t) => {
    if (!cloudPass || !cloudPass.mesh) return;
    cloudPass.mesh.position.x = (t * 3.1) % CLOUD_TILE;
  };

  const tick = (dt) => {
    elapsed += dt;
    driftClouds(elapsed);
    traffic(dt, elapsed);
    crowd(dt, elapsed);
    tickSignals(elapsed);
    flush();
    aimCam(dt);
  };

  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    if (!last) { last = now; fpsAt = now; }
    const raw = (now - last) / 1000;
    last = now;
    tick(Math.min(raw, DT_MAX));
    draw(elapsed);
    /* Frames counted over the window rather than instantaneous 1/dt averaged:
       one long frame does not then drag the number down for the next second. */
    if (elFps) {
      fpsN++;
      if (now - fpsAt > 480) {
        elFps.textContent = String(Math.round(fpsN * 1000 / (now - fpsAt)));
        fpsAt = now; fpsN = 0;
      }
    }
    /* The batching is decided when the city is built, so the count is the same
       on the second frame as on the thousandth. Read it once and stop. */
    if (!drawn && elDraw) { elDraw.textContent = String(sceneCalls); drawn = true; }
  };
  /* The city is built with every car and every walker sitting exactly on its
     roster spacing, which is the one arrangement that never occurs once the sim
     is running: no queue at a red, every stride at the same phase. So it is
     stepped forward 6 s before the first frame is shown - the traffic bunches,
     the signals reach different phases, the walk cycles decorrelate, and the
     opening frame looks like a city that was already there.

     The camera is not part of that: six seconds of drift would put the rail a
     seventh of the way down the avenue before the first frame, and the orbit a
     third of a radian round, so the shot everyone opens on would be a shot
     nobody chose. The two free-running positions are put back afterwards. */
  const flyU0 = flyU, orbA0 = orbA;
  for (let i = 0; i < 180; i++) tick(1 / 30);
  flyU = flyU0; orbA = orbA0; primed = false;

  const oneFrame = () => { draw(elapsed); };
  stage.setAttribute('data-renderer', 'webgl');

  /* `still` was decided at the top of the file: reduced motion, or a connection
     the visitor has asked not to be spent. Either way it is honoured literally -
     the settled city, once, and no loop. Everything else in here - the grade,
     the toon ramp, the crowd, the traffic - is still there in that one frame. */
  if (still) {
    aimCam(0);
    oneFrame();
    if (elFps) elFps.textContent = 'still';
    if (elDraw) elDraw.textContent = String(sceneCalls);
    /* Registered after the resize handler above, so it runs after it: the one
       frame has to be drawn again at the new size or the canvas stays stretched. */
    addEventListener('resize', oneFrame, { passive: true });
  } else {
    /* A hidden tab gets no frames at all rather than a throttled trickle: the
       loop is torn down and rebuilt, and `last` is dropped so the first frame
       back measures its own dt instead of the length of the absence. */
    const wake = () => {
      const want = !document.hidden;
      if (want === awake) return;
      awake = want;
      if (awake) { last = 0; raf = requestAnimationFrame(frame); }
      else if (raf) { cancelAnimationFrame(raf); raf = 0; }
    };
    document.addEventListener('visibilitychange', wake);
    raf = requestAnimationFrame(frame);
  }
})();
