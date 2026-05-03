const { parse } = require("csv-parse/sync");
const validator = require("validator");
const { normalizeEmail } = require("./unsubscribe");

function parseRecipientCsv(buffer, unsubscribedSet) {
  const rows = parse(buffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  const seen = new Set();
  const validRecipients = [];
  const invalidRecipients = [];
  let duplicatesRemoved = 0;
  let unsubscribedSkipped = 0;

  for (const row of rows) {
    const email = normalizeEmail(row.email);
    const name = String(row.name || "").trim();

    if (!email || !validator.isEmail(email)) {
      invalidRecipients.push({
        email: row.email || "",
        name,
        reason: "Invalid email format",
      });
      continue;
    }

    if (seen.has(email)) {
      duplicatesRemoved += 1;
      continue;
    }

    seen.add(email);

    if (unsubscribedSet.has(email)) {
      unsubscribedSkipped += 1;
      continue;
    }

    validRecipients.push({ email, name: name || null });
  }

  return {
    totalUploaded: rows.length,
    validRecipients,
    invalidRecipients,
    duplicatesRemoved,
    unsubscribedSkipped,
  };
}

module.exports = { parseRecipientCsv };
