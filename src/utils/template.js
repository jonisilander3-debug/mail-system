function replaceTokens(content, recipient, unsubscribeUrl) {
  return String(content || "")
    .replaceAll("{{email}}", recipient.email || "")
    .replaceAll("{{name}}", recipient.name || "")
    .replaceAll("{{unsubscribe_url}}", unsubscribeUrl || "");
}

function appendUnsubscribeHtml(html, unsubscribeUrl) {
  if (!unsubscribeUrl) {
    return html;
  }

  return `${html}<hr><p style="font-size:12px;color:#666;">If you no longer want these emails, <a href="${unsubscribeUrl}">unsubscribe here</a>.</p>`;
}

function appendUnsubscribeText(text, unsubscribeUrl) {
  if (!unsubscribeUrl) {
    return text;
  }

  return `${text}\n\nIf you no longer want these emails, unsubscribe here: ${unsubscribeUrl}`;
}

module.exports = {
  replaceTokens,
  appendUnsubscribeHtml,
  appendUnsubscribeText,
};
