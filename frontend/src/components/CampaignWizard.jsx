import { useState } from "react";

const missingPostmarkWarning = "Den har domanen saknar Postmark API-nyckel.";

export default function CampaignWizard({
  steps,
  assistantNotes,
  senderProfiles,
  selectedProfileId,
  selectedProfile,
  setSelectedProfileId,
  profilesLoading,
  profilesError,
  campaignForm,
  savedCampaignId,
  campaignSaveLoading,
  testEmail,
  testEmailSent,
  testEmailLoading,
  campaignStarting,
  campaignStarted,
  aiLoadingMode,
  aiError,
  recipientPreview,
  uploadLoading,
  uploadError,
  uploadedFileName,
  fileInputRef,
  onOpenFilePicker,
  onRecipientFileChange,
  onCampaignFieldChange,
  onSaveCampaign,
  onTestEmailChange,
  onSendTestEmail,
  onStartCampaign,
  onAIGenerate,
}) {
  const [currentStep, setCurrentStep] = useState(1);
  const previewRows = recipientPreview.rowsPreview || [];
  const detectedEmailColumn = recipientPreview.detectedColumns?.email || "Inte hittad";
  const detectedNameColumn = recipientPreview.detectedColumns?.name || "Inte hittad";
  const hasStepOneData = Boolean(
    selectedProfileId &&
      campaignForm.campaignName.trim() &&
      campaignForm.subject.trim() &&
      campaignForm.rawMessage.trim(),
  );
  const hasValidRecipients = (recipientPreview.valid || 0) > 0;
  const hasSavedDraft = Boolean(savedCampaignId);
  const canSendTest = Boolean(hasSavedDraft && selectedProfile?.maskedToken && testEmail.trim());
  const canLaunch = Boolean(hasSavedDraft && hasValidRecipients && selectedProfile?.maskedToken);

  const completion = {
    1: hasStepOneData,
    2: hasValidRecipients,
    3: hasSavedDraft,
    4: false,
  };

  const nextEnabled =
    currentStep === 1 ? completion[1] : currentStep === 2 ? completion[2] : currentStep === 3 ? completion[3] : false;

  function goNext() {
    if (nextEnabled && currentStep < steps.length) {
      setCurrentStep((step) => step + 1);
    }
  }

  function goBack() {
    if (currentStep > 1) {
      setCurrentStep((step) => step - 1);
    }
  }

  return (
    <section className="mx-auto w-full max-w-6xl">
      <WizardProgress steps={steps} currentStep={currentStep} completion={completion} onStepSelect={setCurrentStep} />

      <div className="rounded-[36px] border border-white/10 bg-slate-900/70 p-6 shadow-[0_30px_90px_rgba(2,6,23,0.45)] backdrop-blur-xl sm:p-8">
        {currentStep === 1 ? (
          <div className="space-y-8">
            <SectionHeader
              stepNumber={1}
              title="Kampanj"
              description="Valj avsandardoman, skriv amnesrad och formulera budskapet innan du gar vidare."
            />

            <div className="grid gap-6 xl:grid-cols-[1.05fr_1fr]">
              <div className="rounded-[28px] border border-white/10 bg-slate-950/55 p-6">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.26em] text-cyan-200/70">Avsandardoman</p>
                  {profilesLoading ? (
                    <span className="rounded-full bg-white/[0.05] px-3 py-1 text-xs text-cyan-200">Laddar...</span>
                  ) : null}
                </div>

                {profilesError ? (
                  <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-200">
                    {profilesError}
                  </div>
                ) : null}

                {!profilesLoading && !profilesError && senderProfiles.length === 0 ? (
                  <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4 text-sm text-amber-100">
                    Inga domanprofiler finns upplagda an.
                  </div>
                ) : null}

                <div className="mt-5 space-y-3">
                  {senderProfiles.map((profile) => {
                    const isSelected = profile.id === selectedProfileId;
                    return (
                      <button
                        key={profile.id}
                        type="button"
                        onClick={() => setSelectedProfileId(profile.id)}
                        className={`block w-full rounded-[24px] border p-4 text-left transition ${
                          isSelected
                            ? "border-cyan-300/35 bg-cyan-400/10 shadow-[0_12px_40px_rgba(14,165,233,0.12)]"
                            : "border-white/8 bg-white/[0.02] hover:border-cyan-300/20"
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
                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                          <MiniDetail label="Fran" value={profile.fromEmail} />
                          <MiniDetail label="API" value={profile.maskedToken ? "Nyckel sparad" : "Nyckel saknas"} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-4">
                <TextInput
                  label="Kampanjnamn"
                  value={campaignForm.campaignName}
                  onChange={(value) => onCampaignFieldChange("campaignName", value)}
                  placeholder="Sommarutskick maj 2026"
                />
                <TextInput
                  label="Amnesrad"
                  value={campaignForm.subject}
                  onChange={(value) => onCampaignFieldChange("subject", value)}
                  placeholder="Nyheter och erbjudanden for dig"
                />
                <SelectInput
                  label="Sprak"
                  value={campaignForm.language || "sv"}
                  onChange={(value) => onCampaignFieldChange("language", value)}
                  options={[
                    { value: "sv", label: "Svenska" },
                    { value: "en", label: "English" },
                    { value: "da", label: "Dansk" },
                    { value: "no", label: "Norsk" },
                  ]}
                />
                <TextArea
                  label="Meddelande"
                  value={campaignForm.rawMessage}
                  onChange={(value) => onCampaignFieldChange("rawMessage", value)}
                  placeholder="Skriv kampanjens huvudbudskap har."
                />
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
              <div className="rounded-[28px] border border-white/10 bg-slate-950/55 p-6">
                <p className="text-sm font-medium text-white">AI-assistent</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Forbattra texten, gora tonen mer professionell eller bygg en enkel HTML-version innan du gar vidare.
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <ActionButton onClick={() => onAIGenerate("fix_text")} disabled={Boolean(aiLoadingMode)}>
                    {aiLoadingMode === "fix_text" ? "AI arbetar..." : "Ratta texten"}
                  </ActionButton>
                  <ActionButton onClick={() => onAIGenerate("professional")} disabled={Boolean(aiLoadingMode)}>
                    {aiLoadingMode === "professional" ? "AI arbetar..." : "Gor mer professionell"}
                  </ActionButton>
                  <ActionButton
                    onClick={() => onAIGenerate("html_email")}
                    disabled={Boolean(aiLoadingMode)}
                    accent
                  >
                    {aiLoadingMode === "html_email" ? "AI bygger HTML..." : "Skapa HTML-email"}
                  </ActionButton>
                </div>
                {aiError ? (
                  <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-200">
                    {aiError}
                  </div>
                ) : null}
                <div className="mt-5 grid gap-3">
                  {assistantNotes.map((note) => (
                    <div key={note} className="rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.05] p-4 text-sm leading-6 text-slate-200">
                      {note}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-slate-950/55 p-6">
                <p className="text-sm font-medium text-white">Vald avsandare</p>
                <div className="mt-4 grid gap-3">
                  <DetailRow label="Doman" value={selectedProfile?.domain || "Ingen vald"} />
                  <DetailRow label="Fran namn" value={selectedProfile?.fromName || "Ingen vald"} />
                  <DetailRow label="Fran email" value={selectedProfile?.fromEmail || "Ingen vald"} />
                  <DetailRow label="Message stream" value={selectedProfile?.messageStream || "Ingen vald"} />
                  <DetailRow label="API-nyckel" value={selectedProfile?.maskedToken || "Ingen nyckel sparad"} />
                  <DetailRow label="Sprak" value={campaignForm.language || "sv"} />
                  <DetailRow label="Personalisering" value={"{{name}}, {{email}}, {{unsubscribe_url}}"} />
                </div>
                {!selectedProfile?.maskedToken ? (
                  <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-400/[0.08] p-4 text-sm text-amber-100">
                    {missingPostmarkWarning}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {currentStep === 2 ? (
          <div className="space-y-8">
            <SectionHeader
              stepNumber={2}
              title="Mottagare"
              description="Ladda upp CSV eller Excel, se vilka kolumner som hittades och kontrollera listan innan du fortsatter."
            />

            <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
              <div className="space-y-6">
                <div className="rounded-[28px] border border-dashed border-cyan-300/25 bg-cyan-400/[0.06] p-6">
                  <p className="text-sm font-medium text-white">Ladda upp fil</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Stod for CSV, XLSX och XLS. Systemet hittar automatiskt vanliga kolumner for email och namn.
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={onRecipientFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={onOpenFilePicker}
                    disabled={uploadLoading}
                    className="mt-6 flex min-h-52 w-full items-center justify-center rounded-[24px] border border-white/10 bg-slate-950/60 text-center transition hover:border-cyan-300/30 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <div>
                      <p className="text-5xl text-cyan-300">{uploadLoading ? "..." : "+"}</p>
                      <p className="mt-3 text-sm font-medium text-white">
                        {uploadLoading ? "Laser in fil..." : uploadedFileName ? uploadedFileName : "Valj fil"}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-[0.28em] text-slate-500">CSV eller Excel</p>
                    </div>
                  </button>
                  {uploadError ? (
                    <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-200">
                      {uploadError}
                    </div>
                  ) : null}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <DetailRow label="Email-kolumn" value={detectedEmailColumn} />
                  <DetailRow label="Namn-kolumn" value={detectedNameColumn} />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <StatBlock label="Totalt" value={String(recipientPreview.total || 0)} />
                  <StatBlock label="Giltiga" value={String(recipientPreview.valid || 0)} />
                  <StatBlock label="Ogiltiga" value={String(recipientPreview.invalid || 0)} />
                  <StatBlock label="Dubbletter" value={String(recipientPreview.duplicates || 0)} />
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-slate-950/55 p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">Forhandsvisning av mottagare</p>
                    <p className="text-sm text-slate-400">Bara giltiga mottagare sparas i kampanjen.</p>
                  </div>
                  <span className="rounded-full bg-white/[0.05] px-3 py-1 text-xs text-cyan-200">Preview</span>
                </div>
                <div className="overflow-hidden rounded-[22px] border border-white/8">
                  <table className="min-w-full divide-y divide-white/8 text-left text-sm">
                    <thead className="bg-white/[0.03] text-slate-400">
                      <tr>
                        <th className="px-4 py-3">Rad</th>
                        <th className="px-4 py-3">Email</th>
                        <th className="px-4 py-3">Namn</th>
                        <th className="px-4 py-3">Anledning</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/6">
                      {previewRows.length === 0 ? (
                        <tr className="bg-slate-950/40">
                          <td className="px-4 py-6 text-center text-sm text-slate-400" colSpan={5}>
                            Ladda upp en fil for att se mottagarlistan har.
                          </td>
                        </tr>
                      ) : null}
                      {previewRows.map((recipient) => (
                        <tr key={`${recipient.rowNumber}-${recipient.email}-${recipient.state}`} className="bg-slate-950/40">
                          <td className="px-4 py-3 text-slate-500">{recipient.rowNumber}</td>
                          <td className="px-4 py-3 text-slate-100">{recipient.email}</td>
                          <td className="px-4 py-3 text-slate-300">{recipient.name}</td>
                          <td className="px-4 py-3 text-slate-400">{recipient.reason || "-"}</td>
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

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <MessageBox tone="rose" title="Ogiltiga rader">
                    {recipientPreview.invalidRows.length > 0
                      ? recipientPreview.invalidRows
                          .slice(0, 3)
                          .map((row) => `Rad ${row.rowNumber}: ${row.email || "saknar email"}`)
                          .join(" | ")
                      : "Inga ogiltiga rader hittades."}
                  </MessageBox>
                  <MessageBox tone="amber" title="Dubbletter">
                    {recipientPreview.duplicateRows.length > 0
                      ? recipientPreview.duplicateRows
                          .slice(0, 3)
                          .map((row) => `Rad ${row.rowNumber}: ${row.email}`)
                          .join(" | ")
                      : "Inga dubbletter hittades."}
                  </MessageBox>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {currentStep === 3 ? (
          <div className="space-y-8">
            <SectionHeader
              stepNumber={3}
              title="Forhandsgranska"
              description="Spara kampanjen, skicka ett testmail och kontrollera att allt ser ratt ut innan du startar."
            />

            {!selectedProfile?.maskedToken ? (
              <div className="rounded-[24px] border border-amber-300/20 bg-amber-400/[0.08] p-5">
                <p className="text-sm font-medium text-amber-100">{missingPostmarkWarning}</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Lagg till Postmark API-nyckeln under Domäner & API innan du skickar testmail eller startar kampanjen.
                </p>
              </div>
            ) : null}

            <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-[28px] border border-white/10 bg-slate-950/70 p-5 shadow-[0_25px_80px_rgba(8,15,34,0.45)]">
                <div className="mb-4 flex items-center justify-between border-b border-white/8 pb-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.26em] text-cyan-200/60">Email preview</p>
                    <p className="mt-2 text-lg font-medium text-white">
                      {campaignForm.subject || "Lagg till en amnesrad for att se preview"}
                    </p>
                  </div>
                  <span className="rounded-full bg-cyan-400/12 px-3 py-1 text-xs text-cyan-200">
                    {selectedProfile?.messageStream || "broadcast"}
                  </span>
                </div>
                <div className="rounded-[22px] bg-white p-6 text-slate-800">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                    Fran {selectedProfile?.fromName || "Vald avsandare"}
                  </p>
                  <h3 className="mt-4 text-3xl font-semibold text-slate-900">Hej {`{{name}}`},</h3>
                  {campaignForm.htmlBody ? (
                    <div className="mt-4 text-base leading-7 text-slate-600" dangerouslySetInnerHTML={{ __html: campaignForm.htmlBody }} />
                  ) : (
                    <p className="mt-4 whitespace-pre-line text-base leading-7 text-slate-600">
                      {campaignForm.rawMessage || "Skriv ett kampanjmeddelande for att se preview har."}
                    </p>
                  )}
                  <p className="mt-8 text-xs leading-6 text-slate-400">
                    Unsubscribe-lank byggs in som {`{{unsubscribe_url}}`} nar mailet skickas.
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                <div className="rounded-[28px] border border-white/10 bg-slate-950/55 p-6">
                  <p className="text-sm font-medium text-white">Testa innan du skickar</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Spara forst kampanjen som utkast. Skicka sedan ett testmail till dig sjalv eller kollegan som ska godkanna utskicket.
                  </p>
                  <div className="mt-5 space-y-4">
                    <TextInput
                      label="Testemail"
                      value={testEmail}
                      onChange={onTestEmailChange}
                      placeholder="granska@example.com"
                      type="email"
                    />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={onSaveCampaign}
                        disabled={campaignSaveLoading}
                        className="rounded-2xl border border-cyan-300/30 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-100 shadow-[0_16px_40px_rgba(34,211,238,0.18)] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {campaignSaveLoading ? "Sparar..." : hasSavedDraft ? "Spara igen" : "Spara kampanj"}
                      </button>
                      <button
                        type="button"
                        onClick={onSendTestEmail}
                        disabled={!canSendTest || testEmailLoading}
                        className="rounded-2xl bg-gradient-to-r from-cyan-400 to-teal-400 px-5 py-3 text-sm font-semibold text-slate-950 shadow-[0_16px_40px_rgba(34,211,238,0.28)] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {testEmailLoading ? "Skickar test..." : "Skicka testmail"}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="rounded-[28px] border border-white/10 bg-slate-950/55 p-6">
                  <p className="text-sm font-medium text-white">Status</p>
                  <div className="mt-4 grid gap-3">
                    <DetailRow label="Utkast" value={hasSavedDraft ? `#${savedCampaignId}` : "Inte sparat"} />
                    <DetailRow label="Testmail" value={testEmailSent ? "Skickat" : "Inte skickat"} />
                    <DetailRow label="Mottagare" value={`${recipientPreview.valid || 0} giltiga`} />
                    <DetailRow label="Doman" value={selectedProfile?.domain || "Ingen vald"} />
                  </div>
                  {!testEmailSent ? (
                    <div className="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-400/[0.06] p-4 text-sm text-cyan-100">
                      Testmail ar frivilligt. Du kan starta kampanjen direkt i sista steget nar utkastet ar sparat.
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {currentStep === 4 ? (
          <div className="space-y-8">
            <SectionHeader
              stepNumber={4}
              title="Skicka"
              description="Nu ar allt klart. Kontrollera sammanfattningen och starta utskicket nar du ar redo."
            />

            <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
              <div className="rounded-[28px] border border-white/10 bg-slate-950/55 p-6">
                <p className="text-sm font-medium text-white">Sammanfattning</p>
                <div className="mt-4 grid gap-3">
                  <DetailRow label="Doman" value={selectedProfile?.domain || "Ingen vald"} />
                  <DetailRow label="Fran email" value={selectedProfile?.fromEmail || "Ingen vald"} />
                  <DetailRow label="Amnesrad" value={campaignForm.subject || "Ingen amnesrad"} />
                  <DetailRow label="Giltiga mottagare" value={String(recipientPreview.valid || 0)} />
                  <DetailRow label="Testmail" value={testEmailSent ? "Godkant" : "Inte skickat"} />
                  <DetailRow label="Utkast-ID" value={savedCampaignId ? `#${savedCampaignId}` : "Inte sparat"} />
                </div>
              </div>

              <div className="space-y-5">
                <div className="rounded-[28px] border border-amber-300/20 bg-amber-400/[0.08] p-6">
                  <p className="text-sm font-medium text-amber-100">Varning</p>
                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    Du ar pa vag att skicka denna kampanj till {recipientPreview.valid || 0} giltiga mottagare.
                    Kontrollera att amnesrad och doman ar korrekta innan du startar.
                  </p>
                </div>

                <div className="rounded-[28px] border border-white/10 bg-slate-950/55 p-6">
                  <p className="text-sm font-medium text-white">Starta kampanj</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Kampanjen startar i bakgrunden och skickas enligt den ko och batchlogik som redan finns i backend.
                  </p>
                  {campaignStarted ? (
                    <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">
                      Kampanjen ar startad. Mailen borjar nu ga ut till mottagarna i bakgrunden.
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={onStartCampaign}
                    disabled={!canLaunch || campaignStarting || campaignStarted}
                    className="mt-6 w-full rounded-2xl bg-gradient-to-r from-cyan-300 via-cyan-400 to-teal-400 px-5 py-4 text-sm font-semibold text-slate-950 shadow-[0_18px_48px_rgba(45,212,191,0.35)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {campaignStarting ? "Startar kampanj..." : campaignStarted ? "Kampanj startad" : "Starta kampanj"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <WizardFooter
          currentStep={currentStep}
          totalSteps={steps.length}
          onBack={goBack}
          onNext={goNext}
          nextEnabled={nextEnabled}
        />
      </div>
    </section>
  );
}

function WizardProgress({ steps, currentStep, completion, onStepSelect }) {
  return (
    <div className="mb-8 rounded-[32px] border border-white/10 bg-slate-900/55 p-5 shadow-[0_22px_70px_rgba(2,6,23,0.3)] backdrop-blur-xl sm:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        {steps.map((step, index) => {
          const isCurrent = step.id === currentStep;
          const isCompleted = completion[step.id] && step.id < currentStep;
          const isAvailable = step.id <= currentStep;
          const circleClass = isCompleted
            ? "border-emerald-400 bg-emerald-400 text-slate-950"
            : isCurrent
              ? "border-cyan-300 bg-cyan-400/15 text-cyan-100"
              : "border-white/10 bg-slate-950/70 text-slate-500";
          const lineClass = completion[step.id] || step.id < currentStep ? "bg-emerald-400/90" : "bg-white/10";

          return (
            <div key={step.id} className="flex flex-1 items-center gap-4">
              <button
                type="button"
                onClick={() => {
                  if (isAvailable) {
                    onStepSelect(step.id);
                  }
                }}
                className="flex min-w-0 items-center gap-4 text-left"
              >
                <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${circleClass}`}>
                  {isCompleted ? "✓" : step.id}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-white">{step.title}</span>
                  <span className="block text-xs text-slate-400">{step.note}</span>
                </span>
              </button>
              {index < steps.length - 1 ? <div className={`hidden h-1 flex-1 rounded-full md:block ${lineClass}`} /> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WizardFooter({ currentStep, totalSteps, onBack, onNext, nextEnabled }) {
  return (
    <div className="mt-10 flex flex-col gap-4 border-t border-white/8 pt-6 sm:flex-row sm:items-center sm:justify-between">
      <button
        type="button"
        onClick={onBack}
        disabled={currentStep === 1}
        className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Tillbaka
      </button>
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-500">
          Steg {currentStep} av {totalSteps}
        </span>
        <button
          type="button"
          onClick={onNext}
          disabled={!nextEnabled || currentStep === totalSteps}
          className="rounded-2xl bg-gradient-to-r from-cyan-300 via-cyan-400 to-teal-400 px-5 py-3 text-sm font-semibold text-slate-950 shadow-[0_18px_48px_rgba(45,212,191,0.35)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Fortsatt
        </button>
      </div>
    </div>
  );
}

function SectionHeader({ stepNumber, title, description }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/60">Steg {stepNumber}</p>
      <h3 className="mt-3 text-3xl font-semibold text-white">{title}</h3>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">{description}</p>
    </div>
  );
}

function TextInput({ label, value, onChange, placeholder = "", type = "text" }) {
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

function TextArea({ label, value, onChange, placeholder = "" }) {
  return (
    <label className="block rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
      <span className="text-xs uppercase tracking-[0.24em] text-slate-500">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={8}
        className="mt-3 w-full rounded-2xl border border-white/8 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500"
      />
    </label>
  );
}

function SelectInput({ label, value, onChange, options }) {
  return (
    <label className="block rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
      <span className="text-xs uppercase tracking-[0.24em] text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-3 w-full rounded-2xl border border-white/8 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ActionButton({ children, onClick, disabled, accent = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-2xl px-4 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60 ${
        accent
          ? "border border-cyan-300/20 bg-cyan-400/10 text-cyan-100"
          : "border border-white/10 bg-white/[0.03] text-slate-100"
      }`}
    >
      {children}
    </button>
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

function MiniDetail({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-slate-950/55 px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm text-slate-100">{value}</p>
    </div>
  );
}

function MessageBox({ title, tone, children }) {
  const toneClass =
    tone === "rose"
      ? "border-rose-400/15 bg-rose-400/[0.06] text-rose-200/75"
      : "border-amber-300/15 bg-amber-400/[0.06] text-amber-200/75";

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <p className="text-xs uppercase tracking-[0.22em]">{title}</p>
      <p className="mt-2 text-sm text-slate-200">{children}</p>
    </div>
  );
}
