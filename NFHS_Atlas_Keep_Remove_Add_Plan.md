# Bihar NFHS Atlas: what to remove, what to keep, what to add

Prepared 7 Nov 2026. Based on a code review of `index.html`, `app.js`, `export.js`, `districts.js` and `geo.js` (38 districts, NFHS-6 indicators), plus a browser test of the updated build. Items marked **verify** are things I could not confirm from the code or data alone.

---

## 1. Features

### 1.1 Remove or demote

| Feature | Why it is a problem | Action |
|---|---|---|
| **Auto-play Tour** (▶ Tour) | A novelty, not part of an officer's workflow. The map moves under the user, and it takes a prime toolbar slot. | Move into a "Help / Guided tour" menu. Remove from the main toolbar. |
| **Donut charts** ("Family planning & delivery care") | The state view adds up district percentages without weighting, tooltips say "pts" of a sum, and two unrelated topics share one card. Donuts are hard to compare across districts. | Replace with 100% stacked horizontal bars (one for contraceptive method mix, one for place of delivery). Use weighted state figures. |
| **North vs South of the Ganga** radar | A two-group split hides the real contrasts (Seemanchal, Kosi, Mithila, Magadh, Bhojpur, Tirhut). A radar of group means shows no spread. | Replace with regional groupings. Show n per group and the range, not just the mean. |
| **Plain "Rank #n of 38"** on single indicators | Implies precision. Many adjacent districts are within one point of each other. | Mark ties. Show tiers for the composite index (done). Add "tied" labels for single indicators. |
| **Emoji icons** (KPI ribbon and toolbar buttons) | Render differently across devices and look informal in a government tool. | Replace with one consistent SVG icon set. |
| **Higher-is-better treatment of "Any modern method"** in the KPI ribbon | Sterilization makes up about 84% of modern-method use on average, so a high value is not clearly good. The ribbon entry has no inverse flag. **Verify** the colouring. | Show with a neutral colour and the label "context". |
| **Footnote digits inside indicator names** (`…source1`, `…method2`, `…stunted…12`) | Leaks into the selector, tooltips and exports. Brittle in code. | Strip from display labels. Move footnotes to an info tooltip. |
| **Near-constant indicators in rankings and the correlation matrix** (electricity, bank account, improved water) | Electricity 96.3–99.6%, bank account 95.5–99.6%, improved water exactly 100% in 13 districts. Percentile ranks magnify tiny gaps. | Keep viewable, but label "little variation" and exclude from rankings, the index and correlations. |

### 1.2 Keep (these work well)

- Shareable link with state in the URL, PNG/PDF map export with title and legend, one-page print brief, About/methodology panel, Reset (Esc), `/` to search.
- Clickable legend to isolate a class.
- **Screen** tab (rule-based district filtering).
- **Explore** scatter with axis swap, and the "tap a matrix cell to plot that pair" link.
- "Most similar profile" overlay and the What-if panel.
- Data tab with CSV download, Priority districts, the Domain scoreboard with headroom-first ordering.

### 1.3 Already changed in this round (composite index)

| Change | Detail |
|---|---|
| Five equal-weight domains | Child nutrition (stunting + wasting), Maternal care (4+ ANC + institutional births), Immunization, Unmet FP need, Women's schooling. |
| Family planning counted once | Only unmet need is scored. Modern-method use removed from the index. |
| Wasting and women's schooling added | Previously absent from the index. |
| Profile first, score second | District tab shows five domain bars with the state-median tick. The index is shown below as a secondary line. |
| Tiers instead of exact ranks | Five quintile tiers. "~" marks a tier that is unstable under simulated sampling error. Ties (within 1 index point) are flagged. |
| Stability card | Recomputes the bottom five under 10 designs. Result on your data: Katihar 10/10, Saharsa 9/10, Sitamarhi 9/10, Kishanganj 7/10, Sheikhpura 5/10. |
| Emerging burden card | Blood sugar, blood pressure and overweight shown but not scored (blood sugar is higher where stunting is lower, r = −0.35 for women). |
| About, brief and what-if text updated | Methodology, tiers and assumptions are documented. |

**Caveat:** tier confidence uses *assumed* effective sample sizes (`SE_NEFF` in `app.js`), because the NFHS fact sheets do not publish district standard errors. Replace them with real values if you can obtain them.

### 1.4 Add (prioritised)

**Priority 1: do first**

| Feature | Why | Needs |
|---|---|---|
| **NFHS-5 → NFHS-6 change view** (diverging map, slope chart, "fastest improvers" and "stalled") | Change is more policy-relevant than level, and your data has one round only. | NFHS-5 district data for Bihar. |
| **Per-cell data-quality flags** (`ok`, `low_n`, `suppressed`, `not_available`) | Parenthesised (25–49 cases) values are currently treated as ordinary, and some zeros may be suppressed values. | Re-read the fact sheet PDFs for flags. |
| **Indicator dictionary and tooltips** (definition, denominator, reference period, page) | Users need to know exactly what "institutional births" means. | One metadata file. |
| **Official state and India benchmarks** beside district values | Current "state" values are unweighted district means. | Official fact-sheet figures. |
| **"Not available in NFHS-6" panel** | Anaemia, infant and child mortality and some other NFHS-5 indicators were reportedly dropped. Users will look for them. **Verify** the list against the fact sheet. | A short list. |
| **Hindi language toggle** | The biggest adoption lever for Bihar officials and field staff. | Translations of labels and notes. |
| **Accessibility pass** | No `tabindex`, tabs are plain buttons, canvases have no text alternative. | See section 5. |

**Priority 2**

- Regional groupings (Seemanchal, Kosi, Mithila, Magadh, Bhojpur, Tirhut) as a selectable filter and comparison.
- Cluster typology: 4–5 district profiles from k-means or hierarchical clustering (for example "high fertility, low schooling").
- Gap-to-target view against SDG or state targets.
- Absolute burden view (rate × population, for example number of stunted children), which needs Census projections.
- Domain scores as mappable layers (map each of the five domain scores and the tier).
- Data download with a data dictionary and a data-vintage stamp in every export.
- Mobile layout pass and empty/error states (failed data load, missing value, zero matching districts).

**Priority 3**

- Peer districts based on level and change, not only the current profile.
- JSON export for analysts, a changelog page, a feedback link, an embeddable widget.

---

## 2. Analytics

### 2.1 Remove or demote

| Analytic | Problem | Action |
|---|---|---|
| Equal-weight percentile rank as the headline | Hides weak spots, implies exact ranks, and averages unrelated dimensions. | Done: profile first, tiers, stability card. |
| "Statistical profile" and skew jargon in the default view | Hard for non-statisticians. **Verify** what is displayed. | Plain-language labels ("a few districts are far above the rest"). Move technical stats to an Advanced section. |
| Pearson-only matrix with "bold = significant" | With many pairs, some significant cells are false positives, and outliers (Patna, Kishanganj) can drive r. | Add a Spearman toggle, a multiple-comparisons warning, and an ecological-fallacy note. |
| Unweighted state averages | Differ from the official figures (district mean institutional births 82.0%, stunting 35.9%, against press-reported official 81.1% and 35.6%; **verify** against the fact sheet). | Use official state values, or weight by the denominator population. |
| Top 10 / Bottom 10 for tied or near-constant indicators | Ordering is arbitrary. | Show ties. Hide the ranking when variation is tiny. |
| Index leaders list in the brief | Exact ranks overstate precision. | Show tiers. |

### 2.2 Fix

- Replace the state mean with a weighted or official value everywhere (scoreboard, brief, ribbon).
- Treat the stunting/wasting relationship carefully: the district correlation between them is about 0 (r = −0.01). **Verify** that the wasting column is correct before leaning on it in the index.
- Replace assumed standard errors with real ones when available.

### 2.3 Add

| Analytic | Value |
|---|---|
| **Change analysis** (NFHS-5 → NFHS-6) | Shows progress, not just position. |
| **Level-vs-change quadrant** | Separates "high and improving" from "low and stalling". |
| **Real confidence intervals or sample sizes** | Makes ranks and tiers defensible. |
| **Inequality measures** (best/worst ratio, interquartile range, coefficient of variation) | Shows how unequal districts are on each indicator. |
| **Spatial clustering** (Moran's I, hot-spot map) | Tests whether weak districts cluster (for example Seemanchal and Kosi). |
| **Partial correlation** (controlling for women's schooling) | Shows whether a relationship survives once schooling is held constant. |
| **Domain-gap decomposition** | Shows how much of a district's gap to the median comes from each domain (partly done in What-if). |
| **Burden view** (rate × population) | Large districts with moderate rates can hold the most affected children. |
| **Sensitivity controls** in the UI | Lets users change weights and see the effect on tiers. |

---

## 3. Details to add

### 3.1 Metadata for every indicator

| Field | Example |
|---|---|
| `id` and clean label | `inst_births`, "Institutional births" |
| Unit and direction | `%`, higher is better / lower is better / context only |
| Definition and denominator | "Live births in the 5 years before the survey…" |
| Reference period | "5 years before survey" |
| Source table and page | "NFHS-6 district fact sheet, p. 2" |
| Footnote text | Moved from the label into a tooltip |
| Data-quality flag | `ok` / `low_n` / `suppressed` / `not_available` |
| NFHS-5 value and state/India benchmark | For comparison and change |
| Theme and domain membership | For filtering and the index |

### 3.2 Indicators

**Already in your data:** immunization, ANC, institutional births, stunting, wasting, underweight, women's schooling, child marriage, blood sugar, blood pressure, tobacco, alcohol, bank account, mobile phone, health insurance, internet.

**Not in your file; check whether the NFHS-6 district sheet has them (verify), otherwise list as unavailable:**

- Improved sanitation, clean cooking fuel (reported dropped), birth registration
- ORS and zinc for diarrhoea
- Women's decision-making
- Anaemia and infant/child mortality (reported dropped from NFHS-6)

**Context from other sources (label the source clearly):**

- Population per district (Census 2011 or projections), urban share
- Multidimensional poverty index (NITI Aayog)
- Flood-affected districts, health facility counts and staff vacancies (HMIS, Rural Health Statistics)

### 3.3 Trust and documentation

- Data vintage ("NFHS-6 fact sheets, released May 2026"), version number and last-updated date.
- Known-issues list (see section 4), changelog, how to cite, licence note for DataMeet boundaries and NFHS data.
- Clear "unofficial, derived by [your name or organisation]" notice, repeated on exports and the brief.
- Contact or feedback link.

---

## 4. Data issues to resolve first

| # | Issue | Evidence | Fix |
|---|---|---|---|
| 1 | "Vaccination card only" is higher than "card or recall" | True in all 38 districts (Araria: 86.7% vs 75.7%). Impossible with the same denominator. | Check the fact sheet. Fix the label (denominator may be "children with a card") or the values. |
| 2 | Zeros that may be suppressed values | Male sterilization = 0 in 11 districts. Check-up within 24 hours for home births = 0 in 7 districts. | Add the flag. Show "n/a" or a hollow marker instead of 0. |
| 3 | Near-constant indicators | Electricity 96.3–99.6%, bank account 95.5–99.6%, improved water 100% in 13 districts. | Mark "little variation" and exclude from ranking. |
| 4 | State figure is an unweighted district mean | See section 2.1. | Use official state values. |
| 5 | Footnote digits inside keys | `source1`, `method2`, `stunted…12`. | Move to a metadata file. |
| 6 | Missing values | Three indicators missing in several districts (men married before 21, complementary feeding at 6–8 months, non-breastfeeding adequate diet). | Show "not available" and explain why. |
| 7 | Parenthesised values treated as ordinary | Stated in About. | Store the flag and render differently. |
| 8 | Boundary file is 2011 (DataMeet dists11) | Bihar has 38 districts in both eras. | State it in About. Check district names match NFHS-6 spellings. |

---

## 5. Engineering and accessibility

- **Data size:** `districts.js` is about 290 KB because long indicator names repeat for every district. Store one metadata object plus arrays of numbers (roughly a tenfold reduction).
- **Code:** `app.js` is one large unminified file with globals. Split into data, index, charts and UI modules when convenient.
- **External scripts and fonts:** add Subresource Integrity to the CDN tags, or self-host Leaflet and Chart.js for government deployment.
- **Accessibility:** add `role="tablist"` and `aria-selected` to the tabs; give each chart an `aria-label` summary and a "view as table" link; do not rely on colour alone in the map; add `prefers-color-scheme` support if you want dark mode; test at 360 px width with 44 px tap targets.

---

## 6. Suggested order of work

1. **Data fixes** (section 4, items 1–4) and per-cell flags.
2. **Metadata file** and indicator tooltips, then strip footnote digits from labels.
3. **NFHS-5 data** and the change view.
4. **Replace unweighted state averages** with official or weighted values.
5. **Swap donuts for stacked bars** and replace the North/South radar with regional groupings.
6. **Accessibility pass** and mobile check.
7. **Hindi toggle**, then clustering, spatial analysis and the burden view.

---

## 7. Files changed in this round

| File | What changed |
|---|---|
| `js/app.js` | New index engine (five domains, normalisation variants, stability check, rank-uncertainty simulation, tiers). Updated district profile, Priority districts, scoreboard, what-if, brief and About. New Stability and Emerging burden cards. |
| `index.html` | Two new Insights cards, renamed scoreboard, hint under Priority districts, cache-busting `?v=3` on CSS and JS. |
| `css/style.css` | Styles for domain bars, tier chips, stability bars and the emerging-burden card. |

`export.js`, `districts.js` and `geo.js` are unchanged.
