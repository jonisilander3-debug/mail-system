export default function RecipientsPage({
  senderProfiles,
  selectedDomainId,
  onSelectDomain,
  recipients,
  loading,
  error,
}) {
  return (
    <section className="mx-auto w-full max-w-6xl space-y-6">
      <Panel
        eyebrow="Mottagare"
        title="Kunder per domän"
        description="Valj en domän och se alla mottagare som redan finns under den domänen från tidigare kampanjer."
      >
        <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-[28px] border border-white/10 bg-slate-950/55 p-6">
            <p className="text-sm font-medium text-white">Valj domän</p>
            <div className="mt-4 space-y-3">
              {senderProfiles.map((profile) => {
                const isSelected = profile.id === selectedDomainId;
                return (
                  <button
                    key={profile.id}
                    type="button"
                    onClick={() => onSelectDomain(profile.id)}
                    className={`block w-full rounded-2xl border p-4 text-left transition ${
                      isSelected
                        ? "border-cyan-300/35 bg-cyan-400/10"
                        : "border-white/8 bg-white/[0.02] hover:border-cyan-300/20"
                    }`}
                  >
                    <p className="font-medium text-white">{profile.name}</p>
                    <p className="mt-1 text-sm text-slate-400">{profile.domain}</p>
                    <p className="mt-3 text-xs uppercase tracking-[0.22em] text-slate-500">{profile.fromEmail}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-slate-950/55 p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white">Mottagarlista</p>
                <p className="text-sm text-slate-400">Unika mottagare som tidigare använts under vald domän.</p>
              </div>
              {loading ? (
                <span className="rounded-full bg-white/[0.05] px-3 py-1 text-xs text-cyan-200">Laddar...</span>
              ) : (
                <span className="rounded-full bg-white/[0.05] px-3 py-1 text-xs text-cyan-200">
                  {recipients.length} mottagare
                </span>
              )}
            </div>

            {error ? (
              <div className="mb-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-200">
                {error}
              </div>
            ) : null}

            <div className="overflow-hidden rounded-[22px] border border-white/8">
              <table className="min-w-full divide-y divide-white/8 text-left text-sm">
                <thead className="bg-white/[0.03] text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Namn</th>
                    <th className="px-4 py-3">Senaste kampanj</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/6">
                  {!loading && recipients.length === 0 ? (
                    <tr className="bg-slate-950/40">
                      <td className="px-4 py-6 text-center text-sm text-slate-400" colSpan={4}>
                        Inga mottagare finns ännu under den här domänen.
                      </td>
                    </tr>
                  ) : null}
                  {recipients.map((recipient) => (
                    <tr key={`${recipient.email}-${recipient.campaignId}`} className="bg-slate-950/40">
                      <td className="px-4 py-3 text-slate-100">{recipient.email}</td>
                      <td className="px-4 py-3 text-slate-300">{recipient.name || "-"}</td>
                      <td className="px-4 py-3 text-slate-300">{recipient.campaignName}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-100">
                          {recipient.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Panel>
    </section>
  );
}

function Panel({ eyebrow, title, description, children }) {
  return (
    <section className="rounded-[32px] border border-white/10 bg-slate-900/65 p-6 shadow-[0_30px_90px_rgba(2,6,23,0.45)] backdrop-blur-xl">
      <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/60">{eyebrow}</p>
      <div className="mb-6 mt-3">
        <h3 className="text-2xl font-semibold text-white">{title}</h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{description}</p>
      </div>
      {children}
    </section>
  );
}
