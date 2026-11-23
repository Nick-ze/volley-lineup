/**
 * v8 motion rules for tabs (PLAN §31.2): which side new tab content slides in from, and which
 * tab a horizontal drag goes to (v8.1: an interactive pager). Pure functions, no React.
 *
 * v8.3: split by consumer behind this barrel (the import path stays `@/domain/tabMotion`): the
 * slide (`slideMotion.ts`), the drag (`tabDrag.ts`) and the pager layout (`pagerLayout.ts`).
 */
export * from './slideMotion';
export * from './tabDrag';
export * from './pagerLayout';
