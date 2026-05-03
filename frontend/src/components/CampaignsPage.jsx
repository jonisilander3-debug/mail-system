export default function CampaignsPage({
  campaigns,
  loading,
  error,
  highlightedCampaignId,
  diagnosticsById,
  diagnosticsLoadingId,
  onInspectCampaign,
  onRefresh,
}) {
  const draftCount = campaigns.filter((campaign) => campaign.status === "draft").length;
  const sendingCount = campaigns.filter((campaign) => campaign.status === "sending").length;
  const completedCount = campaigns.filter((campaign) => campaign.status === "completed").length;
  const failedCount = campaigns.filter((campaign) => campaign.status === "failed").length;

  return (
    <section className="mx-auto w-full max-w-6xl space-y-6">
      <Panel
        eyebrow="Kampanjer"
        title="Utskicksstatus"
        description="Har ser du snabbt om ett utskick har startat, hur manga mail som skickats och om nagot verkar ha fastnat."
        action={(
          <button
            type="button"
            onClick={onRefresh}
            className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-slate-200"
          >
            Uppdatera
          </button>
        )}
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Pagaende" value={String(sendingCount)} tone="cyan" />
          <StatCard label="Utkast" value={String(draftCount)} tone="slate" />
          <StatCard label="Klara" value={String(completedCount)} tone="emerald" />
          <StatCard label="Fel" value={String(failedCount)} tone="rose" />
        </div>
      </Panel>

      {loading ? <StatusMessage tone="info">Laddar kampanjer...</StatusMessage> : null}
      {error ? <StatusMessage tone="error">{error}</StatusMessage> : null}

      <Panel
        eyebrow="Senaste"
        title="Senaste kampanjer"
        description="Tryck pa Kontrollera status om du snabbt vill se om en kampanj har startat, pagar eller verkar ha fastnat."
      >
        <div className="space-y-4">
          {!loading && campaigns.length === 0 ? (
            <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-6 text-sm text-slate-400">
              Inga kampanjer finns an.
            </div>
          ) : null}

          {campaigns.map((campaign) => {
            const isHighlighted = highlightedCampaignId === campaign.id;
            const diagnostics = diagnosticsById[campaign.id];
            const isInspecting = diagnosticsLoadingId === campaign.id;

            return (
              <div
                key={campaign.id}
                className={`rounded-[28px] border p-5 transition ${
                  isHighlighted
                    ? "border-cyan-300/30 bg-cyan-400/[0.08] shadow-[0_18px_70px_rgba(14,165,233,0.12)]"
                    : "border-white/10 bg-white/[0.03]"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <p className="text-lg font-semibold text-white">{campaign.name}</p>
                      {isHighlighted ? (
                        <span className="rounded-full bg-cyan-400/15 px-3 py-1 text-xs font-medium text-cyan-100">
                          Nyss startad
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-slate-400">
                      {campaign.senderProfile?.domain || campaign.fromEmail || "Ingen doman"} • {campaign.subject}
                    </p>
                  </div>
                  <StatusBadge status={campaign.status} />
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <DetailRow label="Giltiga" value={String(campaign.validRecipients || 0)} />
                  <DetailRow label="Skickade" value={String(campaign.sentCount || 0)} />
                  <DetailRow label="Misslyckade" value={String(campaign.failedCount || 0)} />
                  <DetailRow label="Testmail" value={campaign.testSentAt ? "Ja" : "Nej"} />
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => onInspectCampaign(campaign.id)}
                    disabled={isInspecting}
                    className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isInspecting ? "Kontrollerar..." : "Kontrollera status"}
                  </button>
                </div>

                {diagnostics ? (
                  <DiagnosticsCard diagnostics={diagnostics} />
                ) : null}
              </div>
            );
          })}
        </div>
      </Panel>
    </section>
  );
}

function Panel({ eyebrow, title, description, action, children }) {
  return (
    <section className="rounded-[32px] border border-white/10 bg-slate-900/65 p-6 shadow-[0_30px_90px_rgba(2,6,23,0.45)] backdrop-blur-xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/60">{eyebrow}</p>
          <div className="mb-6 mt-3">
            <h3 className="text-2xl font-semibold text-white">{title}</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{description}</p>
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function StatCard({ label, value, tone }) {
  const toneClass = {
    cyan: "border-cyan-300/20 bg-cyan-400/[0.06] text-cyan-100",
    emerald: "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-100",
    rose: "border-rose-400/20 bg-rose-400/[0.08] text-rose-100",
    slate: "border-white/10 bg-white/[0.03] text-slate-100",
  }[tone] || "border-white/10 bg-white/[0.03] text-slate-100";

  return (
    <div className={`rounded-[24px] border p-5 ${toneClass}`}>
      <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-semibold">{value}</p>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/8 bg-slate-950/50 px-4 py-3">
      <span className="text-xs uppercase tracking-[0.22em] text-slate-500">{label}</span>
      <span className="text-right text-sm text-slate-100">{value}</span>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    draft: "bg-slate-700/60 text-slate-100",
    ready: "bg-cyan-400/15 text-cyan-100",
    sending: "bg-cyan-400/15 text-cyan-100",
    paused: "bg-amber-400/15 text-amber-200",
    completed: "bg-emerald-400/15 text-emerald-300",
    failed: "bg-rose-400/15 text-rose-300",
    stopped: "bg-slate-700/60 text-slate-100",
  };

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium ${map[status] || map.draft}`}>
      {status}
    </span>
  );
}

function StatusMessage({ tone, children }) {
  const toneClass =
    tone === "error"
      ? "border-rose-400/20 bg-rose-400/10 text-rose-200"
      : "border-cyan-300/20 bg-cyan-400/[0.06] text-cyan-100";

  return <div className={`rounded-[24px] border p-5 text-sm ${toneClass}`}>{children}</div>;
}

function DiagnosticsCard({ diagnostics }) {
  const toneClass = {
    ok: "border-emerald-400/20 bg-emerald-400/10 text-emerald-100",
    info: "border-cyan-300/20 bg-cyan-400/[0.06] text-cyan-100",
    warning: "border-amber-300/20 bg-amber-400/[0.08] text-amber-100",
    error: "border-rose-400/20 bg-rose-400/10 text-rose-100",
  }[diagnostics.health] || "border-cyan-300/20 bg-cyan-400/[0.06] text-cyan-100";

  return (
    <div className={`mt-5 rounded-[24px] border p-5 ${toneClass}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold">Statuskontroll</p>
        <span className="rounded-full bg-slate-950/30 px-3 py-1 text-xs uppercase tracking-[0.2em]">
          {diagnostics.health}
        </span>
      </div>

      <p className="mt-3 text-sm leading-6">{diagnostics.summary}</p>
      <p className="mt-2 text-sm leading-6 text-current/85">{diagnostics.recommendation}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MiniMetric label="Pending" value={String(diagnostics.counts?.pending || 0)} />
        <MiniMetric label="Sent" value={String(diagnostics.counts?.sent || 0)} />
        <MiniMetric label="Failed" value={String(diagnostics.counts?.failed || 0)} />
        <MiniMetric label="Skipped" value={String(diagnostics.counts?.skipped || 0)} />
        <MiniMetric label="Forsok" value={String(diagnostics.counts?.attempts || 0)} />
      </div>

      {diagnostics.topErrorMessage ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/25 p-4 text-sm leading-6 text-white/90">
          Senaste fel: {diagnostics.topErrorMessage}
        </div>
      ) : null}
    </div>
  );
}

function MiniMetric({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/25 px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.24em] text-current/70">{label}</p>
      <p className="mt-2 text-base font-semibold text-white">{value}</p>
    </div>
  );
}
