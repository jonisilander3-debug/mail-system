export default function SettingsPage({
  senderProfiles,
  selectedProfileId,
  setSelectedProfileId,
  profilesLoading,
  profilesError,
  onCreateProfile,
  onEditProfile,
  onDeleteProfile,
  onSetDefault,
  onRefreshProfiles,
  users,
  usersLoading,
  usersError,
  onCreateUser,
  onEditUser,
  onRefreshUsers,
  aiSettings,
  aiSettingsLoading,
  aiSettingsError,
  onAiSettingsChange,
  onAiSettingsSave,
}) {
  return (
    <section className="mx-auto w-full max-w-6xl space-y-6">
      <Panel
        eyebrow="Installningar"
        title="Domaner, API och anvandare"
        description="Hantera avsandardomaner, OpenAI for AI-assistenten och vilka anvandare som far arbeta med respektive doman."
      >
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onCreateProfile}
            className="rounded-2xl bg-gradient-to-r from-cyan-300 via-cyan-400 to-teal-400 px-5 py-3 text-sm font-semibold text-slate-950 shadow-[0_18px_48px_rgba(45,212,191,0.35)]"
          >
            Lagg till doman
          </button>
          <button
            type="button"
            onClick={onCreateUser}
            className="rounded-2xl border border-cyan-300/30 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-100"
          >
            Lagg till anvandare
          </button>
          <button
            type="button"
            onClick={() => {
              onRefreshProfiles();
              onRefreshUsers();
            }}
            className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-slate-200"
          >
            Uppdatera
          </button>
        </div>
      </Panel>

      <Panel
        eyebrow="AI"
        title="OpenAI"
        description="Lagg in OpenAI API-nyckeln har sa att AI-assistenten kan ratta text, gora mejlen mer professionella och bygga HTML-email i kampanjguiden."
      >
        {aiSettingsLoading ? <StatusMessage tone="info">Laddar AI-installningar...</StatusMessage> : null}
        {aiSettingsError ? <StatusMessage tone="error">{aiSettingsError}</StatusMessage> : null}

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4 rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-white">AI-assistent</p>
                <p className="mt-1 text-sm text-slate-400">
                  Nyckeln visas aldrig tillbaka i klartext efter att den sparats.
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  aiSettings.hasOpenaiApiKey ? "bg-cyan-400/15 text-cyan-100" : "bg-amber-400/15 text-amber-200"
                }`}
              >
                {aiSettings.hasOpenaiApiKey ? "API key added" : "API key missing"}
              </span>
            </div>

            <label className="block rounded-[24px] border border-white/10 bg-slate-950/50 p-5">
              <span className="text-xs uppercase tracking-[0.24em] text-slate-500">OpenAI-model</span>
              <input
                type="text"
                value={aiSettings.openaiModel}
                onChange={(event) => onAiSettingsChange("openaiModel", event.target.value)}
                placeholder="gpt-5.4-mini"
                className="mt-3 w-full rounded-2xl border border-white/8 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500"
              />
            </label>

            <label className="block rounded-[24px] border border-white/10 bg-slate-950/50 p-5">
              <span className="text-xs uppercase tracking-[0.24em] text-slate-500">OpenAI API-nyckel</span>
              <input
                type="password"
                value={aiSettings.openaiApiKey}
                onChange={(event) => onAiSettingsChange("openaiApiKey", event.target.value)}
                placeholder="Leave empty to keep existing API key"
                className="mt-3 w-full rounded-2xl border border-white/8 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500"
              />
            </label>

            <label className="block rounded-[24px] border border-white/10 bg-slate-950/50 p-5">
              <span className="text-xs uppercase tracking-[0.24em] text-slate-500">AI HTML prompt</span>
              <textarea
                value={aiSettings.openaiHtmlPrompt}
                onChange={(event) => onAiSettingsChange("openaiHtmlPrompt", event.target.value)}
                placeholder="Describe the visual style, layout, CTA structure, and tone you want AI to use when generating HTML email templates."
                rows={7}
                className="mt-3 w-full rounded-2xl border border-white/8 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500"
              />
            </label>

            <button
              type="button"
              onClick={onAiSettingsSave}
              disabled={aiSettings.saving}
              className="rounded-2xl bg-gradient-to-r from-cyan-300 via-cyan-400 to-teal-400 px-5 py-3 text-sm font-semibold text-slate-950 shadow-[0_18px_48px_rgba(45,212,191,0.35)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {aiSettings.saving ? "Sparar..." : "Spara AI-installningar"}
            </button>
          </div>

          <div className="grid gap-3">
            <DetailRow label="Model" value={aiSettings.openaiModel || "gpt-5.4-mini"} />
            <DetailRow label="Masked key" value={aiSettings.maskedOpenaiApiKey || "No API key stored"} />
            <DetailRow label="Status" value={aiSettings.hasOpenaiApiKey ? "Klar" : "Saknas"} />
            <DetailRow label="HTML prompt" value={aiSettings.openaiHtmlPrompt ? "Configured" : "Using default"} />
          </div>
        </div>
      </Panel>

      <Panel
        eyebrow="Domaner & API"
        title="Avsandarprofiler"
        description="Har skapar du domanerna som anvandare senare far ratt att se och skicka fran."
      >
        {profilesLoading ? <StatusMessage tone="info">Laddar domanprofiler...</StatusMessage> : null}
        {profilesError ? <StatusMessage tone="error">{profilesError}</StatusMessage> : null}

        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          {senderProfiles.map((profile) => {
            const isSelected = profile.id === selectedProfileId;
            return (
              <div
                key={profile.id}
                className={`rounded-[28px] border p-5 transition ${
                  isSelected
                    ? "border-cyan-300/30 bg-cyan-400/[0.08] shadow-[0_18px_70px_rgba(14,165,233,0.12)]"
                    : "border-white/10 bg-white/[0.03]"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-white">{profile.name}</p>
                    <p className="mt-1 text-sm text-slate-400">{profile.domain}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {profile.isDefault ? (
                      <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-medium text-emerald-300">
                        Default
                      </span>
                    ) : null}
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        profile.maskedToken ? "bg-cyan-400/15 text-cyan-100" : "bg-amber-400/15 text-amber-200"
                      }`}
                    >
                      {profile.maskedToken ? "API key added" : "API key missing"}
                    </span>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <DetailRow label="From name" value={profile.fromName} />
                  <DetailRow label="From email" value={profile.fromEmail} />
                  <DetailRow label="Message stream" value={profile.messageStream} />
                  <DetailRow label="Status" value={profile.status} />
                  <DetailRow label="Masked token" value={profile.maskedToken || "No token stored"} />
                  <DetailRow label="Default" value={profile.isDefault ? "Ja" : "Nej"} />
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedProfileId(profile.id)}
                    className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-100"
                  >
                    Valj
                  </button>
                  <button
                    type="button"
                    onClick={() => onEditProfile(profile)}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-slate-200"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetDefault(profile)}
                    disabled={profile.isDefault}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Set default
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteProfile(profile)}
                    className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-2 text-sm font-medium text-rose-200"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel
        eyebrow="Anvandare"
        title="Domanrattigheter"
        description="Skapa anvandare, inaktivera konton och valj vilka domaner varje anvandare far skapa email fran."
      >
        {usersLoading ? <StatusMessage tone="info">Laddar anvandare...</StatusMessage> : null}
        {usersError ? <StatusMessage tone="error">{usersError}</StatusMessage> : null}

        <div className="overflow-hidden rounded-[22px] border border-white/8">
          <table className="min-w-full divide-y divide-white/8 text-left text-sm">
            <thead className="bg-white/[0.03] text-slate-400">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Domaner</th>
                <th className="px-4 py-3">Atgard</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/6">
              {!usersLoading && users.length === 0 ? (
                <tr className="bg-slate-950/40">
                  <td className="px-4 py-6 text-center text-sm text-slate-400" colSpan={4}>
                    Inga extra anvandare finns an.
                  </td>
                </tr>
              ) : null}
              {users.map((user) => (
                <tr key={user.id} className="bg-slate-950/40">
                  <td className="px-4 py-3 text-slate-100">{user.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        user.isActive ? "bg-emerald-400/15 text-emerald-300" : "bg-amber-400/15 text-amber-200"
                      }`}
                    >
                      {user.isActive ? "Aktiv" : "Inaktiv"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {user.senderProfiles.length > 0
                      ? user.senderProfiles.map((profile) => profile.domain).join(", ")
                      : "Inga domaner valda"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onEditUser(user)}
                      className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-slate-200"
                    >
                      edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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

function DetailRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/8 bg-slate-950/50 px-4 py-3">
      <span className="text-xs uppercase tracking-[0.22em] text-slate-500">{label}</span>
      <span className="text-right text-sm text-slate-100">{value}</span>
    </div>
  );
}

function StatusMessage({ tone, children }) {
  const toneClass =
    tone === "error"
      ? "border-rose-400/20 bg-rose-400/10 text-rose-200"
      : "border-cyan-300/20 bg-cyan-400/[0.06] text-cyan-100";

  return <div className={`rounded-[24px] border p-5 text-sm ${toneClass}`}>{children}</div>;
}
