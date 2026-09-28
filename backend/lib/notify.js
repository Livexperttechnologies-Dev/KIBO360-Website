// ---------------------------------------------------------------------------
// Email notifications (best effort; skipped when SMTP isn't configured).
// ---------------------------------------------------------------------------

export function createNotify({ settings }) {
  async function transport() {
    const { notifications } = settings.load();
    const smtp = notifications?.smtp || {};
    if (!smtp.host || !smtp.user) return null;
    const { default: nodemailer } = await import("nodemailer");
    return {
      notifications,
      from: smtp.from || smtp.user,
      tx: nodemailer.createTransport({ host: smtp.host, port: Number(smtp.port) || 587, secure: Number(smtp.port) === 465, auth: { user: smtp.user, pass: smtp.pass } }),
    };
  }

  const label = (form, id) => form?.fields?.find((f) => f.id === id)?.label || id;
  const fmt = (v) => (Array.isArray(v) ? v.join(", ") : v === true ? "Yes" : String(v ?? ""));

  async function submission(sub, form) {
    try {
      const t = await transport();
      if (!t) return;
      const n = t.notifications;
      const to = [...new Set([...(form?.notify?.team !== false && n.notifyTeam ? n.teamEmails || [] : []), ...(form?.notify?.extraEmails || [])])];
      const ctx = sub.context || {};
      if (to.length) {
        const lines = Object.entries(sub.values || {}).map(([k, v]) => `${label(form, k)}: ${fmt(v) || "-"}`);
        const source = [ctx.utm?.source && `utm_source=${ctx.utm.source}`, ctx.utm?.medium && `utm_medium=${ctx.utm.medium}`, ctx.utm?.campaign && `utm_campaign=${ctx.utm.campaign}`].filter(Boolean).join(" ");
        await t.tx.sendMail({
          from: t.from,
          to: to.join(","),
          subject: `New KIBO360 ${form?.name || "form"} submission: ${sub.lead?.name || sub.lead?.email || "website visitor"}`,
          text:
            `New submission on kibo360.in (${form?.name || sub.formId})\n\n${lines.join("\n")}\n\n` +
            `Page: ${ctx.page || "-"}\nLanding page: ${ctx.firstTouch?.landingPage || ctx.landingPage || "-"}\nReferrer: ${ctx.referrer || "-"}\n` +
            (source ? `Campaign: ${source}\n` : "") + `\nReceived: ${sub.receivedAt}\nAdmin: https://kibo360.in/admin/leads`,
        }).catch((e) => console.error("[mail] team notify failed:", e.message));
      }
      if (form?.notify?.autoReply !== false && n.visitorAutoReply && sub.lead?.email) {
        await t.tx.sendMail({
          from: t.from,
          to: sub.lead.email,
          subject: n.visitorSubject || "Thanks for contacting KIBO360",
          text: (n.visitorMessage || "").replaceAll("{name}", sub.lead.name || "there"),
        }).catch((e) => console.error("[mail] visitor auto-reply failed:", e.message));
      }
    } catch (e) {
      console.error("[mail] notification error:", e.message);
    }
  }

  async function team(subject, text) {
    try {
      const t = await transport();
      if (!t || !t.notifications.teamEmails?.length) return;
      await t.tx.sendMail({ from: t.from, to: t.notifications.teamEmails.join(","), subject, text });
    } catch (e) {
      console.error("[mail] team alert failed:", e.message);
    }
  }

  async function sendTestEmail(user) {
    const { notifications } = settings.load();
    if (!notifications.smtp?.host || !notifications.smtp?.user) throw Object.assign(new Error("Configure the SMTP host and username first, then save."), { status: 400 });
    if (!notifications.teamEmails?.length) throw Object.assign(new Error("Add at least one team email first, then save."), { status: 400 });
    const t = await transport();
    try {
      await t.tx.sendMail({
        from: t.from,
        to: notifications.teamEmails.join(","),
        subject: "Test email from the KIBO360 admin console",
        text: `This is a test email sent by ${user.name} (${user.email}) from the KIBO360 admin console.\n\nIf you received it, SMTP and team notifications are working.`,
      });
    } catch (e) {
      throw Object.assign(new Error(`SMTP error: ${e.message}`), { status: 502 });
    }
    return notifications.teamEmails;
  }

  return { submission, team, sendTestEmail };
}
