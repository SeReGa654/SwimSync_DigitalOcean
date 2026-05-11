import { SetMetadata } from '@nestjs/common';

export type CompetitionScopeSource = 'eventParam' | 'entryBody' | 'resultsBodyEntries' | 'competitionId' | 'competitionParam';

export const COMPETITION_SCOPE_METADATA_KEY = 'competitionScope';

export const CompetitionScope = (...sources: CompetitionScopeSource[]) =>
  SetMetadata(COMPETITION_SCOPE_METADATA_KEY, sources);

