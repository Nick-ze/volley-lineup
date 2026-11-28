/**
 * Export / import golden test (v8.3, DECISIONS #223): a fixed data set must export to exactly the
 * same bytes, and the v1–v13 files in this folder must import to exactly the same data, as when
 * the golden files were written (app 8.2.0; rewritten for export schema 11 in app 12.0.0, which
 * added two hosted tournaments to the input and `legacy-v10.json`, the 11.0.0 export of the
 * input; rewritten again for schema 12 in app 12.1.0, which gave the input's tournaments a
 * `plan`, added a tournament with own matches and `legacy-v11.json`, the 12.0.0 export of the
 * input; and for schema 13 in app 12.2.0: players, a player label, a live-scored match in the
 * input, and `legacy-v12.json`, the 12.1.0 export of the input; and for schema 14 in app 12.4.0:
 * the time each own match was added, and `legacy-v13.json`, the 12.3.0 export of the input).
 * Refactors must keep these files unchanged.
 *
 * The goldens are only rewritten on purpose: `UPDATE_GOLDEN=1 npx jest src/domain/__golden__`.
 * A schema change (new export `schemaVersion`) is the only good reason to do that.
 */
import * as fs from 'fs';
import * as path from 'path';

import {
  buildExport,
  mergeData,
  parseImport,
  replaceData,
  serializeExport,
  type ExportData,
} from '../exportSchema';
import { hostedOf, importHosted } from '../hostedTournament';

const DIR = __dirname;
const NOW = new Date('2026-11-23T12:00:00.000Z');
const UPDATE = process.env.UPDATE_GOLDEN === '1';
const LEGACY_VERSIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] as const;

const read = (name: string) => fs.readFileSync(path.join(DIR, name), 'utf8');
const input = (): ExportData => JSON.parse(read('input.json'));
const text = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

function expectGolden(name: string, actual: string): void {
  const file = path.join(DIR, 'golden', name);
  if (UPDATE) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, actual);
  }
  expect(actual).toBe(fs.readFileSync(file, 'utf8'));
}

function parsed(version: number) {
  const result = parseImport(read(`legacy-v${version}.json`));
  if (!result.ok) throw new Error(`legacy-v${version}.json: ${result.error}`);
  return result;
}

describe('export golden', () => {
  it('exports everything with descriptions byte for byte', () => {
    expectGolden(
      'export-all.json',
      serializeExport(buildExport(input(), { now: NOW, includeDescriptions: true })),
    );
  });

  it('exports everything without descriptions byte for byte', () => {
    expectGolden(
      'export-all-no-descriptions.json',
      serializeExport(buildExport(input(), { now: NOW })),
    );
  });

  it('exports one team byte for byte', () => {
    expectGolden(
      'export-team-t1.json',
      serializeExport(buildExport(input(), { now: NOW, teamId: 't1', includeDescriptions: true })),
    );
  });

  it('only exportedAt depends on the clock', () => {
    const a = buildExport(input(), { now: NOW });
    const b = buildExport(input(), { now: new Date('2030-01-01T00:00:00.000Z') });
    expect({ ...b, exportedAt: a.exportedAt }).toEqual(a);
  });
});

describe('import golden', () => {
  it.each(LEGACY_VERSIONS)('a v%i file imports to the same data and summary', (version) => {
    const result = parsed(version);
    expectGolden(`import-v${version}.json`, text({ summary: result.summary, file: result.file }));
  });

  it('replace and merge give the same data', () => {
    const file = parsed(9).file;
    expectGolden('replace-v9.json', text(replaceData(file)));
    expectGolden('merge-v7-into-input.json', text(mergeData(input(), parsed(7).file)));
    expectGolden('merge-v9-into-input.json', text(mergeData(input(), file)));
  });

  it('hosted tournaments: replace and merge give the same data (v11)', () => {
    const device = hostedOf(input());
    const profiles = new Set(input().profiles.map((p) => p.id));
    // A v10 file has none: Replace empties them, Merge keeps the device's.
    const old = hostedOf(parsed(10).file);
    expect(importHosted(device, old, 'replace', profiles)).toEqual({ ok: true, hosted: old });
    expect(importHosted(device, old, 'merge', profiles)).toEqual({ ok: true, hosted: device });
    // The device's own export merged back changes nothing.
    const exported = parseImport(serializeExport(buildExport(input(), { now: NOW })));
    if (!exported.ok) throw new Error(exported.error);
    expect(importHosted(device, hostedOf(exported.file), 'merge', profiles)).toEqual({
      ok: true,
      hosted: device,
    });
  });

  it('an export of the input imports back to the same data (round trip)', () => {
    const exported = serializeExport(buildExport(input(), { now: NOW, includeDescriptions: true }));
    const result = parseImport(exported);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(serializeExport(result.file)).toBe(exported);
  });
});
