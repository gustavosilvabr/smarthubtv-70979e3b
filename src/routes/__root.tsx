import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error }: { error: Error }) {
  console.error("Global crash:", error);

  if (typeof window !== "undefined") {
    // Clear all session storage completely on crash to guarantee fresh login state
    try {
      sessionStorage.clear();
      // Also clear localStorage just in case they were left behind from previous versions
      localStorage.clear();
    } catch {}
    
    // Force immediate reload to the root URL
    window.location.href = "/";
  }

  // Minimal fallback UI while it redirects
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm font-medium text-muted-foreground tracking-widest uppercase">
          Reiniciando
        </p>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Smart hub tv online" },
      { name: "description", content: "canais online e aqui na smart hub play tv" },
      { name: "google-adsense-account", content: "ca-pub-5176993182609305" },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "Smart hub tv online" },
      { property: "og:description", content: "canais online e aqui na smart hub play tv" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "Smart hub tv online" },
      { name: "twitter:description", content: "canais online e aqui na smart hub play tv" },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/7J2KHq8C9qdzUKko7UbvjezcqO33/social-images/social-1780588094344-1000882752.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/7J2KHq8C9qdzUKko7UbvjezcqO33/social-images/social-1780588094344-1000882752.webp" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
    // AdSense is injected client-side after hydration (see RootComponent)
    // to avoid hydration mismatches from auto-injected <ins> tags.
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    if (document.getElementById("adsbygoogle-js")) return;
    const s = document.createElement("script");
    s.id = "adsbygoogle-js";
    s.async = true;
    s.crossOrigin = "anonymous";
    s.src =
      "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5176993182609305";
    document.head.appendChild(s);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
