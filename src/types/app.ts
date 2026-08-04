// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export type LookupValue = { key: string; label: string };
export type GeoLocation = { lat: number; long: number; info?: string };

export type AttachmentType = 'file' | 'note' | 'url' | 'json';
export interface Attachment {
  id: string;
  type: AttachmentType;
  label: string | null;
  value: string | null;
  active: boolean;
  createdat?: string | null;
  updatedat?: string | null;
}

export interface AttachmentInput {
  type: AttachmentType;
  label?: string;
  value: string;
  active?: boolean;
}

export interface Aktualisierung {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    titel?: string;
    beschreibung?: string;
    datum?: string; // Format: YYYY-MM-DD oder ISO String
    version?: string;
    prioritaet?: LookupValue;
    status?: LookupValue;
    verantwortliche_person?: string;
    betroffene_bereiche?: string;
    anmerkungen?: string;
  };
}

export const APP_IDS = {
  AKTUALISIERUNG: '6a7194c44708b76c367818f5',
} as const;


export const LOOKUP_OPTIONS: Record<string, Record<string, {key: string, label: string}[]>> = {
  'aktualisierung': {
    prioritaet: [{ key: "niedrig", label: "Niedrig" }, { key: "mittel", label: "Mittel" }, { key: "hoch", label: "Hoch" }, { key: "kritisch", label: "Kritisch" }],
    status: [{ key: "geplant", label: "Geplant" }, { key: "in_bearbeitung", label: "In Bearbeitung" }, { key: "abgeschlossen", label: "Abgeschlossen" }, { key: "abgebrochen", label: "Abgebrochen" }],
  },
};

export const FIELD_TYPES: Record<string, Record<string, string>> = {
  'aktualisierung': {
    'titel': 'string/text',
    'beschreibung': 'string/textarea',
    'datum': 'date/date',
    'version': 'string/text',
    'prioritaet': 'lookup/select',
    'status': 'lookup/radio',
    'verantwortliche_person': 'string/text',
    'betroffene_bereiche': 'string/text',
    'anmerkungen': 'string/textarea',
  },
};

export const HUB_TOPOLOGY: Record<string, { field: string; entity: string }[]> = {
};

type StripLookup<T> = {
  [K in keyof T]: T[K] extends LookupValue | undefined ? string | LookupValue | undefined
    : T[K] extends LookupValue[] | undefined ? string[] | LookupValue[] | undefined
    : T[K];
};

// Helper Types for creating new records (lookup fields as plain strings for API)
export type CreateAktualisierung = StripLookup<Aktualisierung['fields']>;