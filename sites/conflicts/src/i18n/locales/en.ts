import type { Messages } from '../types.ts';

export const en: Messages = {
  localeName: 'English',
  bcp47: 'en-GB',

  app: {
    title: 'Conflicts',
    tagline: 'An atlas of organised violence, year 0 to now',
    about: 'About the data',
    loading: 'Assembling two thousand years',
    language: 'Language',
    documentTitle: 'conflicts.io — An Atlas of Human Conflict',
    metaDescription:
      'An interactive atlas of human conflict from the year 0 to the present. Scrub through two thousand years of history on an animated map.',
  },

  timeline: {
    play: 'Play',
    pause: 'Pause',
    prevSnapshot: 'Previous map',
    nextSnapshot: 'Next map',
    year: 'Year',
    yearSuffix: 'CE',
    era: 'Jump to era',
    speed: 'Playback speed',
    eventDataBegins: 'event data begins',
    scaleNote:
      'Deaths per year across all recorded conflicts · square-root scale, so the centuries before 1800 stay visible beside the 20th',
    eras: [
      { label: 'Antiquity', year: 100 },
      { label: 'Rome falls', year: 450 },
      { label: 'Early Medieval', year: 800 },
      { label: 'Mongols', year: 1240 },
      { label: 'Early Modern', year: 1600 },
      { label: 'Industrial', year: 1850 },
      { label: 'World Wars', year: 1939 },
      { label: 'Modern', year: 2010 },
    ],
  },

  legend: {
    deaths: 'Deaths',
    shareOfWorld: 'Share of world',
    measure: 'Measure deaths by',
    sizeScale: 'Circle size scale for conflict deaths',
    note: 'Circle area is compressed — a war ten times deadlier is not ten times wider.',
    populationNote: 'Sized by share of the world population of the time.',
  },

  search: {
    placeholder: 'Search conflicts, places, belligerents',
    label: 'Search conflicts',
    filterByType: 'Filter by conflict type',
    noResults: 'No conflicts match your search.',
  },

  country: {
    fightingIn: 'Fighting in',
    inTheatre: 'In the theatre',
    subjectTo: 'subject to',
    none: 'No recorded conflict here this year.',
    modernFlag: 'Modern flag',
  },

  panel: {
    close: 'Close',
    estimatedDeaths: 'estimated deaths',
    ofEveryoneAlive: 'of everyone alive in',
    worldPopulation: 'world population',
    casualtiesBySide: 'Casualties by side',
    belligerents: 'Belligerents',
    sources: 'Sources',
    military: 'Military',
    civilian: 'Civilian',
    barsNote: 'Bars show the best estimate; the line beneath each is the low–high range.',
    deathsShort: 'deaths',
    partOf: 'Counted within',
    duration: 'Duration',
    yearOne: 'year',
    yearMany: 'years',
  },

  types: {
    interstate: 'Interstate war',
    civil: 'Civil war',
    colonial: 'Colonial war',
    religious: 'Religious war',
    genocide: 'Genocide',
    rebellion: 'Rebellion',
    invasion: 'Invasion',
  },

  confidence: {
    documented: 'Documented',
    estimated: 'Estimated',
    disputed: 'Disputed',
  },

  about: {
    title: 'About this atlas',
    lede:
      'Two thousand years of organised human violence, placed on a map whose borders move as you scrub through time. It is built entirely from open data and runs entirely in your browser — there is no server, and nothing you do here is recorded.',
    sections: [
      {
        heading: 'What the numbers can and cannot tell you',
        paragraphs: [
          'Every casualty figure on this site is an estimate, and for most of the last two thousand years it is a contested estimate. Rather than print a single confident number, each conflict carries a low, best and high figure and a confidence rating, and the site draws that uncertainty: a crisp ring means the toll is well documented, a dashed ring means historians genuinely disagree.',
          'The disagreements are not small. The An Lushan Rebellion is recorded as a fall of 36 million in the Tang census, but much of that gap reflects the collapse of the census itself rather than deaths. Estimates for the Congo Free State range from 1.5 to 15 million. Where a figure rests on something other than a body count, the conflict’s summary says so.',
        ],
      },
      {
        heading: 'The map is a record of record-keeping',
        paragraphs: [
          'Coverage is wildly uneven, and this is the most important thing to understand about what you are looking at. There are 13 geolocated battles on record for the 2nd century and 1,854 for the 19th. From 1989 the UCDP dataset adds hundreds of thousands of individual events, and the map visibly floods.',
          'None of that means violence increased on those dates. It means writing, archives and eventually satellites arrived. Sparse centuries are drawn sparse rather than filled with invented entries.',
        ],
      },
      {
        heading: 'Why the circles are not proportional',
        paragraphs: [
          'Deaths span five orders of magnitude, from thousands to tens of millions. Sizing circles by area would either make the small conflicts invisible or the large ones the size of a continent, so the radius uses a damped power curve — compressed, but still monotonic. The legend shows calibration circles at known values. For exact magnitudes, open a conflict.',
          'The share of world population toggle is the fairer comparison across eras. Measured that way the 20th century loses its monopoly on catastrophe: the An Lushan Rebellion may have killed one person in six alive on Earth, against roughly one in thirty for the Second World War.',
        ],
      },
      {
        heading: 'Double counting',
        paragraphs: [
          'Some conflicts sit inside others — the Holocaust and the Second Sino-Japanese War are both counted within the 70–85 million usually quoted for the Second World War. They are listed separately because they matter separately, but they are marked so that any total on this site counts those deaths once.',
        ],
      },
      {
        heading: 'Flags',
        paragraphs: [
          'Where a polity on the map corresponds to a present-day state, its modern national flag is shown as a recognition aid. These are not historical banners: the flag beside “Kingdom of Italy” in 1914 is today’s Italian flag. Polities with no clear modern successor — the Great Khanate, the Western Roman Empire — show no flag at all rather than a misleading one.',
        ],
      },
    ],
    sourcesHeading: 'Sources',
    sources: [
      {
        name: 'Hand-curated conflict records',
        span: 'year 0 – present',
        detail:
          '105 major conflicts with per-side casualty ranges, compiled from Wikipedia’s list of wars by death toll, standard reference works and the scholarly literature cited on each entry.',
      },
      {
        name: 'Wikidata',
        span: 'year 9 – present',
        detail: '6,518 geolocated, dated battles retrieved by SPARQL. Public domain (CC0).',
        url: 'https://query.wikidata.org/',
      },
      {
        name: 'UCDP Georeferenced Event Dataset 25.1',
        span: '1989 – 2024',
        detail:
          '385,918 individual lethal events, aggregated here into quarter-degree cells per year. Uppsala Conflict Data Program, CC BY-4.0.',
        url: 'https://ucdp.uu.se/downloads/',
      },
      {
        name: 'Historical basemaps',
        span: 'year 0 – 2010',
        detail:
          '37 snapshots of world political boundaries, simplified to TopoJSON. By Andreas Ourednik, GPL-3.0 — which is why this project is GPL-3.0 too.',
        url: 'https://github.com/aourednik/historical-basemaps',
      },
      {
        name: 'flag-icons',
        span: 'modern states',
        detail: 'Public-domain SVG national flags by Panayiotis Lipiridis.',
        url: 'https://github.com/lipis/flag-icons',
      },
      {
        name: 'World population estimates',
        span: 'year 0 – present',
        detail:
          'McEvedy & Jones, the HYDE database and UN figures from 1950, used for the “share of world population” view.',
      },
    ],
    footnote:
      'Borders are drawn as a crossfade between snapshots, not a true morph — territory dissolving and reforming. Pre-modern boundaries were rarely lines on the ground, and the underlying dataset advises treating them as fuzzy. Treat them as fuzzy.',
  },

  units: {
    million: 'M',
    thousand: 'k',
  },
};
