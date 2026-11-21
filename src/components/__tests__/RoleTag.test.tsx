import { render, screen } from '@testing-library/react-native';

import { OffPositionMark } from '../OffPositionMark';
import { RoleTag } from '../RoleTag';

// Both are hidden from assistive tech (the spot's label says the role), so query hidden elements.
const hidden = { includeHiddenElements: true };

describe('RoleTag', () => {
  // Since the review of PR #34 the "*" is drawn by OffPositionMark at the spot's top right,
  // so RoleTag ignores `offPosition` (kept for compatibility) and only shows the role.
  it('shows only the role, also off position', async () => {
    await render(<RoleTag role="OPP" testID="tag" />);
    expect(screen.getByTestId('tag', hidden)).toHaveTextContent('OPP');
    await render(<RoleTag role="S" offPosition testID="tag2" />);
    expect(screen.getByTestId('tag2', hidden)).toHaveTextContent('S');
    expect(screen.queryByTestId('tag2-off', hidden)).toBeNull();
  });
});

describe('OffPositionMark', () => {
  it('draws the asterisk', async () => {
    await render(<OffPositionMark testID="mark" />);
    expect(screen.getByTestId('mark', hidden)).toHaveTextContent('*');
  });
});
