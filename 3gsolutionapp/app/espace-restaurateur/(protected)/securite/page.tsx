'use client';
// TICK-188 — Page Sécurité admin : activation / désactivation TOTP 2FA
// Zéro dépendance externe — fonctionne avec les modules Node.js natifs uniquement.
// UX tablette : bouton "Ouvrir dans l'app" (lien otpauth://) + clé secrète manuelle.

import { useState, useEffect } from 'react';

type Status = 'loading' | 'disabled' | 'enrolling' | 'enabled';

export default function SecuritePage() {
  const [status, setStatus] = useState<Status>('loading');
  const [otpauthUri, setOtpauthUri] = useState('');
  const [pendingSecret, setPendingSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [confirmCode, setConfirmCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/admin/2fa/status')
      .then((r) => r.json())
      .then((data) => setStatus(data.enabled ? 'enabled' : 'disabled'))
      .catch(() => setStatus('disabled'));
  }, []);

  async function handleStartEnrollment() {
    setError('');
    setLoading(true);
    const res = await fetch('/api/admin/2fa/setup', { method: 'POST' });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? 'Erreur lors de la génération.'); return; }
    setOtpauthUri(data.otpauthUri);
    setPendingSecret(data.secret);
    setShowSecret(false);
    setStatus('enrolling');
  }

  async function handleConfirm() {
    setError('');
    setLoading(true);
    const res = await fetch('/api/admin/2fa/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: pendingSecret, code: confirmCode }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? 'Code incorrect.'); return; }
    setStatus('enabled');
    setSuccess('Authentification à deux facteurs activée.');
    setConfirmCode('');
  }

  async function handleDisable() {
    setError('');
    setLoading(true);
    const res = await fetch('/api/admin/2fa/disable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: disableCode }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? 'Code incorrect.'); return; }
    setStatus('disabled');
    setSuccess('Authentification à deux facteurs désactivée.');
    setDisableCode('');
  }

  return (
    <div className="max-w-lg mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Sécurité</h1>
      <p className="text-sm text-gray-500 mb-8">Authentification à deux facteurs (2FA)</p>

      {success && (
        <div className="mb-6 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
          {success}
        </div>
      )}

      {/* ── Chargement ── */}
      {status === 'loading' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="h-8 bg-gray-100 rounded animate-pulse" />
        </div>
      )}

      {/* ── 2FA désactivé ── */}
      {status === 'disabled' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔓</span>
            <div>
              <p className="font-medium text-gray-900">2FA désactivé</p>
              <p className="text-sm text-gray-500">Seul votre mot de passe protège votre compte.</p>
            </div>
          </div>
          <button
            onClick={handleStartEnrollment}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg transition-colors text-sm"
          >
            {loading ? 'Chargement…' : 'Activer le 2FA'}
          </button>
        </div>
      )}

      {/* ── Enrôlement ── */}
      {status === 'enrolling' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <p className="font-medium text-gray-900">Ajouter votre compte à l&apos;application</p>

          {/* Bouton direct — ouvre l'app authenticator sur tablette/mobile */}
          <a
            href={otpauthUri}
            className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition-colors text-sm"
          >
            <span>📱</span>
            Ouvrir dans Google Authenticator / Authy
          </a>

          <div className="relative flex items-center">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="mx-3 text-xs text-gray-400">ou entrez la clé manuellement</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Clé secrète pour saisie manuelle */}
          <div>
            <p className="text-xs text-gray-500 mb-2">
              Dans l&apos;application : <strong>+</strong> → <strong>Entrer une clé de configuration</strong>
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono tracking-wider break-all">
                {showSecret ? pendingSecret : '••••••••••••••••••••••••••••••••'}
              </code>
              <button
                type="button"
                onClick={() => setShowSecret((v) => !v)}
                className="px-3 py-2 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 shrink-0"
              >
                {showSecret ? 'Masquer' : 'Afficher'}
              </button>
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* Confirmation du premier code */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Entrez le code affiché dans l&apos;application pour confirmer
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={confirmCode}
              onChange={(e) => setConfirmCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-center tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            onClick={handleConfirm}
            disabled={loading || confirmCode.length !== 6}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg transition-colors text-sm"
          >
            {loading ? 'Vérification…' : 'Confirmer l\'activation'}
          </button>

          <button
            type="button"
            onClick={() => { setStatus('disabled'); setError(''); }}
            className="w-full text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Annuler
          </button>
        </div>
      )}

      {/* ── 2FA activé ── */}
      {status === 'enabled' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔒</span>
            <div>
              <p className="font-medium text-gray-900">2FA activé</p>
              <p className="text-sm text-gray-500">
                Votre compte est protégé par un second facteur d&apos;authentification.
              </p>
            </div>
          </div>

          <hr className="border-gray-100" />

          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Désactiver le 2FA</p>
            <p className="text-xs text-gray-400 mb-3">
              Entrez un code de votre application pour confirmer la désactivation.
            </p>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-center tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-red-400 mb-3"
            />
            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
                {error}
              </p>
            )}
            <button
              onClick={handleDisable}
              disabled={loading || disableCode.length !== 6}
              className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg transition-colors text-sm"
            >
              {loading ? 'Désactivation…' : 'Désactiver le 2FA'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
