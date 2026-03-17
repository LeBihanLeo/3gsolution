import { Resend } from 'resend';
import { ICommande } from '@/models/Commande';

// Initialisation lazy pour éviter l'erreur au build si RESEND_API_KEY absent
function getResend(): Resend {
  return new Resend(process.env.RESEND_API_KEY ?? 'placeholder');
}

function formatPrix(centimes: number): string {
  return (centimes / 100).toFixed(2).replace('.', ',') + ' €';
}

function idCourt(id: string): string {
  return id.slice(-6).toUpperCase();
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

  await getResend().emails.send({
    from: process.env.EMAIL_FROM ?? 'commandes@restaurant.fr',
    to: commande.client.email,
    subject: `Votre commande #${ref} est confirmée — 3G Solution`,
    html,
  });
}
