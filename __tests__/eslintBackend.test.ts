/**
 * @jest-environment node
 *
 * v10 audit L25: the ESLint rule that keeps backend code in `src/lib/sync` also catches
 * `require()`, dynamic `import()`, a sibling's `./sync/*`, test files and scripts.
 */
import { ESLint } from 'eslint';

// The project's config, passed in (ESLint loads a config file with a dynamic import, which Jest
// doesn't allow).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const config = require('../eslint.config.js');
const eslint = new ESLint({ cwd: process.cwd(), overrideConfigFile: true, overrideConfig: config });

/** The rule ids ESLint reports for `code` as if it were the file at `filePath`. */
async function rules(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? []).map((m) => m.ruleId ?? m.message);
}

jest.setTimeout(120_000);

describe('the backend rule (audit L25)', () => {
  it.each([
    [
      "import { createClient } from '@supabase/supabase-js';\nexport const c = createClient;\n",
      'src/features/x/a.ts',
    ],
    ["export const c = require('@supabase/supabase-js');\n", 'src/features/x/a.ts'],
    ["export const c = () => import('@supabase/supabase-js');\n", 'src/features/x/a.ts'],
    ["export const e = () => import('@/lib/sync/engine');\n", 'app/x.tsx'],
    ["export const e = require('../lib/sync/engine');\n", 'src/features/b.ts'],
    [
      "import { createEngine } from './sync/engine';\nexport const e = createEngine;\n",
      'src/lib/other.ts',
    ],
    [
      "import { createClient } from '@supabase/supabase-js';\nexport const c = createClient;\n",
      'src/features/x/__tests__/a.test.ts',
    ],
    [
      "const { createClient } = require('@supabase/supabase-js');\nmodule.exports = createClient;\n",
      'scripts/tool.js',
    ],
  ])('refuses %j in %s', async (code, filePath) => {
    const found = await rules(code, filePath);
    expect(
      found.some((id) => id === 'no-restricted-imports' || id === 'no-restricted-syntax'),
    ).toBe(true);
  });

  it.each([
    [
      "import { createClient } from '@supabase/supabase-js';\nexport const c = createClient;\n",
      'src/lib/sync/client.ts',
    ],
    ["export const c = require('@supabase/supabase-js');\n", 'src/lib/sync/client.ts'],
    [
      "import { createEngine } from '../engine';\nexport const e = createEngine;\n",
      'src/lib/sync/__tests__/x.test.ts',
    ],
    ["import { syncNow } from '@/lib/sync';\nexport const s = syncNow;\n", 'src/features/x/a.ts'],
    [
      "import { SharedTeamDeleteDialog } from '@/features/sync/SharedTeamDeleteDialog';\nexport const D = SharedTeamDeleteDialog;\n",
      'src/features/x/a.ts',
    ],
  ])('allows %j in %s', async (code, filePath) => {
    const found = await rules(code, filePath);
    expect(found).not.toContain('no-restricted-imports');
    expect(found).not.toContain('no-restricted-syntax');
  });
});
