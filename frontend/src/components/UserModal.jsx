export default function UserModal({ modalState, senderProfiles, onClose, onSubmit, onChange }) {
  const isEdit = modalState.mode === "edit";

  function toggleSenderProfile(profileId) {
    const nextIds = modalState.form.senderProfileIds.includes(profileId)
      ? modalState.form.senderProfileIds.filter((id) => id !== profileId)
      : [...modalState.form.senderProfileIds, profileId];

    onChange("senderProfileIds", nextIds);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-[32px] border border-cyan-400/20 bg-slate-950/95 p-6 shadow-[0_40px_120px_rgba(2,6,23,0.65)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/60">
              {isEdit ? "Edit user" : "Add user"}
            </p>
            <h3 className="mt-3 text-2xl font-semibold text-white">
              {isEdit ? "Uppdatera användare" : "Skapa användare"}
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Välj vilka domäner användaren får se och skapa utskick från.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-slate-300"
          >
            Close
          </button>
        </div>

        <form className="mt-6 space-y-5" onSubmit={onSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="Email"
              value={modalState.form.email}
              onChange={(value) => onChange("email", value)}
              placeholder="user@jompalompa.com"
            />
            <Field
              label={isEdit ? "Nytt lösenord" : "Lösenord"}
              type="password"
              value={modalState.form.password}
              onChange={(value) => onChange("password", value)}
              placeholder={isEdit ? "Lämna tomt för att behålla nuvarande" : "Minst 8 tecken"}
            />
          </div>

          <label className="flex items-center gap-3 rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={modalState.form.isActive}
              onChange={(event) => onChange("isActive", event.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-slate-950 text-cyan-400"
            />
            Kontot är aktivt
          </label>

          <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Domäner användaren får se</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {senderProfiles.map((profile) => (
                <label
                  key={profile.id}
                  className="flex items-start gap-3 rounded-2xl border border-white/8 bg-slate-950/60 px-4 py-3 text-sm text-slate-200"
                >
                  <input
                    type="checkbox"
                    checked={modalState.form.senderProfileIds.includes(profile.id)}
                    onChange={() => toggleSenderProfile(profile.id)}
                    className="mt-1 h-4 w-4 rounded border-white/20 bg-slate-950 text-cyan-400"
                  />
                  <span>
                    <span className="block font-medium text-white">{profile.name}</span>
                    <span className="block text-xs text-slate-400">{profile.domain}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {modalState.error ? (
            <div className="rounded-[22px] border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-200">
              {modalState.error}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={modalState.submitting}
              className="rounded-2xl bg-gradient-to-r from-cyan-300 via-cyan-400 to-teal-400 px-5 py-3 text-sm font-semibold text-slate-950 shadow-[0_18px_48px_rgba(45,212,191,0.35)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {modalState.submitting ? "Sparar..." : isEdit ? "Spara ändringar" : "Skapa användare"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-slate-200"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder = "", type = "text" }) {
  return (
    <label className="block rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
      <span className="text-xs uppercase tracking-[0.24em] text-slate-500">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-3 w-full rounded-2xl border border-white/8 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500"
      />
    </label>
  );
}
