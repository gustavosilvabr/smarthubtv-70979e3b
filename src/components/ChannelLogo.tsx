import { memo, useState } from "react";
import { Tv } from "lucide-react";
import { getDisplayImageUrl } from "@/utils/media";

interface Props {
  logo: string;
  name?: string;
  size?: "sm" | "md";
  className?: string;
  serverBase?: string;
}

const SIZES = {
  sm: { box: "h-7 w-7", img: "h-6 w-6", icon: "h-3.5 w-3.5" },
  md: { box: "h-8 w-8", img: "h-8 w-8", icon: "h-4 w-4" },
};

export const ChannelLogo = memo(function ChannelLogo({
  logo,
  name = "",
  size = "sm",
  className = "",
  serverBase,
}: Props) {
  const [imgError, setImgError] = useState(false);
  const imageUrl = getDisplayImageUrl(logo, serverBase);
  const s = SIZES[size];

  if (!imageUrl || imgError) {
    return (
      <span
        className={`grid ${s.box} shrink-0 place-items-center rounded-lg bg-white/5 text-white/70 ring-1 ring-white/10 ${className}`}
      >
        <Tv className={s.icon} />
      </span>
    );
  }

  return (
    <span className={`grid ${s.box} shrink-0 place-items-center rounded-lg ring-1 ring-white/10 ${className}`}>
      <img
        src={imageUrl}
        alt={name}
        loading="lazy"
        decoding="async"
        className={`${s.img} rounded object-contain`}
        onError={() => setImgError(true)}
      />
    </span>
  );
});
