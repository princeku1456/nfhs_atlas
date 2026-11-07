/* Data-quality flags for each cell. The default is "ok" when a cell is absent here.
   Values: "ok" | "low_n" | "suppressed" | "not_available".
   Pre-filled from the data only: missing cells -> "not_available".
   "low_n" and "suppressed" are left empty pending fact-sheet confirmation
   (see the Blocked list in the implementation notes). */
var FLAGS = {
  "Araria": {
    "Men age 25-29 years married before age 21 years (%)": "not_available",
    "Non-breastfeeding children age 6-23 months receiving an adequate diet10, 11 (%)": "not_available"
  },
  "Arwal": {
    "Men age 25-29 years married before age 21 years (%)": "not_available",
    "Non-breastfeeding children age 6-23 months receiving an adequate diet10, 11 (%)": "not_available"
  },
  "Aurangabad": {
    "Children age 6-8 months receiving solid or semi-solid food and breastmilk10 (%)": "not_available",
    "Men age 25-29 years married before age 21 years (%)": "not_available",
    "Non-breastfeeding children age 6-23 months receiving an adequate diet10, 11 (%)": "not_available"
  },
  "Banka": {
    "Children age 6-8 months receiving solid or semi-solid food and breastmilk10 (%)": "not_available",
    "Men age 25-29 years married before age 21 years (%)": "not_available",
    "Non-breastfeeding children age 6-23 months receiving an adequate diet10, 11 (%)": "not_available"
  },
  "Begusarai": {
    "Non-breastfeeding children age 6-23 months receiving an adequate diet10, 11 (%)": "not_available"
  },
  "Bhagalpur": {
    "Non-breastfeeding children age 6-23 months receiving an adequate diet10, 11 (%)": "not_available"
  },
  "Bhojpur": {
    "Children age 6-8 months receiving solid or semi-solid food and breastmilk10 (%)": "not_available"
  },
  "Buxar": {
    "Non-breastfeeding children age 6-23 months receiving an adequate diet10, 11 (%)": "not_available"
  },
  "Darbhanga": {
    "Men age 25-29 years married before age 21 years (%)": "not_available",
    "Non-breastfeeding children age 6-23 months receiving an adequate diet10, 11 (%)": "not_available"
  },
  "Gaya": {
    "Men age 25-29 years married before age 21 years (%)": "not_available",
    "Non-breastfeeding children age 6-23 months receiving an adequate diet10, 11 (%)": "not_available"
  },
  "Gopalganj": {
    "Children age 6-8 months receiving solid or semi-solid food and breastmilk10 (%)": "not_available",
    "Men age 25-29 years married before age 21 years (%)": "not_available",
    "Non-breastfeeding children age 6-23 months receiving an adequate diet10, 11 (%)": "not_available"
  },
  "Jamui": {
    "Men age 25-29 years married before age 21 years (%)": "not_available",
    "Non-breastfeeding children age 6-23 months receiving an adequate diet10, 11 (%)": "not_available"
  },
  "Jehanabad": {
    "Children age 6-8 months receiving solid or semi-solid food and breastmilk10 (%)": "not_available",
    "Men age 25-29 years married before age 21 years (%)": "not_available",
    "Non-breastfeeding children age 6-23 months receiving an adequate diet10, 11 (%)": "not_available"
  },
  "Kaimur (Bhabua)": {
    "Children age 6-8 months receiving solid or semi-solid food and breastmilk10 (%)": "not_available",
    "Men age 25-29 years married before age 21 years (%)": "not_available",
    "Non-breastfeeding children age 6-23 months receiving an adequate diet10, 11 (%)": "not_available"
  },
  "Katihar": {
    "Men age 25-29 years married before age 21 years (%)": "not_available",
    "Non-breastfeeding children age 6-23 months receiving an adequate diet10, 11 (%)": "not_available"
  },
  "Khagaria": {
    "Men age 25-29 years married before age 21 years (%)": "not_available"
  },
  "Kishanganj": {
    "Men age 25-29 years married before age 21 years (%)": "not_available",
    "Non-breastfeeding children age 6-23 months receiving an adequate diet10, 11 (%)": "not_available"
  },
  "Lakhisarai": {
    "Children age 6-8 months receiving solid or semi-solid food and breastmilk10 (%)": "not_available",
    "Men age 25-29 years married before age 21 years (%)": "not_available",
    "Non-breastfeeding children age 6-23 months receiving an adequate diet10, 11 (%)": "not_available"
  },
  "Madhepura": {
    "Men age 25-29 years married before age 21 years (%)": "not_available"
  },
  "Madhubani": {
    "Men age 25-29 years married before age 21 years (%)": "not_available",
    "Non-breastfeeding children age 6-23 months receiving an adequate diet10, 11 (%)": "not_available"
  },
  "Munger": {
    "Children age 6-8 months receiving solid or semi-solid food and breastmilk10 (%)": "not_available",
    "Men age 25-29 years married before age 21 years (%)": "not_available",
    "Non-breastfeeding children age 6-23 months receiving an adequate diet10, 11 (%)": "not_available"
  },
  "Muzaffarpur": {
    "Men age 25-29 years married before age 21 years (%)": "not_available",
    "Non-breastfeeding children age 6-23 months receiving an adequate diet10, 11 (%)": "not_available"
  },
  "Nalanda": {
    "Children age 6-8 months receiving solid or semi-solid food and breastmilk10 (%)": "not_available",
    "Men age 25-29 years married before age 21 years (%)": "not_available",
    "Non-breastfeeding children age 6-23 months receiving an adequate diet10, 11 (%)": "not_available"
  },
  "Nawada": {
    "Men age 25-29 years married before age 21 years (%)": "not_available",
    "Non-breastfeeding children age 6-23 months receiving an adequate diet10, 11 (%)": "not_available"
  },
  "Pashchim Champaran": {
    "Men age 25-29 years married before age 21 years (%)": "not_available",
    "Non-breastfeeding children age 6-23 months receiving an adequate diet10, 11 (%)": "not_available"
  },
  "Patna": {
    "Children age 6-8 months receiving solid or semi-solid food and breastmilk10 (%)": "not_available",
    "Non-breastfeeding children age 6-23 months receiving an adequate diet10, 11 (%)": "not_available"
  },
  "Purbi Champaran": {
    "Men age 25-29 years married before age 21 years (%)": "not_available",
    "Non-breastfeeding children age 6-23 months receiving an adequate diet10, 11 (%)": "not_available"
  },
  "Purnia": {
    "Men age 25-29 years married before age 21 years (%)": "not_available",
    "Non-breastfeeding children age 6-23 months receiving an adequate diet10, 11 (%)": "not_available"
  },
  "Rohtas": {
    "Men age 25-29 years married before age 21 years (%)": "not_available",
    "Non-breastfeeding children age 6-23 months receiving an adequate diet10, 11 (%)": "not_available"
  },
  "Saharsa": {
    "Men age 25-29 years married before age 21 years (%)": "not_available",
    "Non-breastfeeding children age 6-23 months receiving an adequate diet10, 11 (%)": "not_available"
  },
  "Samastipur": {
    "Men age 25-29 years married before age 21 years (%)": "not_available",
    "Non-breastfeeding children age 6-23 months receiving an adequate diet10, 11 (%)": "not_available"
  },
  "Saran": {
    "Children age 6-8 months receiving solid or semi-solid food and breastmilk10 (%)": "not_available",
    "Men age 25-29 years married before age 21 years (%)": "not_available",
    "Non-breastfeeding children age 6-23 months receiving an adequate diet10, 11 (%)": "not_available"
  },
  "Sheikhpura": {
    "Children age 6-8 months receiving solid or semi-solid food and breastmilk10 (%)": "not_available",
    "Men age 25-29 years married before age 21 years (%)": "not_available",
    "Non-breastfeeding children age 6-23 months receiving an adequate diet10, 11 (%)": "not_available"
  },
  "Sheohar": {
    "Men age 25-29 years married before age 21 years (%)": "not_available",
    "Non-breastfeeding children age 6-23 months receiving an adequate diet10, 11 (%)": "not_available"
  },
  "Sitamarhi": {
    "Children age 6-8 months receiving solid or semi-solid food and breastmilk10 (%)": "not_available",
    "Men age 25-29 years married before age 21 years (%)": "not_available",
    "Non-breastfeeding children age 6-23 months receiving an adequate diet10, 11 (%)": "not_available"
  },
  "Siwan": {
    "Children age 6-8 months receiving solid or semi-solid food and breastmilk10 (%)": "not_available",
    "Men age 25-29 years married before age 21 years (%)": "not_available",
    "Non-breastfeeding children age 6-23 months receiving an adequate diet10, 11 (%)": "not_available"
  },
  "Supaul": {
    "Men age 25-29 years married before age 21 years (%)": "not_available",
    "Non-breastfeeding children age 6-23 months receiving an adequate diet10, 11 (%)": "not_available"
  },
  "Vaishali": {
    "Children age 6-8 months receiving solid or semi-solid food and breastmilk10 (%)": "not_available",
    "Men age 25-29 years married before age 21 years (%)": "not_available",
    "Non-breastfeeding children age 6-23 months receiving an adequate diet10, 11 (%)": "not_available"
  }
};
