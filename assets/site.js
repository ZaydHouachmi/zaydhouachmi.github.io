(function () {
  var root = document.documentElement;
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function isDark() {
    var t = root.getAttribute('data-theme');
    return t ? t === 'dark' : !!(mq && mq.matches);
  }
  function syncToggles() {
    var dark = isDark();
    document.querySelectorAll('.theme-toggle').forEach(function (b) {
      b.textContent = dark ? 'Vellum' : 'Blueprint';
      b.setAttribute('aria-pressed', String(dark));
      b.title = dark ? 'Switch to light theme' : 'Switch to dark theme';
    });
    document.dispatchEvent(new CustomEvent('themechange'));
  }
  document.querySelectorAll('.theme-toggle').forEach(function (b) {
    b.addEventListener('click', function () {
      var next = isDark() ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('zh-theme', next); } catch (e) {}
      syncToggles();
    });
  });
  if (mq && mq.addEventListener) mq.addEventListener('change', syncToggles);
  syncToggles();

  document.querySelectorAll('[data-wake]').forEach(initWake);

  document.querySelectorAll('[data-copy]').forEach(function (b) {
    b.addEventListener('click', function () {
      var text = b.getAttribute('data-copy');
      function done(msg) { b.textContent = msg; setTimeout(function () { b.textContent = 'Copy'; }, 1800); }
      function fallback() {
        var el = document.getElementById('email');
        if (el && window.getSelection) {
          var r = document.createRange(); r.selectNodeContents(el);
          var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
        }
        done('Selected');
      }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { done('Copied'); }, fallback);
      else fallback();
    });
  });

  // Looping CAD clips: respect reduced motion, and only play while on screen.
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var clips = document.querySelectorAll('.cad-motion video');
  clips.forEach(function (v) {
    if (reduceMotion) { v.removeAttribute('autoplay'); v.pause(); v.controls = true; }
  });
  if (!reduceMotion && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { var p = e.target.play(); if (p && p.catch) p.catch(function () {}); }
        else e.target.pause();
      });
    }, { threshold: 0.15 });
    clips.forEach(function (v) { io.observe(v); });
  }

  // Jensen (Park) wake model with root-sum-square superposition.
  function initWake(el) {
    var D = 54, R = D / 2, CT = 0.8, PR = 1000, VIN = 3, VR = 12, VOUT = 25;
    var A0 = 1 - Math.sqrt(1 - CT);
    var canvas = el.querySelector('canvas');
    var ctx = canvas.getContext('2d');
    var inputs = {
      dir: el.querySelector('[name="dir"]'),
      ws: el.querySelector('[name="ws"]'),
      sp: el.querySelector('[name="sp"]'),
      k: el.querySelector('[name="k"]')
    };
    var outs = {
      dir: el.querySelector('[data-out="dir"]'),
      ws: el.querySelector('[data-out="ws"]'),
      sp: el.querySelector('[data-out="sp"]'),
      k: el.querySelector('[data-out="k"]'),
      mw: el.querySelector('[data-out="mw"]'),
      loss: el.querySelector('[data-out="loss"]'),
      bars: el.querySelector('[data-out="bars"]')
    };
    var spinBtn = el.querySelector('[data-act="spin"]');
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var colors = {};
    var off = document.createElement('canvas');
    var offCtx = off.getContext('2d');
    var spinning = false, raf = 0, last = 0;

    function rgb(c) {
      var t = document.createElement('canvas'); t.width = t.height = 1;
      var x = t.getContext('2d'); x.fillStyle = '#000'; x.fillStyle = c; x.fillRect(0, 0, 1, 1);
      var d = x.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2]];
    }
    function readColors() {
      var cs = getComputedStyle(root);
      ['--surface', '--accent', '--fg', '--muted', '--rule', '--grid', '--bg'].forEach(function (n) {
        colors[n] = cs.getPropertyValue(n).trim();
      });
      colors.surfRGB = rgb(colors['--surface']);
      colors.accRGB = rgb(colors['--accent']);
    }
    function power(v) {
      if (v < VIN || v >= VOUT) return 0;
      if (v >= VR) return PR;
      return PR * (Math.pow(v, 3) - Math.pow(VIN, 3)) / (Math.pow(VR, 3) - Math.pow(VIN, 3));
    }
    function layout(s) {
      var t = [];
      for (var r = 0; r < 2; r++) for (var c = 0; c < 3; c++) t.push({ x: c * s, y: r * s, id: 'T0' + (r * 3 + c + 1) });
      return t;
    }
    function deficitAt(px, py, turbines, ux, uy, k, skip) {
      var sum = 0;
      for (var i = 0; i < turbines.length; i++) {
        if (i === skip) continue;
        var dx = px - turbines[i].x, dy = py - turbines[i].y;
        var x = dx * ux + dy * uy;
        if (x <= 0) continue;
        var cx = dx - x * ux, cy = dy - x * uy;
        var rw = R + k * x;
        if (cx * cx + cy * cy > rw * rw) continue;
        var d = A0 * Math.pow(R / rw, 2);
        sum += d * d;
      }
      return Math.sqrt(sum);
    }
    function compass(d) {
      return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(d / 45) % 8];
    }

    function draw() {
      var dir = +inputs.dir.value, ws = +inputs.ws.value, sp = +inputs.sp.value, k = +inputs.k.value;
      outs.dir.textContent = dir + '° ' + compass(dir);
      outs.ws.textContent = ws.toFixed(1) + ' m/s';
      outs.sp.textContent = sp.toFixed(1) + ' D · ' + Math.round(sp * D) + ' m';
      outs.k.textContent = k.toFixed(3);

      var s = sp * D;
      var th = dir * Math.PI / 180;
      var ux = -Math.sin(th), uy = -Math.cos(th);
      var T = layout(s);
      var cx0 = s, cy0 = s / 2;
      T.forEach(function (t) { t.x -= cx0; t.y -= cy0; });

      var W = canvas.clientWidth || 600;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var H = Math.round(W * 0.625);
      if (canvas.width !== Math.round(W * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      var halfW = 2.2 * s + 7 * D, halfH = halfW * 0.625;
      var scale = W / (2 * halfW);
      function sx(x) { return W / 2 + x * scale; }
      function sy(y) { return H / 2 - y * scale; }

      var gw = Math.min(480, Math.round(W / 1.6)), gh = Math.round(gw * 0.625);
      off.width = gw; off.height = gh;
      var img = offCtx.createImageData(gw, gh);
      var S = colors.surfRGB, Ac = colors.accRGB;
      for (var j = 0; j < gh; j++) {
        var py = halfH - (j + .5) / gh * 2 * halfH;
        for (var i = 0; i < gw; i++) {
          var px = -halfW + (i + .5) / gw * 2 * halfW;
          var d = deficitAt(px, py, T, ux, uy, k, -1);
          var a = Math.min(1, Math.pow(d / 0.45, 0.75));
          var p = (j * gw + i) * 4;
          img.data[p] = S[0] + (Ac[0] - S[0]) * a;
          img.data[p + 1] = S[1] + (Ac[1] - S[1]) * a;
          img.data[p + 2] = S[2] + (Ac[2] - S[2]) * a;
          img.data[p + 3] = 255;
        }
      }
      offCtx.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(off, 0, 0, W, H);

      ctx.strokeStyle = colors['--grid']; ctx.lineWidth = 1;
      var step = 100 * scale;
      ctx.beginPath();
      for (var gx = W / 2 % step; gx < W; gx += step) { ctx.moveTo(gx + .5, 0); ctx.lineTo(gx + .5, H); }
      for (var gy = H / 2 % step; gy < H; gy += step) { ctx.moveTo(0, gy + .5); ctx.lineTo(W, gy + .5); }
      ctx.stroke();

      var results = T.map(function (t, idx) {
        var d = deficitAt(t.x, t.y, T, ux, uy, k, idx);
        var v = ws * (1 - d);
        return { id: t.id, v: v, p: power(v) };
      });

      ctx.font = '500 11px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      T.forEach(function (t, idx) {
        var x = sx(t.x), y = sy(t.y);
        var half = Math.max(R * scale, 7);
        var nx = -uy, ny = ux;
        ctx.strokeStyle = colors['--fg']; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x - nx * half, y + ny * half);
        ctx.lineTo(x + nx * half, y - ny * half);
        ctx.stroke();
        ctx.fillStyle = colors['--fg'];
        ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillText(t.id, x, y - half - 7 > 10 ? y - half - 7 : y + half + 14);
        var r = results[idx].v / ws;
        ctx.fillStyle = r < 0.9 ? colors['--accent'] : colors['--muted'];
        ctx.fillText(results[idx].v.toFixed(1), x, y + half + 16 < H - 4 ? y + half + 16 : y - half - 20);
      });

      var ax = 26, ay = 26, L = 15;
      ctx.save();
      ctx.translate(ax, ay);
      ctx.strokeStyle = colors['--fg']; ctx.fillStyle = colors['--fg']; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.globalAlpha = .25; ctx.stroke(); ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.moveTo(-ux * L, uy * L); ctx.lineTo(ux * L, -uy * L); ctx.stroke();
      var hx = ux * L, hy = -uy * L, ang = Math.atan2(hy, hx);
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(hx - 7 * Math.cos(ang - .45), hy - 7 * Math.sin(ang - .45));
      ctx.lineTo(hx - 7 * Math.cos(ang + .45), hy - 7 * Math.sin(ang + .45));
      ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.textAlign = 'left';
      ctx.fillStyle = colors['--muted'];
      ctx.fillText('wind', ax + 26, ay + 4);
      ctx.textAlign = 'right';
      ctx.fillText('N ↑   grid 100 m', W - 12, H - 12);

      var free = power(ws) * T.length;
      var tot = results.reduce(function (a, r) { return a + r.p; }, 0);
      var loss = free > 0 ? (1 - tot / free) * 100 : 0;
      outs.mw.textContent = (tot / 1000).toFixed(2) + ' MW';
      outs.loss.textContent = loss.toFixed(1) + ' %';
      outs.loss.classList.toggle('bad', loss > 10);

      var html = '';
      results.forEach(function (r) {
        var pct = ws > 0 ? r.v / ws * 100 : 0;
        html += '<div class="tbar"><span>' + r.id + '</span><span class="track"><span class="fill' + (pct < 90 ? ' low' : '') +
          '" style="width:' + pct.toFixed(1) + '%"></span></span><span class="val">' + r.v.toFixed(1) + ' m/s</span></div>';
      });
      outs.bars.innerHTML = html;
      canvas.setAttribute('aria-label', 'Wake map for wind from ' + dir + ' degrees at ' + ws.toFixed(1) +
        ' metres per second. Farm output ' + (tot / 1000).toFixed(2) + ' megawatts, wake loss ' + loss.toFixed(1) + ' percent.');
    }

    function tick(t) {
      if (!spinning) return;
      if (t - last > 50) {
        inputs.dir.value = (+inputs.dir.value + 1) % 360;
        draw(); last = t;
      }
      raf = requestAnimationFrame(tick);
    }
    function setSpin(on) {
      spinning = on;
      spinBtn.textContent = on ? 'Stop rotating' : 'Rotate the wind';
      spinBtn.setAttribute('aria-pressed', String(on));
      if (on) raf = requestAnimationFrame(tick); else cancelAnimationFrame(raf);
    }

    Object.keys(inputs).forEach(function (n) {
      inputs[n].addEventListener('input', function () { if (n === 'dir' && spinning) setSpin(false); draw(); });
    });
    el.querySelectorAll('[data-preset]').forEach(function (b) {
      b.addEventListener('click', function () {
        setSpin(false);
        inputs.dir.value = b.getAttribute('data-preset');
        draw();
      });
    });
    if (spinBtn) {
      if (reduce) spinBtn.hidden = true;
      spinBtn.addEventListener('click', function () { setSpin(!spinning); });
    }
    document.addEventListener('themechange', function () { readColors(); draw(); });
    if (window.ResizeObserver) new ResizeObserver(function () { draw(); }).observe(canvas);
    else window.addEventListener('resize', draw);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
    readColors();
    draw();
  }
})();
