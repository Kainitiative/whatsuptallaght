import { useState } from "react";
import { useLocation } from "wouter";
import { login, setToken } from "@/lib/api";

export default function Login() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [, navigate] = useLocation();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const token = await login(password);
      setToken(token);
      navigate("/");
    } catch {
      setError("Incorrect password. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-sidebar">
      <div className="bg-white rounded-2xl shadow-xl p-10 w-full max-w-sm">
        <div className="mb-8">
          <img src="/wut-logo-red.png" alt="What's Up Tallaght" className="h-11 w-auto" />
          <p className="text-xs text-muted-foreground mt-2">Admin Dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Admin Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              placeholder="Enter admin password"
              autoFocus
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full bg-primary text-white py-2 rounded-lg font-medium text-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-xs text-muted-foreground text-center">
          Default password: <code className="bg-gray-100 px-1 py-0.5 rounded">tallaght-admin</code>
          <br />
          Set <code className="bg-gray-100 px-1 py-0.5 rounded">ADMIN_PASSWORD</code> on the server to change it.
        </p>
      </div>
    </div>
  );
}
