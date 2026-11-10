import { toLook } from "@/lib/alien/catalog";
import { getStore } from "./store";

/** Everything the signed-in user may see about their own account. The generation seed stays server-side. */
export async function me(userId: string) {
  const store = getStore();
  const [user, profile, privacy, alien, providers, wallets] = await Promise.all([
    store.findUserById(userId),
    store.getProfile(userId),
    store.getPrivacy(userId),
    store.getAlien(userId),
    store.providersOf(userId),
    store.walletsOf(userId),
  ]);
  if (!user) return null;
  return {
    user: { id: user.id, email: user.email, emailVerified: user.emailVerified, hasPassword: Boolean(user.passwordHash), createdAt: user.createdAt },
    profile,
    privacy,
    alien: alien ? { ...alien, seed: undefined, look: toLook(alien) } : null,
    providers,
    wallets: wallets.map((w) => ({ address: w.address, chainId: w.chainId, linkedAt: w.linkedAt })),
  };
}

