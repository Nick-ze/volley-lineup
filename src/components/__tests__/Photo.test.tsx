import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { usePhotoStore } from '@/store/photoStore';

import { Photo } from '../Photo';

beforeEach(() => usePhotoStore.setState({ photos: { a: 'data:image/jpeg;base64,AAAA' } }));

it('shows the picture when the photo exists', async () => {
  await render(<Photo photoId="a" size={64} fallback={<Text>7</Text>} />);
  expect(screen.getByTestId('photo', { includeHiddenElements: true })).toBeTruthy();
  expect(screen.queryByText('7')).toBeNull();
});

it('shows the fallback without a photo or before it has loaded', async () => {
  await render(<Photo photoId={undefined} fallback={<Text>7</Text>} />);
  expect(screen.getByText('7')).toBeTruthy();
  await render(<Photo photoId="missing" fallback={<Text>8</Text>} />);
  expect(screen.getByText('8')).toBeTruthy();
});
