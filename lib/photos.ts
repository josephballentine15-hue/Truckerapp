import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
// Use the stable legacy file API (documentDirectory / copyAsync). The new
// object-based API changed shape across SDKs; legacy stays consistent.
import * as FileSystem from 'expo-file-system/legacy';
import { makeId } from './id';

export type PhotoSource = 'camera' | 'library';

const PHOTO_DIR = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}photos/`
  : null;

async function ensureDir(): Promise<void> {
  if (!PHOTO_DIR) return;
  const info = await FileSystem.getInfoAsync(PHOTO_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(PHOTO_DIR, { intermediates: true });
  }
}

// Copy a picked image out of the OS cache into app storage so it survives.
// On web there is no document directory, so we keep the picker uri as-is.
async function persist(uri: string): Promise<string> {
  if (Platform.OS === 'web' || !PHOTO_DIR) return uri;
  try {
    await ensureDir();
    const ext = uri.split('.').pop()?.split('?')[0] || 'jpg';
    const dest = `${PHOTO_DIR}${makeId('p_')}.${ext}`;
    await FileSystem.copyAsync({ from: uri, to: dest });
    return dest;
  } catch {
    return uri;
  }
}

// Returns a persisted local uri, or null if the user cancelled / denied access.
export async function capturePhoto(source: PhotoSource): Promise<string | null> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return null;
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.5,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets?.length) return null;
    return persist(result.assets[0].uri);
  }

  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.5,
    allowsEditing: false,
  });
  if (result.canceled || !result.assets?.length) return null;
  return persist(result.assets[0].uri);
}

// Delete a photo file we previously persisted (ignore errors / web uris).
export async function deletePhoto(uri: string | null): Promise<void> {
  if (!uri || Platform.OS === 'web' || !PHOTO_DIR) return;
  if (!uri.startsWith(PHOTO_DIR)) return;
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // ignore
  }
}
