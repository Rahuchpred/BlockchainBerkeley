import QRCode from "qrcode";

export type QrShape = { size: number; path: string };

/** The dark modules of a QR code as one SVG path, one unit per module. */
export function qrShape(text: string): QrShape {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: "M" });
  let path = "";
  for (let y = 0; y < modules.size; y++) {
    for (let x = 0; x < modules.size; x++) {
      if (modules.data[y * modules.size + x]) path += `M${x} ${y}h1v1h-1z`;
    }
  }
  return { size: modules.size, path };
}
