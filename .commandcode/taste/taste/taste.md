# Taste
- Never invents or fabricates data: any value, definition, benchmark, or number must come from a file the user provides or a citable source. If unavailable, leave the field/structure empty and flag it as "Blocked / needs input" rather than filling it with a plausible number. Confidence: 0.9
- For missing structural/classification mappings (e.g., district-to-region groupings), prefers a reasonable guess over leaving the structure empty — even when a plan says not to guess. The no-fabrication rule applies to values, numbers, and benchmarks, not to these structural assignments. Confidence: 0.7
- Matches the existing code style and does not reformat unrelated code (follows current formatting — Prettier-style, ES5 `function`, double quotes). Confidence: 0.85
- Prefers graphical/visual representations (charts, plots) over text-only summaries for analytical panels, and wants each panel to make its purpose clear. Confidence: 0.8
- Expects interactive analysis elements (e.g., clusters, regions) to highlight the corresponding areas on the map when clicked. Confidence: 0.8
- Prefers data exports to be exhaustive (full dataset, all indicators/districts) rather than limited to the current view or a summary. Confidence: 0.7
