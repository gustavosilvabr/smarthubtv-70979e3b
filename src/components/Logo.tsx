import logoAsset from "@/assets/smarthub-logo.png.asset.json";

interface Props {
  className?: string;
  alt?: string;
}

export function Logo({ className = "h-10 w-auto", alt = "Smart Hub Play TV" }: Props) {
  return <img src={logoAsset.url} alt={alt} className={className} draggable={false} />;
}
