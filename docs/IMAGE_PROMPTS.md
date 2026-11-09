# Image generation prompts and asset structure

The current build uses only original inline SVG. These prompts are for optional raster art later. **Style rule:** all art must be original. Use thick black outlines, flat psychedelic colours from the brand palette, and goofy aliens. Do not copy any existing brand's characters, logo or layout, including mood references.

Palette: #080808 #171717 #F5F2EA acid #B6F05C coral #FF625C purple #A276E9 blue #55BCEB orange #FFAD5B

## Prompts
1. **Hero:** "Flat vector illustration, thick 6px black outlines, crowd of goofy original aliens dancing on a tiny planet with a DJ booth, acid green, coral, purple, sky blue, orange on near-black, halftone dots, psychedelic sound waves, no text"
2. **Avatar species (×4):**
   - SLIME BEAT: "translucent green slime blob with headphones"
   - COSMIC FUZZ: "purple fuzzy one-eyed alien"
   - VINYL MUTANT: "alien whose head is a spinning record"
   - JELLY RAVER: "blue jellyfish alien with glowing tentacles"
   - Each in the same flat, thick-outline style on a transparent background, 1024².
3. **Stage LV1–5:** "Same party stage evolving: LV1 garage speaker, LV2 club booth, LV3 warehouse rig with lasers, LV4 open-air festival, LV5 planet-sized mega stage. Consistent camera, flat vector, thick outlines"
4. **Venue cards:** "Isometric flat-vector venue: warehouse / rooftop / beach / basement club, thick outlines, palette as above"
5. **Collectible badges:** "Round sticker badge, alien face + event name space, thick outline"

## Asset structure
```
public/
  geo/            # world GeoJSON (bundled)
  art/hero/       # hero-{w}.avif / .webp  (640, 1080, 1600)
  art/avatars/    # {species}.webp + layered parts if moving to raster
  art/stages/     # stage-lv{1..5}.webp
  art/venues/     # {venueId}-{n}.webp
  og/             # og-{route}.png 1200×630
```
Use `next/image` with AVIF/WebP, explicit sizes, and `priority` only on the hero to keep LCP low.
