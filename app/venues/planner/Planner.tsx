"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles, Wand2, ArrowRight } from "lucide-react";
import { DJS, GENRES, VENUES, getVenue } from "@/lib/data";
import { Field, Input, Select } from "@/components/forms/Fields";
import { Button, Card, DemoNotice, PageTitle, Tag } from "@/components/ui/primitives";
import { AlienAvatar } from "@/components/cards/Cards";
import { useDemo } from "@/lib/store";
import { money } from "@/lib/utils";
import type { Genre } from "@/lib/types";

export function Planner() {
  const params = useSearchParams();
  const router = useRouter();
  const setDraft = useDemo((s) => s.setEventDraft);
  const pre = getVenue(params.get("venue") ?? "");
  const [city, setCity] = useState(pre?.city ?? "Tokyo");
  const [genre, setGenre] = useState<Genre>("Techno");
  const [people, setPeople] = useState(pre ? Math.round(pre.capacity * 0.7) : 300);
  const [budget, setBudget] = useState(8000);
  const [plan, setPlan] = useState<null | ReturnType<typeof makePlan>>(null);

  function makePlan() {
    const venues = [...VENUES].filter((v) => v.capacity >= people * 0.9);
    const venue = pre ?? venues.sort((a, b) => Number(b.city === city) - Number(a.city === city) || a.capacity - b.capacity)[0] ?? VENUES[0];
    const djs = DJS.filter((d) => d.genres.includes(genre)).slice(0, 3);
    const hours = 7;
    const venueCost = venue.hourlyRate * hours;
    const djCost = djs.reduce((s, d) => s + Math.round(d.bookingFrom * 0.6), 0);
    const production = Math.round(budget * 0.15);
    const total = venueCost + djCost + production;
    const price = Math.max(10, Math.ceil((total * 1.15) / Math.max(1, people * 0.75) / 5) * 5);
    return { venue, djs, hours, venueCost, djCost, production, total, price, over: total > budget };
  }

  const use = () => {
    if (!plan) return;
    setDraft({ city, genres: [genre], capacity: people, budget, venueMode: "select", venueId: plan.venue.id, djGenres: [genre], tickets: [{ kind: "main", enabled: true, price: plan.price, quantity: people }, { kind: "afterparty", enabled: false, price: 15, quantity: 80 }, { kind: "allnight", enabled: false, price: 35, quantity: 100 }, { kind: "vip", enabled: false, price: 70, quantity: 20 }] }, 0);
    router.push("/events/create");
  };

  return (
    <div className="mx-auto max-w-2xl md:px-6">
      <PageTitle kicker="Beginner friendly" title="AI event planner" sub="都市・ジャンル・人数・予算を入れるだけで、会場・DJ・チケット価格の企画案を作成します。" />
      <DemoNotice className="mx-4 md:mx-0"><strong>Demo:</strong> suggestions come from simple rules over sample data. No AI model is connected in Phase 1.</DemoNotice>
      <form className="mt-5 space-y-4 px-4 md:px-0" onSubmit={(e) => { e.preventDefault(); setPlan(makePlan()); }}>
        <div className="grid grid-cols-2 gap-3">
          <Field id="pc" label="City"><Input id="pc" value={city} onChange={(e) => setCity(e.target.value)} list="pl-cities" /></Field>
          <Field id="pg" label="Genre"><Select id="pg" value={genre} onChange={(e) => setGenre(e.target.value as Genre)}>{GENRES.map((g) => <option key={g}>{g}</option>)}</Select></Field>
          <Field id="pp" label="Expected people"><Input id="pp" type="number" inputMode="numeric" value={people} onChange={(e) => setPeople(Math.max(20, +e.target.value || 20))} /></Field>
          <Field id="pb" label="Budget (USD)"><Input id="pb" type="number" inputMode="numeric" value={budget} onChange={(e) => setBudget(Math.max(0, +e.target.value || 0))} /></Field>
        </div>
        <datalist id="pl-cities">{Array.from(new Set(VENUES.map((v) => v.city))).map((c) => <option key={c} value={c} />)}</datalist>
        <Button type="submit" size="lg" className="w-full" variant="purple"><Wand2 className="size-5" aria-hidden /> Generate plan</Button>
      </form>

      {plan && (
        <section aria-labelledby="plan-h" className="mt-6 space-y-3 px-4 md:px-0" aria-live="polite">
          <h2 id="plan-h" className="flex items-center gap-2 text-3xl uppercase"><Sparkles className="size-6 text-purple" aria-hidden /> Your plan</h2>
          <Card className="p-4">
            <div className="text-xs font-bold uppercase text-mute">Venue</div>
            <div className="mt-1 text-lg font-extrabold">{plan.venue.name}</div>
            <div className="text-sm text-mute">{plan.venue.city} · cap {plan.venue.capacity} · {money(plan.venue.hourlyRate)}/h × {plan.hours}h</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs font-bold uppercase text-mute">Suggested lineup</div>
            <ul className="mt-2 space-y-2">
              {plan.djs.map((d) => <li key={d.id} className="flex items-center gap-2"><AlienAvatar look={d.look} size={36} /><span className="font-bold">{d.name}</span><span className="text-xs text-mute">{d.city}</span></li>)}
              {!plan.djs.length && <li className="text-sm text-mute">No sample DJs for this genre. Open a DJ call instead.</li>}
            </ul>
          </Card>
          <Card className="p-4">
            <div className="text-xs font-bold uppercase text-mute">Budget</div>
            <ul className="mt-2 space-y-1 text-sm">
              <li className="flex justify-between"><span>Venue</span><span>{money(plan.venueCost)}</span></li>
              <li className="flex justify-between"><span>DJs</span><span>{money(plan.djCost)}</span></li>
              <li className="flex justify-between"><span>Production & staff</span><span>{money(plan.production)}</span></li>
              <li className="flex justify-between border-t border-line pt-1 font-bold"><span>Total</span><span>{money(plan.total)}</span></li>
            </ul>
            {plan.over ? <Tag color="#FF625C" dark className="mt-2">Over budget · try fewer DJs or a smaller venue</Tag> : <Tag color="#B6F05C" dark className="mt-2">Within budget</Tag>}
            <p className="mt-3 text-sm">Suggested main ticket: <strong className="font-display text-lg">{money(plan.price)}</strong></p>
          </Card>
          <Button size="lg" className="w-full" onClick={use}>Use this plan <ArrowRight className="size-5" aria-hidden /></Button>
        </section>
      )}
    </div>
  );
}
