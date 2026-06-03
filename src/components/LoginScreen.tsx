import { FormEvent, useState } from "react";
import { Eye, EyeOff, Lock, Server, User, LogIn } from "lucide-react";
import { Logo } from "@/components/Logo";
import {
  normalizeIptvSettings,
  type IptvSettings,
} from "@/utils/iptvSettings";

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

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!server.trim() || !username.trim() || !password.trim()) {
      setError("Preencha servidor, usuário e senha.");
      return;
    }
    onSubmit(normalizeIptvSettings({ server, username, password }));
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      {/* Purple ambience */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-primary/25 blur-[140px]" />
        <div className="absolute bottom-[-180px] left-[-120px] h-[420px] w-[420px] rounded-full bg-primary/20 blur-[140px]" />
        <div className="absolute bottom-[-180px] right-[-120px] h-[420px] w-[420px] rounded-full bg-primary/15 blur-[140px]" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-6 py-10">
        <Logo className="mb-8 h-28 w-auto drop-shadow-[0_0_30px_rgba(168,85,247,0.55)]" />

        <p className="mb-6 text-center text-xs uppercase tracking-[0.35em] text-primary/80">
          Xtream Codes Compatible
        </p>

        <form
          onSubmit={submit}
          className="w-full space-y-3 rounded-2xl border border-primary/20 bg-card/60 p-6 shadow-2xl backdrop-blur"
        >
          <Field icon={<Server className="h-4 w-4" />} placeholder="Servidor / URL">
            <input
              value={server}
              onChange={(e) => setServer(e.target.value)}
              placeholder="https://servidor.com"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              autoComplete="off"
            />
          </Field>

          <Field icon={<User className="h-4 w-4" />} placeholder="Usuário">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Usuário"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              autoComplete="username"
            />
          </Field>

          <Field icon={<Lock className="h-4 w-4" />} placeholder="Senha">
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
              className="text-muted-foreground hover:text-foreground"
              aria-label="Mostrar senha"
            >
              {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </Field>

          {error && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-[0_10px_30px_-10px_rgba(168,85,247,0.7)] transition hover:bg-primary/90"
          >
            <LogIn className="h-4 w-4" /> Entrar
          </button>
        </form>

        <p className="mt-6 text-center text-[11px] text-muted-foreground">
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
  placeholder?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-center gap-3 rounded-xl border border-border bg-background/60 px-3 py-3 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
      <span className="text-primary">{icon}</span>
      {children}
    </label>
  );
}
