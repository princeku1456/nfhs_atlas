/* Regional groupings — replaces the "North / South of the Ganga" radar when
   enabled. District-to-region assignment has NOT been supplied yet, so this file
   is a scaffold and REGIONS_ENABLED is false. When the assignment is provided,
   set REGIONS_ENABLED = true and fill REGIONS[].districts (matching district
   names in data/districts.js). Do not guess the assignment. */
var REGIONS_ENABLED = false;

var REGIONS = [
  { name: "Seemanchal", color: "#3b9ae1", districts: [] },
  { name: "Kosi", color: "#e8873a", districts: [] },
  { name: "Mithila", color: "#40bf65", districts: [] },
  { name: "Magadh", color: "#8a40bf", districts: [] },
  { name: "Bhojpur", color: "#bfaf40", districts: [] },
  { name: "Tirhut", color: "#bf4085", districts: [] },
];
