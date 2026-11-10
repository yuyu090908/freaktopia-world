import { describe, expect, it } from "vitest";
import qrcode from "qrcode-generator";
import jsQR from "jsqr";
import { normalizeCode, passPayload } from "@/lib/party/service";

/** Renders a pass the way PassCard does, then reads it back with the jsQR fallback used by the door scanner. */
function render(text: string, scale = 4, margin = 4) {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const size = (n + margin * 2) * scale;
  const data = new Uint8ClampedArray(size * size * 4).fill(255);
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      if (qr.isDark(r, c))
        for (let y = 0; y < scale; y++)
          for (let x = 0; x < scale; x++) {
            const i = (((r + margin) * scale + y) * size + (c + margin) * scale + x) * 4;
            data[i] = data[i + 1] = data[i + 2] = 0;
          }
  return { data, size };
}

describe("door QR fallback (jsQR)", () => {
  it("decodes a rendered pass into the same event id and code", () => {
    const eid = "3f2b8c1e-9a4d-4e7b-8c21-5d6f7a8b9c0d";
    const payload = passPayload(eid, "ABCDEFGH23");
    const { data, size } = render(payload);
    const hit = jsQR(data, size, size);
    expect(hit?.data).toBe(payload);
    expect(normalizeCode(hit!.data)).toEqual({ eventId: eid, code: "ABCDEFGH23" });
  });

  it("returns nothing for a blank frame", () => {
    const size = 120;
    expect(jsQR(new Uint8ClampedArray(size * size * 4).fill(255), size, size)).toBeNull();
  });
});
