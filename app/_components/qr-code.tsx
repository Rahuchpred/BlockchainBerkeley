import type { QrShape } from "@/lib/fairseat/qr";

// A QR code stays black on white in both themes, so every scanner can read it.
export function QrCode({
  shape,
  label,
  className,
}: {
  shape: QrShape;
  label: string;
  className?: string;
}) {
  const quiet = 2;
  const box = shape.size + quiet * 2;
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`${-quiet} ${-quiet} ${box} ${box}`}
      shapeRendering="crispEdges"
      className={className}
    >
      {/* eslint-disable-next-line lime/no-raw-color -- a gate code is black on white in both themes */}
      <rect x={-quiet} y={-quiet} width={box} height={box} fill="white" />
      {/* eslint-disable-next-line lime/no-raw-color -- a gate code is black on white in both themes */}
      <path d={shape.path} fill="black" />
    </svg>
  );
}
