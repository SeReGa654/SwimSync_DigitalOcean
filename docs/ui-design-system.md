# SwimSync UI Design System

## Semantic color roles

- **Primary** `#00aaff`: actions, links, active states, progress.
- **Gold** `#ffc830`: medals, records, first place highlights.
- **Mint** `#00e5a0`: personal records, live indicators, healthy states.
- **Danger** `#ff4d6d`: errors, disqualifications, destructive actions.
- **Muted** `#9ab8d8`: secondary text, captions.
- **Dim** `#4d7a9e`: inactive controls, table headers.

## Utility classes

- `status-gold`, `status-mint`, `status-danger`, `status-muted`, `status-dim`
- `glass-card`, `surface-elevated`, `btn-primary`, `btn-secondary`, `premium-input`, `premium-chip`

## Rules

1. Prefer semantic utility classes over hardcoded hex colors in components.
2. Keep destructive actions in `status-danger` style family.
3. Live/status badges should use `status-mint` unless they indicate warning/error.
4. New table-like screens should support compact mode from user preferences.
5. New real-time dashboards should respect `showLiveIndicators` user preference.
