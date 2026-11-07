/* Official NFHS-6 state and India figures, supplied by the maintainer.
   Schema (per indicator key, matching data/districts.js labels):
     STATE_BENCHMARKS[indicatorKey] = {
       bihar: <number>,   // official NFHS-6 Bihar state figure
       india: <number>,   // official NFHS-6 India figure
       source: "<citation>"  // fact-sheet page / table
     }

   These are PLACEHOLDERS ONLY. No value here is invented; every entry is
   empty until the official figures are supplied. The app falls back to the
   unweighted district mean (labelled "average of districts, not the official
   state figure") wherever an official value is absent.
*/
var STATE_BENCHMARKS = {};
