// Every email TickGains sends uses this one layout, so they all look like the site: dark panel, gold headings, a gold
// button. Email clients are picky, so it is built from tables with inline styles and system fonts (no web fonts, no CSS
// variables, no SVG). Each message is rendered twice: an HTML version and a plain-text one for clients that want it.
const SITE = () => process.env.SITE_URL || 'https://tickgains.com'

const C = {
  page: '#0e0c09',
  panel: '#211c14',
  border: '#40361f',
  text: '#ece4d3',
  muted: '#a99a79',
  gold: '#d9af52',
  goldBright: '#f0c976',
  goldInk: '#1a1510',
  green: '#7cb869',
}
const FONT = "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
// Only web links ever become hrefs.
const safeUrl = (u) => (/^https?:\/\//i.test(String(u)) ? String(u) : '')

/**
 * title: the heading. paragraphs: plain strings, or { text, strong } to bold a part (strong must appear in text).
 * button: { label, url }. rows: [{ label, value }] shown as a small table. note: small muted text under the button.
 * preheader: the preview line some inboxes show next to the subject.
 * Returns { html, text }.
 */
export function renderEmail({ preheader = '', title, paragraphs = [], button = null, rows = [], note = '' }) {
  const site = SITE()
  const url = button ? safeUrl(button.url) : ''

  const para = (p) => {
    const { text, strong } = typeof p === 'string' ? { text: p, strong: '' } : p
    let html = esc(text)
    if (strong) html = html.replace(esc(strong), `<strong style="color:${C.goldBright};font-weight:700;">${esc(strong)}</strong>`)
    return `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:${C.text};">${html}</p>`
  }

  const rowsHtml = rows.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 20px;border:1px solid ${C.border};border-radius:10px;border-collapse:separate;table-layout:fixed;background:${C.page};">${rows
        .map(
          (r, i) =>
            `<tr><td width="38%" valign="top" style="padding:11px 14px;font-size:13px;color:${C.muted};${i ? `border-top:1px solid ${C.border};` : ''}">${esc(r.label)}</td><td align="right" valign="top" style="padding:11px 14px;font-size:14px;font-weight:700;color:${C.text};overflow-wrap:anywhere;${i ? `border-top:1px solid ${C.border};` : ''}">${esc(r.value)}</td></tr>`,
        )
        .join('')}</table>`
    : ''

  const buttonHtml = url
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 22px;"><tr><td align="center" bgcolor="${C.gold}" style="border-radius:10px;background:${C.gold};"><a href="${esc(url)}" target="_blank" style="display:inline-block;padding:14px 30px;font-family:${FONT};font-size:16px;font-weight:700;color:${C.goldInk};text-decoration:none;border-radius:10px;">${esc(button.label)}</a></td></tr></table>
       <p style="margin:0 0 6px;font-size:12px;line-height:1.5;color:${C.muted};">Button not working? Copy this link into your browser:</p>
       <p style="margin:0 0 18px;font-size:12px;line-height:1.5;word-break:break-all;"><a href="${esc(url)}" target="_blank" style="color:${C.gold};text-decoration:underline;">${esc(url)}</a></p>`
    : ''

  const noteHtml = note ? `<p style="margin:0;font-size:13px;line-height:1.6;color:${C.muted};">${esc(note)}</p>` : ''

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${esc(title)}</title>
</head>
<body style="margin:0;padding:0;background:${C.page};" bgcolor="${C.page}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.page};">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.page}" style="background:${C.page};">
<tr><td align="center" style="padding:32px 14px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;font-family:${FONT};">
    <tr><td style="padding:0 4px 18px;">
      <a href="${esc(site)}" target="_blank" style="text-decoration:none;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="padding-right:10px;"><img src="${esc(site)}/icon-192.png" width="36" height="36" alt="" style="display:block;border-radius:9px;border:0;"></td>
          <td style="font-family:${FONT};font-size:22px;font-weight:800;letter-spacing:-0.01em;"><span style="color:${C.text};">Tick</span><span style="color:${C.goldBright};">Gains</span></td>
        </tr></table>
      </a>
    </td></tr>
    <tr><td bgcolor="${C.panel}" style="background:${C.panel};border:1px solid ${C.border};border-radius:14px;padding:32px 30px 28px;">
      <h1 style="margin:0 0 18px;font-family:${FONT};font-size:24px;line-height:1.25;font-weight:700;letter-spacing:-0.01em;color:${C.goldBright};">${esc(title)}</h1>
      ${paragraphs.map(para).join('\n      ')}
      ${rowsHtml}
      ${buttonHtml}
      ${noteHtml}
    </td></tr>
    <tr><td style="padding:20px 8px 0;font-size:12px;line-height:1.6;color:${C.muted};text-align:center;">
      <a href="${esc(site)}" target="_blank" style="color:${C.gold};text-decoration:none;font-weight:700;">tickgains.com</a><br>
      Free OSRS XP tracking, hiscores history and account planning.<br>
      TickGains is a fan-made tool and is not affiliated with or endorsed by Jagex Ltd.
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`

  const textParts = [
    title,
    '',
    ...paragraphs.map((p) => (typeof p === 'string' ? p : p.text)),
    ...(rows.length ? ['', ...rows.map((r) => `${r.label}: ${r.value}`)] : []),
    ...(url ? ['', `${button.label}:`, url] : []),
    ...(note ? ['', note] : []),
    '',
    `TickGains - ${site}`,
  ]
  return { html, text: textParts.join('\n') }
}
