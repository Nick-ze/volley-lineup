/**
 * v12 hosted tournaments (docs/V12_TOURNAMENT_DESIGN.md, docs/PLAN.md §48): a coach hosts a
 * tournament, enters its teams and types in the results; the plan (one round robin) and the
 * table are derived. Pure functions; the UI is in `src/features/hostedTournament/`.
 *
 * Barrel over the sub-modules, which import each other directly, never this file:
 * `hostedPlan` (rounds), `hostedResult` (sets, outcome), `hostedStandings` (plan with results,
 * table, a team's matches), `hostedForms` (form validation, settings changes), `hostedData`
 * (the stored collections: consistency, import).
 */
export * from './hostedPlan';
export * from './hostedResult';
export * from './hostedStandings';
export * from './hostedForms';
export * from './hostedData';
// v12.2: a team's optional players, and live scoring of a match (point tags, what they add up to).
export * from './hostedPlayers';
export * from './hostedLive';
