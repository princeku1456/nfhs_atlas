/* ---- v4: NFHS-6 data + derived composite index (domain-based) ----
   Five equal-weight domains; each domain = mean of its indicator percentiles.
   Family planning is counted once (unmet need only). Modern-method use is shown
   as context, not scored. See About -> "Why these domains".                      */
var K_STUNT = "Children under 5 years who are stunted (height-for-age)12 (%)",
  K_WAST = "Children under 5 years who are wasted (weight-for-height)12 (%)",
  K_ANC = "Mothers who had at least 4 antenatal care visits (%)",
  K_INST = "Institutional births (%)",
  K_VAC =
    "Children age 12-23 months fully vaccinated based on information from either vaccination card or mother's recall6 (%)",
  K_UNM = "Total unmet need3 (%)",
  K_W10 = "Women with 10 or more years of schooling (%)",
  K_MOD = "Any modern method2 (%)",
  K_CM = "Women age 20-24 years married before age 18 years (%)";
/* [indicator key, direction (+1 higher is better, -1 lower is better), short label] */
var DOM = [
    {
      n: "Child nutrition",
      ind: [
        [K_STUNT, -1, "Stunted"],
        [K_WAST, -1, "Wasted"],
      ],
    },
    {
      n: "Maternal care",
      ind: [
        [K_ANC, 1, "4+ ANC visits"],
        [K_INST, 1, "Institutional births"],
      ],
    },
    { n: "Immunization", ind: [[K_VAC, 1, "Fully vaccinated"]] },
    { n: "Unmet FP need", ind: [[K_UNM, -1, "Unmet need"]] },
    { n: "Women's schooling", ind: [[K_W10, 1, "10+ yrs schooling"]] },
  ],
  PN = DOM.map(function (d) {
    return d.n;
  }),
  PIL = {},
  TL = [
    "Highest tier",
    "Upper-middle tier",
    "Middle tier",
    "Lower-middle tier",
    "Lowest tier",
  ],
  /* ASSUMED effective sample sizes (after design effect) used ONLY to simulate
     sampling error for tier confidence. NFHS fact sheets do not publish district
     standard errors. Replace with real values when available. */
  SE_NEFF = {};
SE_NEFF[K_STUNT] = 250;
SE_NEFF[K_WAST] = 250;
SE_NEFF[K_ANC] = 300;
SE_NEFF[K_INST] = 300;
SE_NEFF[K_VAC] = 100;
SE_NEFF[K_UNM] = 350;
SE_NEFF[K_W10] = 500;
SE_NEFF[K_MOD] = 350;
SE_NEFF[K_CM] = 150;

function okNum(v) {
  return typeof v === "number" && !isNaN(v);
}
function pctArr(a) {
  var v = a.filter(okNum),
    m = v.length;
  return a.map(function (x) {
    if (!okNum(x)) return null;
    if (m < 2) return 50;
    var b = 0,
      e = 0;
    v.forEach(function (y) {
      if (y < x) b++;
      else if (y === x) e++;
    });
    return ((b + (e - 1) / 2) / (m - 1)) * 100;
  });
}
function zArr(a) {
  var v = a.filter(okNum),
    m =
      v.reduce(function (s, x) {
        return s + x;
      }, 0) / v.length,
    sd =
      Math.sqrt(
        v.reduce(function (s, x) {
          return s + (x - m) * (x - m);
        }, 0) / v.length,
      ) || 1;
  return a.map(function (x) {
    return okNum(x) ? 50 + (20 * (x - m)) / sd : null;
  });
}
function mmArr(a) {
  var v = a.filter(okNum),
    lo = Math.min.apply(null, v),
    hi = Math.max.apply(null, v);
  return a.map(function (x) {
    return okNum(x) ? ((x - lo) / (hi - lo || 1)) * 100 : null;
  });
}
var NORM = { pct: pctArr, z: zArr, mm: mmArr };
function colsFor(N, doms) {
  var c = {};
  doms.forEach(function (d) {
    d.ind.forEach(function (p) {
      if (!c[p[0]])
        c[p[0]] = N.map(function (n) {
          var v = data[n][p[0]];
          return okNum(v) ? v : null;
        });
    });
  });
  return c;
}
/* cols: {indicatorKey: [value per district]}; returns domain scores + composite per district */
function scoreSet(cols, doms, method) {
  var f = NORM[method],
    nD = cols[doms[0].ind[0][0]].length,
    dsc = doms.map(function (d) {
      var parts = d.ind.map(function (p) {
          var t = f(cols[p[0]]);
          return p[1] > 0
            ? t
            : t.map(function (x) {
                return x === null ? null : 100 - x;
              });
        }),
        out = [];
      for (var i = 0; i < nD; i++) {
        var s = 0,
          c = 0;
        for (var j = 0; j < parts.length; j++)
          if (parts[j][i] !== null) {
            s += parts[j][i];
            c++;
          }
        out.push(c ? s / c : null);
      }
      return out;
    }),
    ix = [];
  for (var i = 0; i < nD; i++) {
    var s = 0,
      c = 0;
    for (var j = 0; j < dsc.length; j++)
      if (dsc[j][i] !== null) {
        s += dsc[j][i];
        c++;
      }
    ix.push(c ? s / c : null);
  }
  return { dom: dsc, idx: ix };
}
function rankArr(a) {
  return a.map(function (x) {
    var c = 1;
    for (var j = 0; j < a.length; j++) if (a[j] > x) c++;
    return c;
  });
}
function tierOfRank(r, n) {
  return Math.min(4, Math.floor(((r - 1) * 5) / n));
}
function spearman(a, b) {
  var x = pctArr(a),
    y = pctArr(b),
    n = x.length,
    mx = 0,
    my = 0,
    sxy = 0,
    sxx = 0,
    syy = 0,
    i;
  for (i = 0; i < n; i++) {
    mx += x[i] / n;
    my += y[i] / n;
  }
  for (i = 0; i < n; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) * (x[i] - mx);
    syy += (y[i] - my) * (y[i] - my);
  }
  return sxy / Math.sqrt(sxx * syy);
}
/* alternative designs used by the stability check */
function variantList() {
  var v = [
    { label: "Default: percentile scores, 5 domains", f: "pct", doms: DOM },
    { label: "Z-score scaling", f: "z", doms: DOM },
    { label: "Min–max scaling", f: "mm", doms: DOM },
  ];
  DOM.forEach(function (d, j) {
    v.push({
      label: "Without " + d.n,
      f: "pct",
      doms: DOM.filter(function (x, i) {
        return i !== j;
      }),
    });
  });
  v.push({
    label: "Child marriage instead of schooling",
    f: "pct",
    doms: DOM.map(function (d, j) {
      return j === 4
        ? { n: "Women's status", ind: [[K_CM, -1, "Married <18"]] }
        : d;
    }),
  });
  v.push({
    label: "Original v1: six single-indicator pillars",
    f: "pct",
    doms: [
      [K_STUNT, -1],
      [K_INST, 1],
      [K_VAC, 1],
      [K_MOD, 1],
      [K_ANC, 1],
      [K_UNM, -1],
    ].map(function (p) {
      return { n: "p", ind: [[p[0], p[1], ""]] };
    }),
  });
  return v;
}
function stability() {
  if (stability.c) return stability.c;
  var N = names,
    vs = variantList(),
    all = [];
  vs.forEach(function (v) {
    v.doms.forEach(function (d) {
      all.push(d);
    });
  });
  var cols = colsFor(N, all),
    cnt = {},
    base = null,
    out = [];
  vs.forEach(function (v, vi) {
    var r = scoreSet(cols, v.doms, v.f).idx;
    if (!vi) base = r;
    var b5 = N.map(function (n, i) {
      return [n, r[i]];
    })
      .sort(function (a, b) {
        return a[1] - b[1] || a[0].localeCompare(b[0]);
      })
      .slice(0, 5)
      .map(function (x) {
        return x[0];
      });
    b5.forEach(function (x) {
      cnt[x] = (cnt[x] || 0) + 1;
    });
    out.push({ label: v.label, bottom: b5, rho: vi ? spearman(base, r) : 1 });
  });
  return (stability.c = { vars: out, cnt: cnt, total: vs.length });
}
/* Monte-Carlo: how often does a district stay in its tier if each indicator
   carries plausible sampling error? Seeded, so results are reproducible. */
function uncertainty() {
  if (uncertainty.c) return uncertainty.c;
  var N = names,
    nN = N.length,
    keys = [];
  DOM.forEach(function (d) {
    d.ind.forEach(function (p) {
      keys.push(p[0]);
    });
  });
  var base = colsFor(N, DOM),
    sd = {};
  keys.forEach(function (k) {
    sd[k] = base[k].map(function (v) {
      if (v === null) return 0;
      var p = Math.min(0.98, Math.max(0.02, v / 100));
      return 100 * Math.sqrt((p * (1 - p)) / SE_NEFF[k]);
    });
  });
  var seed = 20260507,
    rnd = function () {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    },
    gauss = function () {
      var u = rnd() || 1e-9,
        w = rnd();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * w);
    },
    D = 500,
    rk = N.map(function () {
      return [];
    }),
    same = N.map(function () {
      return 0;
    }),
    pt = scoreSet(base, DOM, "pct").idx.map(function (x) {
      return Math.round(x * 100) / 100;
    }),
    pTier = rankArr(pt).map(function (r) {
      return tierOfRank(r, nN);
    });
  for (var t = 0; t < D; t++) {
    var cc = {};
    keys.forEach(function (k) {
      cc[k] = base[k].map(function (v, i) {
        return v === null
          ? null
          : Math.min(100, Math.max(0, v + gauss() * sd[k][i]));
      });
    });
    var r = rankArr(scoreSet(cc, DOM, "pct").idx);
    for (var i = 0; i < nN; i++) {
      rk[i].push(r[i]);
      if (tierOfRank(r[i], nN) === pTier[i]) same[i]++;
    }
  }
  var lo = {},
    hi = {},
    conf = {};
  N.forEach(function (n, i) {
    var a = rk[i].sort(function (x, y) {
      return x - y;
    });
    lo[n] = a[Math.floor(D * 0.05)];
    hi[n] = a[Math.min(D - 1, Math.floor(D * 0.95))];
    conf[n] = same[i] / D;
  });
  return (uncertainty.c = { lo: lo, hi: hi, conf: conf });
}
function tierInfo(n) {
  var rk = rankOf(n, IXK),
    t = tierOfRank(rk, names.length),
    u = uncertainty();
  return {
    rk: rk,
    t: t,
    label: TL[t],
    lo: u.lo[n],
    hi: u.hi[n],
    conf: u.conf[n],
    unsure: u.conf[n] < 0.6,
  };
}
function tierChip(n) {
  var t = tierInfo(n);
  return (
    '<span class="tier t' +
    t.t +
    '" title="Plausible rank ' +
    t.lo +
    "–" +
    t.hi +
    " of " +
    names.length +
    " (90% of simulations, assumed sampling error). Stays in this tier in " +
    Math.round(t.conf * 100) +
    '% of simulations.">' +
    t.label +
    (t.unsure ? " ~" : "") +
    "</span>"
  );
}
function tiedWith(n) {
  return names.filter(function (m) {
    return m !== n && Math.abs(idx(m) - idx(n)) < 1;
  });
}
function rkTxt(n) {
  if (S.ind === IXK && PIL[n]) {
    var t = tierInfo(n);
    return (
      t.label +
      (t.unsure ? " ~" : "") +
      " · plausible rank " +
      t.lo +
      "–" +
      t.hi +
      " of " +
      names.length
    );
  }
  var tc = tieCount(n);
  return (
    "Rank #" +
    rankOf(n) +
    " of " +
    S.vs.length +
    (tc ? " = tied" : "")
  );
}
(function () {
  var N = Object.keys(data),
    r2 = function (x) {
      return Math.round(x * 100) / 100;
    },
    ok = function (v) {
      return typeof v === "number" && !isNaN(v);
    };
  N.forEach(function (n) {
    var d = data[n],
      mod =
        (d["Any modern method2 (%)"] || 0) -
        (d["Female sterilization (%)"] || 0) -
        (d["Male sterilization (%)"] || 0),
      inst = d["Institutional births (%)"] || 0,
      pub = d["Institutional births in public facility (%)"] || 0;
    d["Other modern methods (%)"] = r2(Math.max(0, mod));
    d["Home births (%)"] = r2(Math.max(0, 100 - inst));
    d["Private facility births (%)"] = r2(Math.max(0, inst - pub));
  });
  var cols0 = colsFor(N, DOM),
    res0 = scoreSet(cols0, DOM, "pct");
  N.forEach(function (n, i) {
    PIL[n] = res0.dom.map(function (t) {
      return t[i] === null ? 0 : t[i];
    });
    data[n]["NFHS Composite Index (0-100)"] = r2(res0.idx[i]);
    // domain scores as selectable map layers (0-100)
    DOM.forEach(function (d, j) {
      data[n]["Domain: " + d.n + " (0-100)"] = r2(PIL[n][j]);
    });
  });
  // tier as a selectable map layer (1 = Highest, 5 = Lowest)
  var idxArr = res0.idx.slice();
  N.forEach(function (n, i) {
    var r =
      idxArr.filter(function (x) {
        return x > idxArr[i];
      }).length + 1;
    data[n]["Index tier (1-5)"] =
      Math.min(4, Math.floor(((r - 1) * 5) / N.length)) + 1;
  });
  Object.keys(data[N[0]]).forEach(function (k) {
    var u = {};
    N.forEach(function (n) {
      u[data[n][k]] = 1;
    });
    if (Object.keys(u).length < 2)
      N.forEach(function (n) {
        delete data[n][k];
      });
  });
})();
var $ = function (s) {
  return document.querySelector(s);
};
var PAL = ["#f4f9fd", "#d3e7f4", "#93c4df", "#4a94c4", "#14537e"],
  ACC = "#e8873a",
  INK = "#0f2a43";
var names = Object.keys(data).sort(),
  LY = {},
  LAB = L.layerGroup();
/* district adjacency, derived from shared border vertices in geo.js */
var NB = {};
(function () {
  function gv(f) {
    var o = {},
      polys =
        f.geometry.type === "Polygon"
          ? [f.geometry.coordinates]
          : f.geometry.coordinates;
    polys.forEach(function (poly) {
      poly.forEach(function (ring) {
        ring.forEach(function (p) {
          o[p[0].toFixed(4) + "," + p[1].toFixed(4)] = 1;
        });
      });
    });
    return o;
  }
  var vs = geo.features.map(gv),
    gns = geo.features.map(function (f) {
      return f.properties.district_clean;
    });
  names.forEach(function (n) {
    NB[n] = [];
  });
  for (var i = 0; i < gns.length; i++) {
    for (var j = i + 1; j < gns.length; j++) {
      var c = 0;
      for (var k in vs[i]) if (vs[j][k]) c++;
      if (c >= 2 && NB[gns[i]] && NB[gns[j]]) {
        NB[gns[i]].push(gns[j]);
        NB[gns[j]].push(gns[i]);
      }
    }
  }
})();
var S = {
  cm: [],
  ind: "",
  cat: "All",
  brk: [],
  cols: [],
  sel: null,
  rgn: null,
  hl: null,
  cls: null,
  lab: 0,
  top: "top",
  sk: "v",
  sd: -1,
  vs: [],
  mean: 0,
  min: 0,
  max: 0,
};
var CATS = [
  ["Index", /Composite Index|^Domain: |Index tier/],
  [
    "Households & Population",
    /Population|electricity|drinking-water|iodized salt|health insurance|bank account\/post office|ever attended school|owning a house|pre-school/,
  ],
  ["Education & Internet", /years of schooling|internet/],
  [
    "Marriage & Fertility",
    /married before|Three or more births|already mothers or pregnant/,
  ],
  [
    "Family Planning",
    /method2|traditional method|sterilization|unmet need|Unmet need/,
  ],
  [
    "Maternal Health",
    /antenatal|neonatal tetanus|iron folic|Mother and Child Protection|Institutional births|caesarean|skilled health|postnatal|check-up within 24 hours/,
  ],
  [
    "Child Health",
    /vaccinated|received.*vaccine|BCG|polio|pentavalent|measles|hepatitis B|rotavirus|vitamin A|vaccinations in a|diarrhoea|acute respiratory infection|fever or symptoms of ARI/,
  ],
  [
    "Nutrition",
    /breastfed|breastfeeding|solid or semi-solid|adequate diet|stunted|wasted|underweight|overweight|Body Mass Index/,
  ],
  [
    "Adult Health",
    /Blood sugar|blood pressure|tobacco|alcohol/,
  ],
  [
    "Women's Empowerment",
    /bank or savings account that they themselves use|mobile phone that they themselves use|hygienic methods of protection/,
  ],
];
function catOf(i) {
  for (var k = 0; k < CATS.length; k++)
    if (CATS[k][1].test(i)) return CATS[k][0];
  return "Other";
}
var ALL = [];
names.forEach(function (n) {
  Object.keys(data[n]).forEach(function (k) {
    if (ALL.indexOf(k) < 0) ALL.push(k);
  });
});
ALL.sort();
function isNum(v) {
  return v !== null && v !== undefined && !isNaN(v);
}
function fmt(v) {
  return isNum(v)
    ? Number(v).toLocaleString("en-IN", { maximumFractionDigits: 2 })
    : "n/a";
}
function fmtC(v) {
  if (!isNum(v)) return "n/a";
  var a = Math.abs(v);
  if (a >= 1e7) return +(v / 1e7).toFixed(2) + " Cr";
  if (a >= 1e5) return +(v / 1e5).toFixed(2) + " L";
  return fmt(v);
}
function P(i) {
  var sex = "";
  i = i.replace(/\s*\((Women|Men)\)\s*$/, function (x, s) {
    sex = s;
    return "";
  });
  var m = /^(.*?)\s*\(([^()]*)\)\s*$/.exec(i);
  var base, unit, year = "";
  if (m) {
    base = m[1];
    var p = m[2].split(",").map(function (s) {
        return s.trim();
      });
    if (/^\d{4}/.test(p[p.length - 1])) year = p.pop();
    unit = p.join(", ");
  } else {
    base = i;
    unit = "";
  }
  if (sex) unit = (unit ? unit + " · " : "") + sex;
  var footnote = "";
  base = base
    .replace(/\s*(\d+(?:\s*,\s*\d+)*)\s*$/, function (x, g) {
      footnote = g;
      return "";
    })
    .trim();
  return { base: base, unit: unit, year: year, footnote: footnote };
}
function isAdd(i) {
  return !/%|\/ha|\/1k|per |\(mm\)|Density|Intensity|Stage|Index|\(0-100\)/i.test(
    i,
  );
}
function flagOf(n, i) {
  var k = i || S.ind;
  if (typeof FLAGS === "undefined" || !FLAGS[n]) return "ok";
  return FLAGS[n][k] || "ok";
}
function V(n, i) {
  var k = i || S.ind;
  if (flagOf(n, k) === "not_available") return null;
  var v = (data[n] || {})[k];
  return isNum(v) ? v : null;
}
function valsOf(i) {
  return names
    .map(function (n) {
      return V(n, i);
    })
    .filter(function (v) {
      return v !== null;
    });
}
/* Near-constant indicators: coefficient of variation < 0.05 or range < 5 points.
   Tagged "little variation" and excluded from rankings, the correlation matrix
   and screening defaults, but still viewable on the map. Thresholds are stated
   so the definition is reproducible from the data. */
var NEAR_CONSTANT = {};
(function () {
  ALL.forEach(function (k) {
    var vs = valsOf(k);
    if (vs.length < 30) return;
    var mn = Math.min.apply(null, vs),
      mx = Math.max.apply(null, vs),
      mean = vs.reduce(function (a, b) { return a + b; }, 0) / vs.length,
      sd = Math.sqrt(
        vs.reduce(function (a, b) { return a + (b - mean) * (b - mean); }, 0) /
          vs.length,
      ),
      cv = mean === 0 ? 0 : sd / Math.abs(mean);
    if (cv < 0.05 || mx - mn < 5) NEAR_CONSTANT[k] = true;
  });
})();
function rankOf(n, i) {
  var v = V(n, i);
  if (v === null) return null;
  return (
    valsOf(i || S.ind).filter(function (x) {
      return x > v;
    }).length + 1
  );
}
/* number of other districts with exactly the same displayed value (tied) */
function tieCount(n, i) {
  var v = V(n, i);
  if (v === null) return 0;
  return (
    valsOf(i || S.ind).filter(function (x) {
      return x === v;
    }).length - 1
  );
}
function mixc(a, b, t) {
  var h = function (x) {
      return [1, 3, 5].map(function (i) {
        return parseInt(x.substr(i, 2), 16);
      });
    },
    A = h(a),
    B = h(b);
  return (
    "#" +
    A.map(function (x, i) {
      return ("0" + Math.round(x + (B[i] - x) * t).toString(16)).slice(-2);
    }).join("")
  );
}
function ramp(n) {
  if (n < 2) return [PAL[2]];
  var o = [];
  for (var i = 0; i < n; i++) {
    var t = (i / (n - 1)) * (PAL.length - 1),
      a = Math.floor(t),
      b = Math.min(a + 1, PAL.length - 1);
    o.push(mixc(PAL[a], PAL[b], t - a));
  }
  return o;
}
function classOf(v) {
  if (!isNum(v)) return -1;
  for (var i = 0; i < S.brk.length; i++) if (v <= S.brk[i]) return i;
  return S.brk.length;
}
function colorOf(v) {
  var c = classOf(v);
  return c < 0 ? "#c7d2d9" : S.cols[c];
}

/* ---- map ---- */
var map = L.map("map", {
  attributionControl: false,
  zoomControl: false,
  zoomSnap: 0.25,
  minZoom: 6,
  maxZoom: 11,
});
L.control.zoom({ position: "bottomright" }).addTo(map);
var PD = [
  "#bf4040",
  "#40bf65",
  "#8a40bf",
  "#bfaf40",
  "#40aabf",
  "#bf4085",
  "#60bf40",
  "#4540bf",
  "#bf6a40",
  "#40bf90",
  "#b540bf",
  "#a5bf40",
  "#407fbf",
  "#bf405a",
  "#40bf4b",
  "#7040bf",
  "#bf9540",
  "#40bfba",
  "#bf409f",
  "#7abf40",
  "#4055bf",
  "#bf5040",
  "#40bf75",
  "#9a40bf",
  "#bfbf40",
  "#409abf",
  "#bf4074",
  "#4fbf40",
  "#5540bf",
  "#bf7b40",
  "#40bfa0",
  "#bf40b9",
  "#94bf40",
  "#406fbf",
  "#bf404a",
  "#40bf5b",
  "#8040bf",
  "#bfa540",
];
function dcol(n) {
  var i = names.indexOf(n);
  return PD[(i < 0 ? 0 : i) % PD.length];
}
function styleFor(n) {
  var v = V(n),
    dim = S.cls !== null && classOf(v) !== S.cls,
    sel = n === S.sel,
    ci = S.cm.indexOf(n);
  return {
    fillColor: colorOf(v),
    fillOpacity: dim || (SCR && SCR.indexOf(n) < 0) ? 0.1 : 0.92,
    weight: sel ? 3.5 : ci >= 0 ? 3 : 0.9,
    color: sel ? ACC : ci >= 0 ? dcol(n) : "#2b4a5c",
    opacity: sel || ci >= 0 ? 1 : 0.55,
    dashArray: ci >= 0 ? "7 5" : null,
  };
}
function hc(n) {
  var v = V(n);
  if (v === null)
    return '<div class="h1">' + n + '</div><div class="h3">No data</div>';
  var d = S.mean ? ((v - S.mean) / S.mean) * 100 : 0;
  return (
    '<div class="h1">' +
    n +
    '</div><div class="h2">' +
    fmt(v) +
    " <small>" +
    P(S.ind).unit +
    '</small></div><div class="h3">' +
    rkTxt(n) +
    (S.mean
      ? " · " + (d >= 0 ? "▲ " : "▼ ") + Math.abs(d).toFixed(0) + "% vs avg"
      : "") +
    "</div>"
  );
}
function hoverOn(n) {
  var l = LY[n];
  if (!l) return;
  l.setStyle({ weight: 2.5, color: INK, opacity: 1, fillOpacity: 0.98 });
  l.bringToFront();
  var r = document.querySelector('tr[data-d="' + n + '"]');
  if (r) r.classList.add("hl");
}
function hoverOff(n) {
  var l = LY[n];
  if (!l) return;
  l.setStyle(styleFor(n));
  if (S.sel && LY[S.sel]) LY[S.sel].bringToFront();
  var r = document.querySelector('tr[data-d="' + n + '"]');
  if (r) r.classList.remove("hl");
}
var geoLayer = L.geoJSON(geo, {
  style: function (f) {
    return styleFor(f.properties.district_clean);
  },
  bubblingMouseEvents: false,
  onEachFeature: function (f, l) {
    var n = f.properties.district_clean;
    LY[n] = l;
    l.bindTooltip(
      function () {
        return hc(n);
      },
      {
        sticky: true,
        className: "hc",
        direction: "top",
        opacity: 1,
        offset: [0, -8],
      },
    );
    l.on({
      mouseover: function () {
        hoverOn(n);
      },
      mouseout: function () {
        hoverOff(n);
      },
      click: function (e) {
        if (
          e.originalEvent &&
          e.originalEvent.shiftKey &&
          S.sel &&
          n !== S.sel
        ) {
          toggleCm(n);
          tab("district");
        } else select(n, true);
      },
    });
    L.marker(l.getBounds().getCenter(), {
      interactive: false,
      keyboard: false,
      icon: L.divIcon({ className: "dl", iconSize: [0, 0] }),
    }).addTo(LAB)._n = n;
  },
}).addTo(map);
var HOME = geoLayer.getBounds();
map.fitBounds(HOME, { padding: [40, 40] });
LAB.addTo(map);
map.on("click", function () {
  clearSel();
  clearMapHighlight();
});
function zs() {
  map.getContainer().classList.toggle("zs", map.getZoom() < 8);
}
map.on("zoomend", zs);
zs();
function drawLabels() {
  LAB.eachLayer(function (m) {
    var n = m._n,
      v = V(n);
    m.setIcon(
      L.divIcon({
        className: "dl",
        iconSize: [0, 0],
        html:
          S.lab === 2
            ? ""
            : '<span class="lb">' +
              n +
              (S.lab === 1 ? "<b>" + fmtC(v) + "</b>" : "") +
              "</span>",
      }),
    );
  });
}

/* ---- selection ---- */
function select(n, fly) {
  S.sel = n;
  S.rgn = null;
  S.hl = null;
  S.cm = S.cm.filter(function (x) {
    return x !== n;
  });
  names.forEach(function (k) {
    LY[k].setStyle(styleFor(k));
  });
  LY[n].bringToFront();
  if (fly)
    map.flyToBounds(LY[n].getBounds(), {
      padding: [90, 90],
      maxZoom: 9,
      duration: 0.8,
    });
  tab("district");
  renderProfile();
  renderTable();
  charts();
  sync();
}
function clearSel() {
  if (!S.sel) return;
  var o = S.sel,
    c0 = S.cm;
  S.sel = null;
  S.cm = [];
  S.rgn = null;
  S.hl = null;
  c0.forEach(function (x) {
    LY[x].setStyle(styleFor(x));
  });
  LY[o].setStyle(styleFor(o));
  renderProfile();
  renderTable();
  charts();
  sync();
}
var TAB_KEYS = ["insights", "district", "explore", "screen", "data"];
function tab(w) {
  document.querySelectorAll(".tab").forEach(function (t) {
    var on = t.dataset.tab === w;
    t.classList.toggle("on", on);
    t.setAttribute("aria-selected", on ? "true" : "false");
    t.tabIndex = on ? 0 : -1;
  });
  TAB_KEYS.forEach(function (k) {
    $("#p-" + k).hidden = k !== w;
  });
  if (w === "insights" || w === "explore") charts();
}
document.querySelectorAll(".tab").forEach(function (t) {
  t.onclick = function () {
    tab(t.dataset.tab);
  };
  t.onkeydown = function (e) {
    var i = TAB_KEYS.indexOf(t.dataset.tab),
      nxt = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown")
      nxt = TAB_KEYS[(i + 1) % TAB_KEYS.length];
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp")
      nxt = TAB_KEYS[(i - 1 + TAB_KEYS.length) % TAB_KEYS.length];
    else if (e.key === "Home") nxt = TAB_KEYS[0];
    else if (e.key === "End") nxt = TAB_KEYS[TAB_KEYS.length - 1];
    if (nxt) {
      e.preventDefault();
      tab(nxt);
      var el = document.querySelector('[data-tab="' + nxt + '"]');
      if (el) el.focus();
    }
  };
});

/* ---- indicator + chips ---- */
function fillSelect() {
  var t = (S.iq || "").trim().toLowerCase(),
    se = $("#indicator"),
    o = ALL.filter(function (i) {
      return (
        (S.cat === "All" || catOf(i) === S.cat) &&
        i.toLowerCase().indexOf(t) >= 0
      );
    });
  se.innerHTML = o
    .map(function (i) {
      return (
        '<option value="' +
        i +
        '">' +
        P(i).base +
        (NEAR_CONSTANT[i] ? " — little variation" : "") +
        "</option>"
      );
    })
    .join("");
  if (!t) {
    if (o.indexOf(S.ind) < 0 && o.length) S.ind = o[0];
    se.value = S.ind;
  }
  se.size = t ? Math.max(2, Math.min(8, o.length)) : 1;
  se.classList.toggle("open", !!t);
}
var cats = ["All"].concat(
  CATS.map(function (c) {
    return c[0];
  }),
);
$("#chips").innerHTML = cats
  .map(function (c) {
    return (
      '<button class="chip' +
      (c === "All" ? " on" : "") +
      '" data-c="' +
      c +
      '">' +
      c +
      "</button>"
    );
  })
  .join("");
$("#chips").onclick = function (e) {
  var b = e.target.closest(".chip");
  if (!b) return;
  S.cat = b.dataset.c;
  document.querySelectorAll(".chip").forEach(function (c) {
    c.classList.toggle("on", c === b);
  });
  var p = S.ind;
  fillSelect();
  if (S.ind !== p) refresh();
};
$("#indicator").onchange = function () {
  if (!this.value) return;
  S.ind = this.value;
  S.cls = null;
  S.iq = "";
  $("#isr").value = "";
  fillSelect();
  refresh();
};
$("#isr").oninput = function () {
  S.iq = this.value;
  fillSelect();
};
$("#isr").onkeydown = function (e) {
  var se = $("#indicator");
  if (e.key === "Enter") {
    if (se.options[0]) {
      se.value = se.options[0].value;
      se.onchange();
    }
  } else if (e.key === "ArrowDown" && se.options.length) {
    se.focus();
    se.selectedIndex = 0;
    e.preventDefault();
  } else if (e.key === "Escape") {
    S.iq = "";
    this.value = "";
    fillSelect();
  }
};
function setInd(i) {
  if (ALL.indexOf(i) < 0) return;
  S.cat = "All";
  document.querySelectorAll(".chip").forEach(function (c) {
    c.classList.toggle("on", c.dataset.c === "All");
  });
  S.ind = i;
  S.cls = null;
  S.iq = "";
  $("#isr").value = "";
  fillSelect();
  refresh();
}

/* ---- refresh ---- */
function refresh() {
  S.vs = valsOf(S.ind);
  var s = S.vs.slice().sort(function (a, b) {
      return a - b;
    }),
    b = [];
  S.min = s[0];
  S.max = s[s.length - 1];
  S.mean =
    s.reduce(function (a, c) {
      return a + c;
    }, 0) / (s.length || 1);
  for (var i = 1; i < 5; i++) b.push(s[Math.floor((i / 5) * (s.length - 1))]);
  S.brk = b.filter(function (x, i) {
    return x < S.max && (i === 0 || x > b[i - 1]);
  });
  S.cols = ramp(S.brk.length + 1);
  names.forEach(function (n) {
    LY[n].setStyle(styleFor(n));
  });
  if (S.sel) LY[S.sel].bringToFront();
  if (S.rgn) paintSet(S.rgn.districts, S.rgn.color);
  if (S.hl) paintSet(S.hl.districts, S.hl.color);
  drawLabels();
  legend();
  kpis();
  title();
  insights();
  charts();
  renderTable();
  renderProfile();
  sync();
}
function title() {
  var p = P(S.ind);
  $("#ttl").textContent = p.base;
  $("#tags").innerHTML =
    (p.unit ? '<span class="tag">' + p.unit + "</span>" : "") +
    (p.year ? '<span class="tag">' + p.year + "</span>" : "") +
    '<span class="tag">' +
    catOf(S.ind) +
    "</span>" +
    (NEAR_CONSTANT[S.ind]
      ? '<span class="tag lv" title="Values are nearly the same across districts, so ranking is not shown">little variation</span>'
      : "");
}
function dirTxt(d) {
  return d === "higher_better"
    ? "higher is better"
    : d === "lower_better"
      ? "lower is better"
      : d === "context"
        ? "context only"
        : "not classified";
}
function metaInfo(i) {
  var m = typeof META !== "undefined" && META[i] ? META[i] : null,
    p = P(i),
    r = [];
  if (p.unit) r.push("<li><b>Unit</b> " + p.unit + "</li>");
  if (m) {
    r.push("<li><b>Theme</b> " + m.theme + "</li>");
    if (m.domain) r.push("<li><b>Index domain</b> " + m.domain + "</li>");
    r.push(
      "<li><b>Direction</b> " +
        (m.direction ? dirTxt(m.direction) : "not classified") +
        "</li>",
    );
    if (m.footnote) r.push("<li><b>Footnote</b> " + m.footnote + "</li>");
    r.push(
      "<li><b>Definition</b> " +
        (m.definition || "<i>definition not yet added</i>") +
        "</li>",
    );
    if (m.denominator) r.push("<li><b>Denominator</b> " + m.denominator + "</li>");
    if (m.referencePeriod)
      r.push("<li><b>Reference period</b> " + m.referencePeriod + "</li>");
    if (m.sourcePage) r.push("<li><b>Source</b> " + m.sourcePage + "</li>");
  } else {
    r.push("<li><b>Definition</b> <i>definition not yet added</i></li>");
  }
  return "<ul>" + r.join("") + "</ul>";
}
$("#mi").onclick = function (e) {
  e.stopPropagation();
  var t = $("#mit");
  if (t.hidden) {
    t.innerHTML = metaInfo(S.ind);
    t.hidden = false;
  } else {
    t.hidden = true;
  }
};
document.addEventListener("click", function (e) {
  if (!e.target.closest("#mit") && !e.target.closest("#mi")) {
    var t = $("#mit");
    if (t) t.hidden = true;
  }
});
function legend() {
  var h = "",
    cnt = S.cols.map(function () {
      return 0;
    }),
    nd = 0;
  names.forEach(function (n) {
    var c = classOf(V(n));
    c < 0 ? nd++ : cnt[c]++;
  });
  S.cols.forEach(function (c, i) {
    var t =
      S.brk.length === 0
        ? "All districts equal"
        : i === 0
          ? "≤ " + fmtC(S.brk[0])
          : i === S.brk.length
            ? "> " + fmtC(S.brk[i - 1])
            : fmtC(S.brk[i - 1]) + " – " + fmtC(S.brk[i]);
    h +=
      '<button class="lg' +
      (S.cls === i ? " on" : "") +
      '" data-i="' +
      i +
      '"><i style="background:' +
      c +
      '"></i>' +
      t +
      "<b>" +
      cnt[i] +
      "</b></button>";
  });
  if (nd)
    h +=
      '<div class="lg" style="cursor:default"><i style="background:#c7d2d9"></i>No data<b>' +
      nd +
      "</b></div>";
  $("#legend").innerHTML = h;
}
$("#legend").onclick = function (e) {
  var b = e.target.closest("button");
  if (!b) return;
  var i = +b.dataset.i;
  S.cls = S.cls === i ? null : i;
  legend();
  names.forEach(function (n) {
    LY[n].setStyle(styleFor(n));
  });
  if (S.sel) LY[S.sel].bringToFront();
};
function countTo(el, to, f) {
  var from = el._v || 0;
  el._v = to;
  var t0 = performance.now();
  (function step(t) {
    var p = Math.min(1, (t - t0) / 650),
      e = 1 - Math.pow(1 - p, 3);
    el.textContent = f(from + (to - from) * e);
    if (p < 1) requestAnimationFrame(step);
  })(t0);
}
function kpis() {
  var add = isAdd(S.ind),
    mx = null,
    mn = null,
    s = S.vs.slice().sort(function (a, b) {
      return a - b;
    }),
    med =
      s.length % 2
        ? s[(s.length - 1) / 2]
        : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
  names.forEach(function (n) {
    var v = V(n);
    if (v === null) return;
    if (!mx || v > mx.v) mx = { n: n, v: v };
    if (!mn || v < mn.v) mn = { n: n, v: v };
  });
  var c = [
    [add ? "Total" : "State mean", add ? S.mean * S.vs.length : S.mean],
    [add ? "Average" : "Median", add ? S.mean : med],
    ["Highest", mx && mx.v, mx && mx.n],
    ["Lowest", mn && mn.v, mn && mn.n],
  ];
  $("#kpis").innerHTML = c
    .map(function (k) {
      var t = k[2] ? "button" : "div";
      return (
        "<" +
        t +
        ' class="kpi"' +
        (k[2] ? ' data-d="' + k[2] + '"' : "") +
        "><small>" +
        k[0] +
        '</small><span class="v" data-v="' +
        k[1] +
        '">0</span><em>' +
        (k[2] || "&nbsp;") +
        "</em></" +
        t +
        ">"
      );
    })
    .join("");
  document.querySelectorAll("#kpis .v").forEach(function (e) {
    countTo(e, +e.dataset.v, fmtC);
  });
}
$("#kpis").onclick = function (e) {
  var b = e.target.closest("[data-d]");
  if (b) select(b.dataset.d, true);
};
function insights() {
  var add = isAdd(S.ind),
    r = names
      .filter(function (n) {
        return V(n) !== null;
      })
      .sort(function (a, b) {
        return V(b) - V(a);
      }),
    tot = S.mean * S.vs.length,
    p = P(S.ind),
    h = "";
  if (!r.length) {
    $("#ins").innerHTML = "<p>No data for this indicator.</p>";
    return;
  }
  var t = r[0];
  h +=
    "<p><b>" +
    t +
    "</b> leads with <b>" +
    fmtC(V(t)) +
    "</b>" +
    (add && tot
      ? ", about <b>" +
        ((V(t) / tot) * 100).toFixed(1) +
        "%</b> of the state total"
      : "") +
    ".</p>";
  var z = r.filter(function (n) {
    return V(n) === 0;
  }).length;
  h +=
    "<p>" +
    (z
      ? "<b>" + z + "</b> of " + r.length + " districts report zero."
      : S.min > 0
        ? "The top district is <b>" +
          (S.max / S.min).toFixed(1) +
          "×</b> the lowest (" +
          r[r.length - 1] +
          ")."
        : "Values span " + fmtC(S.min) + " to " + fmtC(S.max) + ".") +
    "</p>";
  if (add && tot) {
    var t5 = r.slice(0, 5).reduce(function (a, n) {
      return a + V(n);
    }, 0);
    h +=
      "<p>The top 5 districts hold <b>" +
      ((t5 / tot) * 100).toFixed(0) +
      "%</b> of the total.</p>";
  } else {
    var ab = r.filter(function (n) {
      return V(n) > S.mean;
    }).length;
    h +=
      "<p><b>" +
      ab +
      "</b> of " +
      r.length +
      " districts sit above the state average.</p>";
  }
  if (r.length < names.length)
    h +=
      "<p>Only <b>" +
      r.length +
      " of " +
      names.length +
      "</b> districts report this, so read rankings with care.</p>";
  $("#ins").innerHTML = h;
}

/* ---- charts ---- */
Chart.defaults.font.family = "'Plus Jakarta Sans',system-ui,sans-serif";
Chart.defaults.color = "#6a7c8a";
var tipBox = {
  backgroundColor: INK,
  padding: 10,
  cornerRadius: 10,
  displayColors: false,
};
var DP = {
  id: "dist",
  afterDatasetsDraw: function (ch) {
    var m = ch._m;
    if (!m) return;
    var c = ch.ctx,
      A = ch.chartArea,
      Y = ch.scales.y,
      X = function (v) {
        return A.left + ((v - m.lo) / (m.hi - m.lo || 1)) * (A.right - A.left);
      };
    c.save();
    c.strokeStyle = "rgba(12,29,24,.45)";
    c.lineWidth = 1.2;
    m.vs.forEach(function (v) {
      var x = X(v);
      c.beginPath();
      c.moveTo(x, A.bottom);
      c.lineTo(x, A.bottom - 7);
      c.stroke();
    });
    c.beginPath();
    m.kde.forEach(function (p, i) {
      var x = X(p[0]),
        y = Y.getPixelForValue(p[1]);
      i ? c.lineTo(x, y) : c.moveTo(x, y);
    });
    c.strokeStyle = "#0f2a43";
    c.lineWidth = 2.2;
    c.lineJoin = "round";
    c.stroke();
    function vl(v, col, d) {
      var x = X(v);
      c.beginPath();
      c.setLineDash(d);
      c.strokeStyle = col;
      c.lineWidth = 2.2;
      c.moveTo(x, A.top);
      c.lineTo(x, A.bottom);
      c.stroke();
    }
    vl(m.med, "#1d4ed8", []);
    vl(m.mean, "#d9480f", [6, 4]);
    c.restore();
  },
};
function distStats(B, w, cnt) {
  var v = S.vs.slice().sort(function (a, b) {
      return a - b;
    }),
    n = v.length;
  if (n < 3) {
    hist._m = null;
    $("#sk").textContent = "";
    $("#skn").innerHTML = "";
    return;
  }
  var mean =
      v.reduce(function (a, b) {
        return a + b;
      }, 0) / n,
    med = n % 2 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2,
    m2 = 0,
    m3 = 0;
  v.forEach(function (x) {
    var d = x - mean;
    m2 += d * d;
    m3 += d * d * d;
  });
  m2 /= n;
  m3 /= n;
  var sd = Math.sqrt(m2),
    g = sd ? m3 / Math.pow(m2, 1.5) : 0;
  g *= Math.sqrt(n * (n - 1)) / (n - 2);
  var q = function (p) {
      var i = (n - 1) * p,
        f = Math.floor(i);
      return v[f] + (v[Math.min(f + 1, n - 1)] - v[f]) * (i - f);
    },
    s = sd * Math.sqrt(n / (n - 1)),
    iqr = q(0.75) - q(0.25),
    h = 0.9 * Math.min(s, iqr / 1.34 || s) * Math.pow(n, -0.2) || s * 0.3 || 1,
    kde = [],
    pk = 0,
    lo = S.min,
    hi = S.max;
  for (var i = 0; i <= 80; i++) {
    var x = lo + ((hi - lo) * i) / 80,
      f = 0;
    v.forEach(function (t) {
      var z = (x - t) / h;
      f += Math.exp(-0.5 * z * z);
    });
    f = (f / (h * 2.5066)) * w;
    kde.push([x, f]);
    if (f > pk) pk = f;
  }
  hist._m = { lo: lo, hi: hi, mean: mean, med: med, kde: kde, vs: v };
  hist.options.scales.y.suggestedMax = Math.ceil(
    Math.max(pk, Math.max.apply(null, cnt)) * 1.12,
  );
  var a = Math.abs(g),
    lab =
      a < 0.5
        ? "Roughly symmetric"
        : (a > 1 ? "Strongly " : "Moderately ") +
          (g > 0 ? "right" : "left") +
          "-skewed",
    ex = g > 0 ? v[n - 1] : v[0],
    who =
      names.filter(function (x) {
        return V(x) === ex;
      })[0] || "",
    txt;
  if (a < 0.5)
    txt =
      "Values spread fairly evenly around the centre, so the mean (" +
      fmtV(mean) +
      ") and median (" +
      fmtV(med) +
      ") are close.";
  else if (g > 0)
    txt =
      "Most districts sit toward the lower values, while a few high ones" +
      (who ? " (led by <b>" + who + "</b>)" : "") +
      " stretch the right tail and pull the mean (" +
      fmtV(mean) +
      ") above the median (" +
      fmtV(med) +
      ").";
  else
    txt =
      "Most districts sit toward the higher values, while a few low ones" +
      (who ? " (lowest: <b>" + who + "</b>)" : "") +
      " stretch the left tail and pull the mean (" +
      fmtV(mean) +
      ") below the median (" +
      fmtV(med) +
      ").";
  $("#sk").className = "sk " + (a < 0.5 ? "sym" : g > 0 ? "pos" : "neg");
  $("#sk").textContent = lab + " · skew " + (g >= 0 ? "+" : "") + g.toFixed(2);
  $("#skn").innerHTML =
    '<div class="skl"><span><i style="background:#d9480f"></i>Mean</span><span><i style="background:#1d4ed8"></i>Median</span><span><i class="kd"></i>Density curve</span><span><i class="rg"></i>Each district</span></div><p>' +
    txt +
    "</p>";
}
var hist = new Chart($("#hist"), {
  type: "bar",
  data: {
    labels: [],
    datasets: [{ data: [], borderWidth: 1, borderRadius: 5 }],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 600 },
    plugins: {
      legend: { display: false },
      tooltip: Object.assign(
        {
          callbacks: {
            title: function (i) {
              return hist._r[i[0].dataIndex];
            },
            label: function (i) {
              return i.raw + " district" + (i.raw === 1 ? "" : "s");
            },
          },
        },
        tipBox,
      ),
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { maxRotation: 0, autoSkip: true, font: { size: 10 } },
      },
      y: {
        beginAtZero: true,
        ticks: { precision: 0 },
        grid: { color: "#eef3f8" },
      },
    },
  },
  plugins: [DP],
});
var topN = [];
var topChart = new Chart($("#top"), {
  type: "bar",
  data: {
    labels: [],
    datasets: [{ data: [], borderWidth: 1, borderRadius: 6 }],
  },
  options: {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 600 },
    onClick: function (e, el) {
      if (el.length) select(topN[el[0].index], true);
    },
    onHover: function (e, el) {
      e.native.target.style.cursor = el.length ? "pointer" : "default";
    },
    plugins: {
      legend: { display: false },
      tooltip: Object.assign(
        {
          callbacks: {
            label: function (i) {
              var n = topN[i.dataIndex],
                r = rankOf(n),
                t = tieCount(n);
              return "#" + r + (t ? "=" : "") + " · " + fmt(i.raw);
            },
          },
        },
        tipBox,
      ),
    },
    scales: {
      x: {
        beginAtZero: true,
        grid: { color: "#eef3f8" },
        ticks: {
          callback: function (v) {
            return fmtC(v);
          },
        },
      },
      y: { grid: { display: false } },
    },
  },
});
function charts() {
  if ($("#p-insights").hidden || !S.vs.length) return;
  var B =
      S.min === S.max
        ? 1
        : Math.max(6, Math.min(12, Math.round(Math.sqrt(S.vs.length) * 1.8))),
    w = (S.max - S.min) / B || 1,
    cnt = [],
    lab = [],
    rg = [],
    col = [],
    bd = [],
    sb =
      S.sel && V(S.sel) !== null
        ? Math.min(B - 1, Math.floor((V(S.sel) - S.min) / w))
        : -1;
  for (var i = 0; i < B; i++) {
    var lo = S.min + i * w,
      hi = lo + w;
    cnt.push(0);
    lab.push(fmtC(lo));
    rg.push(fmtC(lo) + " – " + fmtC(hi));
    col.push(i === sb ? ACC : S.cols[Math.max(0, classOf((lo + hi) / 2))]);
    bd.push(i === sb ? "#b35f00" : "rgba(43,74,64,.4)");
  }
  S.vs.forEach(function (v) {
    cnt[Math.min(B - 1, Math.floor((v - S.min) / w))]++;
  });
  hist._r = rg;
  hist.data.labels = lab;
  hist.data.datasets[0] = {
    data: cnt,
    backgroundColor: col,
    borderColor: bd,
    borderWidth: 1,
    borderRadius: 5,
  };
  distStats(B, w, cnt);
  hist.update();
  var a = names
    .filter(function (n) {
      return V(n) !== null;
    })
    .sort(function (x, y) {
      return S.top === "top" ? V(y) - V(x) : V(x) - V(y);
    })
    .slice(0, 10);
  topN = a;
  topChart.data.labels = a;
  topChart.data.datasets[0] = {
    data: a.map(function (n) {
      return V(n);
    }),
    backgroundColor: a.map(function (n) {
      return n === S.sel ? ACC : colorOf(V(n));
    }),
    borderColor: a.map(function (n) {
      return n === S.sel ? "#b35f00" : "rgba(43,74,64,.4)";
    }),
    borderWidth: 1,
    borderRadius: 6,
  };
  topChart.update();
  var nc = NEAR_CONSTANT[S.ind],
    rn = $("#rnknote"),
    seg = $("#seg"),
    topbox = $("#top").closest(".ch");
  if (rn) rn.hidden = !nc;
  if (seg) seg.hidden = nc;
  if (topbox) topbox.hidden = nc;
  if (nc) {
    topChart.data.labels = [];
    topChart.data.datasets[0].data = [];
    topChart.update();
  }
}
$("#seg").onclick = function (e) {
  var b = e.target.closest("button");
  if (!b) return;
  S.top = b.dataset.m;
  this.querySelectorAll("button").forEach(function (x) {
    x.classList.toggle("on", x === b);
  });
  charts();
};

/* ---- profile ---- */
var KEY = [
  "Institutional births (%)",
  "Mothers who had at least 4 antenatal care visits (%)",
  "Children age 12-23 months fully vaccinated based on information from either vaccination card or mother's recall6 (%)",
  "Any modern method2 (%)",
  "Total unmet need3 (%)",
  "Children under 5 years who are stunted (height-for-age)12 (%)",
  "Women with 10 or more years of schooling (%)",
  "NFHS Composite Index (0-100)",
];
function renderProfile() {
  var el = $("#p-district"),
    n = S.sel;
  if (!n) {
    el.innerHTML =
      '<div class="empty"><span>🗺️</span>Click any district on the map<br>to open its profile.<br><small>Tip: press <b>/</b> to search by name.</small></div>';
    return;
  }
  var v = V(n),
    p = P(S.ind),
    pos =
      v === null || S.max === S.min
        ? 50
        : ((v - S.min) / (S.max - S.min)) * 100,
    avgp = S.max === S.min ? 50 : ((S.mean - S.min) / (S.max - S.min)) * 100,
    d = S.mean && v !== null ? ((v - S.mean) / S.mean) * 100 : 0,
    tot = S.mean * S.vs.length;
  var grad =
    "linear-gradient(90deg," +
    S.cols
      .map(function (c, i) {
        return c + " " + (i / Math.max(1, S.cols.length - 1)) * 100 + "%";
      })
      .join(",") +
    ")";
  el.innerHTML =
    '<div class="ph"><div><small>District profile</small><h2>' +
    n +
    '</h2></div><button class="x" data-x title="Close">✕</button></div>' +
    '<div class="hero"><small>' +
    p.base +
    (p.year ? " · " + p.year : "") +
    '</small><div class="big">' +
    fmt(v) +
    " <span>" +
    p.unit +
    "</span></div>" +
    (v === null
      ? ""
      : '<span class="pill">' +
        rkTxt(n) +
        '</span><span class="pill">' +
        (d >= 0 ? "▲" : "▼") +
        " " +
        Math.abs(d).toFixed(0) +
        "% vs avg</span>" +
        (isAdd(S.ind) && tot
          ? '<span class="pill">' +
            ((v / tot) * 100).toFixed(1) +
            "% of state</span>"
          : "")) +
    '<div class="meter" style="background:' +
    grad +
    '"><i style="left:' +
    avgp +
    '%" title="State average"></i><i class="me" style="left:' +
    pos +
    '%"></i></div><div class="mm"><span>' +
    fmtC(S.min) +
    "</span><span>▮ state avg</span><span>" +
    fmtC(S.max) +
    "</span></div></div>" +
    '<div class="cmp"><span class="cmpl" title="Or shift-click districts on the map">Compare</span><div class="cchips">' +
    (S.cm.length
      ? '<span class="cc pri" style="--c:' + dcol(n) + '">' + n + "</span>"
      : "") +
    S.cm
      .map(function (x, i) {
        return (
          '<span class="cc" style="--c:' +
          dcol(x) +
          '">' +
          x +
          '<button data-rm="' +
          x +
          '" aria-label="Remove ' +
          x +
          '">✕</button></span>'
        );
      })
      .join("") +
    (S.cm.length < 15
      ? '<select id="cmps" aria-label="Add district to compare"><option value="">+ Add district</option>' +
        names
          .filter(function (x) {
            return x !== n && S.cm.indexOf(x) < 0;
          })
          .map(function (x) {
            return "<option>" + x + "</option>";
          })
          .join("") +
        "</select>"
      : "") +
    (S.cm.length ? '<button class="cclr" data-rm="*">Clear</button>' : "") +
    "</div></div>" +
    '<div class="lbl" style="color:#6a7c8a;margin:4px 0 0">At a glance · tap to map it</div>' +
    '<div class="pf"><input id="pfi" type="search" placeholder="Filter indicators…" aria-label="Filter indicators" value="' +
    (S.pf || "").replace(/"/g, "&quot;") +
    '"><span class="seg" id="pfs">' +
    [
      ["best", "Best"],
      ["worst", "Weakest"],
      ["az", "A–Z"],
    ]
      .concat(S.cm.length ? [["gap", "Spread"]] : [])
      .map(function (o) {
        return (
          '<button data-s="' +
          o[0] +
          '" class="' +
          ((S.ps || "best") === o[0] ? "on" : "") +
          '">' +
          o[1] +
          "</button>"
        );
      })
      .join("") +
    '</span></div><div class="pc" id="pfc"></div><div class="stats" id="pl"></div>';
  renderList();
}
var BC = {};
function shade(k, v) {
  var c = BC[k];
  if (!c) {
    var a = valsOf(k);
    c = BC[k] = { mn: Math.min.apply(null, a), mx: Math.max.apply(null, a) };
  }
  var t = c.mx === c.mn ? 0.5 : (v - c.mn) / (c.mx - c.mn),
    x = Math.max(0, Math.min(1, t)) * (PAL.length - 1),
    i = Math.min(Math.floor(x), PAL.length - 2);
  return mixc(PAL[i], PAL[i + 1], x - i);
}
function bcol(h) {
  var r = parseInt(h.substr(1, 2), 16) / 255,
    g = parseInt(h.substr(3, 2), 16) / 255,
    b = parseInt(h.substr(5, 2), 16) / 255,
    mx = Math.max(r, g, b),
    mn = Math.min(r, g, b),
    l = (mx + mn) / 2,
    d = mx - mn,
    sa = d ? d / (1 - Math.abs(2 * l - 1)) : 0,
    hh = 0;
  if (d) {
    hh =
      mx === r
        ? ((g - b) / d) % 6
        : mx === g
          ? (b - r) / d + 2
          : (r - g) / d + 4;
    hh *= 60;
    if (hh < 0) hh += 360;
  }
  sa = Math.min(1, sa * 1.15 + 0.1);
  l = l > 0.8 ? l - 0.22 : Math.min(0.85, l + 0.14);
  var c = (1 - Math.abs(2 * l - 1)) * sa,
    x = c * (1 - Math.abs(((hh / 60) % 2) - 1)),
    m = l - c / 2,
    q =
      hh < 60
        ? [c, x, 0]
        : hh < 120
          ? [x, c, 0]
          : hh < 180
            ? [0, c, x]
            : hh < 240
              ? [0, x, c]
              : hh < 300
                ? [x, 0, c]
                : [c, 0, x];
  return (
    "#" +
    q
      .map(function (v) {
        return ("0" + Math.round((v + m) * 255).toString(16)).slice(-2);
      })
      .join("")
  );
}
function miniBars(o, g) {
  var best = Math.max.apply(
    null,
    o.vs.map(function (x) {
      return x === null ? -Infinity : x;
    }),
  );
  return (
    '<span class="mb">' +
    g
      .map(function (d, i) {
        var v = o.vs[i],
          dc = dcol(d),
          c = v === null ? "#ccc" : dc,
          rk = o.rk[i],
          f = rk ? rk / o.t : 1,
          tier = f <= 0.25 ? "hi" : f > 0.75 ? "lo" : "mid",
          w =
            v === null || v === 0 ? 0 : Math.max(3, (Math.abs(v) / o.mx) * 100);
        return (
          '<span class="mr' +
          (i ? "" : " me") +
          (v === best && v !== 0 ? " top" : "") +
          (v === 0 || v === null ? " nil" : "") +
          '" style="--d:' +
          dc +
          '"><span class="ml" title="' +
          d +
          '">' +
          d +
          '</span><span class="mt"><i style="width:' +
          w +
          "%;--c:" +
          c +
          ";--b:" +
          bcol(c) +
          '"></i></span><span class="mv">' +
          (v === null ? "–" : fmtC(v)) +
          '</span><span class="rk2 ' +
          tier +
          '" title="State rank">' +
          (rk ? "#" + rk : "–") +
          "</span></span>"
        );
      })
      .join("") +
    "</span>"
  );
}
function renderList() {
  var n = S.sel,
    el = $("#pl");
  if (!n || !el) return;
  var q = (S.pf || "").trim().toLowerCase(),
    cm = S.cm,
    g = [n].concat(cm),
    m = (S.ps === "gap" && !cm.length ? "best" : S.ps) || "best",
    all = ALL.filter(function (k) {
      return V(n, k) !== null;
    }),
    a = all
      .filter(function (k) {
        return k.toLowerCase().indexOf(q) >= 0;
      })
      .map(function (k) {
        var vs = g.map(function (d) {
            return V(d, k);
          }),
          f = vs.filter(function (x) {
            return x !== null;
          }),
          mx = Math.max.apply(null, f.map(Math.abs)) || 1;
        return {
          k: k,
          r: rankOf(n, k),
          t: valsOf(k).length,
          tc: tieCount(n, k),
          vs: vs,
          rk: g.map(function (d) {
            return rankOf(d, k);
          }),
          mx: mx,
          g:
            f.length > 1
              ? (Math.max.apply(null, f) - Math.min.apply(null, f)) / mx
              : 0,
        };
      });
  a.sort(function (x, y) {
    return m === "gap"
      ? y.g - x.g || x.k.localeCompare(y.k)
      : m === "az"
        ? x.k.localeCompare(y.k)
        : (m === "worst" ? y.r - x.r : x.r - y.r) || x.k.localeCompare(y.k);
  });
  $("#pfc").textContent =
    "Showing " +
    a.length +
    " of " +
    all.length +
    " indicators" +
    (m === "az"
      ? ""
      : m === "gap"
        ? " · biggest difference between selected districts first"
        : " · #1 = highest value in the state") +
    (cm.length ? " · bars compare " + g.join(", ") : "");
  el.className = "stats" + (cm.length ? " one" : "");
  el.innerHTML = a.length
    ? a
        .map(function (o) {
          var k = o.k,
            q2 = P(k),
            f = o.r / o.t,
            tier = f <= 0.25 ? "hi" : f > 0.75 ? "lo" : "mid",
            pct = o.t > 1 ? (1 - (o.r - 1) / (o.t - 1)) * 100 : 100,
            cur = k === S.ind;
          return (
            '<button class="st ' +
            tier +
            (cur ? " cur" : "") +
            '" aria-pressed="' +
            cur +
            '" data-i="' +
            k.replace(/"/g, "&quot;") +
            '" title="' +
            q2.base +
            '"><small>' +
            q2.base +
            "</small>" +
            (cm.length ? "" : "<b>" + fmtC(V(n, k)) + "</b>") +
            (cm.length
              ? ""
              : "<em>#" + o.r + (o.tc ? "=" : "") + "<span> /" + o.t + "</span></em>") +
            (cm.length
              ? miniBars(o, g)
              : '<span class="rb"><i style="width:' +
                pct.toFixed(0) +
                '%"></i></span>') +
            "</button>"
          );
        })
        .join("")
    : '<div class="nores">No indicators match “' +
      (S.pf || "").replace(/</g, "&lt;") +
      "”</div>";
}
$("#p-district").onclick = function (e) {
  if (e.target.closest("[data-x]")) return clearSel();
  var rm = e.target.closest("[data-rm]");
  if (rm)
    return setCm(
      rm.dataset.rm === "*"
        ? []
        : S.cm.filter(function (x) {
            return x !== rm.dataset.rm;
          }),
    );
  var t = e.target.closest("[data-s]");
  if (t) {
    S.ps = t.dataset.s;
    this.querySelectorAll("[data-s]").forEach(function (x) {
      x.classList.toggle("on", x === t);
    });
    return renderList();
  }
  var b = e.target.closest(".st");
  if (b) setInd(b.dataset.i);
};
$("#p-district").onchange = function (e) {
  if (e.target.id === "cmps" && e.target.value) addCm(e.target.value);
};
$("#p-district").oninput = function (e) {
  if (e.target.id === "pfi") {
    S.pf = e.target.value;
    renderList();
  }
};

function setCm(arr) {
  var old = S.cm;
  S.cm = arr
    .filter(function (x, i) {
      return x !== S.sel && arr.indexOf(x) === i;
    })
    .slice(0, 15);
  old.concat(S.cm).forEach(function (x) {
    LY[x].setStyle(styleFor(x));
  });
  S.cm.forEach(function (x) {
    LY[x].bringToFront();
  });
  if (S.sel) LY[S.sel].bringToFront();
  renderProfile();
  sync();
}
function toggleCm(n) {
  setCm(
    S.cm.indexOf(n) < 0
      ? S.cm.concat(n)
      : S.cm.filter(function (x) {
          return x !== n;
        }),
  );
}
function addCm(n) {
  setCm(S.cm.concat(n));
}
function sync() {
  try {
    var h = [];
    if (S.sel) h.push("d=" + encodeURIComponent(S.sel));
    if (S.cm.length) h.push("c=" + S.cm.map(encodeURIComponent).join(","));
    h.push("i=" + encodeURIComponent(S.ind));
    history.replaceState(null, "", "#" + h.join("&"));
  } catch (e) {}
}
$("#share").onclick = function () {
  var b = this,
    t = b.textContent;
  function ok() {
    b.textContent = "✓ Link copied";
    setTimeout(function () {
      b.textContent = t;
    }, 1500);
  }
  sync();
  try {
    navigator.clipboard.writeText(location.href).then(ok, function () {
      prompt("Copy this link", location.href);
    });
  } catch (e) {
    prompt("Copy this link", location.href);
  }
};
/* ---- table ---- */
function renderTable() {
  var q = $("#flt").value.trim().toLowerCase(),
    mx = S.max || 1;
  var r = names
    .filter(function (n) {
      return n.toLowerCase().indexOf(q) >= 0;
    })
    .map(function (n) {
      return { n: n, v: V(n), r: rankOf(n), t: tieCount(n) };
    });
  r.sort(function (a, b) {
    return S.sk === "n"
      ? S.sd * a.n.localeCompare(b.n)
      : S.sd *
          ((a.v === null ? -Infinity : a.v) - (b.v === null ? -Infinity : b.v));
  });
  $("#tb").innerHTML = r
    .map(function (x) {
      return (
        '<tr data-d="' +
        x.n +
        '" class="' +
        (x.n === S.sel ? "sel" : "") +
        '"><td class="rk">' +
        (x.r ? x.r + (x.t ? "=" : "") : "–") +
        "</td><td>" +
        x.n +
        '</td><td class="vb"><span class="bar" style="width:' +
        (x.v === null ? 0 : Math.max(2, (x.v / mx) * 100)) +
        '%"></span><b>' +
        fmt(x.v) +
        "</b></td></tr>"
      );
    })
    .join("");
}
$("#tb").onclick = function (e) {
  var t = e.target.closest("tr");
  if (t) select(t.dataset.d, true);
};
$("#tb").onmouseover = function (e) {
  var t = e.target.closest("tr");
  if (t && LY[t.dataset.d]) {
    LY[t.dataset.d].setStyle({
      weight: 2.5,
      color: INK,
      opacity: 1,
      fillOpacity: 0.98,
    });
    LY[t.dataset.d].bringToFront();
  }
};
$("#tb").onmouseout = function (e) {
  var t = e.target.closest("tr");
  if (t && LY[t.dataset.d]) {
    LY[t.dataset.d].setStyle(styleFor(t.dataset.d));
    if (S.sel) LY[S.sel].bringToFront();
  }
};
document.querySelectorAll("th").forEach(function (h) {
  h.onclick = function () {
    var k = h.dataset.k;
    if (S.sk === k) S.sd *= -1;
    else {
      S.sk = k;
      S.sd = k === "n" ? 1 : -1;
    }
    renderTable();
  };
});
$("#flt").oninput = renderTable;
$("#csv").onclick = function () {
  var rows = ['District,"' + P(S.ind).base + '"'].concat(
      names.map(function (n) {
        return n + "," + (V(n) === null ? "" : V(n));
      }),
    ),
    a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob([rows.join("\n")], { type: "text/csv" }),
  );
  a.download = P(S.ind).base.replace(/\W+/g, "_") + ".csv";
  a.click();
};

/* ---- search, tools, keys ---- */
var q = $("#q"),
  sg = $("#sg"),
  sgi = -1,
  sgl = [];
function drawSg() {
  sg.innerHTML = sgl
    .map(function (n, i) {
      return (
        '<button class="' +
        (i === sgi ? "on" : "") +
        '" data-d="' +
        n +
        '"><span>' +
        n +
        "</span><em>" +
        fmtC(V(n)) +
        "</em></button>"
      );
    })
    .join("");
  sg.hidden = !sgl.length;
}
function pick(n) {
  q.value = "";
  sgl = [];
  drawSg();
  q.blur();
  select(n, true);
}
q.oninput = function () {
  var t = q.value.trim().toLowerCase();
  sgl = t
    ? names
        .filter(function (n) {
          return n.toLowerCase().indexOf(t) >= 0;
        })
        .slice(0, 6)
    : [];
  sgi = sgl.length ? 0 : -1;
  drawSg();
};
q.onkeydown = function (e) {
  if (e.key === "ArrowDown") {
    sgi = Math.min(sgl.length - 1, sgi + 1);
    drawSg();
    e.preventDefault();
  } else if (e.key === "ArrowUp") {
    sgi = Math.max(0, sgi - 1);
    drawSg();
    e.preventDefault();
  } else if (e.key === "Enter" && sgl[sgi]) pick(sgl[sgi]);
  else if (e.key === "Escape") {
    q.value = "";
    sgl = [];
    drawSg();
    q.blur();
  }
};
sg.onmousedown = function (e) {
  var b = e.target.closest("button");
  if (b) pick(b.dataset.d);
};
q.onblur = function () {
  setTimeout(function () {
    sg.hidden = true;
  }, 150);
};
var LABN = ["Names", "Values", "Off"];
$("#lab").onclick = function () {
  S.lab = (S.lab + 1) % 3;
  this.textContent = "Labels: " + LABN[S.lab];
  drawLabels();
};
$("#reset").onclick = function () {
  clearSel();
  S.cls = null;
  legend();
  names.forEach(function (n) {
    LY[n].setStyle(styleFor(n));
  });
  map.flyToBounds(HOME, { padding: [40, 40], duration: 0.8 });
};
document.addEventListener("keydown", function (e) {
  var t = e.target.tagName;
  if (t === "INPUT" || t === "SELECT") return;
  if (e.key === "/") {
    e.preventDefault();
    q.focus();
  } else if (e.key === "Escape") $("#reset").click();
});

/* ---- v2: KPI ribbon, radar, mix, explorer, tour ---- */
var fmtV = function (v) {
  return Math.abs(v) >= 1000 ? fmtC(v) : fmt(v);
};
var RLAB = {
  "NFHS Composite Index (0-100)": "Composite index",
  "Institutional births (%)": "Institutional births",
  "Children age 12-23 months fully vaccinated based on information from either vaccination card or mother's recall6 (%)": "Full immunization",
  "Children under 5 years who are stunted (height-for-age)12 (%)": "Child stunting",
  "Any modern method2 (%)": "Modern contraceptive use",
  "Mothers who had at least 4 antenatal care visits (%)": "4+ ANC visits",
  "Total unmet need3 (%)": "Unmet need",
  "Women with 10 or more years of schooling (%)": "Women 10+ yrs schooling",
};
var RC = [
  [
    "🏆",
    "NFHS Composite Index (0-100)",
    function (n) {
      return [data[n]["NFHS Composite Index (0-100)"], 1];
    },
  ],
  [
    "🏥",
    "Institutional births (%)",
    function (n) {
      return [data[n]["Institutional births (%)"], 1];
    },
  ],
  [
    "💉",
    "Children age 12-23 months fully vaccinated based on information from either vaccination card or mother's recall6 (%)",
    function (n) {
      return [
        data[n][
          "Children age 12-23 months fully vaccinated based on information from either vaccination card or mother's recall6 (%)"
        ],
        1,
      ];
    },
  ],
  [
    "🧒",
    "Children under 5 years who are stunted (height-for-age)12 (%)",
    function (n) {
      return [
        data[n]["Children under 5 years who are stunted (height-for-age)12 (%)"],
        1,
      ];
    },
    1,
  ],
  [
    "💊",
    "Any modern method2 (%)",
    function (n) {
      return [data[n]["Any modern method2 (%)"], 1];
    },
  ],
  [
    "🤰",
    "Mothers who had at least 4 antenatal care visits (%)",
    function (n) {
      return [
        data[n]["Mothers who had at least 4 antenatal care visits (%)"],
        1,
      ];
    },
  ],
  [
    "⚠️",
    "Total unmet need3 (%)",
    function (n) {
      return [data[n]["Total unmet need3 (%)"], 1];
    },
    1,
  ],
  [
    "🎓",
    "Women with 10 or more years of schooling (%)",
    function (n) {
      return [data[n]["Women with 10 or more years of schooling (%)"], 1];
    },
  ],
];
var RV = RC.map(function (c) {
  var v = {},
    sn = 0,
    sd = 0,
    m = 1;
  names.forEach(function (n) {
    var a = c[2](n);
    m = a[2] || 1;
    if (!(a[0] >= 0) || (a.length > 1 && !(a[1] > 0))) return;
    v[n] = a.length > 1 ? (a[0] / a[1]) * m : a[0];
    sn += a[0];
    sd += a[1] || 0;
  });
  var so = Object.keys(v).sort(function (a, b) {
    return v[a] - v[b];
  });
  return {
    ic: c[0],
    k: c[1],
    v: v,
    inv: c[3],
    dir:
      (typeof META !== "undefined" && META[c[1]] && META[c[1]].direction) ||
      (c[3] ? "lower_better" : "higher_better"),
    st: sd ? (sn / sd) * m : sn,
    so: so,
  };
});
function ribBuild() {
  $("#rib").innerHTML = RV.map(function (r, i) {
    var lo = r.v[r.so[0]],
      hi = r.v[r.so[r.so.length - 1]],
      w = 100 / r.so.length;
    return (
      '<button class="rc" style="--i:' +
      i +
      '" data-k="' +
      r.k +
      '" title="Click to map: ' +
      P(r.k).base +
      '"><div class="rt"><span>' +
      r.ic +
      " " +
      (RLAB[r.k] || P(r.k).base.replace(/ \(.*/, "")) +
      '</span><i>Bihar</i></div><div class="rv"><b class="n">0</b><small>' +
      P(r.k).unit +
      '</small></div><div class="rl"></div><svg class="sp" viewBox="0 0 100 24" preserveAspectRatio="none">' +
      r.so
        .map(function (n, j) {
          var h = 3 + (hi === lo ? 0.5 : (r.v[n] - lo) / (hi - lo)) * 21;
          return (
            '<rect data-d="' +
            n +
            '" x="' +
            (j * w).toFixed(2) +
            '" y="' +
            (24 - h).toFixed(1) +
            '" width="' +
            (w - 0.7).toFixed(2) +
            '" height="' +
            h.toFixed(1) +
            '"><title>' +
            n +
            ": " +
            fmtV(r.v[n]) +
            "</title></rect>"
          );
        })
        .join("") +
      "</svg></button>"
    );
  }).join("");
}
function ribUp() {
  var cs = document.querySelectorAll("#rib .rc");
  if (!cs.length) return;
  RV.forEach(function (r, i) {
    var c = cs[i],
      s = S.sel,
      t = s && r.v[s] !== undefined ? r.v[s] : r.st,
      l = c.querySelector(".rl");
    countTo(c.querySelector(".n"), t, fmtV);
    c.querySelector("i").textContent = s || "Bihar";
    c.classList.toggle("act", r.k === S.ind);
    c.querySelectorAll("rect").forEach(function (x) {
      x.classList.toggle("on", x.dataset.d === s);
    });
    if (s && r.v[s] !== undefined) {
      var d = ((t - r.st) / r.st) * 100;
      if (r.dir === "context") {
        l.className = "rl";
        l.textContent = "context · " + fmtV(t) + " (state " + fmtV(r.st) + ")";
      } else {
        var g = r.inv ? d < 0 : d > 0,
          rk =
            r.so.filter(function (n) {
              return r.inv ? r.v[n] < t : r.v[n] > t;
            }).length + 1;
        l.className = "rl " + (g ? "up" : "dn");
        l.textContent =
          (d >= 0 ? "▲ " : "▼ ") +
          Math.abs(d).toFixed(0) +
          "% vs state · #" +
          rk +
          "/" +
          r.so.length;
      }
    } else {
      if (r.dir === "context") {
        l.className = "rl";
        l.textContent = "State " + fmtV(r.st);
      } else {
        var b = r.inv ? r.so[0] : r.so[r.so.length - 1];
        l.className = "rl";
        l.textContent = "★ Best: " + b;
      }
    }
  });
}

/* stability of the bottom five across alternative index designs */
function stabCard() {
  if (stabCard.d || $("#p-insights").hidden) return;
  stabCard.d = 1;
  var st = stability(),
    ks = Object.keys(st.cnt).sort(function (a, b) {
      return st.cnt[b] - st.cnt[a] || a.localeCompare(b);
    }),
    core = ks.filter(function (k) {
      return st.cnt[k] / st.total >= 0.8;
    }),
    low = st.vars.slice(1).sort(function (a, b) {
      return a.rho - b.rho;
    })[0],
    h = ks
      .map(function (k) {
        return (
          '<button class="stbr" data-d="' +
          k +
          '"><span>' +
          k +
          '</span><div class="stbb"><i style="width:' +
          ((st.cnt[k] / st.total) * 100).toFixed(0) +
          '%"></i></div><em>' +
          st.cnt[k] +
          "/" +
          st.total +
          "</em></button>"
        );
      })
      .join("");
  $("#stbs").textContent = "bottom 5 · " + st.total + " designs";
  h +=
    '<p class="hint2">' +
    (core.length
      ? "<b>" +
        core.join(", ") +
        "</b> " +
        (core.length > 1 ? "stay" : "stays") +
        " in the bottom five under at least 80% of designs; the rest move in and out depending on which indicators are used."
      : "No district stays in the bottom five under most designs, so read the list as indicative only.") +
    " Least agreement with the default: <i>" +
    low.label +
    "</i> (rank correlation " +
    low.rho.toFixed(2) +
    ").</p>" +
    '<details class="stbd"><summary>See each design</summary><table><tr><th>Design</th><th>Bottom five</th><th>ρ</th></tr>' +
    st.vars
      .map(function (v) {
        return (
          "<tr><td>" +
          v.label +
          "</td><td>" +
          v.bottom.join(", ") +
          "</td><td>" +
          v.rho.toFixed(2) +
          "</td></tr>"
        );
      })
      .join("") +
    "</table></details>";
  $("#stb").innerHTML = h;
}
$("#stb").onclick = function (e) {
  var b = e.target.closest("[data-d]");
  if (b) select(b.dataset.d, true);
};

/* sensitivity: live recompute of the index under different scaling / domains */
var SENS = { method: "pct", off: {} };
var sensChart = null;
function sensUpdate() {
  var doms = DOM.filter(function (d, i) {
      return !SENS.off[i];
    }),
    box = $("#sensres");
  if (!box) return;
  if (!doms.length) {
    SENS.b5 = [];
    box.innerHTML = "Include at least one domain.";
    if (S.hl && S.hl.key === "b5") {
      S.hl = null;
      names.forEach(function (n) {
        LY[n].setStyle(styleFor(n));
      });
      if (S.rgn) paintSet(S.rgn.districts, S.rgn.color);
      sensHlState();
    }
    if (sensChart) {
      sensChart.data.labels = [];
      sensChart.data.datasets[0].data = [];
      sensChart.data.datasets[0].backgroundColor = [];
      sensChart.update();
    }
    return;
  }
  var cols = colsFor(names, doms),
    res = scoreSet(cols, doms, SENS.method).idx,
    byN = {};
  names.forEach(function (n, i) {
    byN[n] = res[i];
  });
  var order = names
      .slice()
      .sort(function (a, b) {
        return byN[a] - byN[b] || a.localeCompare(b);
      }),
    b5 = order.slice(0, 5),
    bottom = order.slice(0, 10),
    tierTxt = "";
  if (S.sel && byN[S.sel] !== null) {
    var rk =
      names.filter(function (m) {
        return byN[m] > byN[S.sel];
      }).length + 1;
    tierTxt =
      " · <b>" + S.sel + "</b>: " + TL[tierOfRank(rk, names.length)].toLowerCase() +
      " (rank " + rk + ")";
  }
  SENS.b5 = b5;
  if (S.hl && S.hl.key === "b5") {
    S.hl.districts = b5.slice();
    paintSet(S.hl.districts, S.hl.color);
  }
  box.innerHTML =
    "Bottom five under this design: <b>" +
    b5.join(", ") +
    "</b>" +
    tierTxt +
    ". Bars show the ten lowest-scoring districts; orange marks the bottom five.";
  var labels = bottom.slice().reverse(),
    data = labels.map(function (n) {
      return byN[n];
    }),
    colors = labels.map(function (n) {
      return b5.indexOf(n) >= 0 ? ACC : "#c3d0d8";
    }),
    borders = labels.map(function (n) {
      return b5.indexOf(n) >= 0 ? "#b35f00" : "rgba(43,74,64,.4)";
    });
  if (!sensChart) {
    sensChart = new Chart($("#sensSc"), {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            data: data,
            backgroundColor: colors,
            borderColor: borders,
            borderWidth: 1,
            borderRadius: 5,
          },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400 },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (i) {
                return "index " + fmt(i.raw);
              },
            },
          },
        },
        scales: {
          x: { grid: { color: "#eef3f8" } },
          y: { grid: { display: false } },
        },
        onClick: function (evt, els) {
          if (els && els.length && sensChart) {
            var n = sensChart.data.labels[els[0].index];
            if (n) select(n, true);
          }
        },
      },
    });
  } else {
    sensChart.data.labels = labels;
    sensChart.data.datasets[0].data = data;
    sensChart.data.datasets[0].backgroundColor = colors;
    sensChart.data.datasets[0].borderColor = borders;
    sensChart.update();
  }
}
function sensCard() {
  if ($("#p-insights").hidden) return;
  if (sensCard.d) {
    sensUpdate();
    return;
  }
  sensCard.d = 1;
  $("#sens").innerHTML =
    '<div class="sensrow"><label>Scaling</label><span class="seg" id="sensm">' +
    [
      ["pct", "Percentile"],
      ["z", "Z-score"],
      ["mm", "Min–max"],
    ]
      .map(function (o) {
        return (
          '<button data-m="' +
          o[0] +
          '" class="' +
          (SENS.method === o[0] ? "on" : "") +
          '">' +
          o[1] +
          "</button>"
        );
      })
      .join("") +
    '</span></div><div class="sensrow"><label>Domains</label><div class="chips" id="sensd">' +
    DOM.map(function (d, i) {
      return (
        '<button class="dchip' +
        (SENS.off[i] ? "" : " on") +
        '" data-i="' +
        i +
        '">' +
        d.n +
        "</button>"
      );
    }).join("") +
    '</div></div><div class="sensh"><button class="btn" id="senshl">Highlight bottom five</button></div>' +
    '<p class="hint2" id="sensres"></p>' +
    '<div class="ch" style="height:230px"><canvas id="sensSc" role="img" aria-label="Sensitivity index for lowest-scoring districts"></canvas></div>';
  $("#sensm").onclick = function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    SENS.method = b.dataset.m;
    $("#sensm").querySelectorAll("button").forEach(function (x) {
      x.classList.toggle("on", x === b);
    });
    sensUpdate();
  };
  $("#sensd").onclick = function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    var i = +b.dataset.i;
    SENS.off[i] = !SENS.off[i];
    b.classList.toggle("on", !SENS.off[i]);
    sensUpdate();
  };
  $("#senshl").onclick = function () {
    if (SENS.b5 && SENS.b5.length) highlightSet("b5", SENS.b5.slice(), ACC);
  };
  sensUpdate();
}

/* emerging burden: shown, deliberately not scored */
var NCDM = [
    ["Women · high blood sugar", /^Blood sugar level-high or very high.*\(Women\)$/],
    ["Men · high blood sugar", /^Blood sugar level-high or very high.*\(Men\)$/],
    ["Women · high blood pressure", /^Elevated blood pressure.*Women/],
    ["Men · high blood pressure", /^Elevated blood pressure.*Men/],
    ["Women · overweight or obese", /overweight or obese/],
  ],
  NCDK = [];
function rcorr(k1, k2) {
  var a = [],
    b = [];
  names.forEach(function (n) {
    var x = V(n, k1),
      y = V(n, k2);
    if (x !== null && y !== null) {
      a.push(x);
      b.push(y);
    }
  });
  var m = a.length,
    ma = sumA(a) / m,
    mb = sumA(b) / m,
    s = 0,
    sx = 0,
    sy = 0;
  for (var i = 0; i < m; i++) {
    s += (a[i] - ma) * (b[i] - mb);
    sx += (a[i] - ma) * (a[i] - ma);
    sy += (b[i] - mb) * (b[i] - mb);
  }
  return s / Math.sqrt(sx * sy);
}
function ncdCard() {
  if (ncdCard.d || $("#p-insights").hidden) return;
  ncdCard.d = 1;
  var rows = [],
    r0 = null;
  NCDM.forEach(function (m, i) {
    var k = ALL.filter(function (x) {
      return m[1].test(x);
    })[0];
    if (!k) return;
    NCDK[i] = k;
    var a = names
        .filter(function (n) {
          return V(n, k) !== null;
        })
        .sort(function (x, y) {
          return V(y, k) - V(x, k);
        }),
      avg = sumA(a.map(function (n) { return V(n, k); })) / a.length,
      r = rcorr(k, K_STUNT);
    if (r0 === null) r0 = r;
    rows.push(
      '<div class="nc"><div class="nch"><button class="lk" data-n="' +
        i +
        '"><b>' +
        m[0] +
        "</b></button><span>" +
        fmt(avg) +
        '% district avg</span></div><div class="ncd">Highest: ' +
        a
          .slice(0, 3)
          .map(function (d) {
            return (
              '<button class="lk" data-d="' +
              d +
              '">' +
              d +
              " " +
              fmt(V(d, k)) +
              "%</button>"
            );
          })
          .join(" ") +
        "</div><small>Across districts, versus child stunting: r = " +
        r.toFixed(2) +
        "</small></div>",
    );
  });
  $("#ncd").innerHTML = rows.join("");
  $("#ncdn").textContent =
    "Shown for planning but not scored. " +
    (r0 !== null && r0 < -0.2
      ? "Blood sugar and similar measures tend to be higher where child stunting is lower (r = " +
        r0.toFixed(2) +
        "), so counting them as a deficit would reward districts with worse child nutrition. Treat them as a separate, emerging burden. "
      : "They describe a different kind of burden from the access and nutrition outcomes in the index. ") +
    "District averages are unweighted.";
}
$("#ncd").onclick = function (e) {
  var b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.d) select(b.dataset.d, true);
  else if (b.dataset.n && NCDK[b.dataset.n]) setInd(NCDK[b.dataset.n]);
};
var charts0 = charts;
charts = function () {
  charts0();
  comp();
  drawSc();
  metrics();
  related();
  matrix();
  board();
  priority();
  stabCard();
  sensCard();
  ncdCard();
  region();
};
var rp0 = renderProfile;
renderProfile = function () {
  rp0();
  radar();
};

/* radar */
var rad = null;
function radar() {
  if (rad) {
    rad.destroy();
    rad = null;
  }
  var el = $("#p-district"),
    n = S.sel;
  if (!n || !PIL[n]) return;
  var h = el.querySelector(".hero");
  if (!h) return;
  var K = "NFHS Composite Index (0-100)",
    pl = PIL[n],
    mx = 0,
    mi = 0;
  pl.forEach(function (x, i) {
    if (x > pl[mx]) mx = i;
    if (x < pl[mi]) mi = i;
  });
  var tiI = tierInfo(n),
    tdw = tiedWith(n);
  var gaps = DOM.map(function (d, j) {
      return { n: d.n, gap: 50 - pl[j] };
    }).filter(function (g) {
      return g.gap > 0;
    }),
    totalGap = gaps.reduce(function (a, g) {
      return a + g.gap;
    }, 0),
    gapHTML = "";
  if (gaps.length && totalGap > 0) {
    gapHTML =
      '<h4 class="gdh">Gap to state median (50)</h4><div class="gaps">' +
      gaps
        .slice()
        .sort(function (a, b) {
          return b.gap - a.gap;
        })
        .map(function (g) {
          return (
            '<div class="gap"><span>' +
            g.n +
            "</span><b>−" +
            g.gap.toFixed(0) +
            ' pts</b><i>' +
            ((g.gap / totalGap) * 100).toFixed(0) +
            "% of gap</i></div>"
          );
        })
        .join("") +
      '</div><p class="rdn">Together these add <b>' +
      totalGap.toFixed(0) +
      " points</b> below the state median.</p>";
  } else {
    gapHTML =
      '<p class="rdn">This district is at or above the state median in every domain.</p>';
  }
  h.insertAdjacentHTML(
    "afterend",
    '<div class="card rd"><h3><span>Domain profile</span><span class="sc">' +
      tierChip(n) +
      '</span></h3><div class="dpf">' +
      DOM.map(function (d, j) {
        var s = pl[j];
        return (
          '<div class="dp"><div class="dph"><b>' +
          d.n +
          "</b><span>" +
          d.ind
            .map(function (q) {
              var v = V(n, q[0]);
              return q[2] + " " + (v === null ? "n/a" : fmt(v) + "%");
            })
            .join(" · ") +
          '</span></div><div class="dpt ' +
          (s < 34 ? "lo" : s < 67 ? "md" : "hi") +
          '"><i style="width:' +
          s.toFixed(0) +
          '%"></i><u></u><em>' +
          Math.round(s) +
          "</em></div></div>"
        );
      }).join("") +
      '</div><p class="rdn">Strongest: <b>' +
      PN[mx] +
      "</b> · Needs attention: <b>" +
      PN[mi] +
      '</b><br>Each bar is a 0–100 domain score; the tick marks the state median (50). Domains are shown separately because districts are often weak on different things.</p>' +
      gapHTML +
      '<div class="ch rdc"><canvas id="rad"></canvas></div><p class="rdn"><b>Overall index ' +
      data[n][K] +
      "</b> (equal-weight average of the " +
      PN.length +
      " domains). Plausible rank " +
      tiI.lo +
      "–" +
      tiI.hi +
      " of " +
      names.length +
      "; stays in this tier in " +
      Math.round(tiI.conf * 100) +
      "% of simulations." +
      (tdw.length
        ? "<br>Within 1 point of " + tdw.join(", ") + " (effectively tied)."
        : "") +
      "</p>" +
      whatif(n) +
      "</div>",
  );
  var ds = [n]
    .concat(S.cm)
    .filter(function (x) {
      return PIL[x];
    })
    .map(function (d, i) {
      var c = i ? dcol(d) : ACC;
      return {
        label: d,
        data: PIL[d],
        borderColor: c,
        backgroundColor: c + "33",
        borderWidth: 2,
        pointRadius: 3,
      };
    });
  ds.push({
    label: "State median",
    data: PN.map(function () {
      return 50;
    }),
    borderColor: "#9aa9a2",
    borderDash: [4, 4],
    borderWidth: 1,
    pointRadius: 0,
    backgroundColor: "transparent",
  });
  var rcv = $("#rad");
  rcv.setAttribute("role", "img");
  rcv.setAttribute("aria-label", "Domain profile radar chart");
  rad = new Chart(rcv, {
    type: "radar",
    data: { labels: PN, datasets: ds },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 700 },
      plugins: {
        legend: {
          display: ds.length > 2,
          labels: { boxWidth: 10, font: { size: 10 } },
        },
        tooltip: Object.assign(
          {
            displayColors: true,
            callbacks: {
              label: function (i) {
                return i.dataset.label + ": " + Math.round(i.raw);
              },
            },
          },
          tipBox,
        ),
      },
      scales: {
        r: {
          min: 0,
          max: 100,
          ticks: { display: false, stepSize: 25 },
          grid: { color: "#e2e8ee" },
          angleLines: { color: "#e2e8ee" },
          pointLabels: { font: { size: 11, weight: "700" }, color: "#3d4f5c" },
        },
      },
    },
  });
}

/* family planning + delivery care donuts */
var mixC = null,
  irrC = null;
var CA = [
    ["Female sterilization", "Female sterilization (%)", "#1f7a9c"],
    ["Male sterilization", "Male sterilization (%)", "#e8873a"],
    ["Other modern", "Other modern methods (%)", "#4a94c4"],
    ["Traditional", "Any traditional method (%)", "#9aa9a2"],
  ],
  IA = [
    [
      "Public facility",
      "Institutional births in public facility (%)",
      "#1f7a9c",
    ],
    ["Private facility", "Private facility births (%)", "#e8873a"],
    ["Home", "Home births (%)", "#9aa9a2"],
  ];
function dn(c, id, A) {
  var ns = S.sel ? [S.sel] : names,
    vals = A.map(function (a) {
      var s = 0,
        cnt = 0;
      ns.forEach(function (n) {
        var v = V(n, a[1]);
        if (v !== null) {
          s += v;
          cnt++;
        }
      });
      return cnt ? s / cnt : 0;
    }),
    t = vals.reduce(function (a, b) {
      return a + b;
    }, 0) || 1,
    pct = vals.map(function (v) {
      return (v / t) * 100;
    }),
    title = S.sel ? S.sel : "Bihar (average of districts)";
  if (!c) {
    c = new Chart($(id), {
      type: "bar",
      data: {
        labels: [title],
        datasets: A.map(function (a, i) {
          return {
            label: a[0],
            data: [pct[i]],
            backgroundColor: a[2],
            borderWidth: 1,
            borderColor: "#fff",
            stack: "s",
          };
        }),
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 700 },
        onClick: function (e, el) {
          if (el.length) setInd(A[el[0].datasetIndex][1]);
        },
        plugins: {
          legend: {
            position: "bottom",
            labels: { boxWidth: 9, font: { size: 10 } },
          },
          tooltip: Object.assign(
            {
              callbacks: {
                label: function (i) {
                  return [
                    i.dataset.label + ": " + fmt(c._vals[i.datasetIndex]) + "%",
                    c._pct[i.datasetIndex].toFixed(0) + "% of mix",
                  ];
                },
              },
            },
            tipBox,
          ),
        },
        scales: {
          x: {
            stacked: true,
            min: 0,
            max: 100,
            grid: { color: "#eef3f8" },
            ticks: { callback: function (v) { return v + "%"; } },
          },
          y: { stacked: true, grid: { display: false } },
        },
      },
    });
  } else {
    c.data.labels = [title];
    c.data.datasets = A.map(function (a, i) {
      return {
        label: a[0],
        data: [pct[i]],
        backgroundColor: a[2],
        borderWidth: 1,
        borderColor: "#fff",
        stack: "s",
      };
    });
    c.update();
  }
  c._t = t;
  c._vals = vals;
  c._pct = pct;
  return c;
}
function comp() {
  if ($("#p-insights").hidden) return;
  $("#cmt").textContent = S.sel || "Bihar (average of districts)";
  mixC = dn(mixC, "#cmix", CA);
  irrC = dn(irrC, "#cirr", IA);
}

/* relationship explorer */
var PRE = [
    [
      "💉 Immunization → child nutrition",
      "Children age 12-23 months fully vaccinated based on information from either vaccination card or mother's recall6 (%)",
      "Children under 5 years who are stunted (height-for-age)12 (%)",
    ],
    [
      "🤰 ANC → delivery",
      "Mothers who had at least 4 antenatal care visits (%)",
      "Institutional births (%)",
    ],
    [
      "👰 Child marriage → teen motherhood",
      "Women age 20-24 years married before age 18 years (%)",
      "Women age 15-19 years who were already mothers or pregnant at the time of the survey (%)",
    ],
    [
      "📚 Schooling → internet",
      "Women with 10 or more years of schooling (%)",
      "Women who have ever used the internet (%)",
    ],
    [
      "⚠️ Unmet need → modern use",
      "Total unmet need3 (%)",
      "Any modern method2 (%)",
    ],
  ],
  XS = { x: PRE[0][1], y: PRE[0][2] },
  sc = null,
  hv = null;
(function () {
  var og = {};
  ALL.forEach(function (k) {
    (og[catOf(k)] = og[catOf(k)] || []).push(k);
  });
  var o = Object.keys(og)
    .map(function (g) {
      return (
        '<optgroup label="' +
        g +
        '">' +
        og[g]
          .map(function (k) {
            return '<option value="' + k + '">' + P(k).base + "</option>";
          })
          .join("") +
        "</optgroup>"
      );
    })
    .join("");
  $("#xx").innerHTML = o;
  $("#xy").innerHTML = o;
  $("#xp").innerHTML = PRE.map(function (p, i) {
    return '<button class="pc2" data-i="' + i + '">' + p[0] + "</button>";
  }).join("");
})();
function selSync() {
  $("#xx").value = XS.x;
  $("#xy").value = XS.y;
}
selSync();
function pear(p) {
  var n = p.length,
    mx = 0,
    my = 0,
    sxy = 0,
    sxx = 0,
    syy = 0;
  p.forEach(function (q) {
    mx += q.x / n;
    my += q.y / n;
  });
  p.forEach(function (q) {
    sxy += (q.x - mx) * (q.y - my);
    sxx += Math.pow(q.x - mx, 2);
    syy += Math.pow(q.y - my, 2);
  });
  var b = sxx ? sxy / sxx : 0;
  return {
    r: sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0,
    mx: mx,
    my: my,
    b: b,
    a: my - b * mx,
  };
}
function drawSc() {
  if ($("#p-explore").hidden) return;
  var p = names
      .filter(function (n) {
        return V(n, XS.x) !== null && V(n, XS.y) !== null;
      })
      .map(function (n) {
        return { x: V(n, XS.x), y: V(n, XS.y), n: n };
      }),
    st = pear(p),
    xs = p.map(function (q) {
      return q.x;
    }),
    x0 = Math.min.apply(null, xs),
    x1 = Math.max.apply(null, xs),
    on = function (q) {
      return q.n === S.sel;
    };
  var ds = {
    data: p,
    backgroundColor: p.map(function (q) {
      return on(q) ? ACC : colorOf(V(q.n));
    }),
    borderColor: p.map(function (q) {
      return on(q) ? "#b35f00" : "#2b4a5c";
    }),
    borderWidth: p.map(function (q) {
      return on(q) ? 3 : 1;
    }),
    pointRadius: p.map(function (q) {
      return on(q) ? 12 : 5;
    }),
    pointHoverRadius: 13,
  };
  if (!sc) {
    sc = new Chart($("#sc"), {
      type: "scatter",
      data: { datasets: [ds] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 500 },
        onClick: function (e, el) {
          if (el.length) {
            select(sc.data.datasets[0].data[el[0].index].n, true);
            tab("explore");
          }
        },
        onHover: function (e, el) {
          var n = el.length ? sc.data.datasets[0].data[el[0].index].n : null;
          if (n !== hv) {
            if (hv) hoverOff(hv);
            hv = n;
            if (n) hoverOn(n);
          }
          e.native.target.style.cursor = n ? "pointer" : "default";
        },
        plugins: {
          legend: { display: false },
          tooltip: Object.assign(
            {
              callbacks: {
                title: function (i) {
                  return i[0].raw.n;
                },
                label: function (i) {
                  return [
                    P(XS.x).base + ": " + fmt(i.raw.x),
                    P(XS.y).base + ": " + fmt(i.raw.y),
                  ];
                },
              },
            },
            tipBox,
          ),
        },
        scales: {
          x: {
            title: {
              display: true,
              text: "",
              font: { size: 11, weight: "700" },
            },
            grid: { color: "#eef3f8" },
            ticks: {
              callback: function (v) {
                return fmtC(v);
              },
            },
          },
          y: {
            title: {
              display: true,
              text: "",
              font: { size: 11, weight: "700" },
            },
            grid: { color: "#eef3f8" },
            ticks: {
              callback: function (v) {
                return fmtC(v);
              },
            },
          },
        },
      },
      plugins: [
        {
          id: "ref",
          afterDatasetsDraw: function (ch) {
            var m = ch._m;
            if (!m) return;
            var c = ch.ctx,
              X = ch.scales.x,
              Y = ch.scales.y,
              A = ch.chartArea;
            c.save();
            c.setLineDash([5, 4]);
            c.strokeStyle = "rgba(12,29,24,.25)";
            c.beginPath();
            c.moveTo(X.getPixelForValue(m.mx), A.top);
            c.lineTo(X.getPixelForValue(m.mx), A.bottom);
            c.moveTo(A.left, Y.getPixelForValue(m.my));
            c.lineTo(A.right, Y.getPixelForValue(m.my));
            c.stroke();
            c.setLineDash([]);
            c.strokeStyle = ACC;
            c.lineWidth = 2.5;
            c.beginPath();
            c.moveTo(
              X.getPixelForValue(m.x0),
              Y.getPixelForValue(m.a + m.b * m.x0),
            );
            c.lineTo(
              X.getPixelForValue(m.x1),
              Y.getPixelForValue(m.a + m.b * m.x1),
            );
            c.stroke();
            c.restore();
          },
        },
      ],
    });
  } else sc.data.datasets[0] = ds;
  st.x0 = x0;
  st.x1 = x1;
  sc._m = st;
  sc.options.scales.x.title.text = XS.x;
  sc.options.scales.y.title.text = XS.y;
  sc.update();
  var a = Math.abs(st.r),
    w =
      a > 0.7 ? "Strong" : a > 0.4 ? "Moderate" : a > 0.2 ? "Weak" : "No clear",
    dir = st.r > 0 ? "positive" : "negative",
    rs = p
      .map(function (q) {
        return { n: q.n, e: q.y - (st.a + st.b * q.x) };
      })
      .sort(function (u, v) {
        return v.e - u.e;
      }),
    hi = rs[0],
    lo = rs[rs.length - 1];
  $("#xn").innerHTML =
    '<div class="rr"><b>r = ' +
    st.r.toFixed(2) +
    "</b><span>" +
    w +
    (a > 0.2 ? " " + dir : "") +
    " relationship · " +
    p.length +
    " districts</span></div>" +
    (a > 0.2
      ? "<p>Districts with higher <b>" +
        P(XS.x).base +
        "</b> tend to have " +
        (st.r > 0 ? "higher" : "lower") +
        " <b>" +
        P(XS.y).base +
        "</b>.</p>"
      : "") +
    '<p>Beats the trend: <button class="lk" data-d="' +
    hi.n +
    '">' +
    hi.n +
    '</button> Lags the trend: <button class="lk" data-d="' +
    lo.n +
    '">' +
    lo.n +
    '</button></p><p style="color:var(--mut);font-size:11px">Colour = current map indicator · dashed = state means · orange line = trend</p>';
}
$("#xx").onchange = function () {
  XS.x = this.value;
  drawSc();
};
$("#xy").onchange = function () {
  XS.y = this.value;
  drawSc();
};
$("#p-explore").onclick = function (e) {
  var b = e.target.closest(".pc2");
  if (b) {
    XS.x = PRE[b.dataset.i][1];
    XS.y = PRE[b.dataset.i][2];
    selSync();
    return drawSc();
  }
  if (e.target.closest("#xsw")) {
    var t = XS.x;
    XS.x = XS.y;
    XS.y = t;
    selSync();
    return drawSc();
  }
  var l = e.target.closest(".lk");
  if (l) {
    select(l.dataset.d, true);
    tab("explore");
  }
};

/* mobile: floating jump button + touch-friendly map panning */
var fab = $("#fab"),
  MQ = window.matchMedia("(max-width:1100px)");
function fabUp() {
  var t = document.querySelector(".side").getBoundingClientRect().top,
    dn = t > innerHeight * 0.6;
  fab.classList.toggle("show", MQ.matches && (dn ? !!S.sel : true));
  fab.textContent = dn ? "📊 " + (S.sel || "Details") + " ↓" : "↑ Back to map";
  fab.dataset.dir = dn ? "d" : "u";
}
fab.onclick = function () {
  document
    .querySelector(fab.dataset.dir === "d" ? ".side" : ".stage")
    .scrollIntoView({ behavior: "smooth" });
};
addEventListener("scroll", fabUp, { passive: true });
var sync1 = sync;
sync = function () {
  sync1();
  fabUp();
};
function dragRule() {
  if (MQ.matches && map.getZoom() <= map.getBoundsZoom(HOME) + 0.3)
    map.dragging.disable();
  else map.dragging.enable();
}
map.on("zoomend moveend", dragRule);
MQ.addEventListener ? MQ.addEventListener("change", dragRule) : 0;
dragRule();
fabUp();
if (innerWidth <= 560) {
  S.lab = 2;
  $("#lab").textContent = "Labels: " + LABN[2];
  drawLabels();
}

/* insights: statistical profile, relationships, correlation matrix */
function qn(v, p) {
  var i = (v.length - 1) * p,
    f = Math.floor(i);
  return v[f] + (v[Math.min(f + 1, v.length - 1)] - v[f]) * (i - f);
}
function metrics() {
  if ($("#p-insights").hidden || S.vs.length < 4) return;
  var v = S.vs.slice().sort(function (a, b) {
      return a - b;
    }),
    n = v.length,
    sum = v.reduce(function (a, b) {
      return a + b;
    }, 0),
    mean = sum / n,
    sd = Math.sqrt(
      v.reduce(function (a, x) {
        return a + (x - mean) * (x - mean);
      }, 0) /
        (n - 1),
    ),
    q1 = qn(v, 0.25),
    q3 = qn(v, 0.75),
    iqr = q3 - q1,
    out = names.filter(function (x) {
      var y = V(x);
      return y !== null && (y < q1 - 1.5 * iqr || y > q3 + 1.5 * iqr);
    }),
    g = null,
    t5 = v.slice(-5).reduce(function (a, b) {
      return a + b;
    }, 0);
  if (v[0] >= 0 && sum > 0) {
    var a = 0;
    for (var i = 0; i < n; i++) a += (2 * (i + 1) - n - 1) * v[i];
    g = a / (n * sum);
  }
  var hi = null,
    lo = null;
  names.forEach(function (x) {
    var y = V(x);
    if (y === null) return;
    if (!hi || y > hi.v) hi = { n: x, v: y };
    if (!lo || y < lo.v) lo = { n: x, v: y };
  });
  var cv = mean ? (sd / Math.abs(mean)) * 100 : 0,
    plain = [];
  if (hi && lo && lo.v > 0) {
    plain.push(
      "<b>" +
        hi.n +
        "</b> has the highest value, <b>" +
        fmt(hi.v / lo.v) +
        "×</b> the lowest (<b>" +
        lo.n +
        "</b>, " +
        fmt(lo.v) +
        ").",
    );
  } else if (hi && lo) {
    plain.push(
      "Values span <b>" + fmt(lo.v) + "</b> to <b>" + fmt(hi.v) + "</b>.",
    );
  }
  plain.push(
    "The middle half of districts sit between <b>" +
      fmt(q1) +
      "</b> and <b>" +
      fmt(q3) +
      "</b>.",
  );
  plain.push(
    "Districts differ by <b>" +
      (mean ? fmt(cv) + "%" : "-") +
      "</b> around the average — higher means more unequal.",
  );
  var T = [
    [
      "Variation (CV)",
      mean ? fmt((sd / Math.abs(mean)) * 100) + "%" : "-",
      "Std dev as % of mean; higher = districts differ more",
    ],
    ["Std deviation", fmtV(sd), "Typical gap from the state mean"],
    [
      "Middle 50% (IQR)",
      fmtV(q1) + " – " + fmtV(q3),
      "Half of all districts fall in this band",
    ],
    [
      "Inequality (Gini)",
      g === null ? "-" : g.toFixed(2),
      "0 = perfectly even, 1 = one district has it all",
    ],
    isAdd(S.ind) && sum > 0
      ? [
          "Top-5 share",
          fmt((t5 / sum) * 100) + "%",
          "Share of the state total held by 5 districts",
        ]
      : [
          "Best ÷ worst",
          v[0] > 0 ? fmt(v[n - 1] / v[0]) + "×" : "-",
          "Highest vs lowest district",
        ],
    [
      "Outliers",
      out.length ? String(out.length) : "None",
      out.length
        ? out.slice(0, 3).join(", ") + (out.length > 3 ? "…" : "")
        : "None beyond 1.5 × IQR",
    ],
  ];
  $("#kn").textContent = P(S.ind).base;
  $("#ktp").innerHTML = plain
    .map(function (s) {
      return "<p>" + s + "</p>";
    })
    .join("");
  $("#kts").innerHTML = T.map(function (t) {
    return (
      '<div class="kt"><small>' +
      t[0] +
      "</small><b>" +
      t[1] +
      "</b><i>" +
      t[2] +
      "</i></div>"
    );
  }).join("");
}
function related() {
  if ($("#p-insights").hidden) return;
  var base = S.ind,
    res = [];
  ALL.forEach(function (k) {
    if (k === base) return;
    var p = [];
    names.forEach(function (n) {
      var x = V(n, base),
        y = V(n, k);
      if (x !== null && y !== null) p.push({ x: x, y: y });
    });
    if (p.length < 30) return;
    var r = pear(p).r;
    if (isNaN(r) || Math.abs(r) > 0.97) return;
    res.push([k, r]);
  });
  var pos = res
      .filter(function (a) {
        return a[1] > 0;
      })
      .sort(function (a, b) {
        return b[1] - a[1];
      })
      .slice(0, 4),
    neg = res
      .filter(function (a) {
        return a[1] < 0;
      })
      .sort(function (a, b) {
        return a[1] - b[1];
      })
      .slice(0, 4);
  function row(a) {
    var c = a[1] > 0 ? "#1f7a9c" : "#d9480f";
    return (
      '<button class="rx1" data-k="' +
      a[0] +
      '" title="' +
      P(a[0]).base +
      '"><span class="n">' +
      P(a[0]).base +
      '</span><span class="bar"><i style="width:' +
      Math.round(Math.abs(a[1]) * 100) +
      "%;background:" +
      c +
      '"></i></span><b style="color:' +
      c +
      '">' +
      (a[1] > 0 ? "+" : "") +
      a[1].toFixed(2) +
      "</b></button>"
    );
  }
  $("#rx").innerHTML =
    '<div class="rxh">Rises together</div>' +
    (pos.map(row).join("") || '<p class="hint2">None found</p>') +
    '<div class="rxh">Moves the opposite way</div>' +
    (neg.map(row).join("") || '<p class="hint2">None found</p>');
  $("#rxn").textContent =
    "Tap a row to plot it in Explore. Correlation is not causation" +
    (isAdd(S.ind)
      ? "; totals mostly move with district size, so per-hectare or % indicators give cleaner links."
      : ".");
}
$("#rx").onclick = function (e) {
  var b = e.target.closest(".rx1");
  if (!b) return;
  XS.x = S.ind;
  XS.y = b.dataset.k;
  selSync();
  tab("explore");
};
var MK = [
    ["Index", "NFHS Composite Index (0-100)"],
    ["Institutional births", "Institutional births (%)"],
    ["4+ ANC", "Mothers who had at least 4 antenatal care visits (%)"],
    ["Full immunization", "Children age 12-23 months fully vaccinated based on information from either vaccination card or mother's recall6 (%)"],
    ["Modern method", "Any modern method2 (%)"],
    ["Unmet need", "Total unmet need3 (%)"],
    ["Stunting", "Children under 5 years who are stunted (height-for-age)12 (%)"],
    ["Women 10+ schooling", "Women with 10 or more years of schooling (%)"],
    ["Women internet", "Women who have ever used the internet (%)"],
    ["Public births", "Institutional births in public facility (%)"],
  ].filter(function (a) {
    return ALL.indexOf(a[1]) >= 0 && !NEAR_CONSTANT[a[1]];
  }),
  corrMethod = "spearman",
  corrCache = {};
function corrOf(k1, k2, method) {
  var xs = [],
    ys = [];
  names.forEach(function (n) {
    var x = V(n, k1),
      y = V(n, k2);
    if (x !== null && y !== null) {
      xs.push(x);
      ys.push(y);
    }
  });
  if (xs.length <= 8) return null;
  if (method === "pearson") {
    var p = xs.map(function (x, i) {
      return { x: x, y: ys[i] };
    });
    return pear(p).r;
  }
  return spearman(xs, ys);
}
function matrix() {
  if ($("#p-insights").hidden) return;
  var CM = corrCache[corrMethod];
  if (!CM) {
    CM = MK.map(function (a) {
      return MK.map(function (b) {
        if (a === b) return 1;
        return corrOf(a[1], b[1], corrMethod);
      });
    });
    corrCache[corrMethod] = CM;
  }
  $("#cx").innerHTML =
    "<tr><th></th>" +
    MK.map(function (b) {
      return (
        '<th class="cv" data-k="' + b[1] + '"><span>' + b[0] + "</span></th>"
      );
    }).join("") +
    "</tr>" +
    MK.map(function (a, i) {
      return (
        '<tr><th class="rh" data-k="' +
        a[1] +
        '">' +
        a[0] +
        "</th>" +
        MK.map(function (b, j) {
          var r = CM[i][j];
          if (r === null) return "<td>-</td>";
          var m = Math.abs(r),
            bg =
              i === j
                ? "#e8eef2"
                : (r > 0 ? "rgba(31,122,156," : "rgba(217,72,15,") +
                  (0.1 + 0.82 * m) +
                  ")";
          return (
            '<td data-i="' +
            i +
            '" data-j="' +
            j +
            '" class="' +
            (m < 0.32 && i !== j ? "ns" : "") +
            '" style="background:' +
            bg +
            ";color:" +
            (m > 0.55 && i !== j ? "#fff" : "#15242e") +
            '" title="' +
            a[0] +
            " vs " +
            b[0] +
            ": r = " +
            r.toFixed(2) +
            '">' +
            (i === j
              ? "•"
              : r.toFixed(2).replace("0.", ".").replace("-0.", "-.")) +
            "</td>"
          );
        }).join("") +
        "</tr>"
      );
    }).join("");
  document.querySelectorAll("#cx th[data-k]").forEach(function (t) {
    t.classList.toggle("cur", t.dataset.k === S.ind);
  });
}
$("#cmode").onclick = function (e) {
  var b = e.target.closest("button");
  if (!b) return;
  corrMethod = b.dataset.m;
  this.querySelectorAll("button").forEach(function (x) {
    x.classList.toggle("on", x === b);
  });
  matrix();
};
$("#cx").onclick = function (e) {
  var c = e.target.closest("td[data-i]");
  if (!c || c.dataset.i === c.dataset.j) return;
  XS.x = MK[c.dataset.i][1];
  XS.y = MK[c.dataset.j][1];
  selSync();
  tab("explore");
};

/* review additions: scoreboard, priority districts, regional view, what-if */
var PKM = [
    ["Child stunting", K_STUNT, -1, "%", 0],
    ["Child wasting", K_WAST, -1, "%", 0],
    ["4+ ANC visits", K_ANC, 1, "%", 1],
    ["Institutional births", K_INST, 1, "%", 1],
    ["Full immunization", K_VAC, 1, "%", 2],
    ["Unmet need for family planning", K_UNM, -1, "%", 3],
    ["Women with 10+ yrs schooling", K_W10, 1, "%", 4],
  ],
  NORTH = [
    "Araria",
    "Begusarai",
    "Darbhanga",
    "Gopalganj",
    "Katihar",
    "Khagaria",
    "Kishanganj",
    "Madhepura",
    "Madhubani",
    "Muzaffarpur",
    "Pashchim Champaran",
    "Purbi Champaran",
    "Purnia",
    "Saharsa",
    "Samastipur",
    "Saran",
    "Sheohar",
    "Sitamarhi",
    "Siwan",
    "Supaul",
    "Vaishali",
  ],
  IXK = "NFHS Composite Index (0-100)",
  sumA = function (a) {
    return a.reduce(function (x, y) {
      return x + y;
    }, 0);
  };
function idx(n) {
  return data[n][IXK];
}
function board() {
  if (board.d || $("#p-insights").hidden) return;
  board.d = 1;
  var rows = PKM.map(function (p) {
      var rv = RV.filter(function (r) {
          return r.k === p[1];
        })[0],
        ns = names
          .filter(function (n) {
            return V(n, p[1]) !== null;
          })
          .sort(function (a, b) {
            return (V(b, p[1]) - V(a, p[1])) * p[2];
          }),
        vs = ns.map(function (n) {
          return V(n, p[1]);
        }),
        st = rv ? rv.st : sumA(vs) / vs.length,
        b = ns[0],
        w = ns[ns.length - 1],
        bv = V(b, p[1]),
        wv = V(w, p[1]);
      return {
        p: p,
        st: st,
        b: b,
        w: w,
        bv: bv,
        wv: wv,
        h: p[2] > 0 ? ((bv - st) / bv) * 100 : ((st - bv) / st) * 100,
        f: Math.max(0, Math.min(1, (st - wv) / (bv - wv))),
      };
    }).sort(function (a, b) {
      return b.h - a.h;
    }),
    F = function (x, p) {
      return (x >= 1000 ? fmtC(x) : fmt(x)) + p[3];
    };
  $("#psb").innerHTML = rows
    .map(function (r) {
      return (
        '<div class="psr"><div class="psh"><b>' +
        r.p[0] +
        ' <small class="dmt">' +
        PN[r.p[4]] +
        "</small></b><span>State " +
        F(r.st, r.p) +
        " · " +
        r.h.toFixed(0) +
        '% from best</span></div><div class="pst"><i style="left:' +
        (r.f * 100).toFixed(1) +
        '%"></i></div><div class="pll"><span>Weakest <button class="lk" data-d="' +
        r.w +
        '">' +
        r.w +
        "</button> " +
        F(r.wv, r.p) +
        '</span><span>Best <button class="lk" data-d="' +
        r.b +
        '">' +
        r.b +
        "</button> " +
        F(r.bv, r.p) +
        "</span></div></div>"
      );
    })
    .join("");
}
$("#psb").onclick = function (e) {
  var b = e.target.closest(".lk");
  if (b) select(b.dataset.d, true);
};
function priority() {
  if (priority.d || $("#p-insights").hidden) return;
  priority.d = 1;
  var st = stability();
  $("#pri").innerHTML = names
    .slice()
    .sort(function (a, b) {
      return idx(a) - idx(b);
    })
    .slice(0, 5)
    .map(function (n) {
      var pl = PIL[n],
        j = pl.indexOf(Math.min.apply(null, pl)),
        tw = tiedWith(n);
      return (
        '<button class="wl" data-d="' +
        n +
        '"><span class="a"><b>' +
        n +
        "</b><em>Index " +
        idx(n) +
        '</em></span><span class="b">' +
        tierChip(n) +
        ' <span class="stn">bottom 5 in ' +
        (st.cnt[n] || 0) +
        "/" +
        st.total +
        " methods</span>" +
        (tw.length
          ? '<br><span class="stn">≈ tied with ' + tw.join(", ") + "</span>"
          : "") +
        "<br>Weakest domain: <b>" +
        PN[j] +
        "</b> (score " +
        Math.round(pl[j]) +
        "). Lifting it to the state median adds about <b>+" +
        ((50 - pl[j]) / PN.length).toFixed(1) +
        "</b> index points.</span></button>"
      );
    })
    .join("");
}
$("#pri").onclick = function (e) {
  var b = e.target.closest(".wl");
  if (b) select(b.dataset.d, true);
};
var rgC = null;
function region() {
  if ($("#p-insights").hidden) return;
  if (
    typeof REGIONS_ENABLED !== "undefined" &&
    REGIONS_ENABLED &&
    typeof REGIONS !== "undefined" &&
    REGIONS.some(function (r) {
      return r.districts.length;
    })
  ) {
    return regionGrouped();
  }
  var R = [
      [
        "North of Ganga",
        names.filter(function (n) {
          return NORTH.indexOf(n) >= 0;
        }),
        "#3b9ae1",
      ],
      [
        "South of Ganga",
        names.filter(function (n) {
          return NORTH.indexOf(n) < 0;
        }),
        "#e8873a",
      ],
    ],
    add = isAdd(S.ind),
    tot = sumA(S.vs),
    pv = [];
  $("#rgs").innerHTML = R.map(function (r) {
    var v = r[1]
        .map(function (n) {
          return V(n);
        })
        .filter(function (x) {
          return x !== null;
        }),
      sm = sumA(v),
      val = add ? sm : sm / (v.length || 1),
      ix = sumA(r[1].map(idx)) / r[1].length;
    pv.push(
      r[1].reduce(
        function (a, n) {
          return a.map(function (x, i) {
            return x + PIL[n][i] / r[1].length;
          });
        },
        PN.map(function () {
          return 0;
        }),
      ),
    );
    return (
      '<div class="rgt" style="border-top:3px solid ' +
      r[2] +
      '"><small>' +
      r[0] +
      " · " +
      r[1].length +
      "</small><b>" +
      (v.length ? fmtV(val) : "-") +
      "</b><i>" +
      (add
        ? "Total · " + (tot ? fmt((sm / tot) * 100) : 0) + "% of state"
        : "Average") +
      " · Index " +
      ix.toFixed(1) +
      "</i></div>"
    );
  }).join("");
  var g = pv[0].map(function (x, i) {
      return pv[1][i] - x;
    }),
    k = g.reduce(function (a, x, i) {
      return Math.abs(x) > Math.abs(g[a]) ? i : a;
    }, 0);
  $("#rgn").textContent =
    "Pillar scores (percentile). Biggest gap: " +
    PN[k] +
    ", where the " +
    (g[k] > 0 ? "South" : "North") +
    " leads by " +
    Math.abs(g[k]).toFixed(0) +
    " points.";
  if (!rgC) {
    rgC = new Chart($("#reg"), {
      type: "radar",
      data: {
        labels: PN,
        datasets: R.map(function (r, i) {
          return {
            label: r[0],
            data: pv[i],
            borderColor: r[2],
            backgroundColor: r[2] + "33",
            borderWidth: 2,
            pointRadius: 3,
          };
        }),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 700 },
        plugins: {
          legend: { labels: { boxWidth: 10, font: { size: 10 } } },
          tooltip: Object.assign(
            {
              displayColors: true,
              callbacks: {
                label: function (i) {
                  return i.dataset.label + ": " + Math.round(i.raw);
                },
              },
            },
            tipBox,
          ),
        },
        scales: {
          r: {
            min: 0,
            max: 100,
            ticks: { display: false, stepSize: 25 },
            grid: { color: "#e2e8ee" },
            angleLines: { color: "#e2e8ee" },
            pointLabels: {
              font: { size: 11, weight: "700" },
              color: "#3d4f5c",
            },
          },
        },
      },
    });
  }
}
/* Map highlight helpers — isolate a set of districts, dimming the rest.
   Used by the regional comparison to highlight a region's districts. */
function memberStyle(n, color) {
  return {
    fillColor: colorOf(V(n)),
    fillOpacity: 0.92,
    weight: 3,
    color: color,
    opacity: 1,
    dashArray: null,
  };
}
function dimStyle(n) {
  return {
    fillColor: colorOf(V(n)),
    fillOpacity: 0.12,
    weight: 0.6,
    color: "#2b4a5c",
    opacity: 0.35,
    dashArray: null,
  };
}
function paintSet(districts, color) {
  names.forEach(function (n) {
    LY[n].setStyle(
      districts.indexOf(n) >= 0 ? memberStyle(n, color) : dimStyle(n),
    );
  });
  districts.forEach(function (n) {
    LY[n].bringToFront();
  });
}
function flyToSet(districts) {
  var b = L.latLngBounds([]);
  districts.forEach(function (n) {
    b.extend(LY[n].getBounds());
  });
  map.flyToBounds(b, { padding: [60, 60], maxZoom: 8, duration: 0.8 });
}
function regionRowState() {
  document.querySelectorAll("#rgs .rgt").forEach(function (el, i) {
    el.classList.toggle("on", REGIONS[i] === S.rgn);
  });
}
function sensHlState() {
  var b = $("#senshl");
  if (b) b.classList.toggle("on", !!S.hl);
}
function clearMapHighlight() {
  S.rgn = null;
  S.hl = null;
  names.forEach(function (n) {
    LY[n].setStyle(styleFor(n));
  });
  if (S.sel && LY[S.sel]) LY[S.sel].bringToFront();
  regionRowState();
  sensHlState();
}
function highlightRegion(i) {
  var r = REGIONS[i];
  if (!r || !r.districts.length) return;
  if (S.rgn === r) {
    clearMapHighlight();
    return;
  }
  S.rgn = r;
  S.hl = null;
  paintSet(r.districts, r.color);
  flyToSet(r.districts);
  regionRowState();
  sensHlState();
}
function highlightSet(key, districts, color) {
  if (S.hl && S.hl.key === key) {
    clearMapHighlight();
    return;
  }
  S.hl = { key: key, districts: districts, color: color };
  S.rgn = null;
  paintSet(districts, color);
  flyToSet(districts);
  regionRowState();
  sensHlState();
}
/* Regional grouped bars — enabled only when REGIONS_ENABLED and REGIONS have
   district assignments. Shows mean, n and range per region for the selected
   indicator. */
var rgC2 = null;
function regionGrouped() {
  var rows = [];
  REGIONS.forEach(function (r) {
    var vs = r.districts
      .map(function (n) {
        return V(n);
      })
      .filter(function (x) {
        return x !== null;
      }),
      mean = vs.length ? sumA(vs) / vs.length : null,
      mn = vs.length ? Math.min.apply(null, vs) : null,
      mx = vs.length ? Math.max.apply(null, vs) : null;
    rows.push({ name: r.name, color: r.color, n: vs.length, mean: mean, mn: mn, mx: mx });
  });
  $("#rgs").innerHTML = rows
    .map(function (r, i) {
      return (
        '<div class="rgt' +
        (S.rgn === REGIONS[i] ? " on" : "") +
        '" data-r="' +
        i +
        '" style="border-top:3px solid ' +
        r.color +
        '" title="Highlight ' +
        r.name +
        ' on the map"><small>' +
        r.name +
        " · " +
        r.n +
        " districts</small><b>" +
        (r.mean === null ? "-" : fmtV(r.mean)) +
        "</b><i>" +
        (r.mean === null ? "no data" : "range " + fmtV(r.mn) + " – " + fmtV(r.mx)) +
        "</i></div>"
      );
    })
    .join("");
  $("#rgn").textContent =
    "Grouped by region for " +
    P(S.ind).base +
    ". Bars show each region's mean; the lowest–highest district range is shown above. Click a region to highlight its districts on the map.";
  var labels = rows.map(function (r) {
      return r.name;
    }),
    means = rows.map(function (r) {
      return r.mean;
    }),
    colors = rows.map(function (r) {
      return r.color;
    });
  if (!rgC2) {
    rgC2 = new Chart($("#reg"), {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          { data: means, backgroundColor: colors, borderWidth: 1, borderRadius: 5 },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 700 },
        plugins: {
          legend: { display: false },
          tooltip: Object.assign(
            {
              callbacks: {
                label: function (i) {
                  return fmt(i.raw);
                },
              },
            },
            tipBox,
          ),
        },
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: "#eef3f8" },
            ticks: { callback: function (v) { return fmtC(v); } },
          },
          y: { grid: { display: false } },
        },
      },
    });
  } else {
    rgC2.data.labels = labels;
    rgC2.data.datasets[0].data = means;
    rgC2.data.datasets[0].backgroundColor = colors;
    rgC2.update();
  }
}
$("#rgs").onclick = function (e) {
  var el = e.target.closest(".rgt");
  if (el && el.dataset.r !== undefined) highlightRegion(+el.dataset.r);
};
function whatif(n) {
  var pl = PIL[n],
    ws = pl
      .map(function (x, i) {
        return [x, i];
      })
      .sort(function (a, b) {
        return a[0] - b[0];
      })
      .slice(0, 2)
      .filter(function (a) {
        return a[0] < 50;
      }),
    ix = idx(n),
    h = "";
  if (ws.length) {
    var up = ws.reduce(function (a, q) {
        return a + (50 - q[0]) / PN.length;
      }, 0),
      nw = ix + up,
      rk =
        names.filter(function (m) {
          return m !== n && idx(m) > nw;
        }).length + 1;
    h +=
      '<p class="rdn"><b>What-if:</b> lifting ' +
      ws
        .map(function (q) {
          return PN[q[1]];
        })
        .join(" and ") +
      " to the state median would add about <b>+" +
      up.toFixed(1) +
      "</b> points (index " +
      ix +
      " → " +
      nw.toFixed(1) +
      ", " +
      tierInfo(n).label.toLowerCase() +
      " → " +
      TL[tierOfRank(rk, names.length)].toLowerCase() +
      ").</p>";
  }
  var pe = names
    .filter(function (m) {
      return m !== n;
    })
    .map(function (m) {
      return [
        m,
        Math.sqrt(
          PIL[m].reduce(function (a, x, i) {
            return a + (x - pl[i]) * (x - pl[i]);
          }, 0),
        ),
      ];
    })
    .sort(function (a, b) {
      return a[0] === b[0] ? 0 : a[1] - b[1];
    })
    .slice(0, 3);
  return (
    h +
    '<p class="rdn">Most similar profile: ' +
    pe
      .map(function (q) {
        return (
          '<button class="lk" data-peer="' + q[0] + '">' + q[0] + "</button>"
        );
      })
      .join("") +
    ' <span style="font-size:11px">tap to overlay on the radar</span></p>'
  );
}
$("#p-district").addEventListener("click", function (e) {
  var b = e.target.closest("[data-peer]");
  if (b) addCm(b.dataset.peer);
});

/* officers' toolkit: screening, about */
var SCR = null,
  RULES = [],
  OPTS = "",
  SOP = [
    ["q4", "is in the top quartile"],
    ["q1", "is in the bottom quartile"],
    ["ab", "is above state average"],
    ["be", "is below state average"],
    ["ge", "is at least…"],
    ["le", "is at most…"],
  ];
(function () {
  var og = {};
  ALL.forEach(function (k) {
    (og[catOf(k)] = og[catOf(k)] || []).push(k);
  });
  OPTS = Object.keys(og)
    .map(function (g) {
      return (
        '<optgroup label="' +
        g +
        '">' +
        og[g]
          .map(function (k) {
            return '<option value="' + k + '">' + P(k).base + "</option>";
          })
          .join("") +
        "</optgroup>"
      );
    })
    .join("");
})();
var PRS = [
  ["⚠️ High unmet need", [["Total unmet need3 (%)", "q4"]]],
  [
    "🍼 High child stunting",
    [["Children under 5 years who are stunted (height-for-age)12 (%)", "q4"]],
  ],
  [
    "🏥 Low institutional births",
    [["Institutional births (%)", "q1"]],
  ],
  [
    "💉 Low immunization",
    [["Children age 12-23 months fully vaccinated based on information from either vaccination card or mother's recall6 (%)", "q1"]],
  ],
  [
    "👰 High child marriage",
    [["Women age 20-24 years married before age 18 years (%)", "q4"]],
  ],
];
$("#scp").innerHTML = PRS.map(function (p, i) {
  return '<button class="pc2" data-p="' + i + '">' + p[0] + "</button>";
}).join("");
function rulesUI() {
  $("#scr").innerHTML = RULES.map(function (r, i) {
    return (
      '<div class="sr" data-i="' +
      i +
      '"><select class="i" data-f="k">' +
      OPTS +
      '</select><div class="o"><select data-f="o">' +
      SOP.map(function (o) {
        return '<option value="' + o[0] + '">' + o[1] + "</option>";
      }).join("") +
      '</select><input data-f="v" type="number" step="any" placeholder="value"' +
      (r.o === "ge" || r.o === "le" ? "" : " hidden") +
      '></div><button class="x" data-x="' +
      i +
      '" title="Remove rule">✕</button></div>'
    );
  }).join("");
  document.querySelectorAll("#scr .sr").forEach(function (el, i) {
    var r = RULES[i];
    el.querySelector("[data-f=k]").value = r.k;
    el.querySelector("[data-f=o]").value = r.o;
    el.querySelector("[data-f=v]").value = r.v === undefined ? "" : r.v;
  });
}
function screenRun() {
  var rs = RULES.filter(function (r) {
      return r.k;
    }),
    res = null;
  if (rs.length) {
    res = names.filter(function (n) {
      return rs.every(function (r) {
        var v = V(n, r.k);
        if (v === null) return false;
        var a = valsOf(r.k)
            .slice()
            .sort(function (x, y) {
              return x - y;
            }),
          m = sumA(a) / a.length,
          t = r.v === "" || r.v === undefined || isNaN(+r.v) ? null : +r.v;
        switch (r.o) {
          case "q4":
            return v >= qn(a, 0.75);
          case "q1":
            return v <= qn(a, 0.25);
          case "ab":
            return v > m;
          case "be":
            return v < m;
          case "ge":
            return t === null || v >= t;
          case "le":
            return t === null || v <= t;
        }
        return true;
      });
    });
  }
  SCR = res;
  names.forEach(function (k) {
    LY[k].setStyle(styleFor(k));
  });
  if (S.sel && LY[S.sel]) LY[S.sel].bringToFront();
  var h = "";
  if (res) {
    h =
      '<div class="sres"><h4>' +
      res.length +
      " of " +
      names.length +
      " districts match" +
      (res.length ? " (shown on the map, others dimmed)" : "") +
      "</h4>" +
      res
        .sort(function (a, b) {
          return idx(a) - idx(b);
        })
        .map(function (n) {
          return (
            '<button class="wl" data-d="' +
            n +
            '"><span class="a"><b>' +
            n +
            "</b><em>Index " +
            idx(n) +
            '</em></span><span class="b">' +
            rs
              .map(function (r) {
                return P(r.k).base + ": <b>" + fmtV(V(n, r.k)) + "</b>";
              })
              .join(" · ") +
            "</span></button>"
          );
        })
        .join("") +
      "</div>";
  }
  $("#sres").innerHTML = h;
}
function rulesSet(a) {
  RULES = a.map(function (x) {
    return { k: x[0], o: x[1], v: x[2] };
  });
  rulesUI();
  screenRun();
}
$("#scp").onclick = function (e) {
  var b = e.target.closest("[data-p]");
  if (b) rulesSet(PRS[b.dataset.p][1]);
};
$("#sadd").onclick = function () {
  RULES.push({ k: ALL[0], o: "q4" });
  rulesUI();
  screenRun();
};
$("#sclr").onclick = function () {
  RULES = [];
  SCR = null;
  rulesUI();
  screenRun();
};
$("#scr").addEventListener("change", function (e) {
  var el = e.target.closest(".sr"),
    f = e.target.dataset.f;
  if (!el || !f) return;
  var r = RULES[el.dataset.i];
  r[f] = e.target.value;
  if (f === "o") {
    rulesUI();
  }
  screenRun();
});
$("#scr").addEventListener("input", function (e) {
  if (e.target.dataset.f !== "v") return;
  RULES[e.target.closest(".sr").dataset.i].v = e.target.value;
  screenRun();
});
$("#scr").addEventListener("click", function (e) {
  var x = e.target.closest("[data-x]");
  if (x) {
    RULES.splice(+x.dataset.x, 1);
    rulesUI();
    screenRun();
  }
});
$("#sres").onclick = function (e) {
  var b = e.target.closest(".wl");
  if (b) select(b.dataset.d, true);
};
rulesSet(PRS[1][1]);
SCR = null;
names.forEach(function (k) {
  LY[k].setStyle(styleFor(k));
});
$("#sres").innerHTML = "";

/* about / methodology */
function about() {
  var fsh = Math.round(
    (names.reduce(function (a, n) {
      var m = V(n, K_MOD);
      return a + (m ? V(n, "Female sterilization (%)") / m : 0);
    }, 0) /
      names.length) *
      100,
  );
  var inc = ALL.map(function (k) {
    return [k, valsOf(k).length];
  })
    .filter(function (a) {
      return a[1] < names.length;
    })
    .sort(function (a, b) {
      return a[1] - b[1];
    });
  $("#abx").innerHTML =
    '<button class="cl" id="abc" aria-label="Close">✕</button><h2>About this atlas</h2><p><button class="btn" id="gtour">▶ Start guided tour</button></p><p>District-level NFHS-6 indicators for Bihar (' +
    names.length +
    " districts, " +
    ALL.length +
    " indicators), built for health review and planning. Source: NFHS-6 (MoHFW / IIPS); boundaries: DataMeet (Census 2011).</p>" +
    "<h4>NFHS Composite Index (0–100)</h4><p>Five domains, equal weight. Inside a domain, each indicator becomes a percentile among the 38 districts (reversed where lower is better) and the indicators are averaged; the index is the average of the five domain scores. It shows <b>relative standing</b>, not distance from a target. 50 is roughly the state median.</p><table><tr><th>Domain</th><th>Indicator</th><th>Better when</th></tr>" +
    DOM.map(function (d) {
      return d.ind
        .map(function (q, i) {
          return (
            "<tr><td>" +
            (i ? "" : d.n) +
            "</td><td>" +
            q[2] +
            "</td><td>" +
            (q[1] > 0 ? "higher" : "lower") +
            "</td></tr>"
          );
        })
        .join("");
    }).join("") +
    "</table>" +
    "<h4>Why these domains</h4><ul><li><b>Family planning counts once.</b> Only unmet need is scored. Modern-method use is not: across districts about " +
    fsh +
    "% of it is female sterilization, which says little about choice or spacing. The method mix is shown in the donut chart instead.</li><li><b>Not scored:</b> blood sugar, blood pressure and overweight (higher where child undernutrition is lower, so scoring them as deficits would mislead; see Emerging burden), child marriage (strongly tied to women's schooling, so it would double count; tested in the stability check), and indicators that barely vary between districts (electricity, bank accounts, improved water).</li></ul>" +
    "<h4>Tiers, ties and uncertainty</h4><p>Districts are grouped into five tiers (quintiles of the 38 districts, Highest to Lowest). Index differences of 1 point or less are treated as ties. A tilde (~) means the district stays in its tier in fewer than 60% of simulations. The simulation (500 seeded draws) adds random sampling error to each indicator; the error sizes come from <b>assumed</b> effective sample sizes (<code>SE_NEFF</code> in the code), not published NFHS standard errors, so treat tier confidence as illustrative until real district sample sizes are used.</p>" +
    "<h4>Stability check</h4><p>The Insights tab recomputes the bottom five under " + stability().total + " designs: z-score and min–max scaling, dropping each domain in turn, child marriage in place of schooling, and the original six-pillar index. Districts that stay in the bottom five across most designs are the robust priorities.</p>" +
    "<h4>Derived indicators</h4><ul><li><b>Other modern methods</b> = any modern method − female sterilization − male sterilization.</li><li><b>Home births</b> = 100 − institutional births.</li><li><b>Private facility births</b> = institutional births − institutional births in a public facility.</li><li>District figures are percentage points and are not weighted by district population.</li></ul>" +
    "<h4>Reading the statistics</h4><ul><li><b>Skew</b>: above +0.5 or below −0.5 means a lopsided spread; the mean is pulled toward the long tail.</li><li><b>CV</b> = std dev ÷ mean. <b>Gini</b>: 0 = perfectly even, 1 = one district holds everything.</li><li><b>Correlation (r)</b> shows districts that move together; it does not prove cause. Bold cells use |r| ≥ 0.32 (p &lt; 0.05 for 38 districts).</li><li><b>North / South of the Ganga</b> grouping is by district location (21 north, 17 south).</li></ul>" +
    '<h4>Data handling and cautions</h4><div class="flag"><ul><li>NFHS flags figures based on 25–49 unweighted cases in parentheses; here they are treated as ordinary values.</li><li>Indicators identical in every district are hidden.</li><li>Three indicators (men married before 21, complementary feeding at 6–8 months, non-breastfeeding adequate diet) are missing in several districts.</li><li>District percentages are unweighted, so smaller districts can swing rankings.</li><li>The composite index uses equal-weight percentiles relative to the other 37 districts, not absolute health targets.</li><li>State values shown beside district values (scoreboard, exports) are simple averages of the 38 districts, not the official NFHS-6 state estimates.</li></ul></div>' +
    (inc.length
      ? "<h4>Indicators with incomplete coverage (" +
        inc.length +
        ")</h4><p>" +
        inc
          .slice(0, 14)
          .map(function (a) {
            return P(a[0]).base + " (" + a[1] + "/" + names.length + ")";
          })
          .join("; ") +
        (inc.length > 14 ? "; …" : "") +
        "</p>"
      : "");
  var gt = $("#gtour");
  if (gt) gt.onclick = startTour;
}
function aboutOpen(o) {
  if (o) about();
  $("#abt").classList.toggle("show", o);
}
$("#abtb").onclick = function () {
  aboutOpen(true);
};
$("#abt").onclick = function (e) {
  if (e.target.id === "abt" || e.target.closest("#abc")) aboutOpen(false);
};
addEventListener("keydown", function (e) {
  if (e.key === "Escape") aboutOpen(false);
});
/* guided tour (started from the About panel) */
var tr = null;
function stopTour() {
  if (tr) {
    clearInterval(tr);
    tr = null;
  }
  var b = $("#gtour");
  if (b) b.textContent = "▶ Start guided tour";
}
function startTour() {
  if (tr) return stopTour();
  aboutOpen(false);
  var i = 0,
    o = names
      .filter(function (n) {
        return V(n) !== null;
      })
      .sort(function (a, b) {
        return V(b) - V(a);
      });
  var b = $("#gtour");
  if (b) b.textContent = "■ Stop guided tour";
  function go() {
    select(o[i % o.length], true);
    i++;
  }
  go();
  tr = setInterval(go, 3200);
}
map.on("click dragstart", stopTour);

/* ---- go ---- */
S.ind = "NFHS Composite Index (0-100)";
var H0 = location.hash,
  HP = {};
fillSelect();
refresh();
try {
  H0.slice(1)
    .split("&")
    .forEach(function (x) {
      var a = x.split("=");
      if (a[0]) HP[a[0]] = decodeURIComponent(a[1] || "");
    });
  if (HP.i && ALL.indexOf(HP.i) >= 0 && HP.i !== S.ind) setInd(HP.i);
  if (HP.d && names.indexOf(HP.d) >= 0) {
    select(HP.d, true);
    if (HP.c)
      setCm(
        HP.c.split(",").filter(function (x) {
          return names.indexOf(x) >= 0;
        }),
      );
  }
} catch (e) {}