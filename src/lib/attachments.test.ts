import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { detectType, processUpload, sanitizeName } from "./attachments";

async function jpegWithGps(): Promise<Buffer> {
  return sharp({ create: { width: 3000, height: 1500, channels: 3, background: "#336699" } })
    .jpeg()
    .withExif({
      IFD0: { Make: "Telefono", Model: "Prueba" },
      IFD3: { GPSLatitudeRef: "N", GPSLatitude: "19/1 25/1 0/1" },
    })
    .toBuffer();
}

describe("detectType", () => {
  it("reconoce los tipos por sus primeros bytes", async () => {
    const img = sharp({ create: { width: 2, height: 2, channels: 3, background: "#fff" } });
    expect(detectType(await img.clone().jpeg().toBuffer())).toBe("jpeg");
    expect(detectType(await img.clone().png().toBuffer())).toBe("png");
    expect(detectType(await img.clone().webp().toBuffer())).toBe("webp");
    expect(detectType(Buffer.from("%PDF-1.7\n..."))).toBe("pdf");
    const heic = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypheic"), Buffer.alloc(8)]);
    expect(detectType(heic)).toBe("heic");
  });

  it("no se deja engañar por la extensión", () => {
    expect(detectType(Buffer.from("<html><script>alert(1)</script></html>"))).toBeNull();
    expect(detectType(Buffer.from("MZ\x90\x00 ejecutable"))).toBeNull();
  });
});

describe("processUpload", () => {
  it("quita EXIF y GPS, y reduce el tamaño", async () => {
    const input = await jpegWithGps();
    expect((await sharp(input).metadata()).exif).toBeDefined();

    const { data, mimeType } = await processUpload(input);
    const meta = await sharp(data).metadata();
    expect(mimeType).toBe("image/jpeg");
    expect(meta.exif).toBeUndefined();
    expect(Math.max(meta.width!, meta.height!)).toBe(2000);
    expect(data.includes(Buffer.from("Telefono"))).toBe(false);
  });

  it("convierte PNG a JPEG y deja el PDF igual", async () => {
    const png = await sharp({ create: { width: 10, height: 10, channels: 4, background: "#0000" } }).png().toBuffer();
    expect((await processUpload(png)).mimeType).toBe("image/jpeg");
    const pdf = Buffer.from("%PDF-1.4 contenido");
    expect(await processUpload(pdf)).toEqual({ data: pdf, mimeType: "application/pdf" });
  });

  it("rechaza tipos no permitidos, HEIC y archivos grandes", async () => {
    await expect(processUpload(Buffer.from("<html></html>"))).rejects.toMatchObject({ status: 415 });
    const heic = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypheic"), Buffer.alloc(8)]);
    await expect(processUpload(heic)).rejects.toThrow(/HEIC/);
    await expect(processUpload(Buffer.alloc(10 * 1024 * 1024 + 1))).rejects.toMatchObject({ status: 413 });
  });

  it("rechaza una imagen dañada", async () => {
    const broken = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.from("basura")]);
    await expect(processUpload(broken)).rejects.toMatchObject({ status: 415 });
  });
});

describe("sanitizeName", () => {
  it("quita rutas y caracteres de control, y usa la extensión real", () => {
    expect(sanitizeName("../../etc/foto.png", "image/jpeg")).toBe("foto.jpg");
    expect(sanitizeName("C:\\Users\\x\\recibo\u0000.PDF", "application/pdf")).toBe("recibo.pdf");
    expect(sanitizeName("", "image/jpeg")).toBe("recibo.jpg");
  });
});
