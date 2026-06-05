interface Props {
  className?: string;
  alt?: string;
}

export function Logo({ className = "h-80 w-auto", alt = "Smart Hub Play TV" }: Props) {
  return <img src="/logo.png" alt={alt} className={className} draggable={false} />;
}
