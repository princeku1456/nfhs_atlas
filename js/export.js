/* =====================================================================
   Map export: PNG and PDF
   ---------------------------------------------------------------------
   Draws the map exactly as it is coloured right now (class colours,
   highlighted / compared districts, screening, legend isolation) onto a
   canvas, together with a title, legend, key figures, scale bar and a
   source line. Output is an A4-landscape sheet.

   No extra libraries: polygons are drawn straight from `geo`, and the
   PDF is written by hand around a JPEG snapshot of the canvas.

   Depends on globals defined in app.js:
   geo, names, HOME, map, LY, S, SCR, V, P, fmtC, isAdd, rankOf,
   styleFor, dcol, catOf, $
   Public API: window.AtlasExport = { open, close, render, savePNG, savePDF }
   ===================================================================== */
(function () {
  'use strict';

  var PW = 1400, PH = 990;              // logical page size (A4 landscape ratio)
  var SCALE = 2;                        // pixel density of the output (2800 x 1980)
  var FONT = "'Plus Jakarta Sans',system-ui,-apple-system,'Segoe UI',sans-serif";
  var INK = '#0f2a43', MUTED = '#5c6f7d', LINE = '#dbe3ea', GREEN = '#165d78', AMBER = '#e8873a';

  // layout (logical px)
  var M = 40;                                                  // page margin
  var MAP = { x: M, y: 160, w: 970, h: 766 };                  // map panel
  var LEG = { x: MAP.x + MAP.w + 20, y: 160, w: PW - M - (MAP.x + MAP.w + 20), h: 766 }; // legend panel

  var opt = { ext: 'state', lab: 0, fmt: 'png' };              // dialog choices
  var canvas = null, token = 0;

  /* ------------------------------------------------------------ helpers */
  function font(weight, size) { return weight + ' ' + size + 'px ' + FONT; }

  function rrect(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function text(c, str, x, y, f, color, align) {
    c.font = f; c.fillStyle = color; c.textAlign = align || 'left'; c.textBaseline = 'alphabetic';
    c.fillText(str, x, y);
  }

  // shrink the font until the string fits, then ellipsise as a last resort
  function fitted(c, str, maxW, weight, size, minSize) {
    var s = size;
    c.font = font(weight, s);
    while (c.measureText(str).width > maxW && s > minSize) { s -= 1; c.font = font(weight, s); }
    if (c.measureText(str).width > maxW) {
      while (str.length > 1 && c.measureText(str + '…').width > maxW) str = str.slice(0, -1);
      str += '…';
    }
    return { str: str, size: s };
  }

  // greedy word-wrap, returns an array of lines
  function wrap(c, str, maxW, f) {
    c.font = f;
    var words = str.split(' '), lines = [], line = '';
    words.forEach(function (w) {
      var t = line ? line + ' ' + w : w;
      if (c.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
    });
    if (line) lines.push(line);
    return lines;
  }

  function pill(c, str, x, y, h, bg, fg, size) {
    c.font = font(700, size);
    var w = c.measureText(str).width + 22;
    rrect(c, x, y, w, h, h / 2); c.fillStyle = bg; c.fill();
    text(c, str, x + 11, y + h / 2 + size * 0.36, font(700, size), fg);
    return w;
  }

  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'map'; }

  function today() {
    return new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  /* --------------------------------------------------------- projection */
  // Web-Mercator, so the export matches the on-screen map shape.
  function mer(lng, lat) {
    var r = Math.PI / 180;
    return [lng * r, Math.log(Math.tan(Math.PI / 4 + lat * r / 2))];
  }

  function projector(b, rect) {
    var a = mer(b.west, b.south), z = mer(b.east, b.north);
    var dx = z[0] - a[0], dy = z[1] - a[1];
    var k = Math.min(rect.w / dx, rect.h / dy);
    var ox = rect.x + (rect.w - dx * k) / 2, oy = rect.y + (rect.h - dy * k) / 2;
    var midLat = (b.south + b.north) / 2;
    return {
      pt: function (lng, lat) { var m = mer(lng, lat); return [ox + (m[0] - a[0]) * k, oy + (z[1] - m[1]) * k]; },
      k: k,
      // pixels per kilometre at the centre latitude
      pxPerKm: k * (Math.PI / 180) / (111.32 * Math.cos(midLat * Math.PI / 180))
    };
  }

  function boundsFor(ext) {
    if (ext === 'view') {
      var b = map.getBounds();
      return { west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() };
    }
    return { west: HOME.getWest(), south: HOME.getSouth(), east: HOME.getEast(), north: HOME.getNorth() };
  }

  /* ------------------------------------------------------------ map art */
  function polygonsOf(feature) {
    var g = feature.geometry;
    return g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  }

  function drawDistricts(c, pr) {
    var feats = geo.features.slice().sort(function (a, b) {
      // same stacking as the live map: plain, compared, selected on top
      function rank(n) { return n === S.sel ? 2 : S.cm.indexOf(n) >= 0 ? 1 : 0; }
      return rank(a.properties.district_clean) - rank(b.properties.district_clean);
    });
    c.lineJoin = 'round';
    feats.forEach(function (f) {
      var n = f.properties.district_clean, st = styleFor(n);
      c.beginPath();
      polygonsOf(f).forEach(function (poly) {
        poly.forEach(function (ring) {
          ring.forEach(function (p, i) {
            var q = pr.pt(p[0], p[1]);
            if (i) c.lineTo(q[0], q[1]); else c.moveTo(q[0], q[1]);
          });
          c.closePath();
        });
      });
      c.globalAlpha = st.fillOpacity; c.fillStyle = st.fillColor; c.fill('evenodd');
      c.globalAlpha = st.opacity;
      c.strokeStyle = st.color; c.lineWidth = Math.max(0.6, st.weight * 0.85);
      c.setLineDash(st.dashArray ? String(st.dashArray).split(/[ ,]+/).map(Number) : []);
      c.stroke();
    });
    c.setLineDash([]); c.globalAlpha = 1;
  }

  function drawLabels(c, pr, mode, zoomed) {
    if (mode === 2) return;
    var fs = zoomed ? 12.5 : 10.5, placed = [];
    var order = names.slice().sort(function (a, b) { return a.localeCompare(b); });
    var nudge = [[0, 0], [0, -13], [0, 13], [-26, 0], [26, 0], [0, -26], [0, 26]];
    order.forEach(function (n) {
      var ctr = LY[n].getBounds().getCenter(), p = pr.pt(ctr.lng, ctr.lat);
      var val = mode === 1 ? fmtC(V(n)) : null;
      c.font = font(700, fs);
      var w = Math.max(c.measureText(n).width, val ? (c.font = font(800, fs + 0.5), c.measureText(val).width) : 0);
      var h = val ? fs * 2.3 : fs * 1.25, spot = nudge[0];
      for (var i = 0; i < nudge.length; i++) {
        var r = { x: p[0] + nudge[i][0] - w / 2 - 2, y: p[1] + nudge[i][1] - h / 2 - 1, w: w + 4, h: h + 2 };
        var hit = placed.some(function (q) { return r.x < q.x + q.w && r.x + r.w > q.x && r.y < q.y + q.h && r.y + r.h > q.y; });
        if (!hit) { spot = nudge[i]; placed.push(r); break; }
        if (i === nudge.length - 1) placed.push(r);
      }
      var cx = p[0] + spot[0], cy = p[1] + spot[1] + (val ? -fs * 0.15 : fs * 0.36);
      c.lineJoin = 'round'; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
      c.font = font(700, fs); c.lineWidth = 3.4; c.strokeStyle = 'rgba(255,255,255,.95)'; c.strokeText(n, cx, cy);
      c.fillStyle = INK; c.fillText(n, cx, cy);
      if (val) {
        c.font = font(800, fs + 0.5); c.strokeText(val, cx, cy + fs * 1.1);
        c.fillStyle = '#0b5a73'; c.fillText(val, cx, cy + fs * 1.1);
      }
    });
  }

  function backing(c, x, y, w, h) {
    rrect(c, x, y, w, h, 8); c.fillStyle = 'rgba(255,255,255,.82)'; c.fill();
  }

  function drawNorthArrow(c, x, y) {
    backing(c, x - 20, y - 8, 40, 66);
    c.fillStyle = INK;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + 9, y + 26); c.lineTo(x, y + 20); c.lineTo(x - 9, y + 26); c.closePath(); c.fill();
    text(c, 'N', x, y + 44, font(800, 13), INK, 'center');
  }

  function drawScaleBar(c, pr, x, y) {
    var opts = [5, 10, 20, 25, 50, 100, 200, 250, 500], km = opts[0];
    opts.forEach(function (o) { if (o * pr.pxPerKm <= 170) km = o; });
    var w = km * pr.pxPerKm, h = 7;
    backing(c, x - 16, y - 26, w + 32, 46);
    c.fillStyle = INK; c.fillRect(x, y, w / 2, h);
    c.fillStyle = '#fff'; c.fillRect(x + w / 2, y, w / 2, h);
    c.strokeStyle = INK; c.lineWidth = 1.2; c.strokeRect(x, y, w, h);
    text(c, '0', x, y - 5, font(700, 11), INK, 'center');
    text(c, km + ' km', x + w, y - 5, font(700, 11), INK, 'center');
  }

  /* ------------------------------------------------------- legend panel */
  // Reads the live #legend so the export always matches the on-screen legend.
  function legendRows() {
    var out = [];
    document.querySelectorAll('#legend .lg').forEach(function (el, i) {
      var sw = el.querySelector('i'), b = el.querySelector('b'), cnt = b ? b.textContent : '';
      var all = el.textContent, label = all.slice(0, all.length - cnt.length).trim();
      out.push({
        color: sw ? (sw.style.backgroundColor || sw.style.background) : '#ccc',
        label: label, count: cnt,
        nodata: !el.hasAttribute('data-i'),
        index: el.hasAttribute('data-i') ? +el.getAttribute('data-i') : -1
      });
    });
    return out;
  }

  function median(a) {
    var s = a.slice().sort(function (x, y) { return x - y; }), n = s.length;
    return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
  }

  function hr(c, x, y, w) { c.strokeStyle = LINE; c.lineWidth = 1; c.beginPath(); c.moveTo(x, y); c.lineTo(x + w, y); c.stroke(); }

  function drawLegend(c) {
    var p = P(S.ind), px = LEG.x + 22, pw = LEG.w - 44, y = LEG.y + 34;
    rrect(c, LEG.x, LEG.y, LEG.w, LEG.h, 18); c.fillStyle = '#fff'; c.fill();
    c.strokeStyle = LINE; c.lineWidth = 1; c.stroke();

    // --- legend classes
    text(c, 'LEGEND', px, y, font(800, 12), MUTED);
    if (p.unit) text(c, p.unit, LEG.x + LEG.w - 22, y, font(700, 12), GREEN, 'right');
    y += 14;
    text(c, 'Districts', LEG.x + LEG.w - 22, y + 6, font(600, 11), MUTED, 'right');
    y += 12;
    legendRows().forEach(function (r) {
      var dim = !r.nodata && S.cls !== null && S.cls !== r.index;
      c.globalAlpha = dim ? 0.3 : 1;
      rrect(c, px, y, 38, 20, 5); c.fillStyle = r.color; c.fill();
      c.strokeStyle = 'rgba(12,29,24,.28)'; c.lineWidth = 1; c.stroke();
      var f = fitted(c, r.label, pw - 38 - 14 - 40, 600, 15, 11);
      text(c, f.str, px + 50, y + 15, font(600, f.size), INK);
      text(c, r.count, px + pw, y + 15, font(800, 15), INK, 'right');
      c.globalAlpha = 1;
      y += 30;
    });
    y += 2;
    var note = wrap(c, 'Classes are quantile-based: each holds roughly the same number of districts.', pw, font(500, 11));
    note.forEach(function (l) { text(c, l, px, y + 10, font(500, 11), MUTED); y += 15; });

    // --- key figures
    y += 12; hr(c, px, y, pw); y += 26;
    text(c, 'KEY FIGURES', px, y, font(800, 12), MUTED); y += 10;
    var vs = S.vs || [], hi = null, lo = null;
    names.forEach(function (n) {
      var v = V(n); if (v === null) return;
      if (!hi || v > hi.v) hi = { n: n, v: v };
      if (!lo || v < lo.v) lo = { n: n, v: v };
    });
    var add = isAdd(S.ind), rows = vs.length ? [
      [add ? 'State total' : 'State average', add ? S.mean * vs.length : S.mean, ''],
      [add ? 'District average' : 'Median', add ? S.mean : median(vs), ''],
      ['Highest', hi && hi.v, hi && hi.n],
      ['Lowest', lo && lo.v, lo && lo.n]
    ] : [];
    rows.forEach(function (r) {
      y += 30;
      text(c, r[0], px, y, font(600, 13), MUTED);
      text(c, fmtC(r[1]), px + pw, y, font(800, 17), INK, 'right');
      if (r[2]) { y += 16; text(c, r[2], px + pw, y, font(600, 11.5), GREEN, 'right'); }
    });
    if (!rows.length) { y += 28; text(c, 'No data for this indicator', px, y, font(600, 13), MUTED); }

    // --- what is highlighted on this particular map
    var extra = [];
    if (S.sel) {
      var rk = rankOf(S.sel), v = V(S.sel);
      extra.push({ sw: AMBER, ring: true, head: 'Selected: ' + S.sel, sub: v === null ? 'No data' : fmtC(v) + (rk ? '  ·  rank ' + rk + ' of ' + S.vs.length : '') });
    }
    if (S.cm && S.cm.length) extra.push({ head: 'Compared (dashed outline)', chips: S.cm.slice() });
    if (typeof SCR !== 'undefined' && SCR) extra.push({ head: 'Screening applied', sub: SCR.length + ' of ' + names.length + ' districts match; others dimmed' });
    if (S.cls !== null) {
      var iso = legendRows().filter(function (r) { return r.index === S.cls; })[0];
      extra.push({ head: 'Class isolated' + (iso ? ': ' + iso.label : ''), sub: 'Other classes are dimmed' });
    }
    if (extra.length) {
      y += 18; hr(c, px, y, pw); y += 26;
      text(c, 'ON THIS MAP', px, y, font(800, 12), MUTED); y += 8;
      extra.forEach(function (e) {
        y += 22;
        if (e.sw) {
          c.beginPath(); c.arc(px + 6, y - 5, 6, 0, 6.2832);
          c.fillStyle = e.ring ? '#fff' : e.sw; c.fill();
          c.strokeStyle = e.sw; c.lineWidth = 2.2; if (e.dash) c.setLineDash([3, 2]); c.stroke(); c.setLineDash([]);
        }
        var tx = px + (e.sw ? 20 : 0), tw = pw - (e.sw ? 20 : 0), f = fitted(c, e.head, tw, 700, 13, 10.5);
        text(c, f.str, tx, y, font(700, f.size), INK);
        if (e.chips) {
          var cx = tx, cf = font(500, 12);
          c.font = cf; y += 18;
          e.chips.forEach(function (n) {
            var nw = c.measureText(n).width + 24;
            if (cx + nw > tx + tw && cx > tx) { cx = tx; y += 18; }
            c.beginPath(); c.arc(cx + 5, y - 4, 4.5, 0, 6.2832); c.fillStyle = dcol(n); c.fill();
            c.strokeStyle = 'rgba(12,29,24,.4)'; c.lineWidth = 0.9; c.stroke();
            text(c, n, cx + 14, y, cf, MUTED);
            cx += nw;
          });
        }
        if (e.sub) wrap(c, e.sub, tw, font(500, 12)).slice(0, 3).forEach(function (l) { y += 16; text(c, l, tx, y, font(500, 12), MUTED); });
      });
    }
  }

  /* ------------------------------------------------- header, map, footer */
  function drawHeader(c) {
    var p = P(S.ind), g = c.createLinearGradient(M, 30, M + 38, 68);
    g.addColorStop(0, '#e8873a'); g.addColorStop(1, '#1f7a9c');
    rrect(c, M, 30, 38, 38, 11); c.fillStyle = g; c.fill();
    text(c, '🏥', M + 19, 56, font(400, 20), INK, 'center');
    text(c, 'BIHAR NFHS ATLAS', M + 52, 46, font(800, 13), GREEN);
    text(c, 'District-level NFHS-6 indicators · ' + names.length + ' districts', M + 52, 63, font(500, 12), MUTED);
    text(c, 'Generated ' + today(), PW - M, 46, font(600, 12), MUTED, 'right');

    var t = fitted(c, p.base, PW - 2 * M, 800, 38, 24);
    text(c, t.str, M, 112, font(800, t.size), INK);

    var x = M, y = 124;
    if (p.unit) x += pill(c, p.unit, x, y, 24, '#e3f1ea', '#165d78', 12.5) + 8;
    if (p.year) x += pill(c, p.year, x, y, 24, '#e3f1ea', '#165d78', 12.5) + 8;
    x += pill(c, catOf(S.ind), x, y, 24, '#e3f1ea', '#165d78', 12.5) + 8;
  }

  function drawFooter(c) {
    hr(c, M, PH - 56, PW - 2 * M);
    text(c, 'Source: NFHS-6 (MoHFW / IIPS) · DataMeet, Census 2011 (district boundaries)', M, PH - 34, font(600, 12), MUTED);
    var have = (S.vs || []).length, miss = names.length - have;
    text(c, miss > 0 ? 'Data available for ' + have + ' of ' + names.length + ' districts. Grey districts have no data.'
                     : 'Data available for all ' + names.length + ' districts.', M, PH - 16, font(500, 11.5), MUTED);
    text(c, 'Bihar NFHS Atlas', PW - M, PH - 34, font(700, 12), GREEN, 'right');
    text(c, 'NFHS-6 district percentages (unweighted)', PW - M, PH - 16, font(500, 11.5), MUTED, 'right');
  }

  function drawMapPanel(c, o) {
    rrect(c, MAP.x, MAP.y, MAP.w, MAP.h, 18); c.fillStyle = '#f1f5f2'; c.fill();
    c.strokeStyle = LINE; c.lineWidth = 1; c.stroke();

    var inner = { x: MAP.x + 30, y: MAP.y + 30, w: MAP.w - 60, h: MAP.h - 60 };
    var pr = projector(boundsFor(o.ext), inner);
    var full = projector(boundsFor('state'), inner);
    c.save(); rrect(c, MAP.x, MAP.y, MAP.w, MAP.h, 18); c.clip();
    drawDistricts(c, pr);
    drawLabels(c, pr, o.lab, pr.k / full.k > 1.8);
    c.restore();
    drawNorthArrow(c, MAP.x + MAP.w - 38, MAP.y + 22);
    drawScaleBar(c, pr, MAP.x + 26, MAP.y + MAP.h - 26);
  }

  /* -------------------------------------------------------------- render */
  function render(o) {
    o = o || {};
    var opts = { ext: o.ext || opt.ext, lab: o.lab === undefined ? opt.lab : o.lab, scale: o.scale || SCALE };
    var cv = document.createElement('canvas');
    cv.width = PW * opts.scale; cv.height = PH * opts.scale;
    var c = cv.getContext('2d');
    c.scale(opts.scale, opts.scale);
    c.fillStyle = '#fff'; c.fillRect(0, 0, PW, PH);
    drawHeader(c);
    drawMapPanel(c, opts);
    drawLegend(c);
    drawFooter(c);
    return cv;
  }

  /* ------------------------------------------------------------ download */
  function fileName(ext) {
    return 'bihar-atlas_' + slug(P(S.ind).base) + (opt.ext === 'view' ? '_view' : '') + '_' + new Date().toISOString().slice(0, 10) + '.' + ext;
  }

  function save(blob, name) {
    var a = document.createElement('a'), url = URL.createObjectURL(blob);
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1500);
  }

  function toBlob(cv, type, q) {
    return new Promise(function (res, rej) {
      if (cv.toBlob) return cv.toBlob(function (b) { b ? res(b) : rej(new Error('Could not encode image')); }, type, q);
      try {
        var d = atob(cv.toDataURL(type, q).split(',')[1]), u = new Uint8Array(d.length);
        for (var i = 0; i < d.length; i++) u[i] = d.charCodeAt(i);
        res(new Blob([u], { type: type }));
      } catch (e) { rej(e); }
    });
  }

  function bytesOf(blob) {
    if (blob.arrayBuffer) return blob.arrayBuffer().then(function (b) { return new Uint8Array(b); });
    return new Promise(function (res, rej) {
      var r = new FileReader(); r.onload = function () { res(new Uint8Array(r.result)); }; r.onerror = rej; r.readAsArrayBuffer(blob);
    });
  }

  // Minimal single-page PDF: one full-page JPEG, A4 landscape, with a title in the metadata.
  function pdfFromJpeg(jpg, w, h, title) {
    var pw = 841.89, ph = 595.28, enc = new TextEncoder(), parts = [], off = 0, xref = [];
    function put(x) { var b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); off += b.length; }
    function obj(n, body) { xref[n] = off; put(n + ' 0 obj\n' + body + '\nendobj\n'); }
    function pad(n) { return ('0000000000' + n).slice(-10); }
    var safe = String(title).replace(/[^\x20-\x7E]/g, '').replace(/([\\()])/g, '\\$1');
    put('%PDF-1.4\n'); put(new Uint8Array([0x25, 0xE2, 0xE3, 0xCF, 0xD3, 0x0A]));
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    obj(3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pw + ' ' + ph + '] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>');
    xref[4] = off;
    put('4 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + w + ' /Height ' + h +
        ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpg.length + ' >>\nstream\n');
    put(jpg); put('\nendstream\nendobj\n');
    var cs = 'q ' + pw + ' 0 0 ' + ph + ' 0 0 cm /Im0 Do Q';
    obj(5, '<< /Length ' + cs.length + ' >>\nstream\n' + cs + '\nendstream');
    obj(6, '<< /Title (' + safe + ') /Creator (Bihar NFHS Atlas) /Producer (Bihar NFHS Atlas) >>');
    var start = off, x = 'xref\n0 7\n0000000000 65535 f \n';
    for (var i = 1; i <= 6; i++) x += pad(xref[i]) + ' 00000 n \n';
    put(x + 'trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n' + start + '\n%%EOF\n');
    return new Blob(parts, { type: 'application/pdf' });
  }

  function savePNG(cv) {
    cv = cv || canvas || render();
    return toBlob(cv, 'image/png').then(function (b) { save(b, fileName('png')); });
  }

  function savePDF(cv) {
    cv = cv || canvas || render();
    return toBlob(cv, 'image/jpeg', 0.93).then(bytesOf).then(function (jpg) {
      save(pdfFromJpeg(jpg, cv.width, cv.height, 'Bihar NFHS Atlas - ' + P(S.ind).base), fileName('pdf'));
    });
  }

  /* -------------------------------------------------------------- dialog */
  var dlg = null;

  function build() {
    dlg = document.getElementById('exp');
    dlg.innerHTML =
      '<div class="exx" role="dialog" aria-modal="true" aria-labelledby="ext">' +
      '<button class="cl" id="exc" aria-label="Close">✕</button>' +
      '<h2 id="ext">Export map</h2>' +
      '<p class="exs">Downloads the map as it is coloured now, with a title, legend, key figures and source line.</p>' +
      '<div class="exp" id="exv"><div class="exld">Preparing preview…</div></div>' +
      '<div class="exo">' +
      seg('Area', 'ext', [['state', 'Whole Bihar'], ['view', 'Current view']]) +
      seg('Labels', 'lab', [['0', 'Names'], ['1', 'Values'], ['2', 'None']]) +
      seg('Format', 'fmt', [['png', 'PNG image'], ['pdf', 'PDF (A4)']]) +
      '</div>' +
      '<div class="exf"><span id="exi"></span><button class="btn pri" id="exd">Download</button></div>' +
      '<div class="exerr" id="exe" hidden></div></div>';
    dlg.onclick = onClick;
  }

  function seg(label, key, items) {
    return '<div><label>' + label + '</label><div class="seg" data-o="' + key + '">' +
      items.map(function (it) { return '<button data-v="' + it[0] + '">' + it[1] + '</button>'; }).join('') + '</div></div>';
  }

  function syncUI() {
    dlg.querySelectorAll('.seg').forEach(function (s) {
      var key = s.getAttribute('data-o');
      s.querySelectorAll('button').forEach(function (b) {
        var on = String(opt[key]) === b.getAttribute('data-v');
        b.classList.toggle('on', on); b.setAttribute('aria-pressed', on);
      });
    });
    $('#exd').textContent = 'Download ' + (opt.fmt === 'pdf' ? 'PDF' : 'PNG');
  }

  function fontsReady() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.all([400, 500, 600, 700, 800].map(function (w) {
      return document.fonts.load(w + ' 14px "Plus Jakarta Sans"').catch(function () { });
    }));
  }

  function refresh() {
    var t = ++token, box = $('#exv');
    syncUI();
    box.classList.add('busy');
    fontsReady().then(function () {
      if (t !== token) return;
      canvas = render();
      box.innerHTML = ''; box.appendChild(canvas); box.classList.remove('busy');
      $('#exi').textContent = canvas.width + ' × ' + canvas.height + ' px';
    }).catch(function (e) {
      if (t === token) { box.classList.remove('busy'); box.textContent = 'Could not draw the preview: ' + e.message; }
    });
  }

  function onClick(e) {
    if (e.target === dlg || e.target.closest('#exc')) return close();
    var b = e.target.closest('.seg button');
    if (b) {
      var key = b.parentNode.getAttribute('data-o'), v = b.getAttribute('data-v');
      opt[key] = key === 'lab' ? +v : v;
      if (key !== 'fmt') refresh(); else syncUI();
      return;
    }
    if (e.target.closest('#exd')) {
      var btn = $('#exd'), err = $('#exe'), old = btn.textContent;
      if (!canvas) return;
      btn.disabled = true; btn.textContent = 'Preparing…'; err.hidden = true;
      (opt.fmt === 'pdf' ? savePDF(canvas) : savePNG(canvas))
        .catch(function (x) { err.hidden = false; err.textContent = 'Download failed: ' + x.message; })
        .then(function () { btn.disabled = false; btn.textContent = old; });
    }
  }

  function open() {
    if (!dlg) build();
    opt.lab = S.lab;                       // start from the map's current Labels setting
    dlg.hidden = false; dlg.classList.add('show');
    refresh();
    var c = $('#exc'); if (c) c.focus();
  }

  function close() { if (dlg) { dlg.classList.remove('show'); dlg.hidden = true; } token++; }

  // Escape closes the dialog without triggering the map's own "reset view" shortcut.
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dlg && dlg.classList.contains('show')) { e.stopPropagation(); close(); }
  }, true);

  $('#exb').onclick = open;

  window.AtlasExport = { open: open, close: close, render: render, savePNG: savePNG, savePDF: savePDF };
})();


/**
 * export.js - Automated District Report Card Generator
 * Uses print-safe color palettes: Deep Navy (#1F4E79), Teal (#2A9D8F), Slate (#7F8C8D)
 */

const ReportGenerator = {
    // Standardized Bihar state averages for benchmarking (mocked for example)
    stateAverages: {
        femaleLiteracy: 55.0,
        institutionalBirths: 76.2,
        womenInSHGs: 32.5,
        cleanCookingFuel: 37.8
    },

    /**
     * Triggers the PDF generation process
     * @param {Object} districtData - The nested JSON data for the selected district
     * @param {String} districtName - Name of the district
     */
    async generateReportCard(districtName, districtData) {
        this.showLoadingState(true);

        try {
            // 1. Create the report container
            const reportElement = document.createElement('div');
            reportElement.id = 'pdf-report-container';
            reportElement.innerHTML = this.buildHTMLTemplate(districtName, districtData);
            
            // Append temporarily to DOM (hidden) for html2canvas to read
            document.body.appendChild(reportElement);

            // 2. Configure PDF export settings
            const opt = {
                margin:       0.5,
                filename:     `NFHS-6_Report_${districtName.replace(/\s+/g, '_')}.pdf`,
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 2, useCORS: true, logging: false },
                jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
            };

            // 3. Generate and save PDF
            await html2pdf().set(opt).from(reportElement).save();

        } catch (error) {
            console.error("Report generation failed:", error);
            alert("Failed to generate the report. Please try again.");
        } finally {
            // 4. Cleanup DOM and UI
            const tempElement = document.getElementById('pdf-report-container');
            if (tempElement) tempElement.remove();
            this.showLoadingState(false);
        }
    },

    /**
     * Builds the structured HTML for the report card
     */
    buildHTMLTemplate(districtName, data) {
        // Evaluate performance vs state average for color coding
        const getBenchmarkColor = (val, avg) => val >= avg ? '#2A9D8F' : '#e07a5f'; // Teal for good, Rust for lagging

        return `
            <div class="report-wrapper">
                <!-- Header -->
                <div class="report-header">
                    <h2>Governance & Public Health Report Card</h2>
                    <h1>${districtName.toUpperCase()} DISTRICT</h1>
                    <p>Source: NFHS-6 Bihar District-wise Fact Sheet</p>
                </div>

                <!-- Livelihood & Empowerment Section -->
                <div class="report-section">
                    <h3><i class="icon-livelihood"></i> Rural Livelihood & Women's Empowerment</h3>
                    <div class="metric-grid">
                        ${this.buildMetricCard("Women in Self-Help Groups (SHGs)", data.womenInSHGs, this.stateAverages.womenInSHGs, "%")}
                        ${this.buildMetricCard("Female Literacy (15-49 yrs)", data.femaleLiteracy, this.stateAverages.femaleLiteracy, "%")}
                        ${this.buildMetricCard("Households with Clean Cooking Fuel", data.cleanCookingFuel, this.stateAverages.cleanCookingFuel, "%")}
                    </div>
                </div>

                <!-- Public Health Benchmarking Section -->
                <div class="report-section">
                    <h3><i class="icon-health"></i> Public Health Benchmarking</h3>
                    <div class="metric-grid">
                        ${this.buildMetricCard("Institutional Births", data.institutionalBirths, this.stateAverages.institutionalBirths, "%")}
                        <!-- Add more of the 93 indicators here dynamically -->
                    </div>
                </div>

                <!-- Footer -->
                <div class="report-footer">
                    <p>Generated via Bihar NFHS-6 Spatial Atlas | ${new Date().toLocaleDateString()}</p>
                </div>
            </div>
        `;
    },

    /**
     * Helper to build individual metric comparison cards
     */
    buildMetricCard(label, districtValue, stateAvg, unit) {
        const variance = (districtValue - stateAvg).toFixed(1);
        const isPositive = variance >= 0;
        const varianceColor = isPositive ? '#2A9D8F' : '#e07a5f';
        const varianceSign = isPositive ? '+' : '';

        return `
            <div class="metric-card">
                <h4>${label}</h4>
                <div class="metric-values">
                    <span class="district-val">${districtValue}${unit}</span>
                </div>
                <div class="benchmark-info">
                    <span>State Avg: <strong>${stateAvg}${unit}</strong></span>
                    <span style="color: ${varianceColor}; font-weight: bold;">
                        (${varianceSign}${variance} vs State)
                    </span>
                </div>
            </div>
        `;
    },

    showLoadingState(isLoading) {
        // Toggle UI button spinner/text (Assuming an export button with ID 'btn-export-report')
        const btn = document.getElementById('btn-export-report');
        if (!btn) return;
        btn.disabled = isLoading;
        btn.innerText = isLoading ? "Generating PDF..." : "Download District Report";
    }
};

// Expose to global scope for UI bindings
window.exportDistrictReport = (name, data) => ReportGenerator.generateReportCard(name, data);