import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { PHOTO_QUALITY } from '@/domain/photos';

import * as native from './pickPhoto.native';
import { compressPhoto, pickPhotoWith } from './pickPhotoShared';
import * as web from './pickPhoto.web';

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

const calls: { crop?: unknown; resize?: unknown; sources: unknown[] } = { sources: [] };
const saveAsync = jest.fn();

jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg', PNG: 'png' },
  ImageManipulator: { manipulate: jest.fn() },
}));

const picker = jest.mocked(ImagePicker);
const manipulate = jest.mocked(ImageManipulator.manipulate);

/** A manipulator that "loads" a 4000 × 3000 picture and returns `base64` when saved. */
function fakeManipulator(base64: string | undefined) {
  saveAsync.mockResolvedValue({ uri: 'file:///out.jpg', width: 256, height: 256, base64 });
  manipulate.mockImplementation((source) => {
    calls.sources.push(source);
    const ctx = {
      crop: (rect: unknown) => {
        calls.crop = rect;
        return ctx;
      },
      resize: (size: unknown) => {
        calls.resize = size;
        return ctx;
      },
      renderAsync: () => Promise.resolve({ width: 4000, height: 3000, saveAsync }),
    };
    return ctx as unknown as ReturnType<typeof ImageManipulator.manipulate>;
  });
}

const asset = { uri: 'file:///big.jpg', width: 4000, height: 3000 };
const picked = { canceled: false, assets: [asset] } as ImagePicker.ImagePickerResult;

beforeEach(() => {
  jest.clearAllMocks();
  calls.sources = [];
  calls.crop = undefined;
  calls.resize = undefined;
  fakeManipulator('AAAA');
  picker.requestCameraPermissionsAsync.mockResolvedValue({
    granted: true,
  } as ImagePicker.CameraPermissionResponse);
  picker.launchCameraAsync.mockResolvedValue(picked);
  picker.launchImageLibraryAsync.mockResolvedValue(picked);
});

describe('compressPhoto', () => {
  it('crops the centre square, resizes to 256 px and saves a JPEG at PHOTO_QUALITY as base64', async () => {
    expect(await compressPhoto('file:///big.jpg')).toBe('data:image/jpeg;base64,AAAA');
    expect(calls.sources[0]).toBe('file:///big.jpg');
    expect(calls.crop).toEqual({ originX: 500, originY: 0, width: 3000, height: 3000 });
    expect(calls.resize).toEqual({ width: 256, height: 256 });
    expect(saveAsync).toHaveBeenCalledWith({
      base64: true,
      compress: PHOTO_QUALITY,
      format: SaveFormat.JPEG,
    });
  });

  it('returns null without base64 output or when the result is too large', async () => {
    fakeManipulator(undefined);
    expect(await compressPhoto('x')).toBeNull();
    fakeManipulator('A'.repeat(300_000));
    expect(await compressPhoto('x')).toBeNull();
  });
});

describe('pickPhotoWith', () => {
  const phone = { askCameraPermission: true, allowsEditing: true };

  it('opens the gallery for images only and returns the compressed picture', async () => {
    expect(await pickPhotoWith('library', phone)).toEqual({
      status: 'picked',
      dataUri: 'data:image/jpeg;base64,AAAA',
    });
    expect(picker.launchImageLibraryAsync).toHaveBeenCalledWith({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    expect(picker.requestCameraPermissionsAsync).not.toHaveBeenCalled();
  });

  it('asks for camera access before opening the camera', async () => {
    expect((await pickPhotoWith('camera', phone)).status).toBe('picked');
    expect(picker.requestCameraPermissionsAsync).toHaveBeenCalled();
    expect(picker.launchCameraAsync).toHaveBeenCalled();
  });

  it('reports a refused camera permission without opening the camera', async () => {
    picker.requestCameraPermissionsAsync.mockResolvedValue({
      granted: false,
    } as ImagePicker.CameraPermissionResponse);
    expect(await pickPhotoWith('camera', phone)).toEqual({ status: 'denied' });
    expect(picker.launchCameraAsync).not.toHaveBeenCalled();
  });

  it('reports a cancelled picker (and one without assets)', async () => {
    picker.launchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null });
    expect(await pickPhotoWith('library', phone)).toEqual({ status: 'cancelled' });
    picker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [] });
    expect(await pickPhotoWith('library', phone)).toEqual({ status: 'cancelled' });
    expect(manipulate).not.toHaveBeenCalled();
  });

  it('turns errors into "denied" (permission) or "failed"', async () => {
    picker.launchImageLibraryAsync.mockRejectedValue(new Error('Missing photo permission'));
    expect(await pickPhotoWith('library', phone)).toEqual({ status: 'denied' });
    picker.launchImageLibraryAsync.mockRejectedValue(new Error('Could not load image'));
    expect(await pickPhotoWith('library', phone)).toEqual({ status: 'failed' });
    picker.launchImageLibraryAsync.mockRejectedValue('weird');
    expect(await pickPhotoWith('library', phone)).toEqual({ status: 'failed' });
  });

  it('reports a picture that could not be compressed', async () => {
    fakeManipulator(undefined);
    expect(await pickPhotoWith('library', phone)).toEqual({ status: 'failed' });
  });
});

describe('platforms', () => {
  it('phones offer the camera, ask for access and let the user crop', async () => {
    expect(native.canTakePhoto()).toBe(true);
    await native.pickPhoto('camera');
    expect(picker.requestCameraPermissionsAsync).toHaveBeenCalled();
    expect(picker.launchCameraAsync).toHaveBeenCalledWith(
      expect.objectContaining({ allowsEditing: true }),
    );
  });

  it('web uses the file input without asking first, and the camera only on touch screens', async () => {
    await web.pickPhoto('camera');
    expect(picker.requestCameraPermissionsAsync).not.toHaveBeenCalled();
    expect(picker.launchCameraAsync).toHaveBeenCalledWith(
      expect.objectContaining({ allowsEditing: false }),
    );

    const original = window.matchMedia;
    window.matchMedia = jest.fn((query: string) => ({
      matches: query === '(pointer: coarse)',
    })) as unknown as typeof window.matchMedia;
    expect(web.canTakePhoto()).toBe(true);
    window.matchMedia = jest.fn(() => ({ matches: false })) as unknown as typeof window.matchMedia;
    expect(web.canTakePhoto()).toBe(false);
    window.matchMedia = undefined as unknown as typeof window.matchMedia;
    expect(web.canTakePhoto()).toBe(false);
    window.matchMedia = original;
  });
});
