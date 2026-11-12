import { apiClient } from '@/shared/api/client';

export type MediaPurpose = 'chat' | 'kyc' | 'product' | 'receipt' | 'profile';

type PresignResponse = {
  storageKey: string;
  uploadUrl: string;
  headers: Record<string, string>;
  maxBytes: number;
};

let storageConfiguredCache: boolean | null = null;

export async function isMediaStorageConfigured(): Promise<boolean> {
  if (storageConfiguredCache !== null) return storageConfiguredCache;
  try {
    const { data } = await apiClient.get<{ configured: boolean }>('/media/status');
    storageConfiguredCache = Boolean(data.configured);
  } catch {
    storageConfiguredCache = false;
  }
  return storageConfiguredCache;
}

/**
 * Sube un File al bucket vía URL prefirmada.
 * Devuelve storageKey (+ preview blob URL opcional).
 */
export async function uploadMediaFile(
  file: File,
  purpose: MediaPurpose,
): Promise<{ storageKey: string; previewUrl: string; mimeType: string; sizeBytes: number }> {
  const { data: presign } = await apiClient.post<PresignResponse>('/media/presign', {
    purpose,
    contentType: file.type || 'application/octet-stream',
    contentLength: file.size,
    fileName: file.name,
  });

  const put = await fetch(presign.uploadUrl, {
    method: 'PUT',
    headers: {
      ...(presign.headers ?? {}),
      'Content-Type': file.type || 'application/octet-stream',
    },
    body: file,
  });
  if (!put.ok) {
    throw new Error(`No se pudo subir el archivo (${put.status})`);
  }

  await apiClient.post('/media/confirm', {
    storageKey: presign.storageKey,
    purpose,
  });

  return {
    storageKey: presign.storageKey,
    previewUrl: URL.createObjectURL(file),
    mimeType: file.type,
    sizeBytes: file.size,
  };
}

export function storageRefUrl(storageKey: string): string {
  return `storage://${storageKey}`;
}
