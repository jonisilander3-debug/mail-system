import { useEffect, useState } from "react";

const steps = [
  { id: 1, title: "Campaign Setup", note: "Profile, subject, voice" },
  { id: 2, title: "Audience Upload", note: "CSV or Excel intake" },
  { id: 3, title: "Preview & Test", note: "AI review and send test" },
  { id: 4, title: "Launch Control", note: "Final checks and send" },
];

const recipients = [
  { email: "anna@northmail.se", name: "Anna Berg", segment: "VIP", state: "valid" },
  { email: "leo@signal.fi", name: "Leo Niemi", segment: "Trial", state: "valid" },
  { email: "sales@", name: "Broken Row", segment: "Unknown", state: "invalid" },
  { email: "mikael@fjord.no", name: "Mikael S", segment: "Newsletter", state: "duplicate" },
];

const assistantNotes = [
  "Subject line sentiment is confident and clear for a B2B launch.",
  "HTML body is missing a stronger primary CTA above the fold.",
  "28 recipients look valid. 1 invalid and 1 duplicate were detected.",
];

const API_BASE_URL = "http://127.0.0.1:3000";

function App() {
  const [senderProfiles, setSenderProfiles] = useState([]);
  const [selectedProfileId, setSelectedProfileId] = useState(null);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [profilesError, setProfilesError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadProfiles() {
      setProfilesLoading(true);
      setProfilesError("");

      try {
        const response = await fetch(`${API_BASE_URL}/api/settings/domains`, {
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }

        const data = await response.json();
        if (cancelled) {
          return;
        }

        const domains = Array.isArray(data.domains) ? data.domains : [];
        setSenderProfiles(domains);

        const defaultProfile = domains.find((profile) => profile.isDefault) || domains[0] || null;
        setSelectedProfileId(defaultProfile ? defaultProfile.id : null);
      } catch (error) {
        if (!cancelled) {
          setProfilesError("Could not load sender profiles from the backend.");
          setSenderProfiles([]);
          setSelectedProfileId(null);
        }
      } finally {
        if (!cancelled) {
          setProfilesLoading(false);
        }
      }
    }

    loadProfiles();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedProfile = senderProfiles.find((profile) => profile.id === selectedProfileId) || senderProfiles[0] || null;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.15),_transparent_32%),linear-gradient(160deg,_#020617_0%,_#061326_45%,_#071d2e_100%)] text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="hidden w-80 shrink-0 border-r border-cyan-500/10 bg-slate-950/70 px-6 py-8 backdrop-blur-xl lg:flex lg:flex-col">
          <div className="mb-10">
            <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-300 via-cyan-400 to-teal-500 text-lg font-bold text-slate-950 shadow-[0_20px_60px_rgba(6,182,212,0.35)]">
              EC
            </div>
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-200/70">Campaign Control</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Postmark Launchpad</h1>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              A focused email-operations workspace for domain-aware campaign prep, preview, testing, and launch.
            </p>
          </div>

          <nav className="space-y-3">
            {["Dashboard", "Campaign Wizard", "Domains & API Keys", "Recipient Imports", "Tests & Launches"].map((label, index) => (
              <div
                key={label}
                className={`rounded-2xl border px-4 py-3 transition ${
                  index === 1
                    ? "border-cyan-400/35 bg-cyan-400/10 text-white shadow-[0_0_0_1px_rgba(34,211,238,0.12)]"
                    : "border-white/5 bg-white/[0.02] text-slate-400"
                }`}
              >
                <p className="text-sm font-medium">{label}</p>
              </div>
            ))}
          </nav>

          <div className="mt-auto rounded-3xl border border-cyan-400/15 bg-white/[0.03] p-5">
            <p className="text-xs uppercase tracking-[0.25em] text-cyan-200/70">Queue Health</p>
            <div className="mt-4 flex items-end justify-between">
              <div>
                <p className="text-4xl font-semibold text-white">128</p>
                <p className="text-sm text-slate-400">pending recipients in active queues</p>
              </div>
              <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-medium text-emerald-300">
                Stable
              </span>
            </div>
          </div>
        </aside>

        <main className="flex-1 px-5 py-6 sm:px-8 lg:px-10">
          <header className="mb-8 flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/65">Standalone Admin</p>
              <h2 className="mt-2 text-3xl font-semibold text-white sm:text-4xl">4-Step Campaign Wizard</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400 sm:text-base">
                Replace the old server-rendered admin with a modern control room. This mockup is intentionally UI-first:
                the backend remains Express, Prisma, Postmark, pg-boss, and session auth underneath.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Metric label="Open drafts" value="06" detail="Across all domains" />
              <Metric label="Valid recipients" value="28" detail="In current import" />
              <Metric label="Test status" value="Ready" detail="Last send 3 min ago" />
            </div>
          </header>

          <section className="mb-8 grid gap-4 xl:grid-cols-4">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={`rounded-[28px] border p-5 ${
                  index === 0
                    ? "border-cyan-300/35 bg-cyan-400/10 shadow-[0_18px_70px_rgba(14,165,233,0.18)]"
                    : "border-white/10 bg-white/[0.03]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-cyan-100/90">Step {step.id}</span>
                  <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.25em] text-slate-400">
                    {index === 0 ? "Active" : "Queued"}
                  </span>
                </div>
                <h3 className="mt-4 text-xl font-semibold text-white">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{step.note}</p>
              </div>
            ))}
          </section>

          <section className="grid gap-6 2xl:grid-cols-[1.35fr_0.95fr]">
            <div className="space-y-6">
              <Panel
                eyebrow="Step 1"
                title="Campaign setup and domain profile"
                description="Choose which verified Postmark identity should own this send, then lock in subject, tone, and unsubscribe behavior."
              >
                <div className="grid gap-4 lg:grid-cols-[1.05fr_1fr]">
                  <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs uppercase tracking-[0.25em] text-cyan-200/70">Sender profiles</p>
                      {profilesLoading ? (
                        <span className="rounded-full bg-white/[0.05] px-3 py-1 text-xs text-cyan-200">Loading...</span>
                      ) : null}
                    </div>

                    {profilesError ? (
                      <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-200">
                        {profilesError}
                      </div>
                    ) : null}

                    {!profilesLoading && !profilesError && senderProfiles.length === 0 ? (
                      <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4 text-sm text-amber-100">
                        No sender profiles are configured yet.
                      </div>
                    ) : null}

                    <div className="mt-4 space-y-3">
                      {senderProfiles.map((profile) => {
                        const isSelected = profile.id === selectedProfileId;
                        return (
                          <button
                            key={profile.id}
                            type="button"
                            onClick={() => setSelectedProfileId(profile.id)}
                            className={`block w-full rounded-2xl border p-4 text-left transition ${
                              isSelected
                                ? "border-cyan-300/30 bg-cyan-400/10"
                                : "border-white/8 bg-white/[0.02]"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <p className="font-medium text-white">{profile.name}</p>
                                <p className="mt-1 text-sm text-slate-400">{profile.domain}</p>
                              </div>
                              <span className="rounded-full bg-slate-950/70 px-3 py-1 text-xs text-cyan-200">
                                {profile.status}
                              </span>
                            </div>
                            <p className="mt-3 text-xs uppercase tracking-[0.22em] text-slate-500">
                              Message stream: {profile.messageStream}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid gap-4">
                    <Field label="Campaign name" value="Q2 Product Momentum Launch" />
                    <Field label="Subject line" value="See what changed in your customer reporting flow" />
                    <Field label="Preview text" value="A cleaner workflow, faster reporting, and your Q2 launch notes." />
                    <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
                      <p className="text-sm font-medium text-white">Selected sender details</p>
                      <div className="mt-4 grid gap-3 text-sm">
                        <DetailRow label="Domain" value={selectedProfile?.domain || "No selection"} />
                        <DetailRow label="From name" value={selectedProfile?.fromName || "No selection"} />
                        <DetailRow label="From email" value={selectedProfile?.fromEmail || "No selection"} />
                        <DetailRow label="Message stream" value={selectedProfile?.messageStream || "No selection"} />
                        <DetailRow label="Masked token" value={selectedProfile?.maskedToken || "No token stored"} />
                      </div>
                    </div>
                    <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
                      <p className="text-sm font-medium text-white">Personalization tokens</p>
                      <div className="mt-3 flex flex-wrap gap-2 text-sm">
                        {["{{name}}", "{{email}}", "{{unsubscribe_url}}"].map((token) => (
                          <span key={token} className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-cyan-100">
                            {token}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </Panel>

              <Panel
                eyebrow="Step 2"
                title="CSV or Excel audience intake"
                description="Drop in a list, validate it automatically, and see invalid / duplicate / unsubscribed contacts before launch."
              >
                <div className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
                  <div className="rounded-[28px] border border-dashed border-cyan-300/25 bg-cyan-400/[0.06] p-6">
                    <p className="text-sm font-medium text-white">Upload recipients</p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      Supports `.csv`, `.xlsx`, `email`, `name`, and extra segmentation columns for preview.
                    </p>
                    <div className="mt-6 flex min-h-52 items-center justify-center rounded-[22px] border border-white/10 bg-slate-950/60">
                      <div className="text-center">
                        <p className="text-5xl text-cyan-300">+</p>
                        <p className="mt-3 text-sm font-medium text-white">Drag & drop file here</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.28em] text-slate-500">CSV or Excel import</p>
                      </div>
                    </div>
                    <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                      <StatBlock label="Uploaded" value="30" />
                      <StatBlock label="Valid" value="28" />
                      <StatBlock label="Invalid" value="1" />
                      <StatBlock label="Duplicates" value="1" />
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-white/10 bg-slate-900/70 p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">Automatic recipient preview</p>
                        <p className="text-sm text-slate-400">Rows are classified before they ever hit a send queue.</p>
                      </div>
                      <span className="rounded-full bg-white/[0.05] px-3 py-1 text-xs text-cyan-200">Preview mode</span>
                    </div>
                    <div className="overflow-hidden rounded-[22px] border border-white/8">
                      <table className="min-w-full divide-y divide-white/8 text-left text-sm">
                        <thead className="bg-white/[0.03] text-slate-400">
                          <tr>
                            <th className="px-4 py-3">Email</th>
                            <th className="px-4 py-3">Name</th>
                            <th className="px-4 py-3">Segment</th>
                            <th className="px-4 py-3">State</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/6">
                          {recipients.map((recipient) => (
                            <tr key={`${recipient.email}-${recipient.state}`} className="bg-slate-950/40">
                              <td className="px-4 py-3 text-slate-100">{recipient.email}</td>
                              <td className="px-4 py-3 text-slate-300">{recipient.name}</td>
                              <td className="px-4 py-3 text-slate-400">{recipient.segment}</td>
                              <td className="px-4 py-3">
                                <span
                                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                                    recipient.state === "valid"
                                      ? "bg-emerald-400/15 text-emerald-300"
                                      : recipient.state === "invalid"
                                        ? "bg-rose-400/15 text-rose-300"
                                        : "bg-amber-400/15 text-amber-300"
                                  }`}
                                >
                                  {recipient.state}
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
            </div>

            <div className="space-y-6">
              <Panel
                eyebrow="AI Assistant"
                title="Campaign coach"
                description="A sidecar panel for copy checks, audience sanity checks, and readiness summaries."
              >
                <div className="space-y-4">
                  {assistantNotes.map((note) => (
                    <div key={note} className="rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.05] p-4 text-sm leading-6 text-slate-200">
                      {note}
                    </div>
                  ))}
                  <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                    <p className="text-xs uppercase tracking-[0.26em] text-slate-500">Suggested next action</p>
                    <p className="mt-2 text-sm text-white">Move the CTA button higher and send a test email to `launch-review@example.com`.</p>
                  </div>
                </div>
              </Panel>

              <Panel
                eyebrow="Step 3"
                title="Live email preview and test send"
                description="Preview the HTML and text versions side by side, then send a gated test email before launch."
              >
                <div className="rounded-[28px] border border-white/10 bg-slate-950/80 p-4 shadow-[0_25px_80px_rgba(8,15,34,0.45)]">
                  <div className="mb-4 flex items-center justify-between border-b border-white/8 pb-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.26em] text-cyan-200/60">Live preview</p>
                      <p className="mt-2 text-lg font-medium text-white">See what changed in your customer reporting flow</p>
                    </div>
                    <span className="rounded-full bg-cyan-400/12 px-3 py-1 text-xs text-cyan-200">
                      {selectedProfile?.messageStream || "HTML mode"}
                    </span>
                  </div>
                  <div className="rounded-[22px] bg-white p-6 text-slate-800">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                      From {selectedProfile?.fromName || "Selected Sender"}
                    </p>
                    <h3 className="mt-4 text-3xl font-semibold text-slate-900">Hello Anna,</h3>
                    <p className="mt-4 text-base leading-7 text-slate-600">
                      We rebuilt the reporting workflow to make weekly campaign summaries easier to scan, faster to share,
                      and clearer to act on.
                    </p>
                    <div className="mt-6 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-cyan-200">
                      Open the Q2 product update
                    </div>
                    <p className="mt-8 text-xs leading-6 text-slate-400">
                      Sending identity: {selectedProfile?.fromEmail || "No sender selected"}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto]">
                  <Field label="Send test email to" value="launch-review@example.com" />
                  <button className="mt-6 rounded-2xl bg-gradient-to-r from-cyan-400 to-teal-400 px-5 py-3 text-sm font-semibold text-slate-950 shadow-[0_16px_40px_rgba(34,211,238,0.28)]">
                    Send test
                  </button>
                </div>
              </Panel>

              <Panel
                eyebrow="Step 4"
                title="Final launch control"
                description="Confirm batch settings, estimated throughput, and launch only after the test send is complete."
              >
                <div className="grid gap-4 sm:grid-cols-3">
                  <StatBlock label="Batch size" value="100/min" />
                  <StatBlock label="Estimated duration" value="17 min" />
                  <StatBlock label="Queue mode" value={selectedProfile?.messageStream || "Broadcast"} />
                </div>
                <div className="mt-5 rounded-[24px] border border-amber-300/20 bg-amber-400/[0.08] p-5">
                  <p className="text-sm font-medium text-amber-100">Launch confirmation</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    You are about to send this campaign to 28 validated recipients across{" "}
                    {selectedProfile ? `${selectedProfile.domain} (${selectedProfile.fromEmail})` : "the selected domain profile"}.
                  </p>
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <button className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-slate-200">
                    Pause campaign
                  </button>
                  <button className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-slate-200">
                    Resume campaign
                  </button>
                  <button className="rounded-2xl bg-gradient-to-r from-cyan-300 via-cyan-400 to-teal-400 px-5 py-3 text-sm font-semibold text-slate-950 shadow-[0_18px_48px_rgba(45,212,191,0.35)]">
                    Send campaign now
                  </button>
                </div>
              </Panel>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

function Metric({ label, value, detail }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
      <p className="text-xs uppercase tracking-[0.25em] text-slate-500">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-sm text-slate-400">{detail}</p>
    </div>
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

function Field({ label, value }) {
  return (
    <label className="block rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
      <span className="text-xs uppercase tracking-[0.24em] text-slate-500">{label}</span>
      <div className="mt-3 rounded-2xl border border-white/8 bg-slate-950/60 px-4 py-3 text-sm text-slate-100">
        {value}
      </div>
    </label>
  );
}

function StatBlock({ label, value }) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{label}</p>
      <p className="mt-3 text-xl font-semibold text-white">{value}</p>
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

export default App;
