export const FEATURE_FLAG_DEFINITIONS = [
  {
    key: 'ff.export.docx.queue',
    name: 'DOCX queue exports',
    description: 'Керує генерацією DOCX через чергу експорту.',
    defaultEnabled: true,
  },
  {
    key: 'ff.live.scoreboard.ws',
    name: 'Live scoreboard websocket updates',
    description: 'Керує live-оновленнями результатів через WebSocket.',
    defaultEnabled: true,
  },
  {
    key: 'ff.import.bulk-edit',
    name: 'Bulk import edit tools',
    description: 'Керує інструментами масового редагування в імпорті.',
    defaultEnabled: true,
  },
  {
    key: 'ff.secretary.heat-draft-autosave',
    name: 'Secretary heat draft autosave',
    description: 'Керує автозбереженням чернетки запливу для секретаря.',
    defaultEnabled: true,
  },
] as const;

export type FeatureFlagKey = (typeof FEATURE_FLAG_DEFINITIONS)[number]['key'];

export const FEATURE_FLAG_KEYS = new Set<string>(FEATURE_FLAG_DEFINITIONS.map((f) => f.key));
