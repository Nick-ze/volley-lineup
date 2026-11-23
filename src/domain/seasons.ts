/**
 * v8 (app 7.0): seasons / tournaments and their opponent teams (docs/PLAN.md §28–30). Pure
 * functions, no React, no storage, no user-facing text (errors are codes).
 *
 * Every match belongs to a season (or tournament) of its team and plays against one of that
 * season's opponents. `Match.opponent` keeps the opponent's name (it is renamed with them).
 *
 * Split by job (v8.3); this barrel keeps `@/domain/seasons` as the one import path: names
 * (`seasonNames.ts`), the upgrade to seasons (`seasonUpgrade.ts`), form checks
 * (`seasonForms.ts`), lists and records (`seasonRecords.ts`) and import merging
 * (`seasonMerge.ts`).
 */
export * from './seasonNames';
export * from './seasonUpgrade';
export * from './seasonForms';
export * from './seasonRecords';
export * from './seasonMerge';
