import { createMMKV } from 'react-native-mmkv';

export const APP_STORAGE_ID = 'manga-reader-storage';
export const APP_STORAGE_ENCRYPTION_KEY = 'manga-reader-encryption-key';

/**
 * MangaReader 唯一的持久化命名空间。
 * 沿用既有 HTYF 迁移版本的 ID 与密钥，避免升级后丢失本地漫画数据。
 */
export const createAppStorage = () =>
  createMMKV({ id: APP_STORAGE_ID, encryptionKey: APP_STORAGE_ENCRYPTION_KEY });

export const appStorage = createAppStorage();
