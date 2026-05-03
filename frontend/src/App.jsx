import { useEffect, useRef, useState } from "react";
import CampaignWizardFlow from "./components/CampaignWizard";
import RecipientsPage from "./components/RecipientsPage";
import SettingsPage from "./components/SettingsPage";
import UserModal from "./components/UserModal";

const steps = [
  { id: 1, title: "Kampanj", note: "Avsändare, ämne och budskap" },
  { id: 2, title: "Mottagare", note: "Ladda upp och granska listan" },
  { id: 3, title: "Förhandsgranska", note: "Spara utkast och skicka test" },
  { id: 4, title: "Skicka", note: "Bekräfta och starta kampanjen" },
];

const assistantNotes = [
  "Hall ett tydligt huvudbudskap i början sa att mottagaren snabbt forstar erbjudandet.",
  "Anvand {{name}} tidigt i texten om kampanjen ska kannas mer personlig.",
  "Lagg alltid med en enkel avslutning och en tydlig avsandare i slutet av mailet.",
];

const navItems = [
  { id: "create-campaign", label: "Skapa kampanj", eyebrow: "Launchpad" },
  { id: "campaigns", label: "Kampanjer", eyebrow: "Pipeline" },
  { id: "recipients", label: "Mottagare", eyebrow: "Audience" },
  { id: "settings", label: "Inställningar", eyebrow: "System" },
];

const emptyProfileForm = {
  name: "",
  domain: "",
  fromName: "",
  fromEmail: "",
  postmarkToken: "",
  messageStream: "broadcast",
  status: "active",
  isDefault: false,
};

const emptyUserForm = {
  email: "",
  password: "",
  isActive: true,
  senderProfileIds: [],
};

const emptyAiSettingsForm = {
  openaiModel: "gpt-5.4-mini",
  openaiApiKey: "",
  openaiHtmlPrompt: "",
  maskedOpenaiApiKey: "",
  hasOpenaiApiKey: false,
  saving: false,
};

const MISSING_POSTMARK_WARNING = "Den här domänen saknar Postmark API-nyckel.";

const API_BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

function createEmptyRecipientPreview() {
  return {
    total: 0,
    valid: 0,
    invalid: 0,
    duplicates: 0,
    validRecipients: [],
    rowsPreview: [],
    invalidRows: [],
    duplicateRows: [],
    detectedColumns: {
      email: null,
      name: null,
      available: [],
    },
  };
}

function apiUrl(path) {
  return API_BASE_URL ? `${API_BASE_URL}${path}` : path;
}

function App() {
  const [activeView, setActiveView] = useState("create-campaign");
  const [authStatus, setAuthStatus] = useState("loading");
  const [currentUser, setCurrentUser] = useState(null);
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [senderProfiles, setSenderProfiles] = useState([]);
  const [selectedProfileId, setSelectedProfileId] = useState(null);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [profilesError, setProfilesError] = useState("");
  const [campaignForm, setCampaignForm] = useState({
    campaignName: "",
    subject: "",
    rawMessage: "",
    textBody: "",
    htmlBody: "",
    language: "sv",
  });
  const [campaignSaveLoading, setCampaignSaveLoading] = useState(false);
  const [savedCampaignId, setSavedCampaignId] = useState(null);
  const [testEmail, setTestEmail] = useState("");
  const [testEmailLoading, setTestEmailLoading] = useState(false);
  const [testEmailSent, setTestEmailSent] = useState(false);
  const [campaignStarting, setCampaignStarting] = useState(false);
  const [campaignStarted, setCampaignStarted] = useState(false);
  const [aiLoadingMode, setAiLoadingMode] = useState("");
  const [aiError, setAiError] = useState("");
  const [recipientPreview, setRecipientPreview] = useState(createEmptyRecipientPreview);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [banner, setBanner] = useState(null);
  const [modalState, setModalState] = useState({
    open: false,
    mode: "create",
    profileId: null,
    form: emptyProfileForm,
    submitting: false,
    error: "",
  });
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState("");
  const [aiSettings, setAiSettings] = useState(emptyAiSettingsForm);
  const [aiSettingsLoading, setAiSettingsLoading] = useState(false);
  const [aiSettingsError, setAiSettingsError] = useState("");
  const [userModalState, setUserModalState] = useState({
    open: false,
    mode: "create",
    userId: null,
    form: emptyUserForm,
    submitting: false,
    error: "",
  });
  const [recipientDomainId, setRecipientDomainId] = useState(null);
  const [recipientRows, setRecipientRows] = useState([]);
  const [recipientExplorerLoading, setRecipientExplorerLoading] = useState(false);
  const [recipientExplorerError, setRecipientExplorerError] = useState("");
  const [wizardResetSignal, setWizardResetSignal] = useState(0);
  const recipientFileInputRef = useRef(null);

  async function requestJson(path, options = {}) {
    const headers = {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    };

    const response = await fetch(apiUrl(path), {
      credentials: "include",
      ...options,
      headers,
    });

    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
      setAuthStatus("unauthenticated");
      setCurrentUser(null);
      setSenderProfiles([]);
      setSelectedProfileId(null);
      setRecipientPreview(createEmptyRecipientPreview());
      setUploadedFileName("");
      setUploadError("");
      setSavedCampaignId(null);
      setTestEmail("");
      setTestEmailSent(false);
      setTestEmailLoading(false);
      setCampaignStarting(false);
      setCampaignStarted(false);
      setAiError("");
      setAiLoadingMode("");
      throw new Error(data.error || "Authentication required.");
    }

    if (!response.ok) {
      throw new Error(data.error || `Request failed with ${response.status}`);
    }

    return data;
  }

  async function checkAuth() {
    setAuthStatus("loading");
    try {
      const data = await requestJson("/api/auth/me");
      setCurrentUser(data.user);
      setAuthStatus("authenticated");
    } catch (error) {
      setCurrentUser(null);
      setAuthStatus("unauthenticated");
    }
  }

  async function loadProfiles(preferredProfileId) {
    setProfilesLoading(true);
    setProfilesError("");

    try {
      const data = await requestJson("/api/settings/domains");
      const domains = Array.isArray(data.domains) ? data.domains : [];
      setSenderProfiles(domains);

      const preferred =
        domains.find((profile) => profile.id === preferredProfileId) ||
        domains.find((profile) => profile.id === selectedProfileId) ||
        domains.find((profile) => profile.isDefault) ||
        domains[0] ||
        null;

      setSelectedProfileId(preferred ? preferred.id : null);
    } catch (error) {
      setProfilesError(error.message || "Could not load sender profiles from the backend.");
      setSenderProfiles([]);
      setSelectedProfileId(null);
    } finally {
      setProfilesLoading(false);
    }
  }

  async function loadUsers() {
    setUsersLoading(true);
    setUsersError("");

    try {
      const data = await requestJson("/api/settings/users");
      setUsers(Array.isArray(data.users) ? data.users : []);
    } catch (error) {
      setUsers([]);
      setUsersError(error.message || "Could not load users.");
    } finally {
      setUsersLoading(false);
    }
  }

  async function loadAiSettings() {
    setAiSettingsLoading(true);
    setAiSettingsError("");

    try {
      const data = await requestJson("/api/settings/app");
      const settings = data.settings || {};
      setAiSettings({
        openaiModel: settings.openaiModel || "gpt-5.4-mini",
        openaiApiKey: "",
        openaiHtmlPrompt: settings.openaiHtmlPrompt || "",
        maskedOpenaiApiKey: settings.maskedOpenaiApiKey || "",
        hasOpenaiApiKey: Boolean(settings.hasOpenaiApiKey),
        saving: false,
      });
    } catch (error) {
      setAiSettings({
        ...emptyAiSettingsForm,
      });
      setAiSettingsError(error.message || "Could not load AI settings.");
    } finally {
      setAiSettingsLoading(false);
    }
  }

  async function loadRecipientsByDomain(nextSenderProfileId) {
    const targetId = nextSenderProfileId || recipientDomainId || selectedProfileId || null;
    setRecipientExplorerLoading(true);
    setRecipientExplorerError("");

    try {
      const query = targetId ? `?senderProfileId=${targetId}` : "";
      const data = await requestJson(`/api/recipients${query}`);
      setRecipientRows(Array.isArray(data.recipients) ? data.recipients : []);
      setRecipientDomainId(targetId);
    } catch (error) {
      setRecipientRows([]);
      setRecipientExplorerError(error.message || "Could not load recipients.");
    } finally {
      setRecipientExplorerLoading(false);
    }
  }

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (authStatus === "authenticated") {
      loadProfiles();
      loadUsers();
      loadAiSettings();
      return;
    }

    if (authStatus === "unauthenticated") {
      setProfilesLoading(false);
      setProfilesError("");
      setSenderProfiles([]);
      setSelectedProfileId(null);
      setRecipientPreview(createEmptyRecipientPreview());
      setUploadedFileName("");
      setUploadError("");
      setSavedCampaignId(null);
      setUsers([]);
      setUsersError("");
      setAiSettings({ ...emptyAiSettingsForm });
      setAiSettingsError("");
      setRecipientRows([]);
      setRecipientExplorerError("");
      setTestEmail("");
      setTestEmailSent(false);
      setTestEmailLoading(false);
      setCampaignStarting(false);
      setCampaignStarted(false);
      setAiError("");
      setAiLoadingMode("");
    }
  }, [authStatus]);

  useEffect(() => {
    if (authStatus === "authenticated" && activeView === "recipients") {
      loadRecipientsByDomain(recipientDomainId || selectedProfileId);
    }
  }, [activeView, authStatus, selectedProfileId]);

  const selectedProfile =
    senderProfiles.find((profile) => profile.id === selectedProfileId) || senderProfiles[0] || null;

  function openCreateModal() {
    setModalState({
      open: true,
      mode: "create",
      profileId: null,
      form: { ...emptyProfileForm },
      submitting: false,
      error: "",
    });
  }

  function openEditModal(profile) {
    setModalState({
      open: true,
      mode: "edit",
      profileId: profile.id,
      form: {
        name: profile.name || "",
        domain: profile.domain || "",
        fromName: profile.fromName || "",
        fromEmail: profile.fromEmail || "",
        postmarkToken: "",
        messageStream: profile.messageStream || "broadcast",
        status: profile.status || "active",
        isDefault: Boolean(profile.isDefault),
      },
      submitting: false,
      error: "",
    });
  }

  function closeModal() {
    setModalState((current) => ({
      ...current,
      open: false,
      submitting: false,
      error: "",
    }));
  }

  function updateModalField(field, value) {
    setModalState((current) => ({
      ...current,
      form: {
        ...current.form,
        [field]: value,
      },
    }));
  }

  function openCreateUserModal() {
    setUserModalState({
      open: true,
      mode: "create",
      userId: null,
      form: { ...emptyUserForm },
      submitting: false,
      error: "",
    });
  }

  function openEditUserModal(user) {
    setUserModalState({
      open: true,
      mode: "edit",
      userId: user.id,
      form: {
        email: user.email || "",
        password: "",
        isActive: Boolean(user.isActive),
        senderProfileIds: Array.isArray(user.senderProfileIds) ? user.senderProfileIds : [],
      },
      submitting: false,
      error: "",
    });
  }

  function closeUserModal() {
    setUserModalState((current) => ({
      ...current,
      open: false,
      submitting: false,
      error: "",
    }));
  }

  function updateUserModalField(field, value) {
    setUserModalState((current) => ({
      ...current,
      form: {
        ...current.form,
        [field]: value,
      },
    }));
  }

  function updateAiSettingsField(field, value) {
    setAiSettings((current) => ({
      ...current,
      [field]: value,
    }));
    setAiSettingsError("");
  }

  async function handleAiSettingsSave() {
    if (!aiSettings.openaiModel.trim() && !aiSettings.openaiApiKey.trim() && !aiSettings.openaiHtmlPrompt.trim()) {
      setAiSettingsError("Fyll i OpenAI-model, HTML-prompt eller API-nyckel innan du sparar.");
      return;
    }

    setAiSettings((current) => ({
      ...current,
      saving: true,
    }));
    setAiSettingsError("");

    try {
      const data = await requestJson("/api/settings/app", {
        method: "PUT",
        body: JSON.stringify({
          openaiModel: aiSettings.openaiModel.trim(),
          openaiApiKey: aiSettings.openaiApiKey.trim(),
          openaiHtmlPrompt: aiSettings.openaiHtmlPrompt.trim(),
        }),
      });

      const settings = data.settings || {};
      setAiSettings({
        openaiModel: settings.openaiModel || "gpt-5.4-mini",
        openaiApiKey: "",
        openaiHtmlPrompt: settings.openaiHtmlPrompt || "",
        maskedOpenaiApiKey: settings.maskedOpenaiApiKey || "",
        hasOpenaiApiKey: Boolean(settings.hasOpenaiApiKey),
        saving: false,
      });
      setBanner({
        type: "success",
        message: "AI-installningarna sparades.",
      });
    } catch (error) {
      setAiSettings((current) => ({
        ...current,
        saving: false,
      }));
      setAiSettingsError(error.message || "Could not save AI settings.");
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    setLoginLoading(true);
    setLoginError("");

    try {
      const data = await requestJson("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: loginForm.email.trim().toLowerCase(),
          password: loginForm.password,
        }),
      });

      setCurrentUser(data.user);
      setAuthStatus("authenticated");
      setLoginForm({ email: "", password: "" });
      setBanner(null);
    } catch (error) {
      setLoginError(error.message || "Invalid login credentials.");
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await requestJson("/api/auth/logout", {
        method: "POST",
      });
    } catch (error) {
      // Even if logout returns 401, we still want to clear local auth state.
    } finally {
      setCurrentUser(null);
      setAuthStatus("unauthenticated");
      setBanner(null);
      setModalState((current) => ({ ...current, open: false }));
      setActiveView("create-campaign");
      setRecipientPreview(createEmptyRecipientPreview());
      setUploadedFileName("");
      setUploadError("");
      setSavedCampaignId(null);
      setTestEmail("");
      setTestEmailSent(false);
      setTestEmailLoading(false);
      setCampaignStarting(false);
      setCampaignStarted(false);
      setAiError("");
      setAiLoadingMode("");
    }
  }

  function openRecipientFilePicker() {
    recipientFileInputRef.current?.click();
  }

  async function handleRecipientFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    setUploadLoading(true);
    setUploadError("");
    setUploadedFileName(file.name);

    try {
      const response = await fetch(apiUrl("/api/recipients/preview"), {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const data = await response.json().catch(() => ({}));

      if (response.status === 401) {
        setAuthStatus("unauthenticated");
        setCurrentUser(null);
        setSenderProfiles([]);
        setSelectedProfileId(null);
        setRecipientPreview(createEmptyRecipientPreview());
        setUploadedFileName("");
        setUploadError("");
        setSavedCampaignId(null);
        setTestEmail("");
        setTestEmailSent(false);
        setTestEmailLoading(false);
        setCampaignStarting(false);
        setAiError("");
        setAiLoadingMode("");
        throw new Error(data.error || "Authentication required.");
      }

      if (!response.ok) {
        throw new Error(data.error || "Could not parse recipients file.");
      }

      setRecipientPreview({
        total: data.total || 0,
        valid: data.valid || 0,
        invalid: data.invalid || 0,
        duplicates: data.duplicates || 0,
        validRecipients: Array.isArray(data.validRecipients) ? data.validRecipients : [],
        rowsPreview: Array.isArray(data.rowsPreview) ? data.rowsPreview : [],
        invalidRows: Array.isArray(data.invalidRows) ? data.invalidRows : [],
        duplicateRows: Array.isArray(data.duplicateRows) ? data.duplicateRows : [],
        detectedColumns: data.detectedColumns || { email: null, name: null, available: [] },
      });
      setSavedCampaignId(null);
      setTestEmailSent(false);
      setCampaignStarted(false);
      setBanner({
        type: "success",
        message: `Parsed ${file.name} successfully. ${data.valid || 0} valid recipients are ready for review.`,
      });
    } catch (error) {
      setUploadError(error.message || "Could not parse recipients file.");
      setRecipientPreview(createEmptyRecipientPreview());
    } finally {
      setUploadLoading(false);
      event.target.value = "";
    }
  }

  function updateCampaignField(field, value) {
    setCampaignForm((current) => {
      if (field === "rawMessage") {
        return {
          ...current,
          rawMessage: value,
          textBody: value,
          htmlBody: "",
        };
      }

      return {
        ...current,
        [field]: value,
      };
    });
    setAiError("");
    setSavedCampaignId(null);
    setTestEmailSent(false);
    setCampaignStarted(false);
  }

  function resetCampaignWizard() {
    setCampaignForm({
      campaignName: "",
      subject: "",
      rawMessage: "",
      textBody: "",
      htmlBody: "",
      language: "sv",
    });
    setSavedCampaignId(null);
    setTestEmail("");
    setTestEmailSent(false);
    setCampaignStarting(false);
    setCampaignStarted(false);
    setAiLoadingMode("");
    setAiError("");
    setRecipientPreview(createEmptyRecipientPreview());
    setUploadLoading(false);
    setUploadError("");
    setUploadedFileName("");
    setBanner({
      type: "success",
      message: "Kampanjen ar igang. Du kan nu skapa ett nytt utskick.",
    });
    setWizardResetSignal((value) => value + 1);
  }

  async function handleSaveCampaign() {
    const payload = {
      senderProfileId: selectedProfileId,
      campaignName: campaignForm.campaignName.trim(),
      subject: campaignForm.subject.trim(),
      rawMessage: campaignForm.rawMessage.trim(),
      htmlBody:
        campaignForm.htmlBody.trim() ||
        (campaignForm.rawMessage.trim()
          ? `<p>${campaignForm.rawMessage.trim().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/\r?\n/g, "<br>")}</p>`
          : ""),
      textBody: campaignForm.textBody.trim() || campaignForm.rawMessage.trim(),
      recipients: recipientPreview.validRecipients || [],
    };

    if (!payload.senderProfileId || !payload.campaignName || !payload.subject || !payload.rawMessage) {
      setBanner({
        type: "error",
        message: "Choose a sender profile and fill in campaign name, subject, and message before saving.",
      });
      return;
    }

    if (!payload.recipients.length) {
      setBanner({
        type: "error",
        message: "Upload a recipient file with at least one valid recipient before saving the campaign.",
      });
      return;
    }

    setCampaignSaveLoading(true);

    try {
      const data = await requestJson("/api/campaigns", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setSavedCampaignId(data.campaign?.id || null);
      setTestEmailSent(false);
      setCampaignStarted(false);
      setBanner({
        type: "success",
        message: `Campaign draft saved successfully${data.campaign?.id ? ` as #${data.campaign.id}` : ""}.`,
      });
    } catch (error) {
      setBanner({
        type: "error",
        message: error.message || "Could not save campaign draft.",
      });
    } finally {
      setCampaignSaveLoading(false);
    }
  }

  async function handleAIGenerate(mode) {
    if (!campaignForm.rawMessage.trim()) {
      setAiError("Skriv ett utkast i kampanjmeddelandet innan du använder AI-assistenten.");
      return;
    }

    setAiLoadingMode(mode);
    setAiError("");

    try {
      const data = await requestJson("/api/ai/generate-email", {
        method: "POST",
        body: JSON.stringify({
          mode,
          userText: campaignForm.rawMessage,
          subject: campaignForm.subject,
          senderDomain: selectedProfile?.domain || "",
          language: campaignForm.language || "sv",
        }),
      });

      setCampaignForm((current) => ({
        ...current,
        subject: data.subject || current.subject,
        rawMessage: data.textBody || current.rawMessage,
        textBody: data.textBody || current.textBody,
        htmlBody: data.htmlBody || current.htmlBody,
      }));
      setSavedCampaignId(null);
      setTestEmailSent(false);
      setCampaignStarted(false);
      setBanner({
        type: "success",
        message: "AI-förslaget har uppdaterat ämnesrad, text och förhandsvisning.",
      });
    } catch (error) {
      setAiError(error.message || "AI kunde inte generera e-postinnehåll just nu.");
    } finally {
      setAiLoadingMode("");
    }
  }

  async function handleSendTestEmail() {
    if (!savedCampaignId) {
      setBanner({
        type: "error",
        message: "Spara kampanjen som utkast innan du skickar ett testmail.",
      });
      return;
    }

    if (!testEmail.trim()) {
      setBanner({
        type: "error",
        message: "Fyll i en giltig testadress innan du skickar testmail.",
      });
      return;
    }

    setTestEmailLoading(true);

    try {
      await requestJson("/api/test-email", {
        method: "POST",
        body: JSON.stringify({
          campaignId: savedCampaignId,
          testEmail: testEmail.trim(),
        }),
      });

      setTestEmailSent(true);
      setBanner({
        type: "success",
        message: `Testmail skickades till ${testEmail.trim()}.`,
      });
    } catch (error) {
      setTestEmailSent(false);
      setBanner({
        type: "error",
        message: error.message || "Kunde inte skicka testmail just nu.",
      });
    } finally {
      setTestEmailLoading(false);
    }
  }

  async function handleStartCampaign() {
    if (!savedCampaignId) {
      setBanner({
        type: "error",
        message: "Spara kampanjen innan du startar utskicket.",
      });
      return;
    }

    setCampaignStarting(true);

    try {
      const data = await requestJson(`/api/campaigns/${savedCampaignId}/start`, {
        method: "POST",
      });

      if (!data.campaign || data.campaign.status === "draft") {
        throw new Error("Kampanjen markerades inte som startad i databasen.");
      }

      setCampaignStarted(true);
      setBanner({
        type: "success",
        message: "Kampanjen har startats och lagts i ko for utskick.",
      });
    } catch (error) {
      setBanner({
        type: "error",
        message: error.message || "Kunde inte starta kampanjen.",
      });
    } finally {
      setCampaignStarting(false);
    }
  }

  async function handleProfileSubmit(event) {
    event.preventDefault();

    const payload = {
      name: modalState.form.name.trim(),
      domain: modalState.form.domain.trim().toLowerCase(),
      fromName: modalState.form.fromName.trim(),
      fromEmail: modalState.form.fromEmail.trim().toLowerCase(),
      postmarkToken: modalState.form.postmarkToken.trim(),
      messageStream: modalState.form.messageStream.trim() || "broadcast",
      status: modalState.form.status.trim() || "active",
      isDefault: modalState.form.isDefault,
    };

    if (
      !payload.name ||
      !payload.domain ||
      !payload.fromName ||
      !payload.fromEmail
    ) {
      setModalState((current) => ({
        ...current,
        error: "Fill in all required profile fields before saving the sender profile.",
      }));
      return;
    }

    setModalState((current) => ({
      ...current,
      submitting: true,
      error: "",
    }));

    try {
      const method = modalState.mode === "create" ? "POST" : "PUT";
      const path =
        modalState.mode === "create"
          ? "/api/settings/domains"
          : `/api/settings/domains/${modalState.profileId}`;

      const data = await requestJson(path, {
        method,
        body: JSON.stringify(payload),
      });

      const updatedProfileId = data.domain?.id || modalState.profileId || selectedProfileId;
      await loadProfiles(updatedProfileId);
      setBanner({
        type: "success",
        message:
          modalState.mode === "create"
            ? "Sender profile created successfully."
            : "Sender profile updated successfully.",
      });
      closeModal();
    } catch (error) {
      setModalState((current) => ({
        ...current,
        submitting: false,
        error: error.message || "Could not save sender profile.",
      }));
    }
  }

  async function handleUserSubmit(event) {
    event.preventDefault();

    const payload = {
      email: userModalState.form.email.trim().toLowerCase(),
      password: userModalState.form.password,
      isActive: Boolean(userModalState.form.isActive),
      senderProfileIds: Array.isArray(userModalState.form.senderProfileIds)
        ? userModalState.form.senderProfileIds
        : [],
    };

    if (!payload.email) {
      setUserModalState((current) => ({
        ...current,
        error: "Fyll i en giltig e-postadress.",
      }));
      return;
    }

    if (userModalState.mode === "create" && payload.password.length < 8) {
      setUserModalState((current) => ({
        ...current,
        error: "Losenordet maste vara minst 8 tecken.",
      }));
      return;
    }

    if (userModalState.mode === "edit" && payload.password && payload.password.length < 8) {
      setUserModalState((current) => ({
        ...current,
        error: "Nytt losenord maste vara minst 8 tecken.",
      }));
      return;
    }

    setUserModalState((current) => ({
      ...current,
      submitting: true,
      error: "",
    }));

    try {
      const method = userModalState.mode === "create" ? "POST" : "PUT";
      const path =
        userModalState.mode === "create"
          ? "/api/settings/users"
          : `/api/settings/users/${userModalState.userId}`;

      await requestJson(path, {
        method,
        body: JSON.stringify(payload),
      });

      await loadUsers();
      setBanner({
        type: "success",
        message: userModalState.mode === "create" ? "Anvandaren skapades." : "Anvandaren uppdaterades.",
      });
      closeUserModal();
    } catch (error) {
      setUserModalState((current) => ({
        ...current,
        submitting: false,
        error: error.message || "Kunde inte spara anvandaren.",
      }));
    }
  }

  async function handleDeleteProfile(profile) {
    const confirmed = window.confirm(`Delete sender profile "${profile.name}"?`);
    if (!confirmed) {
      return;
    }

    try {
      await requestJson(`/api/settings/domains/${profile.id}`, {
        method: "DELETE",
      });

      const nextPreferredId = selectedProfileId === profile.id ? null : selectedProfileId;
      await loadProfiles(nextPreferredId);
      setBanner({
        type: "success",
        message: `Deleted sender profile "${profile.name}".`,
      });
    } catch (error) {
      setBanner({
        type: "error",
        message: error.message || "Could not delete sender profile.",
      });
    }
  }

  async function handleSetDefault(profile) {
    try {
      await requestJson(`/api/settings/domains/${profile.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: profile.name,
          domain: profile.domain,
          fromName: profile.fromName,
          fromEmail: profile.fromEmail,
          postmarkToken: "",
          messageStream: profile.messageStream,
          status: profile.status,
          isDefault: true,
        }),
      });

      await loadProfiles(profile.id);
      setBanner({
        type: "success",
        message: `"${profile.name}" is now the default sender profile.`,
      });
    } catch (error) {
      setBanner({
        type: "error",
        message: error.message || "Could not set default sender profile.",
      });
    }
  }

  if (authStatus === "loading") {
    return <SplashScreen label="Checking admin session..." />;
  }

  if (authStatus !== "authenticated" || !currentUser) {
    return (
      <LoginScreen
        form={loginForm}
        setForm={setLoginForm}
        loading={loginLoading}
        error={loginError}
        onSubmit={handleLogin}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.15),_transparent_32%),linear-gradient(160deg,_#020617_0%,_#061326_45%,_#071d2e_100%)] text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="hidden w-80 shrink-0 border-r border-cyan-500/10 bg-slate-950/70 px-6 py-8 backdrop-blur-xl lg:flex lg:flex-col">
          <div className="mb-10">
            <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-300 via-cyan-400 to-teal-500 text-lg font-bold text-slate-950 shadow-[0_20px_60px_rgba(6,182,212,0.35)]">
              EC
            </div>
            <h1 className="mt-2 text-3xl font-semibold text-white">Emailutskick</h1>
          </div>

          <nav className="space-y-3">
            {navItems.map((item) => {
              const isActive = item.id === activeView;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveView(item.id)}
                  className={`block w-full rounded-2xl border px-4 py-3 text-left transition ${
                    isActive
                      ? "border-cyan-400/35 bg-cyan-400/10 text-white shadow-[0_0_0_1px_rgba(34,211,238,0.12)]"
                      : "border-white/5 bg-white/[0.02] text-slate-400"
                  }`}
                >
                  <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-200/50">{item.eyebrow}</p>
                  <p className="mt-1 text-sm font-medium">{item.label}</p>
                </button>
              );
            })}
          </nav>

          <div className="mt-auto" />
        </aside>

        <main className="flex-1 px-5 py-6 sm:px-8 lg:px-10">
          <PageHeader activeView={activeView} senderProfiles={senderProfiles} currentUser={currentUser} onLogout={handleLogout} />

          {banner ? (
            <Banner
              type={banner.type}
              message={banner.message}
              onClose={() => setBanner(null)}
            />
          ) : null}

          {activeView === "create-campaign" ? (
            <CampaignWizardFlow
              steps={steps}
              assistantNotes={assistantNotes}
              senderProfiles={senderProfiles}
              selectedProfileId={selectedProfileId}
              selectedProfile={selectedProfile}
              setSelectedProfileId={setSelectedProfileId}
              profilesLoading={profilesLoading}
              profilesError={profilesError}
              campaignForm={campaignForm}
              savedCampaignId={savedCampaignId}
              campaignSaveLoading={campaignSaveLoading}
              testEmail={testEmail}
              testEmailSent={testEmailSent}
              testEmailLoading={testEmailLoading}
              campaignStarting={campaignStarting}
              campaignStarted={campaignStarted}
              aiLoadingMode={aiLoadingMode}
              aiError={aiError}
              recipientPreview={recipientPreview}
              uploadLoading={uploadLoading}
              uploadError={uploadError}
              uploadedFileName={uploadedFileName}
              fileInputRef={recipientFileInputRef}
              onOpenFilePicker={openRecipientFilePicker}
              onRecipientFileChange={handleRecipientFileChange}
              onCampaignFieldChange={updateCampaignField}
              onSaveCampaign={handleSaveCampaign}
              onTestEmailChange={setTestEmail}
              onSendTestEmail={handleSendTestEmail}
              onStartCampaign={handleStartCampaign}
              onAIGenerate={handleAIGenerate}
              onCreateAnotherCampaign={resetCampaignWizard}
              resetSignal={wizardResetSignal}
            />
          ) : null}

          {activeView === "recipients" ? (
            <RecipientsPage
              senderProfiles={senderProfiles}
              selectedDomainId={recipientDomainId || selectedProfileId}
              onSelectDomain={loadRecipientsByDomain}
              recipients={recipientRows}
              loading={recipientExplorerLoading}
              error={recipientExplorerError}
            />
          ) : null}

          {activeView === "settings" ? (
            <SettingsPage
              senderProfiles={senderProfiles}
              selectedProfileId={selectedProfileId}
              setSelectedProfileId={setSelectedProfileId}
              profilesLoading={profilesLoading}
              profilesError={profilesError}
              onCreateProfile={openCreateModal}
              onEditProfile={openEditModal}
              onDeleteProfile={handleDeleteProfile}
              onSetDefault={handleSetDefault}
              onRefreshProfiles={() => loadProfiles()}
              users={users}
              usersLoading={usersLoading}
              usersError={usersError}
              onCreateUser={openCreateUserModal}
              onEditUser={openEditUserModal}
              onRefreshUsers={loadUsers}
              aiSettings={aiSettings}
              aiSettingsLoading={aiSettingsLoading}
              aiSettingsError={aiSettingsError}
              onAiSettingsChange={updateAiSettingsField}
              onAiSettingsSave={handleAiSettingsSave}
            />
          ) : null}

          {activeView !== "create-campaign" && activeView !== "settings" && activeView !== "recipients" ? (
            <PlaceholderPage activeView={activeView} />
          ) : null}
        </main>
      </div>

      {modalState.open ? (
        <ProfileModal
          modalState={modalState}
          onClose={closeModal}
          onSubmit={handleProfileSubmit}
          onChange={updateModalField}
        />
      ) : null}

      {userModalState.open ? (
        <UserModal
          modalState={userModalState}
          senderProfiles={senderProfiles}
          onClose={closeUserModal}
          onSubmit={handleUserSubmit}
          onChange={updateUserModalField}
        />
      ) : null}
    </div>
  );
}

function SplashScreen({ label }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.15),_transparent_32%),linear-gradient(160deg,_#020617_0%,_#061326_45%,_#071d2e_100%)] px-4 text-slate-100">
      <div className="w-full max-w-md rounded-[32px] border border-cyan-400/15 bg-slate-950/80 p-8 text-center shadow-[0_30px_90px_rgba(2,6,23,0.45)]">
        <div className="mx-auto mb-5 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-300 via-cyan-400 to-teal-500 text-lg font-bold text-slate-950 shadow-[0_20px_60px_rgba(6,182,212,0.35)]">
          EC
        </div>
        <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/70">Emailutskick</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Laddar kontrollpanelen</h1>
        <p className="mt-4 text-sm text-slate-400">{label}</p>
      </div>
    </div>
  );
}

function LoginScreen({ form, setForm, loading, error, onSubmit }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.15),_transparent_32%),linear-gradient(160deg,_#020617_0%,_#061326_45%,_#071d2e_100%)] px-4 text-slate-100">
      <div className="w-full max-w-md rounded-[32px] border border-cyan-400/15 bg-slate-950/85 p-8 shadow-[0_30px_90px_rgba(2,6,23,0.45)] backdrop-blur-xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-300 via-cyan-400 to-teal-500 text-lg font-bold text-slate-950 shadow-[0_20px_60px_rgba(6,182,212,0.35)]">
            EC
          </div>
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/70">Admin Login</p>
          <h1 className="mt-3 text-3xl font-semibold text-white">Logga in</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Logga in med din adminanvändare innan du hanterar kampanjer, domäner eller mottagare.
          </p>
        </div>

        <form className="space-y-5" onSubmit={onSubmit}>
          <InputField
            label="Email"
            value={form.email}
            onChange={(value) => setForm((current) => ({ ...current, email: value }))}
            placeholder="admin@localhost"
          />
          <InputField
            label="Password"
            type="password"
            value={form.password}
            onChange={(value) => setForm((current) => ({ ...current, password: value }))}
            placeholder="Ange lösenord"
          />

          {error ? (
            <div className="rounded-[22px] border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-200">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-gradient-to-r from-cyan-300 via-cyan-400 to-teal-400 px-5 py-3 text-sm font-semibold text-slate-950 shadow-[0_18px_48px_rgba(45,212,191,0.35)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Loggar in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}

function PageHeader({ activeView, senderProfiles, currentUser, onLogout }) {
  if (activeView === "create-campaign") {
    return (
      <header className="mx-auto mb-8 flex w-full max-w-6xl items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/65">Kampanjguide</p>
          <h2 className="mt-2 text-3xl font-semibold text-white sm:text-4xl">Skapa ny kampanj</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400 sm:text-base">
            Folj stegen for att skicka ett emailutskick utan att fastna i tekniska detaljer.
          </p>
        </div>

        <div className="flex items-center justify-end gap-3">
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-slate-300">
            {currentUser.email}
          </span>
          <button
            type="button"
            onClick={onLogout}
            className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-slate-200"
          >
            Logout
          </button>
        </div>
      </header>
    );
  }

  const copy = {
    recipients: {
      eyebrow: "Mottagare",
      title: "Mottagare per domän",
      description:
        "Välj en domän och se vilka kunder som redan finns upplagda under den avsändaren.",
      metrics: [
        { label: "Domäner", value: String(senderProfiles.length).padStart(2, "0"), detail: "Tillgängliga avsändare" },
        { label: "Standard", value: senderProfiles.find((profile) => profile.isDefault)?.domain || "Ingen", detail: "Förvalt val" },
        { label: "Vy", value: "Kunder", detail: "Unika mottagare per domän" },
      ],
    },
    settings: {
      eyebrow: "Inställningar",
      title: "Domäner, API och användare",
      description:
        "Hantera avsändarprofiler, Postmark-nycklar och vilka domäner varje användare får arbeta med.",
      metrics: [
        { label: "Domäner", value: String(senderProfiles.length).padStart(2, "0"), detail: "Aktiva avsändare" },
        { label: "Default", value: senderProfiles.find((profile) => profile.isDefault)?.domain || "Ingen", detail: "Nuvarande standard" },
        { label: "API", value: "Postmark", detail: "Sparas per domän" },
      ],
    },
  };

  const current = copy[activeView] || {
    eyebrow: "Emailutskick",
    title: navItems.find((item) => item.id === activeView)?.label || "Workspace",
    description: "Den här sidan använder samma appskal och datakällor som resten av adminflödet.",
    metrics: [
      { label: "Status", value: "Live", detail: "Sidan är aktiv" },
      { label: "Domäner", value: String(senderProfiles.length).padStart(2, "0"), detail: "Tillgängliga avsändare" },
      { label: "Tema", value: "Aktivt", detail: "Gemensamt appskal laddat" },
    ],
  };

  return (
    <header className="mb-8 flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/65">{current.eyebrow}</p>
        <h2 className="mt-2 text-3xl font-semibold text-white sm:text-4xl">{current.title}</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400 sm:text-base">{current.description}</p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-3">
          {current.metrics.map((metric) => (
            <Metric key={metric.label} label={metric.label} value={metric.value} detail={metric.detail} />
          ))}
        </div>
        <div className="flex items-center justify-end gap-3">
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-slate-300">
            {currentUser.email}
          </span>
          <button
            type="button"
            onClick={onLogout}
            className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-slate-200"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}

function CampaignWizard({
  steps: currentSteps,
  assistantNotes: currentAssistantNotes,
  senderProfiles,
  selectedProfileId,
  selectedProfile,
  setSelectedProfileId,
  profilesLoading,
  profilesError,
  campaignForm,
  savedCampaignId,
  campaignSaveLoading,
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
  onAIGenerate,
}) {
  const previewRows = recipientPreview.rowsPreview || [];
  const detectedEmailColumn = recipientPreview.detectedColumns?.email || "Not detected";
  const detectedNameColumn = recipientPreview.detectedColumns?.name || "Not detected";

  return (
    <>
      <section className="mb-8 grid gap-4 xl:grid-cols-4">
        {currentSteps.map((step, index) => (
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
                <InputField
                  label="Campaign name"
                  value={campaignForm.campaignName}
                  onChange={(value) => onCampaignFieldChange("campaignName", value)}
                  placeholder="Q2 Product Momentum Launch"
                />
                <InputField
                  label="Subject line"
                  value={campaignForm.subject}
                  onChange={(value) => onCampaignFieldChange("subject", value)}
                  placeholder="See what changed in your customer reporting flow"
                />
                <MessageField
                  label="Campaign message"
                  value={campaignForm.rawMessage}
                  onChange={(value) => onCampaignFieldChange("rawMessage", value)}
                  placeholder="Write the campaign message that should become the saved draft body."
                />
                <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
                  <p className="text-sm font-medium text-white">Selected sender details</p>
                  <div className="mt-4 grid gap-3 text-sm">
                    <DetailRow label="Domain" value={selectedProfile?.domain || "No selection"} />
                    <DetailRow label="From name" value={selectedProfile?.fromName || "No selection"} />
                    <DetailRow label="From email" value={selectedProfile?.fromEmail || "No selection"} />
                    <DetailRow label="Message stream" value={selectedProfile?.messageStream || "No selection"} />
                    <DetailRow label="Masked token" value={selectedProfile?.maskedToken || "No token stored"} />
                    <DetailRow label="Draft ID" value={savedCampaignId ? `#${savedCampaignId}` : "Not saved yet"} />
                  </div>
                  {!selectedProfile?.maskedToken ? (
                    <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-400/[0.08] p-4 text-sm text-amber-100">
                      {MISSING_POSTMARK_WARNING}
                    </div>
                  ) : null}
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
                  Supports `.csv`, `.xlsx`, `.xls`, and auto-detects common email and name column labels.
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
                  className="mt-6 flex min-h-52 w-full items-center justify-center rounded-[22px] border border-white/10 bg-slate-950/60 text-center transition hover:border-cyan-300/30 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <div>
                    <p className="text-5xl text-cyan-300">{uploadLoading ? "..." : "+"}</p>
                    <p className="mt-3 text-sm font-medium text-white">
                      {uploadLoading ? "Parsing recipient file..." : uploadedFileName ? uploadedFileName : "Select file to preview"}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-[0.28em] text-slate-500">
                      CSV or Excel import
                    </p>
                  </div>
                </button>
                {uploadError ? (
                  <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-200">
                    {uploadError}
                  </div>
                ) : null}
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <DetailRow label="Email column" value={detectedEmailColumn} />
                  <DetailRow label="Name column" value={detectedNameColumn} />
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                  <StatBlock label="Uploaded" value={String(recipientPreview.total || 0)} />
                  <StatBlock label="Valid" value={String(recipientPreview.valid || 0)} />
                  <StatBlock label="Invalid" value={String(recipientPreview.invalid || 0)} />
                  <StatBlock label="Duplicates" value={String(recipientPreview.duplicates || 0)} />
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
                        <th className="px-4 py-3">Row</th>
                        <th className="px-4 py-3">Email</th>
                        <th className="px-4 py-3">Name</th>
                        <th className="px-4 py-3">Reason</th>
                        <th className="px-4 py-3">State</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/6">
                      {previewRows.length === 0 ? (
                        <tr className="bg-slate-950/40">
                          <td className="px-4 py-6 text-center text-sm text-slate-400" colSpan={5}>
                            Upload a CSV or Excel file to see recipient preview rows here.
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
                  <div className="rounded-2xl border border-rose-400/15 bg-rose-400/[0.06] p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-rose-200/75">Invalid rows</p>
                    <p className="mt-2 text-sm text-slate-200">
                      {recipientPreview.invalidRows.length > 0
                        ? recipientPreview.invalidRows
                            .slice(0, 3)
                            .map((row) => `Row ${row.rowNumber}: ${row.email || "missing email"}`)
                            .join(" • ")
                        : "No invalid rows detected."}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-amber-300/15 bg-amber-400/[0.06] p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-amber-200/75">Duplicate rows</p>
                    <p className="mt-2 text-sm text-slate-200">
                      {recipientPreview.duplicateRows.length > 0
                        ? recipientPreview.duplicateRows
                            .slice(0, 3)
                            .map((row) => `Row ${row.rowNumber}: ${row.email}`)
                            .join(" • ")
                        : "No duplicate rows detected."}
                    </p>
                  </div>
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
              <div className="grid gap-3">
                <button
                  type="button"
                  onClick={() => onAIGenerate("fix_text")}
                  disabled={Boolean(aiLoadingMode)}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-sm font-medium text-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {aiLoadingMode === "fix_text" ? "AI arbetar..." : "Rätta texten"}
                </button>
                <button
                  type="button"
                  onClick={() => onAIGenerate("professional")}
                  disabled={Boolean(aiLoadingMode)}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-sm font-medium text-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {aiLoadingMode === "professional" ? "AI arbetar..." : "Gör mer professionell"}
                </button>
                <button
                  type="button"
                  onClick={() => onAIGenerate("html_email")}
                  disabled={Boolean(aiLoadingMode)}
                  className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-3 text-left text-sm font-medium text-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {aiLoadingMode === "html_email" ? "AI bygger HTML..." : "Skapa HTML-email"}
                </button>
              </div>
              {aiError ? (
                <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm leading-6 text-rose-200">
                  {aiError}
                </div>
              ) : null}
              {currentAssistantNotes.map((note) => (
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
            {!selectedProfile?.maskedToken ? (
              <div className="mb-5 rounded-[24px] border border-amber-300/20 bg-amber-400/[0.08] p-5">
                <p className="text-sm font-medium text-amber-100">{MISSING_POSTMARK_WARNING}</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Lägg till Postmark API-nyckeln under Domäner & API innan du skickar testmail eller startar kampanjen.
                </p>
              </div>
            ) : null}
            <div className="rounded-[28px] border border-white/10 bg-slate-950/80 p-4 shadow-[0_25px_80px_rgba(8,15,34,0.45)]">
              <div className="mb-4 flex items-center justify-between border-b border-white/8 pb-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.26em] text-cyan-200/60">Live preview</p>
                  <p className="mt-2 text-lg font-medium text-white">
                    {campaignForm.subject || "Add a subject line to preview the draft"}
                  </p>
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
                {campaignForm.htmlBody ? (
                  <div
                    className="mt-4 text-base leading-7 text-slate-600"
                    dangerouslySetInnerHTML={{ __html: campaignForm.htmlBody }}
                  />
                ) : (
                  <p className="mt-4 text-base leading-7 text-slate-600">
                    {campaignForm.rawMessage || "Write the campaign message to see the preview body here."}
                  </p>
                )}
                <div className="mt-6 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-cyan-200">
                  Open the Q2 product update
                </div>
                <p className="mt-8 text-xs leading-6 text-slate-400">
                  Sending identity: {selectedProfile?.fromEmail || "No sender selected"}
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto_auto]">
              <Field label="Send test email to" value="launch-review@example.com" />
              <button
                disabled={!selectedProfile?.maskedToken}
                className="mt-6 rounded-2xl bg-gradient-to-r from-cyan-400 to-teal-400 px-5 py-3 text-sm font-semibold text-slate-950 shadow-[0_16px_40px_rgba(34,211,238,0.28)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Send test
              </button>
              <button
                type="button"
                onClick={onSaveCampaign}
                disabled={campaignSaveLoading}
                className="mt-6 rounded-2xl border border-cyan-300/30 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-100 shadow-[0_16px_40px_rgba(34,211,238,0.18)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {campaignSaveLoading ? "Saving..." : "Spara kampanj"}
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
                You are about to send this campaign to {recipientPreview.valid || 0} validated recipients across{" "}
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
              <button
                disabled={!selectedProfile?.maskedToken}
                className="rounded-2xl bg-gradient-to-r from-cyan-300 via-cyan-400 to-teal-400 px-5 py-3 text-sm font-semibold text-slate-950 shadow-[0_18px_48px_rgba(45,212,191,0.35)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Send campaign now
              </button>
            </div>
          </Panel>
        </div>
      </section>
    </>
  );
}

function DomainsPage({
  senderProfiles,
  selectedProfileId,
  setSelectedProfileId,
  profilesLoading,
  profilesError,
  onCreate,
  onEdit,
  onDelete,
  onSetDefault,
  onRefresh,
}) {
  return (
    <section className="space-y-6">
      <Panel
        eyebrow="Sender Profiles"
        title="Manage domains, streams, and Postmark tokens"
        description="Each profile maps one sender identity to one Postmark token and one message stream. Changes here feed the campaign wizard immediately."
      >
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onCreate}
            className="rounded-2xl bg-gradient-to-r from-cyan-300 via-cyan-400 to-teal-400 px-5 py-3 text-sm font-semibold text-slate-950 shadow-[0_18px_48px_rgba(45,212,191,0.35)]"
          >
            Add profile
          </button>
          <button
            type="button"
            onClick={onRefresh}
            className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-slate-200"
          >
            Refresh
          </button>
        </div>

        {profilesLoading ? (
          <div className="mt-5 rounded-[24px] border border-cyan-300/20 bg-cyan-400/[0.06] p-5 text-sm text-cyan-100">
            Loading sender profiles from the backend...
          </div>
        ) : null}

        {profilesError ? (
          <div className="mt-5 rounded-[24px] border border-rose-400/20 bg-rose-400/10 p-5 text-sm text-rose-200">
            {profilesError}
          </div>
        ) : null}

        {!profilesLoading && !profilesError && senderProfiles.length === 0 ? (
          <div className="mt-5 rounded-[24px] border border-amber-300/20 bg-amber-400/[0.08] p-5 text-sm text-amber-100">
            No sender profiles found yet. Add your first domain profile to start sending.
          </div>
        ) : null}

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
                        profile.maskedToken
                          ? "bg-cyan-400/15 text-cyan-100"
                          : "bg-amber-400/15 text-amber-200"
                      }`}
                    >
                      {profile.maskedToken ? "API key added" : "API key missing"}
                    </span>
                    <span className="rounded-full bg-slate-950/70 px-3 py-1 text-xs text-cyan-200">
                      {profile.status}
                    </span>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <DetailRow label="Domain" value={profile.domain} />
                  <DetailRow label="From name" value={profile.fromName} />
                  <DetailRow label="From email" value={profile.fromEmail} />
                  <DetailRow label="Message stream" value={profile.messageStream} />
                  <DetailRow label="Masked token" value={profile.maskedToken || "No token stored"} />
                  <DetailRow label="Default flag" value={profile.isDefault ? "Yes" : "No"} />
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedProfileId(profile.id)}
                    className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-100"
                  >
                    Use in wizard
                  </button>
                  <button
                    type="button"
                    onClick={() => onEdit(profile)}
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
                    onClick={() => onDelete(profile)}
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
    </section>
  );
}

function PlaceholderPage({ activeView }) {
  const label = navItems.find((item) => item.id === activeView)?.label || "Workspace";

  return (
    <Panel
      eyebrow="Coming Next"
      title={label}
      description="This section now shares the same navigation shell and profile state, so it is ready for the next backend wiring pass."
    >
      <div className="rounded-[28px] border border-dashed border-cyan-300/20 bg-cyan-400/[0.06] p-8">
        <p className="text-lg font-medium text-white">{label} is next in the React rebuild.</p>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
          The sender-profile management screen is live now, and the campaign wizard continues to read from the same
          shared backend data source.
        </p>
      </div>
    </Panel>
  );
}

function ProfileModal({ modalState, onClose, onSubmit, onChange }) {
  const isEdit = modalState.mode === "edit";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-[32px] border border-cyan-400/20 bg-slate-950/95 p-6 shadow-[0_40px_120px_rgba(2,6,23,0.65)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/60">
              {isEdit ? "Edit sender profile" : "Add sender profile"}
            </p>
            <h3 className="mt-3 text-2xl font-semibold text-white">
              {isEdit ? "Update domain & API settings" : "Create a new domain profile"}
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Tokens are never shown back to the browser. Leave the token field empty during edits to keep the existing
              stored value.
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
            <InputField label="Profile name" value={modalState.form.name} onChange={(value) => onChange("name", value)} />
            <InputField label="Domain" value={modalState.form.domain} onChange={(value) => onChange("domain", value)} />
            <InputField label="From name" value={modalState.form.fromName} onChange={(value) => onChange("fromName", value)} />
            <InputField label="From email" value={modalState.form.fromEmail} onChange={(value) => onChange("fromEmail", value)} />
            <InputField
              label="Message stream"
              value={modalState.form.messageStream}
              onChange={(value) => onChange("messageStream", value)}
              placeholder="broadcast"
            />
            <SelectField label="Status" value={modalState.form.status} onChange={(value) => onChange("status", value)}>
              <option value="active">active</option>
              <option value="paused">paused</option>
              <option value="disabled">disabled</option>
            </SelectField>
          </div>

          <InputField
            label="Postmark API-nyckel"
            value={modalState.form.postmarkToken}
            onChange={(value) => onChange("postmarkToken", value)}
            placeholder={isEdit ? "Leave empty to keep existing token" : "Klistra in Postmark API-nyckel"}
          />

          <label className="flex items-center gap-3 rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={modalState.form.isDefault}
              onChange={(event) => onChange("isDefault", event.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-slate-950 text-cyan-400"
            />
            Set as default sender profile
          </label>

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
              {modalState.submitting ? "Saving..." : isEdit ? "Save changes" : "Create profile"}
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

function Banner({ type, message, onClose }) {
  const tone =
    type === "success"
      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
      : "border-rose-400/20 bg-rose-400/10 text-rose-100";

  return (
    <div className={`mb-6 flex items-start justify-between gap-4 rounded-[24px] border p-4 ${tone}`}>
      <p className="text-sm leading-6">{message}</p>
      <button type="button" onClick={onClose} className="text-xs uppercase tracking-[0.22em] text-current/80">
        Dismiss
      </button>
    </div>
  );
}

function InputField({ label, value, onChange, placeholder = "", type = "text" }) {
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

function MessageField({ label, value, onChange, placeholder = "" }) {
  return (
    <label className="block rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
      <span className="text-xs uppercase tracking-[0.24em] text-slate-500">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={6}
        className="mt-3 w-full rounded-2xl border border-white/8 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500"
      />
    </label>
  );
}

function SelectField({ label, value, onChange, children }) {
  return (
    <label className="block rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
      <span className="text-xs uppercase tracking-[0.24em] text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-3 w-full rounded-2xl border border-white/8 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 outline-none"
      >
        {children}
      </select>
    </label>
  );
}

function Metric({ label, value, detail }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
      <p className="text-xs uppercase tracking-[0.25em] text-slate-500">{label}</p>
      <p className="mt-3 break-all text-2xl font-semibold text-white">{value}</p>
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
