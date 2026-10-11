import Image from "next/image";
import { Avatar } from "@/components/lime/ui/avatar";
import { cn } from "@/lib/lime/utils";

const SIZES = {
  sm: { box: "size-8", px: 32 },
  md: { box: "size-10", px: 40 },
  lg: { box: "size-14", px: 56 },
} as const;

// A team's art from Gemini, set whole inside a white disc with a hairline edge. The art is never
// cropped: it sits at two thirds of the disc so its outline stays clear of the edge.
export function TeamMark({
  team,
  image,
  size = "md",
  className,
}: {
  team: string;
  image: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  if (!image) return <Avatar name={team} size={size} className={className} />;
  const { box, px } = SIZES[size];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border border-line bg-raised",
        box,
        className,
      )}
    >
      <Image
        src={image}
        alt=""
        width={px}
        height={px}
        className="size-2/3 object-contain"
      />
    </span>
  );
}
