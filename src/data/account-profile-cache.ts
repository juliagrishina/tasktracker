import type { AccountProfile, AccountProfileCache } from '../application/account-profile';

export interface AccountProfileStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export function createAccountProfileCache({
  storage,
  userId,
}: {
  storage: AccountProfileStorage;
  userId: string;
}): AccountProfileCache {
  const key = `planme.account-profile.${userId}`;

  return {
    async load() {
      const raw = await storage.getItem(key);
      if (raw === null) return null;
      try {
        const profile = JSON.parse(raw) as AccountProfile;
        return profile.userId === userId ? profile : null;
      } catch {
        return null;
      }
    },
    async save(profile) {
      if (profile.userId !== userId) {
        throw new Error('Account profile cache cannot write another user profile.');
      }
      await storage.setItem(key, JSON.stringify(profile));
    },
  };
}
