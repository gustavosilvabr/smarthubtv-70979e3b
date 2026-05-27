import { Menu, Search, Tv2 } from "lucide-react";

interface Props {
  search: string;
  onSearch: (s: string) => void;
  onToggleSidebar: () => void;
}

export function Header({ search, onSearch, onToggleSidebar }: Props) {
  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/80 backdrop-blur px-4 py-3">
      <button
        onClick={onToggleSidebar}
        className="md:hidden rounded-md p-2 hover:bg-accent"
        aria-label="Menu"
      >
        <Menu className="h-5 w-5" />
      </button>
      <div className="flex items-center gap-2">
        <Tv2 className="h-6 w-6 text-primary" />
        <span className="text-lg font-bold tracking-tight">FLIX<span className="text-primary">TV</span></span>
      </div>
      <div className="ml-auto flex-1 max-w-md relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Buscar canais, filmes, séries..."
          className="w-full rounded-full bg-secondary pl-9 pr-4 py-2 text-sm outline-none ring-1 ring-border focus:ring-primary transition"
        />
      </div>
    </header>
  );
}
