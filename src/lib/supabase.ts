export function getSupabase() {
  return null;
}

export function isSupabaseConfigured() {
  return false;
}

export const SUPABASE_CONFIG_STATUS = {
  isReady: false,
  url: '',
};

export const SUPABASE_SQL_SCHEMA = `-- Supabase completely removed from Bid project.
`;

export async function ensureMediaBucketExists() {
  return { success: true };
}

export async function uploadMediaToSupabase(file: File | Blob, fileName?: string, folder = 'general') {
  return null;
}

export const MOTORIDE_MEDIA_BUCKET = 'motoride-media';

export type StorageStatus = any;
export function syncAllAccountsToSupabase() {
  return Promise.resolve({ synced: 0, total: 0 });
}
