import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
export type UploadImage = { uri: string; name: string; type: string };
export async function chooseImage(): Promise<UploadImage | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted)
    throw new Error('Allow photo access to choose an image.');
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    quality: 0.85,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const resized = await ImageManipulator.manipulateAsync(
    asset.uri,
    asset.width > 1200 ? [{ resize: { width: 1200 } }] : [],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
  );
  return {
    uri: resized.uri,
    name: `flashgo-${Date.now()}.jpg`,
    type: 'image/jpeg',
  };
}
export async function formWithImage(
  values: Record<string, unknown>,
  image?: UploadImage | null,
) {
  const form = new FormData();
  for (const [key, value] of Object.entries(values))
    if (value !== undefined && value !== null) form.append(key, String(value));
  if (image) {
    if (Platform.OS === 'web')
      form.append('image', await (await fetch(image.uri)).blob(), image.name);
    else form.append('image', image as unknown as Blob);
  }
  return form;
}
