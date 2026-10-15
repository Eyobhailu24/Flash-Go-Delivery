export function parseMapFlag(value: string | undefined): boolean {
  if (!value || value === 'false') return false;
  if (value === 'true') return true;
  throw new Error('EXPO_PUBLIC_GOOGLE_MAPS must be true or false.');
}
