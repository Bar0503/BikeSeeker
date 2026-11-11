import { useState, type SyntheticEvent } from "react";
import type { User } from "../types/bike";
import { login } from "../services/bikeService";

interface LoginScreenProps {
  readonly onLoginSuccess: (user: User) => void;
  readonly notice?: string | null;
}

export function LoginScreen({ onLoginSuccess, notice }: LoginScreenProps) {
  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Bejelentkezesi urlap esemenykezeloje es token mentese
  const handleSubmit = async (event: SyntheticEvent): Promise<void> => {
    event.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMessage("Kérlek, add meg a felhasználónevet és a jelszót!");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await login({ username: username.trim(), password });
      onLoginSuccess(response.user);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Sikertelen bejelentkezés. Ellenőrizd az adatokat!";
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070d09] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#121f17]/95 border border-emerald-900/40 rounded-2xl p-8 shadow-2xl backdrop-blur-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-950/80 border border-emerald-800/60 text-emerald-400 mb-3 shadow-lg">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-extrabold text-stone-100 tracking-tight">
            Bike<span className="text-emerald-400">Seeker</span>
          </h1>
          <p className="text-xs text-stone-400 mt-1">
            Jelentkezz be a kerékpár és alkatrész adatbázis eléréséhez
          </p>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 rounded-lg bg-rose-950/50 border border-rose-900/60 text-rose-300 text-xs">
            {errorMessage}
          </div>
        )}

        {/* Tajekoztato uzenet, peldaul lejart munkamenet utan */}
        {notice && !errorMessage && (
          <div className="mb-4 p-3 rounded-lg bg-amber-950/40 border border-amber-800/60 text-amber-200 text-xs">
            {notice}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="login-username"
              className="block text-xs font-medium text-emerald-200/80 mb-1"
            >
              Felhasználónév
            </label>
            <input
              id="login-username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="pl. BikeBéla"
              className="w-full bg-[#0a120d] border border-emerald-900/40 rounded-lg px-3.5 py-2.5 text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="block text-xs font-medium text-emerald-200/80 mb-1"
            >
              Jelszó
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-[#0a120d] border border-emerald-900/40 rounded-lg px-3.5 py-2.5 text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-stone-950 font-semibold py-2.5 rounded-lg text-sm transition-colors shadow-lg shadow-emerald-950/60 cursor-pointer"
          >
            {loading ? "Hitelesítés..." : "Bejelentkezés"}
          </button>
        </form>
      </div>
    </div>
  );
}