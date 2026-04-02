import { useQuery } from "@tanstack/react-query";
import { getUsage, type UsageData } from "@/lib/api";

function fmt(n: number, decimals = 4) {
  return n.toFixed(decimals);
}

function fmtCost(usd: number) {
  if (usd < 0.0001) return "<$0.0001";
  return `$${usd.toFixed(4)}`;
}

function fmtTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function stageName(stage: string) {
  const map: Record<string, string> = {
    tone_classify: "Tone classify",
    info_extract: "Info extract",
    write_article: "Write article",
    rss_rewrite: "RSS rewrite",
    image_describe: "Image describe",
  };
  return map[stage] ?? stage;
}

function StatCard({ label, cost, tokens }: { label: string; cost: number; tokens: number }) {
  return (
    <div className="bg-card rounded-xl border border-border p-5 flex flex-col gap-1">
      <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{label}</p>
      <p className="text-2xl font-bold text-foreground">{fmtCost(cost)}</p>
      <p className="text-sm text-muted-foreground">{fmtTokens(tokens)} tokens</p>
    </div>
  );
}

export default function Usage() {
  const { data, isLoading, error } = useQuery<UsageData>({
    queryKey: ["usage"],
    queryFn: getUsage,
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-foreground mb-2">AI Usage</h1>
        <p className="text-muted-foreground">Loading usage data…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-foreground mb-2">AI Usage</h1>
        <p className="text-destructive">Failed to load usage data.</p>
      </div>
    );
  }

  const { totals, byModel, byStage, dailySeries, recentEntries } = data;

  const maxDailyCost = Math.max(...dailySeries.map((d) => d.cost_usd), 0.00001);

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">AI Usage</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Token costs tracked per article — data captured from each OpenAI API call.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Today" cost={totals.today.cost_usd} tokens={totals.today.input_tokens + totals.today.output_tokens} />
        <StatCard label="This week" cost={totals.week.cost_usd} tokens={totals.week.input_tokens + totals.week.output_tokens} />
        <StatCard label="This month" cost={totals.month.cost_usd} tokens={totals.month.input_tokens + totals.month.output_tokens} />
        <StatCard label="All time" cost={totals.allTime.cost_usd} tokens={totals.allTime.input_tokens + totals.allTime.output_tokens} />
      </div>

      {dailySeries.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Daily cost — last 30 days</h2>
          <div className="flex items-end gap-1 h-32">
            {dailySeries.map((day) => {
              const pct = (day.cost_usd / maxDailyCost) * 100;
              return (
                <div
                  key={day.day}
                  className="flex-1 flex flex-col items-center gap-1 group relative"
                  title={`${day.day}: ${fmtCost(day.cost_usd)} (${day.submissions} submissions)`}
                >
                  <div
                    className="w-full rounded-t bg-primary/70 group-hover:bg-primary transition-colors"
                    style={{ height: `${Math.max(pct, 2)}%` }}
                  />
                  <span className="text-[9px] text-muted-foreground rotate-45 origin-left hidden group-hover:block absolute -bottom-5 left-0 whitespace-nowrap">
                    {day.day.slice(5)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">By model</h2>
          {byModel.length === 0 ? (
            <p className="text-muted-foreground text-sm">No data yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="pb-2 font-medium">Model</th>
                  <th className="pb-2 font-medium text-right">Calls</th>
                  <th className="pb-2 font-medium text-right">Tokens</th>
                  <th className="pb-2 font-medium text-right">Cost</th>
                </tr>
              </thead>
              <tbody>
                {byModel.map((m) => (
                  <tr key={m.model} className="border-b border-border/40 last:border-0">
                    <td className="py-2 font-mono text-xs">{m.model}</td>
                    <td className="py-2 text-right text-muted-foreground">{m.calls}</td>
                    <td className="py-2 text-right text-muted-foreground">{fmtTokens(m.input_tokens + m.output_tokens)}</td>
                    <td className="py-2 text-right font-medium">{fmtCost(m.cost_usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-card rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">By pipeline stage</h2>
          {byStage.length === 0 ? (
            <p className="text-muted-foreground text-sm">No data yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="pb-2 font-medium">Stage</th>
                  <th className="pb-2 font-medium text-right">Calls</th>
                  <th className="pb-2 font-medium text-right">Tokens</th>
                  <th className="pb-2 font-medium text-right">Cost</th>
                </tr>
              </thead>
              <tbody>
                {byStage.map((s) => (
                  <tr key={s.stage} className="border-b border-border/40 last:border-0">
                    <td className="py-2">{stageName(s.stage)}</td>
                    <td className="py-2 text-right text-muted-foreground">{s.calls}</td>
                    <td className="py-2 text-right text-muted-foreground">{fmtTokens(s.input_tokens + s.output_tokens)}</td>
                    <td className="py-2 text-right font-medium">{fmtCost(s.cost_usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4">Recent API calls</h2>
        {recentEntries.length === 0 ? (
          <p className="text-muted-foreground text-sm">No usage data yet. It will appear here after the next article is processed.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="pb-2 font-medium">Time</th>
                  <th className="pb-2 font-medium">Stage</th>
                  <th className="pb-2 font-medium">Model</th>
                  <th className="pb-2 font-medium text-right">In</th>
                  <th className="pb-2 font-medium text-right">Out</th>
                  <th className="pb-2 font-medium text-right">Cost</th>
                </tr>
              </thead>
              <tbody>
                {recentEntries.map((entry) => (
                  <tr key={entry.id} className="border-b border-border/40 last:border-0 hover:bg-muted/30">
                    <td className="py-1.5 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(entry.createdAt).toLocaleString("en-IE", { dateStyle: "short", timeStyle: "short" })}
                    </td>
                    <td className="py-1.5">{stageName(entry.stage)}</td>
                    <td className="py-1.5 font-mono text-xs text-muted-foreground">{entry.model}</td>
                    <td className="py-1.5 text-right text-muted-foreground">{fmtTokens(entry.inputTokens)}</td>
                    <td className="py-1.5 text-right text-muted-foreground">{fmtTokens(entry.outputTokens)}</td>
                    <td className="py-1.5 text-right font-medium">{fmtCost(Number(entry.estimatedCostUsd))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
