/* Regional groupings — standard Bihar administrative divisions, consolidated
   into the seven groups used for this atlas. District-to-region assignment uses
   the state's official divisions (Seemanchal, Kosi, Mithila/Darbhanga, Munger,
   Tirhut, Magadh, Bhojpur). District names match data/districts.js exactly.

   Bihar has nine administrative divisions; seven are named explicitly here and
   the remaining two (Patna, Saran) are folded into neighbouring groups so every
   district belongs to exactly one region:
     - Patna division (Patna, Nalanda)            -> Magadh
     - Saran division (Saran, Siwan, Gopalganj)   -> Tirhut
   Bhagalpur division (Bhagalpur, Banka) is folded into Munger, Begusarai into
   Mithila, and Khagaria into Kosi (flood-plain east).
   This is a presentation grouping, not an official boundary file. */
var REGIONS_ENABLED = true;

var REGIONS = [
  { name: "Seemanchal", color: "#3b9ae1", districts: ["Araria", "Katihar", "Kishanganj", "Purnia"] },
  { name: "Kosi", color: "#e8873a", districts: ["Madhepura", "Saharsa", "Supaul", "Khagaria"] },
  { name: "Mithila", color: "#40bf65", districts: ["Darbhanga", "Madhubani", "Samastipur", "Begusarai"] },
  { name: "Munger", color: "#26a69a", districts: ["Munger", "Jamui", "Lakhisarai", "Sheikhpura", "Bhagalpur", "Banka"] },
  { name: "Tirhut", color: "#bf4085", districts: ["Pashchim Champaran", "Purbi Champaran", "Muzaffarpur", "Sitamarhi", "Sheohar", "Vaishali", "Saran", "Siwan", "Gopalganj"] },
  { name: "Magadh", color: "#8a40bf", districts: ["Gaya", "Nawada", "Aurangabad", "Jehanabad", "Arwal", "Patna", "Nalanda"] },
  { name: "Bhojpur", color: "#bfaf40", districts: ["Bhojpur", "Buxar", "Rohtas", "Kaimur (Bhabua)"] },
];
