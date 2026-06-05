import { useEffect, useRef, useState } from "react";
import { Lock, Delete, ShieldAlert, Eye, EyeOff } from "lucide-react";

const ADULT_PIN = "0000";

interface Props {
  onUnlock: () => void;
  onCancel: () => void;
}

export function AdultPinModal({ onUnlock, onCancel }: Props) {
  const [digits, setDigits] = useState<string[]>([]);
  const [shake, setShake] = useState(false);
  const [show, setShow] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const entered = digits.join("");

  useEffect(() => {
    if (digits.length === 4) {
      if (entered === ADULT_PIN) {
        onUnlock();
      } else {
        setShake(true);
        setTimeout(() => {
          setDigits([]);
          setShake(false);
        }, 500);
      }
    }
  }, [digits, entered, onUnlock]);

  // keyboard support
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        setDigits((d) => d.length < 4 ? [...d, e.key] : d);
      } else if (e.key === "Backspace") {
        setDigits((d) => d.slice(0, -1));
      } else if (e.key === "Escape") {
        onCancel();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel]);

  const press = (d: string) => {
    setDigits((prev) => prev.length < 4 ? [...prev, d] : prev);
  };

  const del = () => setDigits((d) => d.slice(0, -1));

  const numpad = ["1","2","3","4","5","6","7","8","9","","0","⌫"] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "radial-gradient(ellipse at center, rgba(88,28,135,0.6) 0%, rgba(5,3,8,0.97) 70%)" }}
    >
      <div
        ref={containerRef}
        className={[
          "relative w-full max-w-sm rounded-3xl border border-white/10 bg-[#0e0819]/90 p-6 shadow-2xl backdrop-blur-xl",
          shake ? "animate-[shake_0.4s_ease]" : "",
        ].join(" ")}
        style={shake ? { animation: "shake 0.4s ease" } : {}}
      >
        {/* Icon */}
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-red-700/60 to-rose-900/60 ring-1 ring-red-500/40">
          <ShieldAlert className="h-8 w-8 text-red-400" />
        </div>

        <h2 className="mb-1 text-center text-xl font-bold text-white">Conteúdo Adulto</h2>
        <p className="mb-6 text-center text-xs text-white/50">Digite a senha para acessar esta categoria</p>

        {/* PIN dots */}
        <div className="mb-6 flex justify-center gap-4">
          {[0, 1, 2, 3].map((i) => {
            const filled = i < digits.length;
            return (
              <div
                key={i}
                className={[
                  "flex h-12 w-12 items-center justify-center rounded-xl border-2 text-lg font-bold transition-all duration-150",
                  filled
                    ? shake
                      ? "border-red-500 bg-red-500/20 text-red-300"
                      : "border-amber-400/80 bg-amber-400/15 text-amber-300"
                    : "border-white/15 bg-white/5 text-white/20",
                ].join(" ")}
              >
                {filled ? (show ? digits[i] : "•") : ""}
              </div>
            );
          })}
          <button
            onClick={() => setShow((s) => !s)}
            className="absolute right-6 top-[calc(50%-16px)] grid h-8 w-8 place-items-center rounded-full text-white/30 hover:text-white/60 transition"
            aria-label={show ? "Ocultar senha" : "Mostrar senha"}
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {numpad.map((key, idx) => {
            if (key === "") return <div key={idx} />;
            if (key === "⌫") {
              return (
                <button
                  key={idx}
                  onClick={del}
                  className="flex h-14 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/60 transition hover:bg-red-500/20 hover:border-red-500/40 hover:text-red-300 active:scale-95"
                >
                  <Delete className="h-5 w-5" />
                </button>
              );
            }
            return (
              <button
                key={idx}
                onClick={() => press(key)}
                className="flex h-14 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-xl font-bold text-white transition hover:bg-purple-700/40 hover:border-purple-500/40 active:scale-95"
              >
                {key}
              </button>
            );
          })}
        </div>

        {/* Cancel */}
        <button
          onClick={onCancel}
          className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-semibold text-white/60 transition hover:bg-white/10 hover:text-white"
        >
          Cancelar
        </button>

        <p className="mt-3 text-center text-[10px] text-white/25">+18 · Apenas para maiores de idade</p>
      </div>

      <style>{`
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20% { transform: translateX(-10px); }
          40% { transform: translateX(10px); }
          60% { transform: translateX(-8px); }
          80% { transform: translateX(8px); }
        }
      `}</style>
    </div>
  );
}

/** Returns true if a category name is adult content */
export function isAdultCategory(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.includes("adult") ||
    lower.includes("adulto") ||
    lower.includes("xxx") ||
    lower.includes("18+") ||
    lower.includes("+18") ||
    lower.includes("erotic") ||
    lower.includes("erótico") ||
    lower.includes("sex") ||
    lower.includes("porn") ||
    lower.includes("hentai") ||
    lower.includes("mature") ||
    lower.includes("for adults") ||
    lower.includes("only adult")
  );
}
