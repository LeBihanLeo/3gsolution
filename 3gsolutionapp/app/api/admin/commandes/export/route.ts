// TICK-106 — Export CSV commandes (comptabilité)
// TICK-125 — Paramètre ?statut=recuperee pour l'onglet "Passées"
// Auth : admin requis (401 sinon)
// Query : ?from=YYYY-MM-DD&to=YYYY-MM-DD&statut=recuperee (défaut : aujourd'hui, tous statuts payés)
// Format CSV : UTF-8 BOM, séparateur point-virgule, TVA 10%

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import Commande, { ICommande } from '@/models/Commande';
import { logger } from '@/lib/logger';

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatEur(centimes: number): string {
  return (centimes / 100).toFixed(2).replace('.', ',') + ' €';
}

function escapeCsv(value: string): string {
  // Entourer de guillemets si contient ; " ou saut de ligne
  if (/[;";\n\r]/.test(value)) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

function idCourt(id: string): string {
  return '#' + id.slice(-6).toUpperCase();
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const todayStr = toDateStr(new Date());
  const fromStr = searchParams.get('from') ?? todayStr;
  const toStr = searchParams.get('to') ?? todayStr;
  // TICK-125 — filtre statut optionnel : 'recuperee' pour l'export comptabilité passées
  const statutFilter = searchParams.get('statut');
  const STATUTS_VALIDES = ['payee', 'en_preparation', 'prete', 'recuperee'];

  // Construire les bornes de date (inclusive)
  const from = new Date(`${fromStr}T00:00:00.000Z`);
  const to = new Date(`${toStr}T23:59:59.999Z`);

  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    return NextResponse.json({ error: 'Paramètres de date invalides (YYYY-MM-DD attendu)' }, { status: 400 });
  }

  if (statutFilter && !STATUTS_VALIDES.includes(statutFilter)) {
    return NextResponse.json({ error: 'Statut invalide' }, { status: 400 });
  }

  try {
    await connectDB();

    const statutQuery = statutFilter
      ? { statut: statutFilter }
      : { statut: { $ne: 'en_attente_paiement' } };

    const commandes = await Commande.find({
      createdAt: { $gte: from, $lte: to },
      ...statutQuery,
    })
      .sort({ createdAt: 1 })
      .lean() as (ICommande & { _id: { toString(): string } })[];

    // En-tête CSV
    const BOM = '\uFEFF';
    const HEADER = 'Date;Heure;Numéro;Client;Produits;Options;Quantités;Sous-total HT;TVA (10%);Total TTC;Créneau;Statut';

    const rows = commandes.map((c) => {
      const date = new Date(c.createdAt);
      const dateStr = date.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' });
      const heureStr = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });

      const nomsProds = c.produits.map((p) => p.nom).join(', ');
      const options = c.produits.map((p) =>
        p.options.length > 0 ? p.options.map((o) => o.nom).join(', ') : '-'
      ).join(', ');
      const quantites = c.produits.map((p) => String(p.quantite)).join(', ');

      const totalTTC = c.total; // centimes
      const tva = Math.round(totalTTC / 11); // TVA 10% incluse : TTC / 1.1 → TVA = TTC - TTC/1.1 = TTC * 0.1/1.1 = TTC/11
      const ht = totalTTC - tva;

      const creneau = c.retrait.type === 'immediat' ? 'Dès que possible' : (c.retrait.creneau ?? '');

      const statutLabel: Record<string, string> = {
        payee: 'Payée',
        en_preparation: 'En préparation',
        prete: 'Prête',
        recuperee: 'Récupérée',
      };

      return [
        dateStr,
        heureStr,
        idCourt(c._id.toString()),
        escapeCsv(c.client.nom),
        escapeCsv(nomsProds),
        escapeCsv(options),
        escapeCsv(quantites),
        formatEur(ht),
        formatEur(tva),
        formatEur(totalTTC),
        escapeCsv(creneau),
        statutLabel[c.statut] ?? c.statut,
      ].join(';');
    });

    const csv = BOM + HEADER + '\n' + rows.join('\n');

    logger.info('commandes_exported_csv', {
      adminId: session.user?.email ?? 'unknown',
      from: fromStr,
      to: toStr,
      count: commandes.length,
    });

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="commandes-${fromStr}-${toStr}.csv"`,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
