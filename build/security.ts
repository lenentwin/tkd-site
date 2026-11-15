export function addHtmlSecurity(html: string, headers: string): string {
  const policy = headers.match(/^\s*Content-Security-Policy:\s*(.+)$/m)?.[1];
  if (!policy) throw new Error("Missing security policy");
  if (/<meta\b[^>]*http-equiv=["']Content-Security-Policy["']/i.test(html)) return html;
  const supported = policy.split(";").map(value => value.trim()).filter(value => value && !/^(frame-ancestors|report-uri|report-to|sandbox)\b/i.test(value)).join("; ");
  const escaped = supported.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
  return html.replace(/<head>/i, '<head>\n    <meta http-equiv="Content-Security-Policy" content="' + escaped + '" />\n    <meta name="referrer" content="strict-origin-when-cross-origin" />');
}
