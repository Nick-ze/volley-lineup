import { render, screen } from '@testing-library/react-native';
import { StyleSheet, View } from 'react-native';

import { touchTarget } from '@/theme';

import { ListRow } from '../components/ListRow';

const basis = (testID: string) =>
  StyleSheet.flatten(screen.getByTestId(testID).props.style).flexBasis as number;

describe('ListRow (v8 QA)', () => {
  it('keeps the same room for the name when a picture leads the row', async () => {
    await render(
      <>
        <ListRow
          title="Volley Wil Damen 1"
          onPress={() => {}}
          accessibilityLabel="a"
          testID="plain"
        />
        <ListRow
          title="Volley Wil Damen 1"
          leading={<View style={{ width: touchTarget, height: touchTarget }} />}
          onPress={() => {}}
          accessibilityLabel="b"
          testID="pictured"
        />
      </>,
    );
    // The picture's width (plus the gap) is added, so the actions wrap below on a phone
    // instead of cutting the team name short.
    expect(basis('pictured')).toBeGreaterThan(basis('plain') + touchTarget);
  });
});
