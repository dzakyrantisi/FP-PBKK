export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export const buildImageUrl = (path?: string | null) => {
  if (!path) {
    return null;
  }
  const normalized = path.replace(/\\/g, '/');
  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }
  return `${API_BASE_URL}/${normalized.replace(/^\//, '')}`;
};
