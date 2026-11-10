"use client";

import { type Tu } from "@/lib/i18n/tu";
import { useTranslations } from "next-intl";
import { useMyAvatar } from "@/lib/auth/client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Ban, CornerUpLeft, Flag, MoreHorizontal, Send, ShieldCheck, Smile, X } from "lucide-react";
import { AlienAvatar } from "@/components/cards/Cards";
import { liveApi, type RoomChat } from "@/lib/live/client";
import { toast, useDemo } from "@/lib/store";
import { cn } from "@/lib/utils";

const BADGE = (tu: Tu): Record<NonNullable<RoomChat["badge"]>, { label: string; color: string }> => ({
  dj: { label: "DJ", color: "#FF625C" },
  organizer: { label: tu("organizer"), color: "#B6F05C" },
  moderator: { label: tu("mod"), color: "#55BCEB" },
});
const EMOJI = ["👽", "🔥", "🙌", "💚", "🔊", "🪩", "✨", "😵‍💫"];

/**
 * Live chat. Only the latest 60 messages come from the server (windowed), and rows use
 * content-visibility so off-screen rows are not laid out. Reports and blocks are handled on the server.
 */
export function Chat({ eventId, messages, onSent, disabled, className }: { eventId: string; messages: RoomChat[]; onSent: () => void; disabled?: string | null; className?: string }) {
  const tu = useTranslations("live");
  const [text, setText] = useState("");
  const [reply, setReply] = useState<RoomChat | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [emoji, setEmoji] = useState(false);
  const list = useRef<HTMLOListElement>(null);
  const stick = useRef(true);
  // Signed in: the account alien and display name. Never a second random alien.
  const { look, name } = useMyAvatar();
  const byId = new Map(messages.map((m) => [m.id, m]));

  useLayoutEffect(() => {
    const el = list.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  useEffect(() => {
    if (!menu) return;
    const close = (e: KeyboardEvent) => e.key === "Escape" && setMenu(null);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [menu]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    setErr(null);
    const r = await liveApi(`${eventId}/chat`, { method: "POST", json: { body, replyTo: reply?.id ?? null, name: name.slice(0, 24).padEnd(2, "_"), look } });
    setBusy(false);
    if (!r.ok) return setErr(r.error.message);
    setText("");
    setReply(null);
    stick.current = true;
    onSent();
  };

  const report = async (m: RoomChat) => {
    setMenu(null);
    const r = await liveApi<{ hidden: boolean }>(`${eventId}/chat/${m.id}/report`, { method: "POST" });
    toast(r.ok ? { title: tu("reportedToModerators"), body: r.data.hidden ? tu("theMessageIsNowHidden") : tu("thanksThreeReportsHideA") } : { title: tu("couldntReport"), body: r.error.message });
  };
  const block = async (m: RoomChat) => {
    setMenu(null);
    const r = await liveApi(`${eventId}/block`, { method: "POST", json: { userId: m.authorId } });
    toast(r.ok ? { title: tu("blockedName", { name: m.name }), body: tu("youWontSeeTheirMessages") } : { title: tu("couldntBlock"), body: r.error.message });
    if (r.ok) onSent();
  };

  return (
    <div className={cn("flex min-h-0 flex-col", className)} data-testid="chat">
      <ol
        ref={list}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
        }}
        className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-1 py-2"
        aria-label={tu("chatMessages")}
        aria-live="polite"
        aria-relevant="additions"
      >
        {messages.map((m) => {
          const parent = m.replyTo ? byId.get(m.replyTo) : null;
          return (
            <li key={m.id} className="relative flex gap-2 rounded-2xl px-2 py-1.5 hover:bg-surface-2" style={{ contentVisibility: "auto", containIntrinsicSize: "auto 56px" }}>
              <AlienAvatar look={m.look} size={32} className="mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                {parent && <p className="truncate text-[11px] text-mute"><CornerUpLeft className="mr-0.5 inline size-3" aria-hidden />{parent.name}: {parent.hidden ? tu("hiddenMessage") : parent.body}</p>}
                <p className="flex flex-wrap items-center gap-1 text-[12px]">
                  <b className={m.mine ? "text-acid" : "text-cream"}>{m.name}</b>
                  {m.badge && <span className="rounded-full px-1.5 py-px text-[9px] font-extrabold text-ink" style={{ background: BADGE(tu)[m.badge].color }}>{BADGE(tu)[m.badge].label}</span>}
                  {m.demo && !m.badge && <span className="text-[9px] font-bold uppercase text-orange/80">{tu("demo2")}</span>}
                </p>
                <p className={cn("break-words text-[14px] leading-snug", m.hidden && "italic text-mute")}>{m.hidden ? tu("hiddenAfterReportsModeratorsWill") : m.body}</p>
              </div>
              {!m.mine && !m.hidden && (
                <button type="button" onClick={() => setMenu(menu === m.id ? null : m.id)} aria-label={tu("actionsForMessageFromName", { name: m.name })} aria-expanded={menu === m.id} className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-mute hover:bg-surface">
                  <MoreHorizontal className="size-4" />
                </button>
              )}
              {menu === m.id && (
                <div className="absolute right-2 top-11 z-10 flex gap-1 rounded-2xl border border-line bg-ink p-1 shadow-xl" role="menu">
                  <button type="button" role="menuitem" onClick={() => { setReply(m); setMenu(null); }} className="inline-flex min-h-11 items-center gap-1 rounded-xl px-3 text-[13px] font-bold hover:bg-surface"><CornerUpLeft className="size-4" aria-hidden />{tu("reply")}</button>
                  {!m.badge && <button type="button" role="menuitem" onClick={() => report(m)} className="inline-flex min-h-11 items-center gap-1 rounded-xl px-3 text-[13px] font-bold text-orange hover:bg-surface"><Flag className="size-4" aria-hidden />{tu("report")}</button>}
                  {!m.badge && <button type="button" role="menuitem" onClick={() => block(m)} className="inline-flex min-h-11 items-center gap-1 rounded-xl px-3 text-[13px] font-bold text-coral hover:bg-surface"><Ban className="size-4" aria-hidden />{tu("block")}</button>}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <form onSubmit={send} className="border-t border-line pt-2">
        {reply && (
          <div className="mb-1.5 flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-1 text-[12px]">
            <CornerUpLeft className="size-3.5 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 truncate">{tu("replyingTo")} <b>{reply.name}</b>: {reply.body}</span>
            <button type="button" onClick={() => setReply(null)} aria-label={tu("cancelReply")} className="inline-flex size-11 items-center justify-center"><X className="size-4" /></button>
          </div>
        )}
        {emoji && (
          <div className="mb-1.5 flex flex-wrap gap-1" role="group" aria-label={tu("emoji")}>
            {EMOJI.map((e) => <button key={e} type="button" onClick={() => setText((t) => (t + e).slice(0, 280))} className="inline-flex size-11 items-center justify-center rounded-xl bg-surface-2 text-lg" aria-label={tu("insertE", { e })}>{e}</button>)}
          </div>
        )}
        {disabled ? (
          <p className="rounded-2xl bg-surface-2 p-3 text-[13px] text-mute">{disabled}</p>
        ) : (
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => setEmoji(!emoji)} aria-label={tu("emoji")} aria-expanded={emoji} className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-2"><Smile className="size-5" /></button>
            <label className="min-w-0 flex-1">
              <span className="sr-only">{tu("message")}</span>
              <input value={text} onChange={(e) => setText(e.target.value.slice(0, 280))} maxLength={280} placeholder={tu("sayHiAsName", { name })} className="min-h-11 w-full rounded-full border-2 border-line bg-surface px-4 text-[16px] outline-none focus:border-acid" aria-label={tu("chatMessage")} />
            </label>
            <button type="submit" disabled={!text.trim() || busy} aria-label={tu("sendMessage")} className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-acid text-ink disabled:opacity-40"><Send className="size-5" /></button>
          </div>
        )}
        {err && <p className="mt-1 text-[12px] text-coral" role="alert">{err}</p>}
        <p className="mt-1.5 flex items-center gap-1 text-[11px] text-mute"><ShieldCheck className="size-3.5 text-acid" aria-hidden />{tu("beKindLinksSpamAnd")}</p>
      </form>
    </div>
  );
}
