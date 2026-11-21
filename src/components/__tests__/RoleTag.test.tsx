import { render, screen } from '@testing-library/react-native';

import { RoleTag } from '../RoleTag';

// The tag is hidden from assistive tech (the spot's label says the role), so query hidden elements.
const hidden = { includeHiddenElements: true };

describe('RoleTag', () => {
  it('shows the role, and an asterisk only off position', async () => {
    await render(<RoleTag role="OPP" testID="tag" />);
    expect(screen.getByText('OPP', hidden)).toBeTruthy();
    expect(screen.queryByTestId('tag-off', hidden)).toBeNull();
    await render(<RoleTag role="S" offPosition testID="tag2" />);
    expect(screen.getByTestId('tag2-off', hidden)).toBeTruthy();
    await render(<RoleTag role="MB" offPosition />);
    expect(screen.getByText('MB', hidden)).toBeTruthy();
  });
});
