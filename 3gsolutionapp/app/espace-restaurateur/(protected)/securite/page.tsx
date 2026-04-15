'use client';
// TICK-188 — Page Sécurité admin : activation / désactivation TOTP 2FA

import { useState, useEffect } from 'react';
import Image from 'next/image';

type Status = 'loading' | 'disabled' | 'enrolling' | 'enabled' | 'disabling';

export default function SecuritePage() {
  const [status, setStatus] = useState<Status>('loading');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [pendingSecret, setPendingSecret] = useState('');
  const [confirmCode, setConfirmCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Vérifie si le 2FA est activé en chargeant le statut depuis l'API
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
    setQrCodeDataUrl(data.qrCodeDataUrl);
    setPendingSecret(data.secret);
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
      <p className="text-sm text-gray-500 mb-8">
        Authentification à deux facteurs (2FA)
      </p>

      {success && (
        <div className="mb-6 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
          {success}
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

      {/* ── Enrôlement en cours ── */}
      {status === 'enrolling' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <p className="font-medium text-gray-900">Scannez ce QR code</p>
          <p className="text-sm text-gray-500">
            Ouvrez <strong>Google Authenticator</strong> ou <strong>Authy</strong>, appuyez sur
            &ldquo;+&rdquo; et scannez le code ci-dessous.
          </p>

          {qrCodeDataUrl && (
            <div className="flex justify-center">
              <Image
                src={qrCodeDataUrl}
                alt="QR code 2FA"
                width={200}
                height={200}
                className="rounded-lg border border-gray-200"
                unoptimized
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Entrez le code affiché pour confirmer
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
            <p className="text-sm font-medium text-gray-700 mb-2">
              Désactiver le 2FA
            </p>
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

      {status === 'loading' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="h-8 bg-gray-100 rounded animate-pulse" />
        </div>
      )}
    </div>
  );
}
