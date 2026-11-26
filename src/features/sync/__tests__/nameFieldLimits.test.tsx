/**
 * v10 audit (docs/AUDIT_V10.md M3): the name fields can't take more text than a synced record
 * may hold (names 200 characters, other text 1000). The forms' own, tighter checks still say
 * "too long" when saving; this only keeps a paste from growing a field beyond what could sync.
 */
import { render, screen } from '@testing-library/react-native';

import { MAX_NAME_LENGTH, MAX_TEXT_LENGTH } from '@/domain/syncSchema';
import { SeasonPicker } from '@/features/matchForm/SeasonPicker';
import { PresetNameDialog } from '@/features/presets/PresetNameDialog';
import { PlayerForm } from '@/features/roster/components/PlayerForm';
import { TeamForm } from '@/features/roster/components/TeamForm';
import { SeasonForm } from '@/features/seasons/SeasonForm';
import { t } from '@/i18n/en';

const noop = () => {};
const limit = (label: string) => screen.getByLabelText(label).props.maxLength as unknown;

describe('name fields hold at most what a synced record may (audit M3)', () => {
  it('team name', async () => {
    await render(<TeamForm submitLabel="Save" onSubmit={noop} onCancel={noop} />);
    expect(limit(t.roster.teams.name)).toBe(MAX_NAME_LENGTH);
  });

  it('player first and last name', async () => {
    await render(<PlayerForm teamId="t1" onDone={noop} />);
    expect(limit(t.roster.player.firstName)).toBe(MAX_NAME_LENGTH);
    expect(limit(t.roster.player.lastName)).toBe(MAX_NAME_LENGTH);
  });

  it('season name and place', async () => {
    await render(<SeasonForm teamId="t1" onSubmit={noop} onCancel={noop} />);
    expect(limit(t.seasons.form.name)).toBe(MAX_NAME_LENGTH);
    expect(limit(t.seasons.form.location)).toBe(MAX_TEXT_LENGTH);
  });

  it('the season created with a new match', async () => {
    await render(
      <SeasonPicker
        seasons={[]}
        fixed={false}
        value={null}
        onChange={noop}
        newName=""
        onNewName={noop}
      />,
    );
    expect(screen.getByTestId('match-new-season-name').props.maxLength).toBe(MAX_NAME_LENGTH);
  });

  it('preset name', async () => {
    await render(
      <PresetNameDialog
        teamId="t1"
        title="New preset"
        confirmLabel="Save"
        initialName=""
        onSubmit={noop}
        onCancel={noop}
      />,
    );
    expect(limit(t.presets.nameDialog.name)).toBe(MAX_NAME_LENGTH);
  });
});
