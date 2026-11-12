import * as THREE from "three";

/*!
 * ZFORCE cricket-ball renderer. This site bundles Three.js locally and
 * mounts the renderer on elements marked with data-zforce-ball.
 *
 * Options:
 *   colors        array of 'red' | 'white' | 'pink' (or custom {leather, thread, logo} objects)
 *   bounceHeight  toss height in ball-radii (default 1.6)
 *   bounceTime    seconds the first toss spends in the air (default 1.05)
 *   restitution   bounce energy kept per impact, 0..0.9 (default 0.55 — hard leather)
 *   restTime      seconds the ball rests before it is tossed again (default 0.9)
 *   squash        squash amount on impact, 0..0.2 (default 0.05 — leather barely deforms)
 *   quality       'high' (2048px textures) | 'low' (1024px) — default picks by device
 *   interactive   click/tap a ball to spin it (default true)
 *   shadow        soft contact shadow (default true)
 *
 * Three.js is bundled with the ZFORCE site.
 */
(function (global) {
  'use strict';

  function loadThree() {
    return Promise.resolve(THREE);
  }

  var PALETTES = {
    red:   { leather: [176, 18, 27],  thread: [240, 236, 226], logo: [240, 204, 112] },
    white: { leather: [242, 238, 228], thread: [192, 184, 166], logo: [226, 186, 92] },
    pink:  { leather: [232, 78, 140], thread: [28, 26, 30],    logo: [244, 210, 120] }
  };

  /* ------------------------------------------------------------------ *
   * Logo (drawn once to a canvas, used as an alpha mask)
   * ------------------------------------------------------------------ */
  function drawLogo(size) {
    var c = document.createElement('canvas');
    c.width = c.height = size;
    var g = c.getContext('2d');
    var s = size / 1024;
    g.scale(s, s);
    var cx = 512, cy = 512;
    g.fillStyle = g.strokeStyle = '#fff';

    // rings
    g.lineWidth = 12; g.beginPath(); g.arc(cx, cy, 490, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 8;  g.beginPath(); g.arc(cx, cy, 405, 0, Math.PI * 2); g.stroke();

    // "PREMIUM BALLS" along the top arc
    var text = 'PREMIUM BALLS', r = 447, track = 6;
    g.font = '700 58px "Montserrat", "Helvetica Neue", Arial, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    var widths = [], total = 0;
    for (var i = 0; i < text.length; i++) { var w = g.measureText(text[i]).width + track; widths.push(w); total += w; }
    var a = -Math.PI / 2 - (total / r) / 2;
    var start = a;
    for (i = 0; i < text.length; i++) {
      var aa = a + (widths[i] / 2) / r;
      g.save();
      g.translate(cx + r * Math.cos(aa), cy + r * Math.sin(aa));
      g.rotate(aa + Math.PI / 2);
      g.fillText(text[i], 0, 0);
      g.restore();
      a += widths[i] / r;
    }
    [start - 0.09, a + 0.09].forEach(function (d) {
      g.beginPath(); g.arc(cx + r * Math.cos(d), cy + r * Math.sin(d), 10, 0, Math.PI * 2); g.fill();
    });

    // "— Est.2015 —"
    g.font = '600 62px "Montserrat", "Helvetica Neue", Arial, sans-serif';
    g.fillText('Est.2015', cx, cy + 300);
    g.lineWidth = 8;
    g.beginPath(); g.moveTo(cx - 270, cy + 300); g.lineTo(cx - 160, cy + 300); g.stroke();
    g.beginPath(); g.moveTo(cx + 160, cy + 300); g.lineTo(cx + 270, cy + 300); g.stroke();

    // Complete, bold "Z" — top bar, diagonal, bottom bar — slanted like "FORCE",
    // standing on the same baseline and a little taller (drop-cap style).
    var BASE = 640, SLANT = 0.2;
    var zx0 = 148, zx1 = 372, zy0 = 352, zy1 = BASE, zt = 60, zd = 86;
    var Z = [
      [zx0, zy0], [zx1, zy0], [zx1, zy0 + zt],            // top bar
      [zx0 + zd, zy1 - zt],                                // diagonal down to bottom bar
      [zx1, zy1 - zt], [zx1, zy1], [zx0, zy1], [zx0, zy1 - zt], // bottom bar
      [zx1 - zd, zy0 + zt],                                // diagonal back up
      [zx0, zy0 + zt]
    ];
    g.beginPath();
    Z.forEach(function (p, k) {
      var X = p[0] + SLANT * (BASE - p[1]), Y = p[1];      // same italic slant as the text
      k ? g.lineTo(X, Y) : g.moveTo(X, Y);
    });
    g.closePath(); g.fill();

    // "FORCE" — bold condensed, same slant, sharing the Z's baseline
    g.save();
    g.font = '400 240px Impact, "Haettenschweiler", "Arial Narrow Bold", "Arial Black", sans-serif';
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    var tw = g.measureText('FORCE').width, target = 470;
    g.setTransform(s * target / tw, 0, -SLANT * s * 0.8, s * 0.8, 396 * s, BASE * s);
    g.fillText('FORCE', 0, 0);
    g.restore();
    return c;
  }

  /* ------------------------------------------------------------------ *
   * Procedural leather / seam / logo masks on an equirect UV map
   * ------------------------------------------------------------------ */
  function hash3(i, j, k) {
    var h = Math.imul(i, 73856093) ^ Math.imul(j, 19349663) ^ Math.imul(k, 83492791);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) & 0xffff) / 65535;
  }
  function noise3(x, y, z) {
    var xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    var xf = x - xi, yf = y - yi, zf = z - zi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
    function L(a, b, t) { return a + (b - a) * t; }
    return L(
      L(L(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), u), L(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), u), v),
      L(L(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), u), L(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), u), v),
      w);
  }

  var maskCache = {};
  function buildMasks(W) {
    if (maskCache[W]) return maskCache[W];
    var H = W / 2, N = W * H;
    var groove = new Float32Array(N), stitch = new Float32Array(N), logo = new Float32Array(N),
        grain = new Float32Array(N), band = new Float32Array(N), hole = new Float32Array(N);

    var LW = 1024, logoCanvas = drawLogo(LW);
    var ld = logoCanvas.getContext('2d').getImageData(0, 0, LW, LW).data;
    function sampleLogo(fx, fy) {
      var x0 = fx | 0, y0 = fy | 0;
      if (x0 < 0 || y0 < 0 || x0 >= LW - 1 || y0 >= LW - 1) return 0;
      var tx = fx - x0, ty = fy - y0, i0 = (y0 * LW + x0) * 4 + 3, i1 = i0 + LW * 4;
      return ((ld[i0] * (1 - tx) + ld[i0 + 4] * tx) * (1 - ty) + (ld[i1] * (1 - tx) + ld[i1 + 4] * tx) * ty) / 255;
    }

    var LOGO_SIZE = 0.76;           // logo half-width as a fraction of the radius
    // Seam geometry (radians on a unit ball). A real ball has a raised seam band
    // with two prominent rows of slanted, rope-like stitches either side of a
    // central groove, roughly 70-80 stitches per row.
    var STITCHES = 74;              // stitches around the ball, per row
    var ROWS = [0.05, 0.104];       // row centres, measured from the seam groove
    var ROW_W = 0.025;              // half-length of a stitch across its row
    var GROOVE_W = 0.013, BAND_W = 0.15;
    var TWO_PI = Math.PI * 2;
    var cosP = new Float32Array(W), sinP = new Float32Array(W);
    for (var px = 0; px < W; px++) { var ph = (px + 0.5) / W * TWO_PI; cosP[px] = Math.cos(ph); sinP[px] = Math.sin(ph); }

    for (var py = 0; py < H; py++) {
      var th = (py + 0.5) / H * Math.PI, sT = Math.sin(th), y = Math.cos(th);
      for (px = 0; px < W; px++) {
        var i = py * W + px;
        var x = -cosP[px] * sT, z = sinP[px] * sT;

        // Main seam lies in the plane x = 0; logo faces +x.
        var d = Math.asin(Math.max(-1, Math.min(1, x))), ad = Math.abs(d);
        var gr = 1 - ad / GROOVE_W;
        groove[i] = gr > 0 ? Math.sqrt(gr) : 0;
        var bw = ad / BAND_W;
        band[i] = bw < 1 ? 1 - bw * bw * bw * bw : 0;

        var t = Math.atan2(y, z), st = 0, hl = 0, side = d >= 0 ? 1 : -1;
        for (var r = 0; r < ROWS.length; r++) {
          var across = (ad - ROWS[r]) / ROW_W;
          if (across > -1.45 && across < 1.45) {
            // stitches lean in opposite directions on each side of the seam
            var ph2 = (t / TWO_PI) * STITCHES + across * 0.42 * side + r * 0.5;
            var c = ph2 - Math.floor(ph2) - 0.5;
            var e = (c / 0.3) * (c / 0.3) + across * across;
            if (e < 1) {
              var twist = 0.86 + 0.14 * Math.sin(across * 10 + c * 34 * side);  // twisted thread
              st = Math.max(st, Math.sqrt(1 - e) * twist);
            }
            // needle holes where the thread enters the leather
            var ae = Math.abs(across) - 1.12, hc = c / 0.2;
            var he = (ae / 0.22) * (ae / 0.22) + hc * hc;
            if (he < 1) hl = Math.max(hl, 1 - he);
          }
        }
        stitch[i] = st;
        hole[i] = st > 0.05 ? 0 : hl;

        // faint quarter seam on the back hemisphere
        if (x < -0.25) {
          var qz = Math.abs(Math.asin(Math.max(-1, Math.min(1, z))));
          if (qz < 0.006) groove[i] = Math.max(groove[i], 0.5 * (1 - qz / 0.006));
        }

        // leather grain
        grain[i] = 0.6 * noise3(x * 42, y * 42, z * 42) + 0.4 * noise3(x * 130 + 7, y * 130, z * 130);

        // gold-foil logo, projected straight onto the +x face
        if (x > 0.25) {
          var fx = (-z / LOGO_SIZE * 0.5 + 0.5) * LW, fy = (0.5 - y / LOGO_SIZE * 0.5) * LW;
          logo[i] = sampleLogo(fx, fy);
        }
      }
    }
    return (maskCache[W] = { W: W, H: H, groove: groove, stitch: stitch, logo: logo, grain: grain, band: band, hole: hole });
  }

  function makeCanvas(W, H) { var c = document.createElement('canvas'); c.width = W; c.height = H; return c; }

  var sharedTexCache = {};
  function sharedMaps(THREE, m) {
    if (sharedTexCache[m.W]) return sharedTexCache[m.W];
    var W = m.W, H = m.H, N = W * H;
    var bumpC = makeCanvas(W, H), ormC = makeCanvas(W, H);
    var bctx = bumpC.getContext('2d'), octx = ormC.getContext('2d');
    var bi = bctx.createImageData(W, H), oi = octx.createImageData(W, H), b = bi.data, o = oi.data;
    for (var i = 0; i < N; i++) {
      var g = m.grain[i], s = m.stitch[i], gr = m.groove[i], l = m.logo[i];
      var h = 0.4 + 0.1 * g + 0.14 * m.band[i] - 0.4 * gr + 0.46 * s - 0.25 * m.hole[i] - 0.04 * l;
      var hv = Math.max(0, Math.min(255, h * 255)) | 0, j = i * 4;
      b[j] = b[j + 1] = b[j + 2] = hv; b[j + 3] = 255;
      var rough = 0.38 + 0.18 * g;
      rough = rough * (1 - l) + 0.34 * l;
      rough = rough + (0.85 - rough) * Math.min(1, s * 1.5);
      rough = rough + (0.7 - rough) * gr;
      o[j] = 255;
      o[j + 1] = (rough * 255) | 0;          // roughness (G)
      o[j + 2] = (l * 0.65 * 255) | 0;    // metalness (B)
      o[j + 3] = 255;
    }
    bctx.putImageData(bi, 0, 0); octx.putImageData(oi, 0, 0);
    var bump = new THREE.CanvasTexture(bumpC), orm = new THREE.CanvasTexture(ormC);
    return (sharedTexCache[m.W] = { bump: bump, orm: orm });
  }

  var colorTexCache = {};
  function colorMap(THREE, m, pal, key) {
    var ck = m.W + ':' + key;
    if (colorTexCache[ck]) return colorTexCache[ck];
    var W = m.W, H = m.H, N = W * H, c = makeCanvas(W, H), ctx = c.getContext('2d');
    var img = ctx.createImageData(W, H), p = img.data;
    var L = pal.leather, T = pal.thread, G = pal.logo;
    for (var i = 0; i < N; i++) {
      var g = m.grain[i], shade = 0.9 + 0.16 * g, dark = (1 - 0.6 * m.groove[i]) * (1 - 0.55 * m.hole[i]);
      var r = L[0] * shade * dark, gg = L[1] * shade * dark, bb = L[2] * shade * dark;
      var s = Math.min(1, m.stitch[i] * 1.7), ts = 0.72 + 0.28 * m.stitch[i];
      r += (T[0] * ts - r) * s; gg += (T[1] * ts - gg) * s; bb += (T[2] * ts - bb) * s;
      var l = m.logo[i], gs = 0.92 + 0.16 * g;
      r += (G[0] * gs - r) * l; gg += (G[1] * gs - gg) * l; bb += (G[2] * gs - bb) * l;
      var j = i * 4;
      p[j] = r > 255 ? 255 : r; p[j + 1] = gg > 255 ? 255 : gg; p[j + 2] = bb > 255 ? 255 : bb; p[j + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    var tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return (colorTexCache[ck] = tex);
  }

  function studioEnvironment(THREE, renderer) {
    var pm = new THREE.PMREMGenerator(renderer), env = new THREE.Scene();
    env.add(new THREE.Mesh(new THREE.BoxGeometry(30, 30, 30),
      new THREE.MeshBasicMaterial({ color: 0x3a3a40, side: THREE.BackSide })));
    function panel(w, h, pos, intensity, tint) {
      var mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
      mat.color.setRGB(tint[0] * intensity, tint[1] * intensity, tint[2] * intensity);
      var mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      mesh.position.set(pos[0], pos[1], pos[2]); mesh.lookAt(0, 0, 0); env.add(mesh);
    }
    panel(10, 10, [0, 12, 2], 5, [1, 1, 1]);
    panel(6, 8, [-10, 4, 8], 3.2, [1, 0.98, 0.95]);
    panel(5, 9, [11, 2, -3], 1.6, [1, 0.9, 0.78]);
    panel(14, 3, [0, -6, 10], 0.8, [1, 1, 1]);
    var tex = pm.fromScene(env, 0.035).texture;
    pm.dispose();
    return tex;
  }

  function shadowTexture(THREE) {
    var c = makeCanvas(256, 256), g = c.getContext('2d');
    var grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grd.addColorStop(0, 'rgba(0,0,0,0.85)');
    grd.addColorStop(0.45, 'rgba(0,0,0,0.35)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  }

  /* ------------------------------------------------------------------ *
   * Mount
   * ------------------------------------------------------------------ */
  function mount(target, opts) {
    var el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) throw new Error('ZforceBall: container not found');
    opts = opts || {};
    var colors = opts.colors || ['red', 'white', 'pink'];
    var bounceH = opts.bounceHeight != null ? opts.bounceHeight : 1.6;
    var T = opts.bounceTime || 1.05;
    var squashAmt = opts.squash != null ? opts.squash : 0.05;      // leather is hard: very little squash
    var restitution = opts.restitution != null ? opts.restitution : 0.55;
    var restTime = opts.restTime != null ? opts.restTime : 0.9;
    var interactive = opts.interactive !== false;
    var useShadow = opts.shadow !== false;
    var reduce = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var quality = opts.quality || ((global.devicePixelRatio || 1) > 1.5 || global.innerWidth < 700 ? 'low' : 'high');
    var texW = quality === 'low' ? 1024 : 2048;

    var state = { destroyed: false, running: true };
    var balls = [];
    var selectBall = function () {};
    var api = {
      pause: function () { state.running = false; },
      play: function () { state.running = true; },
      select: function (index) { selectBall(index); },
      destroy: function () { state.destroyed = true; if (state.cleanup) state.cleanup(); }
    };

    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';

    api.ready = loadThree().then(function (THREE) {
      if (state.destroyed) return;
      var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;
      renderer.setClearColor(0x000000, 0);
      var canvas = renderer.domElement;
      canvas.style.cssText = 'display:block;width:100%;height:100%;outline:none;touch-action:manipulation;';
      canvas.setAttribute('aria-label', 'Animated ZFORCE cricket balls');
      canvas.setAttribute('role', 'img');
      el.appendChild(canvas);

      var scene = new THREE.Scene();
      scene.environment = studioEnvironment(THREE, renderer);
      var key = new THREE.DirectionalLight(0xffffff, 1.4);
      key.position.set(-3, 6, 5);
      scene.add(key);
      scene.add(new THREE.AmbientLight(0xffffff, 0.15));

      var camera = new THREE.PerspectiveCamera(28, 1, 0.1, 200);
      var masks = buildMasks(texW);
      var shared = sharedMaps(THREE, masks);
      var aniso = renderer.capabilities.getMaxAnisotropy();
      shared.bump.anisotropy = shared.orm.anisotropy = aniso;
      var geo = new THREE.SphereGeometry(1, 128, 96);
      var shTex = useShadow ? shadowTexture(THREE) : null;

      var spacing = 2.75, n = colors.length;
      var g = 8 * bounceH / (T * T), v0 = g * T / 2;
      balls = colors.map(function (c, idx) {
        var pal = typeof c === 'string' ? (PALETTES[c] || PALETTES.red) : c;
        var keyName = typeof c === 'string' ? c : JSON.stringify(c);
        var map = colorMap(THREE, masks, pal, keyName);
        map.anisotropy = aniso;
        var mat = new THREE.MeshPhysicalMaterial({
          map: map, bumpMap: shared.bump, bumpScale: 2.2,
          roughnessMap: shared.orm, metalnessMap: shared.orm,
          roughness: 1, metalness: 1,
          clearcoat: 0.55, clearcoatRoughness: 0.22,
          envMapIntensity: 1.0
        });
        var root = new THREE.Group();          // world-aligned: position + squash
        var spin = new THREE.Group();          // rotation
        var mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.y = -Math.PI / 2;        // logo (+x) faces the camera (+z)
        spin.add(mesh); root.add(spin);
        root.position.x = (idx - (n - 1) / 2) * spacing;
        scene.add(root);
        var shadow = null;
        if (shTex) {
          shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6),
            new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false, toneMapped: false }));
          shadow.rotation.x = -Math.PI / 2;
          shadow.position.set(root.position.x, 0.002, 0);
          scene.add(shadow);
        }
        mesh.userData.ball = idx;
        return { root: root, spin: spin, mesh: mesh, shadow: shadow,
                 y: 1, vy: 0, mode: 'rest', restT: restTime - 0.35 - idx * 0.55,   // staggered first tosses
                 flipT: -1, sq: -1, sqAmp: 0, wx: 0, wvx: 0, wz: 0, wvz: 0,
                 spinAngle: 0, spinVel: 0, tilt: idx * 1.7 };
      });

      function resize() {
        var w = el.clientWidth || 300, h = el.clientHeight || 300;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        var needW = (n - 1) * spacing + 2.8, needH = (reduce ? 2 : bounceH + 2) + 0.8;
        var vf = THREE.MathUtils.degToRad(camera.fov), hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
        var dist = Math.max(needW / (2 * Math.tan(hf / 2)), needH / (2 * Math.tan(vf / 2))) + 1.2;
        var cy = needH / 2 - 0.35;
        camera.position.set(0, cy + dist * 0.16, dist);
        camera.lookAt(0, cy, 0);
        camera.updateProjectionMatrix();
      }
      var ro = new ResizeObserver(resize); ro.observe(el); resize();

      var visible = true;
      var io = new IntersectionObserver(function (e) { visible = e[0].isIntersecting; }, { threshold: 0 });
      io.observe(el);

      var ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
      function onClick(ev) {
        var r = canvas.getBoundingClientRect();
        ptr.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
        ray.setFromCamera(ptr, camera);
        var hit = ray.intersectObjects(balls.map(function (b) { return b.mesh; }))[0];
        if (!hit) return;
        var b = balls[hit.object.userData.ball];
        if (b.mode === 'rest') toss(b); else b.spinVel += 12;
      }
      function onMove(ev) {
        var r = canvas.getBoundingClientRect();
        ptr.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
        ray.setFromCamera(ptr, camera);
        canvas.style.cursor = ray.intersectObjects(balls.map(function (b) { return b.mesh; })).length ? 'pointer' : 'default';
      }
      if (interactive) { canvas.addEventListener('click', onClick); canvas.addEventListener('pointermove', onMove); }

      /* Hard leather ball physics:
       *  toss → one seam-over-seam flip in the air → lands logo-forward →
       *  each bounce loses ~45% speed (restitution) → tiny squash + rattle on
       *  every impact → settles → short rest → tossed again. */
      function toss(b) {
        b.mode = 'air'; b.vy = v0; b.flipT = 0; b.restT = 0;
      }
      selectBall = function (index) {
        var ball = balls[index];
        if (!ball) return;
        if (ball.mode === 'rest') toss(ball);
        else ball.spinVel += 12;
      };
      function stepBall(b, h) {
        if (b.mode === 'air') {
          b.vy -= g * h;
          b.y += b.vy * h;
          if (b.y <= 1 && b.vy < 0) {
            b.y = 1;
            var impact = -b.vy, strength = Math.min(1, impact / v0);
            b.sq = 0; b.sqAmp = squashAmt * strength;
            b.wvx += (Math.random() - 0.5) * impact * 0.5;
            b.wvz += (Math.random() - 0.5) * impact * 0.45;
            if (impact < 0.11 * v0) { b.mode = 'rest'; b.vy = 0; b.restT = 0; }
            else b.vy = impact * restitution;
          }
        } else if (!reduce) {
          b.restT += h;
          if (b.restT >= restTime) toss(b);
        }
        // rattle: damped spring back to logo-forward
        b.wvx += (-70 * b.wx - 7 * b.wvx) * h; b.wx += b.wvx * h;
        b.wvz += (-70 * b.wz - 7 * b.wvz) * h; b.wz += b.wvz * h;
      }

      var clock = new THREE.Clock(), time = 0, raf = 0, SQ_DUR = 0.045;
      function frame() {
        raf = requestAnimationFrame(frame);
        var dt = Math.min(clock.getDelta(), 0.05);
        if (!state.running || !visible) return;
        time += dt;
        balls.forEach(function (b) {
          for (var k = 0; k < 4; k++) stepBall(b, dt / 4);

          var sy = 1, sxz = 1;
          if (b.sq >= 0) {
            b.sq += dt;
            var p = Math.sin(Math.PI * Math.min(1, b.sq / SQ_DUR));
            sy = 1 - b.sqAmp * p; sxz = 1 + b.sqAmp * 0.5 * p;
            if (b.sq >= SQ_DUR) b.sq = -1;
          }
          var flip = 0;
          if (b.flipT >= 0) {
            b.flipT += dt;
            var fp = Math.min(1, b.flipT / T);
            flip = -Math.PI * 2 * fp;                 // one full backspin rotation per toss
            if (fp >= 1) b.flipT = -1;
          }

          b.root.position.y = b.y - (1 - sy);       // keep the bottom on the floor while compressed
          b.root.scale.set(sxz, sy, sxz);
          b.spinVel *= Math.exp(-1.6 * dt);
          b.spinAngle += b.spinVel * dt;
          b.spin.rotation.set(
            flip + b.wx + Math.sin(time * 0.6 + b.tilt) * 0.08,
            Math.sin(time * 0.45 + b.tilt) * 0.35 + b.spinAngle,
            b.wz + Math.sin(time * 0.5 + b.tilt) * 0.06);
          if (b.shadow) {
            var hgt = Math.max(0, b.y - 1), kk = 1 - hgt / (bounceH + 0.6);
            b.shadow.material.opacity = 0.18 + 0.55 * kk;
            var sc = 0.72 + 0.6 * (1 - kk);
            b.shadow.scale.set(sc * sxz, sc * sxz, 1);
          }
        });
        renderer.render(scene, camera);
      }
      frame();

      state.cleanup = function () {
        cancelAnimationFrame(raf); ro.disconnect(); io.disconnect();
        canvas.removeEventListener('click', onClick); canvas.removeEventListener('pointermove', onMove);
        scene.traverse(function (o) {
          if (o.isMesh) { o.material.dispose(); if (o.geometry !== geo) o.geometry.dispose(); }
        });
        geo.dispose(); if (shTex) shTex.dispose();
        renderer.dispose(); canvas.remove();
      };
    });
    return api;
  }

  function autoMount() {
    var nodes = document.querySelectorAll('[data-zforce-ball]');
    for (var i = 0; i < nodes.length; i++) {
      var nd = nodes[i];
      if (nd.__zforce) continue;
      var ds = nd.dataset, o = {};
      if (ds.colors) o.colors = ds.colors.split(',').map(function (s) { return s.trim(); });
      if (ds.bounceHeight) o.bounceHeight = parseFloat(ds.bounceHeight);
      if (ds.bounceTime) o.bounceTime = parseFloat(ds.bounceTime);
      if (ds.squash) o.squash = parseFloat(ds.squash);
      if (ds.restitution) o.restitution = parseFloat(ds.restitution);
      if (ds.restTime) o.restTime = parseFloat(ds.restTime);
      if (ds.quality) o.quality = ds.quality;
      nd.__zforce = mount(nd, o);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoMount);
  else autoMount();

  global.ZforceBall = { mount: mount, palettes: PALETTES, autoMount: autoMount, drawLogo: drawLogo };
})(window);
