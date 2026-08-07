import type { ConflictType, Confidence } from '../types.ts';

/**
 * The message contract.
 *
 * Deliberately a typed nested object rather than a `t('some.key')` lookup. Adding a
 * language means satisfying this interface, so a missing or misspelled string is a
 * compile error rather than a `some.key` leaking into the UI at runtime. That is
 * the whole point of "prepared for more languages": the compiler enforces it.
 */
export interface Messages {
  /** Endonym shown in the language switcher — always in its own language. */
  readonly localeName: string;
  /** BCP 47 tag, used for Intl formatting. */
  readonly bcp47: string;

  readonly app: {
    readonly title: string;
    readonly tagline: string;
    readonly about: string;
    readonly loading: string;
    readonly language: string;
    /** Browser tab title; index.html ships the English one for first paint. */
    readonly documentTitle: string;
    readonly metaDescription: string;
  };

  readonly timeline: {
    readonly play: string;
    readonly pause: string;
    /** Jump to the previous/next border snapshot. */
    readonly prevSnapshot: string;
    readonly nextSnapshot: string;
    readonly year: string;
    /** Era abbreviation after the year readout: "CE" / "n. Chr." */
    readonly yearSuffix: string;
    readonly era: string;
    readonly speed: string;
    readonly eventDataBegins: string;
    readonly scaleNote: string;
    readonly eras: readonly { readonly label: string; readonly year: number }[];
  };

  readonly legend: {
    readonly deaths: string;
    readonly shareOfWorld: string;
    readonly measure: string;
    readonly sizeScale: string;
    readonly note: string;
    readonly populationNote: string;
  };

  readonly search: {
    readonly placeholder: string;
    readonly label: string;
    readonly filterByType: string;
    readonly noResults: string;
  };

  readonly country: {
    readonly fightingIn: string;
    readonly inTheatre: string;
    readonly subjectTo: string;
    readonly none: string;
    readonly modernFlag: string;
  };

  readonly panel: {
    readonly close: string;
    readonly estimatedDeaths: string;
    readonly ofEveryoneAlive: string;
    readonly worldPopulation: string;
    readonly casualtiesBySide: string;
    readonly belligerents: string;
    readonly sources: string;
    readonly military: string;
    readonly civilian: string;
    readonly barsNote: string;
    readonly deathsShort: string;
    readonly partOf: string;
    readonly duration: string;
    /** Singular/plural for the duration readout: "1 year" / "8 years". */
    readonly yearOne: string;
    readonly yearMany: string;
  };

  readonly types: Readonly<Record<ConflictType, string>>;
  readonly confidence: Readonly<Record<Confidence, string>>;

  readonly about: {
    readonly title: string;
    readonly lede: string;
    readonly sections: readonly {
      readonly heading: string;
      readonly paragraphs: readonly string[];
    }[];
    readonly sourcesHeading: string;
    readonly sources: readonly {
      readonly name: string;
      readonly span: string;
      readonly detail: string;
      readonly url?: string;
    }[];
    readonly footnote: string;
  };

  /**
   * Compact magnitude suffixes. German abbreviates differently ("Mio.", "Tsd.")
   * and uses a comma as the decimal separator, so this cannot be hard-coded.
   */
  readonly units: {
    readonly million: string;
    readonly thousand: string;
  };
}
