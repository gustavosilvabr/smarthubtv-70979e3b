import { FormEvent, useState } from "react";
import { ArrowLeft, Loader2, Save, Server } from "lucide-react";
import type { IptvSettings } from "@/utils/iptvSettings";
import { normalizeIptvSettings } from "@/utils/iptvSettings";

interface Props {
  settings: IptvSettings;
  loading: boolean;
  onSave: (settings: IptvSettings) => void;
  onHome: () => void;
}

export function SettingsPanel({ settings, loading, onSave, onHome }: Props) {
  const [form, setForm] = useState(settings);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSave(normalizeIptvSettings(form));
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-6 md:px-6">
        <button
          onClick={onHome}
          className="mb-6 inline-flex w-fit items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar para Home
        </button>

        <div className="rounded-xl border border-border bg-card p-5 shadow-xl md:p-6">
          <div className="mb-6 flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-primary/15 ring-1 ring-primary/30">
              <Server className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Configurações</h1>
              <p className="text-sm text-muted-foreground">Atualize os dados da sua conta IPTV.</p>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Servidor/URL</span>
              <input
                value={form.server}
                onChange={(e) => setForm((current) => ({ ...current, server: e.target.value }))}
                placeholder="https://servidor.com"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Usuário</span>
              <input
                value={form.username}
                onChange={(e) => setForm((current) => ({ ...current, username: e.target.value }))}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Senha</span>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm((current) => ({ ...current, password: e.target.value }))}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
              />
            </label>

            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar e atualizar
              </button>
              <button
                type="button"
                onClick={onHome}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-secondary px-4 py-2 text-sm font-semibold hover:bg-accent"
              >
                Voltar para Home
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}