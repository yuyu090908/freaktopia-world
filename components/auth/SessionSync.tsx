"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth/client";
import { useDemo } from "@/lib/store";

/**
 * Loads the session once per page load and, when signed in, makes the account alien the avatar
 * used everywhere (LIVE, DAO, rankings, profile): those features read the profile look from the demo store.
 */
export function SessionSync() {
  const refresh = useAuth((s) => s.refresh);
  const me = useAuth((s) => s.me);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    const alien = me?.alien;
    if (!me || !alien) return;
    const apply = () => {
      const st = useDemo.getState();
      const name = me.profile.displayName ?? alien.name;
      const same = JSON.stringify(st.profile.look) === JSON.stringify(alien.look) && st.profile.avatarName === alien.name && st.profile.username === name;
      if (!same) st.updateProfile({ look: alien.look, avatarName: alien.name, avatarSaved: true, username: name });
    };
    // The demo store rehydrates from localStorage after mount: apply after that, or it would be overwritten.
    if (useDemo.persist.hasHydrated()) apply();
    return useDemo.persist.onFinishHydration(apply);
  }, [me]);
  return null;
}
