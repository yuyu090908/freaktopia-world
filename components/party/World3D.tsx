"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Alien } from "@/components/art/Alien";
import { useLocalHref } from "@/components/i18n/LocaleContext";
import { cn } from "@/lib/utils";
import { THEME_COLORS, deviceTier, type Planet, type Shown, type Theme, type WorldData } from "./shared";

/**
 * 3D world (three.js, loaded only when this mode is used). Original FREAKTOPIA look: flat toon planets with a
 * thick black outline, neon glows, aliens standing on the home planet. No realistic globe.
 *
 * Performance: one shared geometry per shape, per-device caps on drawn aliens (120 / 40) and crowd dots
 * (1500 / 400), aliens hidden when the camera is far away (crowd dots stay), the loop pauses when the tab is
 * hidden or the world is off screen, and it never auto-rotates with reduced motion.
 */

const CAPS = { high: { avatars: 120, crowd: 1500, dpr: 1.75 }, low: { avatars: 40, crowd: 400, dpr: 1 } };
const ORBIT_X = 6.2;
const ORBIT_Z = 4.6;

export function World3D({ w, planetHref, selected, onSelect, onFail }: { w: WorldData; planetHref: (p: Planet) => string; selected: string | null; onSelect: (id: string) => void; onFail: () => void }) {
  const t = useTranslations("party");
  const href = useLocalHref();
  const router = useRouter();
  const host = useRef<HTMLDivElement>(null);
  const svgs = useRef<HTMLDivElement>(null);
  const labels = useRef<(HTMLAnchorElement | null)[]>([]);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const tier = typeof window === "undefined" ? "high" : deviceTier();
  const cap = CAPS[tier];
  const avatars = w.community.shown.slice(0, cap.avatars);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: tier === "high", alpha: false, powerPreference: tier === "high" ? "high-performance" : "low-power" });
    } catch {
      onFail();
      return;
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap.dpr));
    renderer.setClearColor(0x080808);
    el.appendChild(renderer.domElement);
    renderer.domElement.setAttribute("aria-hidden", "true");
    renderer.domElement.style.touchAction = "none";

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
    camera.position.set(0, 6.5, 13);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 5;
    controls.maxDistance = 26;
    controls.maxPolarAngle = Math.PI * 0.85;
    controls.autoRotate = !reduced;
    controls.autoRotateSpeed = 0.35;

    scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(5, 8, 6);
    scene.add(sun);

    const disposables: { dispose: () => void }[] = [];
    const keep = <T extends { dispose: () => void }>(x: T) => (disposables.push(x), x);
    const toonSteps = (() => {
      const d = new Uint8Array([90, 170, 255]);
      const tex = new THREE.DataTexture(d, 3, 1, THREE.RedFormat);
      tex.minFilter = tex.magFilter = THREE.NearestFilter;
      tex.needsUpdate = true;
      return keep(tex);
    })();
    const outlineMat = keep(new THREE.MeshBasicMaterial({ color: 0x080808, side: THREE.BackSide }));
    const sphere = keep(new THREE.IcosahedronGeometry(1, 3));
    const lumpy = keep(new THREE.IcosahedronGeometry(1, 1));
    const ring = keep(new THREE.TorusGeometry(1, 0.035, 6, 64));
    const box = keep(new THREE.BoxGeometry(1, 1, 1));
    const cone = keep(new THREE.ConeGeometry(1, 1.4, 4));
    const toon = (color: THREE.ColorRepresentation, emissive: THREE.ColorRepresentation = 0x000000, transparent = false, opacity = 1) =>
      keep(new THREE.MeshToonMaterial({ color, gradientMap: toonSteps, emissive, emissiveIntensity: 0.35, transparent, opacity }));
    const outlined = (geo: THREE.BufferGeometry, mat: THREE.Material, s = 1.06) => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(geo, mat));
      const o = new THREE.Mesh(geo, outlineMat);
      o.scale.setScalar(s);
      g.add(o);
      return g;
    };

    // Stars: cheap Points field.
    {
      const n = tier === "high" ? 900 : 300;
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const r = 40 + ((i * 7919) % 50);
        const th = (i * 2.399) % (Math.PI * 2);
        const ph = Math.acos(1 - 2 * ((i * 0.618) % 1));
        pos.set([r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th)], i * 3);
      }
      const g = keep(new THREE.BufferGeometry());
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      scene.add(new THREE.Points(g, keep(new THREE.PointsMaterial({ color: 0xf5f2ea, size: 0.18, transparent: true, opacity: 0.6 }))));
    }

    // Home planet: grows with the verified stage.
    const stage = w.growth.stage;
    const R = 1.5 + stage * 0.22;
    const home = outlined(sphere, toon(0x7fbf2e, 0x2a4a08), 1.05);
    home.scale.setScalar(R);
    scene.add(home);
    const halo = new THREE.Mesh(sphere, keep(new THREE.MeshBasicMaterial({ color: 0xb6f05c, transparent: true, opacity: 0.08 })));
    halo.scale.setScalar(R * 1.25);
    scene.add(halo);
    if (stage >= 2) {
      const r = new THREE.Mesh(ring, keep(new THREE.MeshBasicMaterial({ color: 0xff8fd1 })));
      r.scale.setScalar(R * 1.55);
      r.rotation.x = Math.PI / 2.2;
      scene.add(r);
    }
    if (stage >= 1) {
      // Venue on the north pole: a deck that widens and gains towers / a festival roof with each stage.
      const venue = new THREE.Group();
      const deck = outlined(box, toon(0x1a1a1a, 0x0b0b0b), 1.12);
      deck.scale.set(0.5 + stage * 0.18, 0.18, 0.45);
      venue.add(deck);
      for (const sx of [-1, 1]) {
        if (stage < 2) break;
        const tower = outlined(box, toon(0x55bceb, 0x10384a), 1.15);
        tower.scale.set(0.12, 0.35 + stage * 0.06, 0.12);
        tower.position.set(sx * (0.3 + stage * 0.1), 0.2, 0);
        venue.add(tower);
      }
      if (stage >= 4) {
        const roof = outlined(cone, toon(0xff625c, 0x4a1210), 1.08);
        roof.scale.set(0.5 + stage * 0.12, 0.35, 0.4);
        roof.position.y = 0.55;
        roof.rotation.y = Math.PI / 4;
        venue.add(roof);
      }
      venue.position.y = R * 0.98;
      scene.add(venue);
    }

    // Event planets on the orbit. Same shared shapes, one look per genre.
    const planetMeshes: THREE.Object3D[] = [];
    const planetGroups: THREE.Group[] = [];
    const pos = (i: number) => {
      const a = (i / Math.max(w.planets.length, 1)) * Math.PI * 2 - Math.PI / 2;
      return new THREE.Vector3(Math.cos(a) * ORBIT_X, Math.sin(a * 2) * 0.5, Math.sin(a) * ORBIT_Z);
    };
    const orbitLine = new THREE.Mesh(ring, keep(new THREE.MeshBasicMaterial({ color: 0xa276e9, transparent: true, opacity: 0.25 })));
    orbitLine.scale.set(ORBIT_X, ORBIT_Z, 1);
    orbitLine.rotation.x = Math.PI / 2;
    scene.add(orbitLine);
    w.planets.forEach((p, i) => {
      const c = THEME_COLORS[p.theme];
      const dim = p.state === "unverified" || p.state === "cancelled";
      const g = new THREE.Group();
      const size = p.theme === "festival" ? 0.75 : 0.42 + Math.min(4, p.level) * 0.05;
      const body = outlined(p.theme === "afro_house" ? lumpy : sphere, toon(c.base, c.glow, dim, dim ? 0.45 : 1), 1.08);
      body.scale.setScalar(size);
      body.userData.planetId = p.id;
      body.traverse((m) => (m.userData.planetId = p.id));
      g.add(body);
      planetMeshes.push(body);
      addGenreDetail(g, p.theme, size);
      if (p.state === "upcoming") {
        const dash = new THREE.Mesh(ring, keep(new THREE.MeshBasicMaterial({ color: c.glow, transparent: true, opacity: 0.8 })));
        dash.scale.setScalar(size * 1.5);
        dash.userData.spin = true;
        g.add(dash);
      }
      const glow = new THREE.Mesh(sphere, keep(new THREE.MeshBasicMaterial({ color: c.glow, transparent: true, opacity: 0.12 })));
      glow.scale.setScalar(size * 1.45);
      glow.userData.glow = p.id;
      g.add(glow);
      g.position.copy(pos(i));
      scene.add(g);
      planetGroups.push(g);
    });
    function addGenreDetail(g: THREE.Group, theme: Theme, size: number) {
      const c = THEME_COLORS[theme];
      if (theme === "tech_house") {
        // Two cube satellites: a club-light rig.
        for (const k of [0, 1]) {
          const cube = outlined(box, toon(c.accent, c.accent), 1.2);
          cube.scale.setScalar(size * 0.22);
          cube.userData.orbit = { r: size * 1.6, phase: k * Math.PI, speed: 0.9 };
          g.add(cube);
        }
      } else if (theme === "melodic_techno") {
        const r = new THREE.Mesh(ring, keep(new THREE.MeshBasicMaterial({ color: c.glow })));
        r.scale.setScalar(size * 1.75);
        r.rotation.x = Math.PI / 2.6;
        g.add(r);
      } else if (theme === "afro_house") {
        const sunDisc = outlined(sphere, toon(c.accent, c.accent), 1.15);
        sunDisc.scale.setScalar(size * 0.25);
        sunDisc.position.set(size * 0.9, size * 0.9, 0);
        g.add(sunDisc);
      } else if (theme === "festival") {
        for (const k of [0, 1, 2]) {
          const tent = outlined(cone, toon([c.accent, 0xffad5b, 0x55bceb][k], 0x220022), 1.12);
          tent.scale.setScalar(size * 0.22);
          const a = (k / 3) * Math.PI * 2;
          tent.position.set(Math.cos(a) * size * 0.55, size * 0.92, Math.sin(a) * size * 0.55);
          g.add(tent);
        }
        const r = new THREE.Mesh(ring, keep(new THREE.MeshBasicMaterial({ color: c.accent })));
        r.scale.setScalar(size * 1.6);
        r.rotation.x = Math.PI / 2;
        g.add(r);
      }
    }

    // Anonymous crowd + people over the device cap: colored dots on the planet's upper half. Everyone is counted.
    const crowdCount = Math.min(Math.max(w.community.total - avatars.length, 0), cap.crowd);
    if (crowdCount > 0) {
      const cp = new Float32Array(crowdCount * 3);
      const cc = new Float32Array(crowdCount * 3);
      const palette = [0xb6f05c, 0xa276e9, 0x55bceb, 0xff8fd1].map((x) => new THREE.Color(x));
      for (let i = 0; i < crowdCount; i++) {
        const th = i * 2.39996;
        const y = 0.15 + 0.8 * ((i * 0.61803) % 1);
        const rr = Math.sqrt(1 - y * y);
        cp.set([Math.cos(th) * rr * R * 1.02, y * R * 1.02, Math.sin(th) * rr * R * 1.02], i * 3);
        const col = palette[i % 4];
        cc.set([col.r, col.g, col.b], i * 3);
      }
      const g = keep(new THREE.BufferGeometry());
      g.setAttribute("position", new THREE.BufferAttribute(cp, 3));
      g.setAttribute("color", new THREE.BufferAttribute(cc, 3));
      const dots = new THREE.Points(g, keep(new THREE.PointsMaterial({ size: 0.07, vertexColors: true })));
      dots.scale.setScalar(1 / R); // positions are in world units; the home group is scaled by R
      home.add(dots);
    }

    // Opted-in aliens as sprites, textured from the same SVG aliens used everywhere else.
    const avatarGroup = new THREE.Group();
    scene.add(avatarGroup);
    const sprites: THREE.Sprite[] = [];
    const glowTex = (() => {
      const cv = document.createElement("canvas");
      cv.width = cv.height = 64;
      const ctx = cv.getContext("2d")!;
      const gr = ctx.createRadialGradient(32, 32, 4, 32, 32, 32);
      gr.addColorStop(0, "rgba(255,255,255,0.9)");
      gr.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, 64, 64);
      return keep(new THREE.CanvasTexture(cv));
    })();
    const TIER_GLOW: Record<string, { color: number; size: number } | null> = { first: null, aura: { color: 0xa276e9, size: 1.5 }, glow: { color: 0xb6f05c, size: 1.9 }, regular: { color: 0xffad5b, size: 2.2 } };
    let cancelled = false;
    const nodes = svgs.current ? Array.from(svgs.current.querySelectorAll("svg")) : [];
    nodes.forEach((svg, i) => {
      const a = avatars[i];
      if (!a) return;
      const th = i * 2.39996 + 0.7;
      const y = 0.35 + 0.6 * ((i * 0.381966) % 1);
      const rr = Math.sqrt(1 - y * y);
      const at = new THREE.Vector3(Math.cos(th) * rr, y, Math.sin(th) * rr).multiplyScalar(R * 1.12);
      const fx = TIER_GLOW[a.tier];
      if (fx) {
        const halo = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: glowTex, color: fx.color, transparent: true, opacity: 0.45, depthWrite: false })));
        halo.scale.setScalar(0.32 * fx.size);
        halo.position.copy(at);
        avatarGroup.add(halo);
      }
      const xml = new XMLSerializer().serializeToString(svg);
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        if (cancelled) return;
        const cv = document.createElement("canvas");
        cv.width = cv.height = tier === "high" ? 128 : 64;
        cv.getContext("2d")!.drawImage(img, 0, 0, cv.width, cv.height);
        const tex = keep(new THREE.CanvasTexture(cv));
        tex.colorSpace = THREE.SRGBColorSpace;
        const s = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: tex, transparent: true })));
        s.scale.setScalar(a.tier === "regular" ? 0.62 : 0.52);
        s.position.copy(at);
        s.userData.publicId = a.publicId;
        avatarGroup.add(s);
        sprites.push(s);
      };
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
    });

    // Resize, visibility, picking.
    let baseDist = 14;
    let lastW = -1;
    const resize = () => {
      const { clientWidth: cw, clientHeight: ch } = el;
      renderer.setSize(cw, ch, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      camera.aspect = cw / Math.max(ch, 1);
      // Narrow (phone) screens: step back so the whole orbit fits.
      const want = 14 * Math.max(1, 1.25 / camera.aspect);
      baseDist = Math.min(want, controls.maxDistance);
      if (cw !== lastW) camera.position.setLength(baseDist); // not on phone URL-bar height changes, so zoom is kept
      lastW = cw;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    let visible = true;
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      loop();
    });
    io.observe(el);
    const onVis = () => loop();
    document.addEventListener("visibilitychange", onVis);
    const onLost = (e: Event) => {
      e.preventDefault();
      onFail();
    };
    renderer.domElement.addEventListener("webglcontextlost", onLost);

    const ray = new THREE.Raycaster();
    let down: { x: number; y: number } | null = null;
    const pick = (ev: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1), camera);
      const hitA = avatarGroup.visible ? ray.intersectObjects(sprites, false)[0] : undefined;
      const hitP = ray.intersectObjects(planetMeshes, true)[0];
      if (hitA && (!hitP || hitA.distance < hitP.distance) && hitA.object.userData.publicId) {
        router.push(href(`/u/${hitA.object.userData.publicId}`));
        return;
      }
      if (hitP) onSelectRef.current(hitP.object.userData.planetId);
    };
    const pd = (ev: PointerEvent) => (down = { x: ev.clientX, y: ev.clientY });
    const pu = (ev: PointerEvent) => {
      if (down && Math.hypot(ev.clientX - down.x, ev.clientY - down.y) < 6) pick(ev);
      down = null;
    };
    renderer.domElement.addEventListener("pointerdown", pd);
    renderer.domElement.addEventListener("pointerup", pu);
    const stopAuto = () => (controls.autoRotate = false);
    controls.addEventListener("start", stopAuto);

    const clock = new THREE.Clock();
    const v = new THREE.Vector3();
    const frame = () => {
      const dt = clock.getDelta();
      const tt = clock.elapsedTime;
      controls.update(dt);
      const dist = camera.position.length();
      avatarGroup.visible = dist < baseDist * 1.3; // LOD: far away only the crowd dots remain
      planetGroups.forEach((g, i) => {
        for (const ch of g.children) {
          if (ch.userData.orbit) {
            const o = ch.userData.orbit;
            const a = o.phase + (reduced ? 0 : tt * o.speed);
            ch.position.set(Math.cos(a) * o.r, 0, Math.sin(a) * o.r);
          }
          if (ch.userData.spin && !reduced) ch.rotation.z = tt * 0.5;
          if (ch.userData.glow) ((ch as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = ch.userData.glow === selectedRef.current ? 0.35 : 0.12;
        }
        const label = labels.current[i];
        if (label) {
          v.copy(g.position).project(camera);
          const behind = v.z > 1;
          label.style.transform = `translate(-50%, -50%) translate(${((v.x + 1) / 2) * el.clientWidth}px, ${((1 - v.y) / 2) * el.clientHeight}px)`;
          label.style.opacity = behind ? "0" : "1";
        }
      });
      renderer.render(scene, camera);
    };
    let running = false;
    function loop() {
      const should = visible && !document.hidden;
      if (should && !running) {
        clock.getDelta();
        renderer.setAnimationLoop(frame);
        running = true;
      } else if (!should && running) {
        renderer.setAnimationLoop(null);
        running = false;
      }
    }
    loop();

    return () => {
      cancelled = true;
      renderer.setAnimationLoop(null);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      renderer.domElement.removeEventListener("webglcontextlost", onLost);
      renderer.domElement.removeEventListener("pointerdown", pd);
      renderer.domElement.removeEventListener("pointerup", pu);
      controls.dispose();
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
    // The scene is rebuilt only when the world data changes; selection is read through a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w]);

  return (
    <div className="relative h-full w-full overflow-hidden" data-testid="world-3d">
      <div ref={host} className="absolute inset-0" role="img" aria-label={t("worldAlt", { name: w.owner.name ?? "—", stage: w.growth.stage })} />
      {/* Hidden source SVGs for the alien textures (the same aliens as everywhere else). */}
      <div ref={svgs} className="pointer-events-none absolute -left-[9999px] top-0 size-0 overflow-hidden" aria-hidden>
        {avatars.map((a: Shown) => (
          <Alien key={a.key} look={a.look} className="size-32" />
        ))}
      </div>
      {/* Accessible planet links that follow the planets on screen. */}
      {w.planets.map((p, i) => (
        <Link
          key={p.id}
          ref={(n) => {
            labels.current[i] = n;
          }}
          href={planetHref(p)}
          onClick={(e) => {
            if (selected !== p.id) {
              e.preventDefault();
              onSelect(p.id);
            }
          }}
          className={cn("absolute left-0 top-0 flex min-h-11 min-w-11 items-end justify-center rounded-full pb-0 transition-opacity focus-visible:outline-2", selected === p.id && "ring-2 ring-acid")}
          aria-label={`${p.name} · ${t(`state.${p.state}`)}`}
          data-testid="planet"
          data-state={p.state}
          data-theme={p.theme}
        >
          <span className="pointer-events-none translate-y-7 whitespace-nowrap rounded-full bg-ink/80 px-1.5 text-[10px] font-extrabold uppercase text-cream">{p.name.length > 16 ? `${p.name.slice(0, 15)}…` : p.name}</span>
        </Link>
      ))}
    </div>
  );
}
