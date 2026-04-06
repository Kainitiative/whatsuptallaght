import { useEffect, useState, useCallback } from "react";
import { getSettings, updateSetting, clearSetting, type Setting } from "@/lib/api";

const CATEGORY_LABELS: Record<string, string> = {
  openai: "OpenAI",
  whatsapp: "WhatsApp",
  platform: "Platform",
  distribution: "Distribution",
};

export default function Settings() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [working, setWorking] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getSettings();
      setSettings(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave(key: string) {
    if (!value.trim()) return;
    setWorking(key);
    try {
      const updated = await updateSetting(key, value.trim());
      setSettings((prev) => prev.map((s) => s.key === key ? { ...s, isConfigured: true, value: s.isSecret ? "••••••••" : value.trim() } : s));
      setEditing(null);
      setValue("");
      showToast(`✅ ${updated.label ?? key} saved`);
    } finally {
      setWorking(null);
    }
  }

  async function handleClear(key: string) {
    if (!confirm("Clear this setting?")) return;
    setWorking(key);
    try {
      await clearSetting(key);
      setSettings((prev) => prev.map((s) => s.key === key ? { ...s, isConfigured: false, value: null } : s));
      showToast("Setting cleared");
    } finally {
      setWorking(null);
    }
  }

  const byCategory = settings.reduce<Record<string, Setting[]>>((acc, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s);
    return acc;
  }, {});

  return (
    <div className="p-8 max-w-3xl">
      {toast && (
        <div className="fixed top-4 right-4 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm shadow-lg z-50">
          {toast}
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure API keys and platform settings. Secrets are encrypted at rest.</p>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (
        <div className="space-y-8">
          {Object.entries(byCategory).map(([cat, items]) => (
            <div key={cat}>
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                {CATEGORY_LABELS[cat] ?? cat}
              </h2>
              <div className="bg-white border border-border rounded-xl divide-y divide-border">
                {items.map((setting) => (
                  <div key={setting.key} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{setting.label}</span>
                          {setting.isRequired && (
                            <span className="text-xs text-red-500 font-medium">Required</span>
                          )}
                          {setting.isSecret && (
                            <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-mono">secret</span>
                          )}
                        </div>
                        {setting.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{setting.description}</p>
                        )}
                        {setting.helpUrl && (
                          <a href={setting.helpUrl} target="_blank" rel="noopener noreferrer"
                             className="text-xs text-primary hover:underline">
                            How to get this →
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {setting.isConfigured ? (
                          <>
                            <span className="text-xs text-green-600 font-medium">✅ Configured</span>
                            <button
                              onClick={() => { setEditing(setting.key); setValue(""); }}
                              className="text-xs text-primary hover:underline"
                            >
                              Update
                            </button>
                            <button
                              onClick={() => handleClear(setting.key)}
                              disabled={working === setting.key}
                              className="text-xs text-red-600 hover:underline disabled:opacity-50"
                            >
                              Clear
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => { setEditing(setting.key); setValue(""); }}
                            className="px-3 py-1.5 text-xs bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                          >
                            Set value
                          </button>
                        )}
                      </div>
                    </div>

                    {editing === setting.key && (
                      <div className="mt-3 flex gap-2">
                        <input
                          type={setting.isSecret ? "password" : "text"}
                          value={value}
                          onChange={(e) => setValue(e.target.value)}
                          placeholder={setting.isSecret ? "Paste secret value…" : "Enter value…"}
                          className="flex-1 px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary font-mono"
                          autoFocus
                          onKeyDown={(e) => e.key === "Enter" && handleSave(setting.key)}
                        />
                        <button
                          onClick={() => handleSave(setting.key)}
                          disabled={!value.trim() || working === setting.key}
                          className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
                        >
                          {working === setting.key ? "Saving…" : "Save"}
                        </button>
                        <button
                          onClick={() => { setEditing(null); setValue(""); }}
                          className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
        <p className="text-sm font-medium text-amber-900 mb-1">Admin password</p>
        <p className="text-xs text-amber-800">
          Set the <code className="bg-amber-100 px-1 rounded">ADMIN_PASSWORD</code> environment variable on the server to change the login password.
          Default is <code className="bg-amber-100 px-1 rounded">tallaght-admin</code>.
        </p>
      </div>
    </div>
  );
}
