const path = require("path");
const XLSX = require("xlsx");
const { parse } = require("csv-parse/sync");
const validator = require("validator");
const { normalizeEmail } = require("./unsubscribe");

const EMAIL_COLUMN_ALIASES = [
  "email",
  "e-mail",
  "mail",
  "epost",
  "e-post",
  "customer_email",
  "user_email",
];

const NAME_COLUMN_ALIASES = [
  "name",
  "namn",
  "username",
  "användarnamn",
  "user",
  "first_name",
  "förnamn",
];

function normalizeColumnKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function buildAliasSet(values) {
  return new Set(values.map(normalizeColumnKey));
}

const EMAIL_ALIAS_SET = buildAliasSet(EMAIL_COLUMN_ALIASES);
const NAME_ALIAS_SET = buildAliasSet(NAME_COLUMN_ALIASES);

function parseCsvRows(buffer) {
  return parse(buffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
}

function parseSpreadsheetRows(file) {
  const extension = path.extname(String(file.originalname || "")).toLowerCase();
  if (extension === ".csv") {
    return parseCsvRows(file.buffer);
  }

  if (extension === ".xlsx" || extension === ".xls") {
    const workbook = XLSX.read(file.buffer, { type: "buffer" });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      return [];
    }

    return XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], {
      defval: "",
      raw: false,
    });
  }

  throw new Error("Unsupported file format. Upload CSV, XLSX, or XLS.");
}

function detectColumns(rows) {
  const firstRow = rows[0] || {};
  const headers = Object.keys(firstRow);
  let email = null;
  let name = null;

  for (const header of headers) {
    const normalized = normalizeColumnKey(header);

    if (!email && EMAIL_ALIAS_SET.has(normalized)) {
      email = header;
    }

    if (!name && NAME_ALIAS_SET.has(normalized)) {
      name = header;
    }
  }

  return {
    email,
    name,
    available: headers,
  };
}

function buildPreviewResult(rows) {
  const detectedColumns = detectColumns(rows);
  const seen = new Set();
  const validRecipients = [];
  const invalidRows = [];
  const duplicateRows = [];
  const rowsPreview = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const rawEmail = detectedColumns.email ? row[detectedColumns.email] : "";
    const rawName = detectedColumns.name ? row[detectedColumns.name] : "";
    const email = normalizeEmail(rawEmail);
    const name = String(rawName || "").trim();
    let state = "valid";
    let reason = "";

    if (!detectedColumns.email || !email) {
      state = "invalid";
      reason = detectedColumns.email ? "Missing email" : "No email column detected";
      invalidRows.push({
        rowNumber,
        email: String(rawEmail || ""),
        name,
        reason,
      });
    } else if (!validator.isEmail(email)) {
      state = "invalid";
      reason = "Invalid email format";
      invalidRows.push({
        rowNumber,
        email: String(rawEmail || ""),
        name,
        reason,
      });
    } else if (seen.has(email)) {
      state = "duplicate";
      reason = "Duplicate email";
      duplicateRows.push({
        rowNumber,
        email,
        name,
        reason,
      });
    } else {
      seen.add(email);
      validRecipients.push({
        email,
        name: name || null,
      });
    }

    if (rowsPreview.length < 25) {
      rowsPreview.push({
        rowNumber,
        email: email || String(rawEmail || ""),
        name,
        state,
        reason: reason || null,
      });
    }
  });

  return {
    total: rows.length,
    valid: validRecipients.length,
    invalid: invalidRows.length,
    duplicates: duplicateRows.length,
    rowsPreview,
    invalidRows,
    duplicateRows,
    detectedColumns,
    validRecipients,
  };
}

function parseRecipientFile(file) {
  const rows = parseSpreadsheetRows(file);
  return buildPreviewResult(rows);
}

function parseRecipientCsv(buffer, unsubscribedSet) {
  const rows = parseCsvRows(buffer);
  const preview = buildPreviewResult(rows);
  const unsubscribed = unsubscribedSet || new Set();
  const validRecipients = [];
  let unsubscribedSkipped = 0;

  for (const recipient of preview.validRecipients) {
    if (unsubscribed.has(recipient.email)) {
      unsubscribedSkipped += 1;
      continue;
    }

    validRecipients.push(recipient);
  }

  return {
    totalUploaded: preview.total,
    validRecipients,
    invalidRecipients: preview.invalidRows,
    duplicatesRemoved: preview.duplicates,
    unsubscribedSkipped,
  };
}

module.exports = {
  parseRecipientCsv,
  parseRecipientFile,
  detectColumns,
};
