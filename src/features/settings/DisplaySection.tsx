import { ToggleRow } from '@/components';
import { useT } from '@/i18n';
import { useAppStore } from '@/store';

import { Section } from './Section';

/** "Prioritise names" on the player chips (v8.4; was "Show names instead of numbers"). Persisted, kept on "Delete all". */
export function DisplaySection() {
  const t = useT();
  const chipLabel = useAppStore((s) => s.chipLabel);
  const setChipLabel = useAppStore((s) => s.setChipLabel);
  const s = t.language.display;
  return (
    <Section title={s.title} hint={s.hint}>
      <ToggleRow
        label={s.namesInsteadOfNumbers}
        value={chipLabel === 'name'}
        onChange={(on) => setChipLabel(on ? 'name' : 'number')}
        testID="toggle-chip-names"
      />
    </Section>
  );
}
