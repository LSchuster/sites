import type { Messages } from '../types.ts';

export const de: Messages = {
  localeName: 'Deutsch',
  bcp47: 'de-DE',

  app: {
    title: 'Konflikte',
    tagline: 'Ein Atlas organisierter Gewalt, Jahr 0 bis heute',
    about: 'Über die Daten',
    loading: 'Zweitausend Jahre werden zusammengesetzt',
    language: 'Sprache',
    documentTitle: 'conflicts.io — Ein Atlas menschlicher Konflikte',
    metaDescription:
      'Ein interaktiver Atlas menschlicher Konflikte vom Jahr 0 bis heute. Zweitausend Jahre Geschichte auf einer animierten Karte.',
  },

  timeline: {
    play: 'Abspielen',
    pause: 'Pause',
    prevSnapshot: 'Vorherige Karte',
    nextSnapshot: 'Nächste Karte',
    year: 'Jahr',
    yearSuffix: 'n. Chr.',
    era: 'Zu Epoche springen',
    speed: 'Abspielgeschwindigkeit',
    eventDataBegins: 'Ereignisdaten beginnen',
    scaleNote:
      'Todesopfer pro Jahr über alle erfassten Konflikte · Quadratwurzel-Skala, damit die Jahrhunderte vor 1800 neben dem 20. sichtbar bleiben',
    eras: [
      { label: 'Antike', year: 100 },
      { label: 'Rom zerfällt', year: 450 },
      { label: 'Frühmittelalter', year: 800 },
      { label: 'Mongolen', year: 1240 },
      { label: 'Frühe Neuzeit', year: 1600 },
      { label: 'Industriezeit', year: 1850 },
      { label: 'Weltkriege', year: 1939 },
      { label: 'Gegenwart', year: 2010 },
    ],
  },

  legend: {
    deaths: 'Todesopfer',
    shareOfWorld: 'Anteil der Welt',
    measure: 'Todesopfer messen nach',
    sizeScale: 'Größenskala der Kreise für Todesopfer',
    note: 'Die Kreisfläche ist gestaucht — ein zehnmal tödlicherer Krieg ist nicht zehnmal breiter.',
    populationNote: 'Größe nach Anteil an der damaligen Weltbevölkerung.',
  },

  search: {
    placeholder: 'Konflikte, Orte, Kriegsparteien suchen',
    label: 'Konflikte suchen',
    filterByType: 'Nach Konfliktart filtern',
    noResults: 'Keine Konflikte gefunden.',
  },

  country: {
    fightingIn: 'Kämpft in',
    inTheatre: 'Im Kriegsgebiet',
    subjectTo: 'untersteht',
    none: 'Kein erfasster Konflikt in diesem Jahr.',
    modernFlag: 'Heutige Flagge',
  },

  panel: {
    close: 'Schließen',
    estimatedDeaths: 'geschätzte Todesopfer',
    ofEveryoneAlive: 'aller damals lebenden Menschen im Jahr',
    worldPopulation: 'Weltbevölkerung',
    casualtiesBySide: 'Opfer nach Seite',
    belligerents: 'Kriegsparteien',
    sources: 'Quellen',
    military: 'Militärisch',
    civilian: 'Zivil',
    barsNote:
      'Die Balken zeigen den besten Schätzwert; die Linie darunter ist die Spanne von niedrig bis hoch.',
    deathsShort: 'Todesopfer',
    partOf: 'Enthalten in',
    duration: 'Dauer',
    yearOne: 'Jahr',
    yearMany: 'Jahre',
  },

  types: {
    interstate: 'Zwischenstaatlicher Krieg',
    civil: 'Bürgerkrieg',
    colonial: 'Kolonialkrieg',
    religious: 'Religionskrieg',
    genocide: 'Völkermord',
    rebellion: 'Aufstand',
    invasion: 'Invasion',
  },

  confidence: {
    documented: 'Belegt',
    estimated: 'Geschätzt',
    disputed: 'Umstritten',
  },

  about: {
    title: 'Über diesen Atlas',
    lede:
      'Zweitausend Jahre organisierter menschlicher Gewalt auf einer Karte, deren Grenzen sich bewegen, während Sie durch die Zeit scrollen. Der Atlas basiert vollständig auf offenen Daten und läuft vollständig in Ihrem Browser — es gibt keinen Server, und nichts von dem, was Sie hier tun, wird aufgezeichnet.',
    sections: [
      {
        heading: 'Was die Zahlen sagen können und was nicht',
        paragraphs: [
          'Jede Opferzahl auf dieser Seite ist eine Schätzung, und für den größten Teil der letzten zweitausend Jahre ist sie eine umstrittene Schätzung. Statt eine einzelne selbstsichere Zahl zu drucken, trägt jeder Konflikt einen niedrigen, besten und hohen Wert sowie eine Verlässlichkeitsangabe, und die Seite zeichnet diese Unsicherheit: ein klarer Ring bedeutet, die Zahl ist gut belegt, ein gestrichelter Ring bedeutet, dass Historiker sich tatsächlich uneinig sind.',
          'Die Differenzen sind nicht klein. Die An-Lushan-Rebellion ist als Rückgang von 36 Millionen im Zensus der Tang-Dynastie verzeichnet, doch ein großer Teil dieser Lücke spiegelt den Zusammenbruch des Zensus selbst wider, nicht Todesfälle. Die Schätzungen für den Kongo-Freistaat reichen von 1,5 bis 15 Millionen. Wo eine Zahl auf etwas anderem als einer Totenzählung beruht, sagt die Zusammenfassung des Konflikts das ausdrücklich.',
        ],
      },
      {
        heading: 'Die Karte zeigt, was aufgeschrieben wurde',
        paragraphs: [
          'Die Abdeckung ist äußerst ungleichmäßig, und das ist das Wichtigste, was Sie über das Gezeigte wissen sollten. Für das 2. Jahrhundert sind 13 geografisch verortete Schlachten überliefert, für das 19. Jahrhundert 1.854. Ab 1989 fügt der UCDP-Datensatz Hunderttausende einzelner Ereignisse hinzu, und die Karte wird sichtbar überflutet.',
          'Nichts davon bedeutet, dass die Gewalt zu diesen Zeitpunkten zugenommen hätte. Es bedeutet, dass Schrift, Archive und schließlich Satelliten hinzukamen. Dünn belegte Jahrhunderte werden dünn dargestellt, statt mit erfundenen Einträgen aufgefüllt zu werden.',
        ],
      },
      {
        heading: 'Warum die Kreise nicht proportional sind',
        paragraphs: [
          'Die Todeszahlen umspannen fünf Größenordnungen, von Tausenden bis zu Dutzenden Millionen. Kreise nach Fläche zu skalieren würde entweder die kleinen Konflikte unsichtbar machen oder die großen so groß wie einen Kontinent. Der Radius folgt daher einer gedämpften Potenzkurve — gestaucht, aber weiterhin monoton. Die Legende zeigt Eichkreise bei bekannten Werten. Für genaue Größen öffnen Sie einen Konflikt.',
          'Der Umschalter „Anteil der Welt“ ist der fairere Vergleich über Epochen hinweg. So gemessen verliert das 20. Jahrhundert sein Monopol auf die Katastrophe: die An-Lushan-Rebellion tötete möglicherweise jeden sechsten damals lebenden Menschen, gegenüber etwa jedem dreißigsten im Zweiten Weltkrieg.',
        ],
      },
      {
        heading: 'Doppelzählung',
        paragraphs: [
          'Manche Konflikte stecken in anderen — der Holocaust und der Zweite Japanisch-Chinesische Krieg werden beide innerhalb der 70 bis 85 Millionen gezählt, die üblicherweise für den Zweiten Weltkrieg genannt werden. Sie sind gesondert aufgeführt, weil sie gesondert von Bedeutung sind, aber so markiert, dass jede Summe auf dieser Seite diese Toten nur einmal zählt.',
        ],
      },
      {
        heading: 'Flaggen',
        paragraphs: [
          'Wo ein Staatswesen auf der Karte einem heutigen Staat entspricht, wird dessen moderne Nationalflagge als Wiedererkennungshilfe gezeigt. Es sind keine historischen Banner: die Flagge neben „Königreich Italien“ im Jahr 1914 ist die heutige italienische Flagge. Staatswesen ohne eindeutigen modernen Nachfolger — das Große Khanat, das Weströmische Reich — zeigen gar keine Flagge statt einer irreführenden.',
        ],
      },
    ],
    sourcesHeading: 'Quellen',
    sources: [
      {
        name: 'Handkuratierte Konfliktdaten',
        span: 'Jahr 0 – heute',
        detail:
          '105 große Konflikte mit Opferspannen je Seite, zusammengetragen aus Wikipedias Liste der Kriege nach Opferzahl, Standardnachschlagewerken und der bei jedem Eintrag angegebenen Fachliteratur.',
      },
      {
        name: 'Wikidata',
        span: 'Jahr 9 – heute',
        detail: '6.518 geografisch verortete, datierte Schlachten per SPARQL abgerufen. Gemeinfrei (CC0).',
        url: 'https://query.wikidata.org/',
      },
      {
        name: 'UCDP Georeferenced Event Dataset 25.1',
        span: '1989 – 2024',
        detail:
          '385.918 einzelne tödliche Ereignisse, hier zu Zellen von einem Viertelgrad pro Jahr aggregiert. Uppsala Conflict Data Program, CC BY-4.0.',
        url: 'https://ucdp.uu.se/downloads/',
      },
      {
        name: 'Historische Basiskarten',
        span: 'Jahr 0 – 2010',
        detail:
          '37 Momentaufnahmen politischer Weltgrenzen, zu TopoJSON vereinfacht. Von Andreas Ourednik, GPL-3.0 — weshalb auch dieses Projekt unter GPL-3.0 steht.',
        url: 'https://github.com/aourednik/historical-basemaps',
      },
      {
        name: 'flag-icons',
        span: 'moderne Staaten',
        detail: 'Gemeinfreie SVG-Nationalflaggen von Panayiotis Lipiridis.',
        url: 'https://github.com/lipis/flag-icons',
      },
      {
        name: 'Schätzungen zur Weltbevölkerung',
        span: 'Jahr 0 – heute',
        detail:
          'McEvedy & Jones, die HYDE-Datenbank und UN-Zahlen ab 1950, verwendet für die Ansicht „Anteil der Welt“.',
      },
    ],
    footnote:
      'Grenzen werden als Überblendung zwischen Momentaufnahmen gezeichnet, nicht als echte Verformung — Gebiete lösen sich auf und bilden sich neu. Vormoderne Grenzen waren selten Linien im Gelände, und der zugrunde liegende Datensatz rät, sie als unscharf zu behandeln. Behandeln Sie sie als unscharf.',
  },

  units: {
    million: ' Mio.',
    thousand: ' Tsd.',
  },
};
