"use client";

/**
 * Demo state, persisted to localStorage under "freaktopia-demo-v1".
 * Everything here lives only in the visitor's browser. No server, wallet
 * or payment provider is involved in Phase 1.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useEffect, useSyncExternalStore } from "react";
import type {
  AfterParty,
  AlienLook,
  CreatedEvent,
  DemoOrder,
  DJApplication,
  EventDraft,
  FreakEvent,
  ToastMsg,
  UserProfile,
  Venue,
} from "./types";
import { levelFor, userLevel } from "./levels";

export const DEFAULT_LOOK: AlienLook = {
  species: "slime",
  body: "#B6F05C",
  accent: "#FF625C",
  outfit: "hoodie",
  outfitColor: "#A276E9",
  accessory: "headphones",
};

const DEFAULT_PROFILE: UserProfile = {
  username: "space_raver",
  bio: "New arrival. Looking for the loudest planet.",
  city: "Tokyo",
  favoriteGenres: ["Techno", "House"],
  xp: 180,
  avatarName: "SLIME BEAT",
  look: DEFAULT_LOOK,
  avatarSaved: false,
};

export const uid = (p = "id") => `${p}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;

interface Comment {
  id: string;
  name: string;
  text: string;
  at: string;
}

interface BookingRequest {
  id: string;
  djId: string;
  date: string;
  eventName: string;
  budget: number;
  message: string;
  createdAt: string;
}

interface DemoState {
  profile: UserProfile;
  /** Extra supporters/funding added by this visitor (demo). */
  support: Record<string, { supporters: number; raised: number }>;
  /** Simulator overrides from the event-detail demo slider. */
  sim: Record<string, { supporters: number; raised: number } | undefined>;
  favorites: string[]; // DJ ids
  orders: DemoOrder[];
  createdEvents: CreatedEvent[];
  eventDraft: Partial<EventDraft>;
  eventDraftStep: number;
  venues: Venue[];
  venueDraft: Partial<Venue> & { photos?: string[] };
  venueDraftStep: number;
  afterParties: AfterParty[];
  applications: DJApplication[];
  bookings: BookingRequest[];
  comments: Record<string, Comment[]>;
  likes: Record<string, number>;
  votes: Record<string, number>; // djId -> 1..5 stars given by user
  liveShowAvatar: boolean;
  liveZone: string;
  liveCheckedIn: boolean;
  ownedItems: string[];
  club: { name: string; tier: number };
  inquiriesAnswered: string[];

  addXp: (n: number) => { leveledUp: boolean; level: number };
  updateProfile: (p: Partial<UserProfile>) => void;
  saveLook: (look: AlienLook, avatarName: string) => void;
  supportEvent: (eventId: string, amount: number) => void;
  setSim: (eventId: string, v: { supporters: number; raised: number } | undefined) => void;
  toggleFavorite: (djId: string) => boolean;
  addOrder: (o: DemoOrder) => void;
  setEventDraft: (d: Partial<EventDraft>, step?: number) => void;
  publishEvent: () => CreatedEvent | null;
  resetEventDraft: () => void;
  setVenueDraft: (d: Partial<Venue> & { photos?: string[] }, step?: number) => void;
  publishVenue: () => Venue | null;
  addAfterParty: (a: AfterParty) => void;
  addApplication: (a: DJApplication) => void;
  setApplicationStatus: (id: string, status: DJApplication["status"]) => void;
  addBooking: (b: BookingRequest) => void;
  addComment: (djId: string, c: Comment) => void;
  like: (djId: string) => void;
  vote: (djId: string, stars: number) => void;
  setLive: (p: Partial<Pick<DemoState, "liveShowAvatar" | "liveZone" | "liveCheckedIn">>) => void;
  setClub: (c: Partial<DemoState["club"]>) => void;
  answerInquiry: (id: string) => void;
  resetAll: () => void;
}

const initial = {
  profile: DEFAULT_PROFILE,
  support: {},
  sim: {},
  favorites: ["gloopzilla"],
  orders: [],
  createdEvents: [],
  eventDraft: {},
  eventDraftStep: 0,
  venues: [],
  venueDraft: {},
  venueDraftStep: 0,
  afterParties: [],
  applications: [],
  bookings: [],
  comments: {},
  likes: {},
  votes: {},
  liveShowAvatar: false,
  liveZone: "entrance",
  liveCheckedIn: false,
  ownedItems: ["headphones", "hoodie", "cap"],
  club: { name: "MY FIRST CLUB", tier: 1 },
  inquiriesAnswered: [],
};

const useDemoRaw = create<DemoState>()(
  persist(
    (set, get) => ({
      ...initial,

      addXp: (n) => {
        const before = userLevel(get().profile.xp).level;
        const xp = get().profile.xp + n;
        set((s) => ({ profile: { ...s.profile, xp } }));
        const after = userLevel(xp).level;
        return { leveledUp: after > before, level: after };
      },
      updateProfile: (p) => set((s) => ({ profile: { ...s.profile, ...p } })),
      saveLook: (look, avatarName) =>
        set((s) => ({ profile: { ...s.profile, look, avatarName, avatarSaved: true } })),
      supportEvent: (eventId, amount) =>
        set((s) => {
          const cur = s.support[eventId] ?? { supporters: 0, raised: 0 };
          return { support: { ...s.support, [eventId]: { supporters: cur.supporters + (cur.supporters ? 0 : 1), raised: cur.raised + amount } } };
        }),
      setSim: (eventId, v) => set((s) => ({ sim: { ...s.sim, [eventId]: v } })),
      toggleFavorite: (djId) => {
        const has = get().favorites.includes(djId);
        set((s) => ({ favorites: has ? s.favorites.filter((f) => f !== djId) : [...s.favorites, djId] }));
        return !has;
      },
      addOrder: (o) => set((s) => ({ orders: [o, ...s.orders] })),
      setEventDraft: (d, step) =>
        set((s) => ({ eventDraft: { ...s.eventDraft, ...d }, eventDraftStep: step ?? s.eventDraftStep })),
      publishEvent: () => {
        const d = get().eventDraft as EventDraft;
        if (!d.name) return null;
        const ev: CreatedEvent = { ...d, id: uid("my-event"), createdAt: new Date().toISOString(), published: true };
        set((s) => ({ createdEvents: [ev, ...s.createdEvents], eventDraft: {}, eventDraftStep: 0 }));
        return ev;
      },
      resetEventDraft: () => set({ eventDraft: {}, eventDraftStep: 0 }),
      setVenueDraft: (d, step) =>
        set((s) => ({ venueDraft: { ...s.venueDraft, ...d }, venueDraftStep: step ?? s.venueDraftStep })),
      publishVenue: () => {
        const d = get().venueDraft;
        if (!d.name) return null;
        const v: Venue = {
          id: uid("my-venue"),
          name: d.name,
          city: d.city ?? "",
          country: d.country ?? "",
          capacity: d.capacity ?? 100,
          hourlyRate: d.hourlyRate ?? 100,
          amenities: d.amenities ?? [],
          availableDates: d.availableDates ?? [],
          address: d.address ?? "",
          palette: ["#B6F05C", "#A276E9", "#080808"],
          description: d.description ?? "",
          rating: 0,
          photos: d.photos ?? [],
          isDemo: false,
          ownerIsUser: true,
        };
        set((s) => ({ venues: [v, ...s.venues], venueDraft: {}, venueDraftStep: 0 }));
        return v;
      },
      addAfterParty: (a) => set((s) => ({ afterParties: [a, ...s.afterParties] })),
      addApplication: (a) => set((s) => ({ applications: [a, ...s.applications] })),
      setApplicationStatus: (id, status) =>
        set((s) => ({ applications: s.applications.map((a) => (a.id === id ? { ...a, status } : a)) })),
      addBooking: (b) => set((s) => ({ bookings: [b, ...s.bookings] })),
      addComment: (djId, c) =>
        set((s) => ({ comments: { ...s.comments, [djId]: [...(s.comments[djId] ?? []), c].slice(-50) } })),
      like: (djId) => set((s) => ({ likes: { ...s.likes, [djId]: (s.likes[djId] ?? 0) + 1 } })),
      vote: (djId, stars) => set((s) => ({ votes: { ...s.votes, [djId]: stars } })),
      setLive: (p) => set(p),
      setClub: (c) => set((s) => ({ club: { ...s.club, ...c } })),
      answerInquiry: (id) => set((s) => ({ inquiriesAnswered: [...s.inquiriesAnswered, id] })),
      resetAll: () => set({ ...initial }),
    }),
    {
      name: "freaktopia-demo-v1",
      storage: createJSONStorage(() => localStorage),
      version: 1,
      skipHydration: true,
    },
  ),
);

const subscribeHydration = (cb: () => void) => useDemoRaw.persist.onFinishHydration(cb);
const isHydratedSnapshot = () => useDemoRaw.persist.hasHydrated();

/**
 * True once persisted demo state is loaded. During server render and the
 * hydration pass it is always false, so HTML matches; client-side mounts
 * after that see true immediately (no flash).
 */
export function useIsHydrated() {
  return useSyncExternalStore(subscribeHydration, isHydratedSnapshot, () => false);
}

/** Triggers the one-time rehydration from localStorage (called from the layout). */
export function useHydrated() {
  const ok = useIsHydrated();
  useEffect(() => {
    if (!useDemoRaw.persist.hasHydrated()) useDemoRaw.persist.rehydrate();
  }, []);
  return ok;
}

type Selector<T> = (s: DemoState) => T;
/**
 * Hydration-safe store hook: returns values from the initial (server) state
 * until persisted data has loaded, avoiding SSR hydration mismatches.
 */
function useDemoHook(): DemoState;
function useDemoHook<T>(selector: Selector<T>): T;
function useDemoHook<T>(selector?: Selector<T>) {
  const hydrated = useIsHydrated();
  const sel = (selector ?? ((x: DemoState) => x)) as Selector<T | DemoState>;
  const live = useDemoRaw(sel);
  return hydrated ? live : sel(useDemoRaw.getInitialState());
}
export const useDemo = Object.assign(useDemoHook, {
  getState: useDemoRaw.getState,
  setState: useDemoRaw.setState,
  persist: useDemoRaw.persist,
});

/** Live stats for an event = demo base data + this visitor's support (+ simulator override). */
export function useEventStats(ev: FreakEvent) {
  const support = useDemo((s) => s.support[ev.id]);
  const sim = useDemo((s) => s.sim[ev.id]);
  const supporters = sim?.supporters ?? ev.supporters + (support?.supporters ?? 0);
  const raised = sim?.raised ?? ev.raised + (support?.raised ?? 0);
  return { supporters, raised, level: levelFor(supporters, raised), supported: !!support, simulated: !!sim };
}

/* ---------- Toasts (not persisted) ---------- */
interface ToastState {
  toasts: ToastMsg[];
  push: (t: Omit<ToastMsg, "id">) => void;
  dismiss: (id: string) => void;
}
export const useToast = create<ToastState>()((set) => ({
  toasts: [],
  push: (t) => {
    const id = uid("t");
    set((s) => ({ toasts: [...s.toasts.slice(-2), { ...t, id }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), 3800);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));
export const toast = (t: Omit<ToastMsg, "id">) => useToast.getState().push(t);

/** Grant XP and toast on user level-up. */
export function grantXp(n: number, reason: string) {
  const r = useDemo.getState().addXp(n);
  toast({ title: `+${n} XP`, body: reason, tone: "success" });
  if (r.leveledUp) setTimeout(() => toast({ title: `LEVEL UP! LV.${r.level}`, body: "Your alien grew a little weirder.", tone: "level" }), 400);
}
