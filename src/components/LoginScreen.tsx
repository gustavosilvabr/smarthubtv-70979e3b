import { FormEvent, useRef, useState } from "react";
import { Eye, EyeOff, Lock, Server, User, LogIn } from "lucide-react";
import { Logo } from "@/components/Logo";
import {
  normalizeIptvSettings,
  type IptvSettings,
} from "@/utils/iptvSettings";
import { useGsapEntrance } from "@/hooks/useGsapEntrance";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

interface Props {
  onSubmit: (settings: IptvSettings) => void;
  initial?: Partial<IptvSettings>;
}

export function LoginScreen({ onSubmit, initial }: Props) {
  const [server, setServer] = useState(initial?.server ?? "");
  const [username, setUsername] = useState(initial?.username ?? "");
  const [password, setPassword] = useState(initial?.password ?? "");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);

  useGsapEntrance(logoRef, { y: -20, scale: 0.95, duration: 0.7, ease: "back.out(1.5)" });
  useGsapEntrance(formRef, { y: 30, duration: 0.6, delay: 0.2, staggerSelector: ".stagger-item", ease: "power3.out" });

  useGSAP(
    () => {
      // Ambient floating bubbles
      gsap.to(".ambient-bubble", {
        y: "random(-20, 20)",
        x: "random(-20, 20)",
        scale: "random(0.9, 1.1)",
        duration: "random(3, 5)",
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
        stagger: 0.5,
      });
    },
    { scope: containerRef }
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!server.trim() || !username.trim() || !password.trim()) {
      setError("Preencha servidor, usuário e senha.");
      return;
    }
    onSubmit(normalizeIptvSettings({ server, username, password }));
  };

  return (
    <div ref={containerRef} className="relative h-screen w-full overflow-hidden bg-background text-foreground">
      {/* Purple ambience */}
      <div className="pointer-events-none absolute inset-0">
        <div className="ambient-bubble absolute -top-32 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-primary/25 blur-[130px]" />
        <div className="ambient-bubble absolute bottom-[-160px] left-[-100px] h-[380px] w-[380px] rounded-full bg-primary/20 blur-[130px]" />
        <div className="ambient-bubble absolute bottom-[-160px] right-[-100px] h-[380px] w-[380px] rounded-full bg-primary/15 blur-[130px]" />
      </div>

      {/* Centered content — fills height, no scroll */}
      <div className="relative z-10 flex h-full flex-col items-center justify-center px-4 py-4">

        {/* Logo — scales down on small screens */}
        <div ref={logoRef} className="flex flex-col items-center">
          <Logo className="mb-3 sm:mb-4 h-20 sm:h-28 md:h-36 w-auto drop-shadow-[0_0_32px_rgba(168,85,247,0.7)]" />
          <p className="mb-3 sm:mb-4 text-center text-[10px] sm:text-xs uppercase tracking-[0.3em] text-primary/80">
            Xtream Codes Compatible
          </p>
        </div>

        <form
          ref={formRef}
          onSubmit={submit}
          className="w-full max-w-sm space-y-2.5 rounded-2xl border border-primary/20 bg-card/60 p-4 sm:p-5 shadow-2xl backdrop-blur"
        >
          <div className="stagger-item">
            <Field icon={<Server className="h-4 w-4" />}>
              <input
                value={server}
                onChange={(e) => setServer(e.target.value)}
                placeholder="Servidor / URL (http://servidor.com:porta)"
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
              />
            </Field>
            <p className="mt-1 px-1 text-[10px] text-muted-foreground/70">
              Aceita qualquer formato: http://, https://, IP:porta, domínio
            </p>
          </div>

          <div className="stagger-item">
            <Field icon={<User className="h-4 w-4" />}>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Usuário"
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                autoComplete="username"
              />
            </Field>
          </div>

          <div className="stagger-item">
            <Field icon={<Lock className="h-4 w-4" />}>
              <input
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Senha"
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Mostrar senha"
              >
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </Field>
          </div>

          {error && (
            <p className="stagger-item rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}

          <div className="stagger-item pt-1">
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 sm:py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-[0_8px_24px_-8px_rgba(168,85,247,0.7)] transition hover:bg-primary/90 hover:scale-[1.02] active:scale-95"
            >
              <LogIn className="h-4 w-4" /> Entrar
            </button>
          </div>
        </form>

        <p className="stagger-item mt-3 text-center text-[10px] text-muted-foreground">
          Seus dados ficam salvos apenas neste dispositivo.
        </p>
      </div>
    </div>
  );
}

function Field({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-center gap-3 rounded-xl border border-border bg-background/60 px-3 py-2.5 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
      <span className="text-primary shrink-0">{icon}</span>
      {children}
    </label>
  );
}
