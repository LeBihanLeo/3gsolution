import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import { ICommande } from '@/models/Commande';

// ── Transport abstrait : MailDev (SMTP) en dev, Resend en prod ────────────────
interface SendPayload {
  to: string;
  subject: string;
  html: string;
}

async function sendEmail(payload: SendPayload): Promise<void> {
  const from = process.env.EMAIL_FROM ?? 'commandes@restaurant.fr';

  if (process.env.SMTP_HOST) {
    // MailDev / SMTP local
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 1025),
      secure: false,
      ignoreTLS: true,
    });
    await transporter.sendMail({ from, ...payload });
    return;
  }

  // Resend (production)
  const resend = new Resend(process.env.RESEND_API_KEY ?? 'placeholder');
  await resend.emails.send({ from, ...payload });
}

function formatPrix(centimes: number): string {
  return (centimes / 100).toFixed(2).replace('.', ',') + ' €';
}

function idCourt(id: string): string {
  return id.slice(-6).toUpperCase();
}

// ── Email vérification compte client (TICK-067) ───────────────────────────
export async function sendVerificationEmail(email: string, token: string): Promise<void> {
  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
  const link = `${baseUrl}/auth/verify-email?token=${token}`;

  await sendEmail({
    to: email,
    subject: 'Vérifiez votre adresse email — 3G Solution',
    html: `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="font-family:-apple-system,sans-serif;background:#f9fafb;padding:32px">
  <div style="max-width:500px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.1)">
    <h1 style="color:#111827;font-size:20px;margin:0 0 16px">Confirmez votre email</h1>
    <p style="color:#6b7280;margin:0 0 24px">Cliquez sur le lien ci-dessous pour activer votre compte. Ce lien est valable <strong>24 heures</strong>.</p>
    <a href="${link}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
      Vérifier mon email
    </a>
    <p style="color:#9ca3af;font-size:12px;margin:24px 0 0">Si vous n'avez pas créé de compte, ignorez cet email.</p>
  </div>
</body>
</html>`,
  });
}

// ── Email reset mot de passe (TICK-069) ───────────────────────────────────
export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
  const link = `${baseUrl}/auth/reset-password?token=${token}`;

  await sendEmail({
    to: email,
    subject: 'Réinitialisation de mot de passe — 3G Solution',
    html: `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="font-family:-apple-system,sans-serif;background:#f9fafb;padding:32px">
  <div style="max-width:500px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.1)">
    <h1 style="color:#111827;font-size:20px;margin:0 0 16px">Réinitialisation de mot de passe</h1>
    <p style="color:#6b7280;margin:0 0 24px">Cliquez sur le lien ci-dessous pour choisir un nouveau mot de passe. Ce lien est valable <strong>1 heure</strong>.</p>
    <a href="${link}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
      Réinitialiser mon mot de passe
    </a>
    <p style="color:#9ca3af;font-size:12px;margin:24px 0 0">Si vous n'avez pas fait cette demande, ignorez cet email.</p>
  </div>
</body>
</html>`,
  });
}

export async function sendConfirmationEmail(commande: ICommande): Promise<void> {
  if (!commande.client.email) return;

  const ref = idCourt(commande._id.toString());
  const retrait =
    commande.retrait.type === 'immediat'
      ? 'Dès que possible'
      : `À ${commande.retrait.creneau}`;

  const lignesProduits = commande.produits
    .map((p) => {
      const optionsTexte =
        p.options.length > 0
          ? ` <span style="color:#6b7280;font-size:13px">(${p.options.map((o) => o.nom).join(', ')})</span>`
          : '';
      const prixUnit = p.prix + p.options.reduce((s, o) => s + o.prix, 0);
      return `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;color:#374151">
            ${p.quantite}× ${p.nom}${optionsTexte}
          </td>
          <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:600;color:#111827">
            ${formatPrix(prixUnit * p.quantite)}
          </td>
        </tr>`;
    })
    .join('');

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">

    <div style="background:#2563eb;padding:28px 32px">
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700">Commande confirmée ✅</h1>
      <p style="margin:6px 0 0;color:#bfdbfe;font-size:14px">Commande #${ref}</p>
    </div>

    <div style="padding:28px 32px">
      <p style="margin:0 0 16px;color:#374151;font-size:15px">
        Bonjour <strong>${commande.client.nom}</strong>,
      </p>
      <p style="margin:0 0 24px;color:#6b7280;font-size:14px">
        Votre paiement a bien été reçu. Voici le récapitulatif de votre commande.
      </p>

      <table style="width:100%;border-collapse:collapse">
        ${lignesProduits}
        <tr>
          <td style="padding:12px 0 0;font-weight:700;color:#111827;font-size:16px">Total</td>
          <td style="padding:12px 0 0;text-align:right;font-weight:700;color:#111827;font-size:16px">
            ${formatPrix(commande.total)}
          </td>
        </tr>
      </table>

      <div style="margin:24px 0;background:#f0fdf4;border:1px solid #bbf7d0;padding:14px 16px;border-radius:8px">
        <span style="font-weight:600;color:#15803d">Retrait :</span>
        <span style="color:#166534;margin-left:6px">${retrait}</span>
      </div>

      ${
        commande.commentaire
          ? `<p style="color:#6b7280;font-size:13px;font-style:italic">Note : ${commande.commentaire}</p>`
          : ''
      }

      <hr style="border:none;border-top:1px solid #f3f4f6;margin:24px 0">
      <p style="margin:0;color:#9ca3af;font-size:12px">
        3G Solution — Réf. commande #${ref}
      </p>
    </div>
  </div>
</body>
</html>`;

  await sendEmail({
    to: commande.client.email,
    subject: `Votre commande #${ref} est confirmée — 3G Solution`,
    html,
  });
}
