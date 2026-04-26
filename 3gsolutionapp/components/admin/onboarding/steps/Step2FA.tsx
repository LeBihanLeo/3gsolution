'use client';
// TICK-198 — Step 5 : 2FA Authenticator dans le wizard onboarding
// Réutilise les APIs /api/admin/2fa/* existantes (TICK-188).

import { useState, useEffect } from 'react';
import type { StepProps } from '../types';

type Status2FA = 'loading' | 'disabled' | 'enrolling' | 'enabled';

export default function Step2FA({ onNext, onMarkStep, stepId }: StepProps) {
  const [status, setStatus] = useState<Status2FA>('loading');
  const [qrCodeSvg, setQrCodeSvg] = useState('');
  const [pendingSecret, setPending] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [confirmCode, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/admin/2fa/status')
      .then((r) => r.json())
      .then((d) => {
        const enabled = d.enabled;
        setStatus(enabled ? 'enabled' : 'disabled');
        if (enabled) onMarkStep(stepId);
      })
      .catch(() => setStatus('disabled'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleStartEnrollment() {
    setError(''); setLoading(true);
    const res = await fetch('/api/admin/2fa/setup', { method: 'POST' });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? 'Erreur lors de la génération.'); return; }
    setQrCodeSvg(data.qrCodeSvg);
    setPending(data.secret);
    setShowSecret(false);
    setStatus('enrolling');
  }

  async function handleConfirm() {
    setError(''); setLoading(true);
    const res = await fetch('/api/admin/2fa/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: pendingSecret, code: confirmCode }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? 'Code incorrect.'); return; }
    setStatus('enabled');
    setConfirm('');
    await onMarkStep(stepId);
  }

  async function handleSkip() {
    await onMarkStep(stepId);
    onNext();
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Sécurisez votre compte</h2>
        <p className="text-sm text-gray-500 mt-1">
          L&apos;authentification à deux facteurs (2FA) protège votre compte même si votre mot de passe est compromis.
        </p>
      </div>

      {/* Loader */}
      {status === 'loading' && (
        <div className="h-16 bg-gray-100 rounded-lg animate-pulse" />
      )}

      {/* 2FA déjà activé */}
      {status === 'enabled' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
            <span className="text-2xl">🔒</span>
            <div>
              <p className="font-semibold text-green-800">2FA déjà activé</p>
              <p className="text-sm text-green-600">Votre compte est protégé par un second facteur.</p>
            </div>
          </div>
          <button
            onClick={onNext}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
          >
            Continuer →
          </button>
        </div>
      )}

      {/* Invitation à activer */}
      {status === 'disabled' && (
        <div className="space-y-4">
          {/* Avantages */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
            <p className="text-sm font-semibold text-amber-800">Pourquoi activer le 2FA ?</p>
            <ul className="text-sm text-amber-700 space-y-1">
              <li>• Protection contre les accès non autorisés</li>
              <li>• Indispensable si vous gérez des données de paiement</li>
              <li>• Compatible avec Google Authenticator et Authy</li>
            </ul>
          </div>

          <button
            onClick={handleStartEnrollment}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
          >
            {loading ? 'Chargement…' : 'Activer le 2FA'}
          </button>

          <button
            onClick={handleSkip}
            className="w-full text-sm text-gray-400 hover:text-gray-600 transition-colors py-2"
          >
            Passer pour l&apos;instant (non recommandé)
          </button>
        </div>
      )}

      {/* Flow d'enrollment */}
      {status === 'enrolling' && (
        <div className="space-y-5">
          <p className="text-sm text-gray-600">
            Scannez le QR code avec <strong>Google Authenticator</strong> ou <strong>Authy</strong>,
            puis entrez le code à 6 chiffres pour confirmer.
          </p>

          {qrCodeSvg && (
            <div
              className="flex justify-center [&>svg]:w-44 [&>svg]:h-44 [&>svg]:mx-auto [&>svg]:rounded-lg [&>svg]:border [&>svg]:border-gray-200"
              dangerouslySetInnerHTML={{ __html: qrCodeSvg }}
            />
          )}

          {/* Clé manuelle */}
          <div>
            <p className="text-xs text-gray-500 mb-2">Ou entrez la clé manuellement :</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono tracking-wider break-all select-all">
                {showSecret ? pendingSecret : '•'.repeat(pendingSecret.length)}
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Code de confirmation (6 chiffres)
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={confirmCode}
              onChange={(e) => setConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-center tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            onClick={handleConfirm}
            disabled={loading || confirmCode.length !== 6}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
          >
            {loading ? 'Vérification…' : 'Activer le 2FA'}
          </button>

          <button
            type="button"
            onClick={() => { setStatus('disabled'); setError(''); }}
            className="w-full text-sm text-gray-500 hover:text-gray-700 transition-colors py-1"
          >
            Annuler
          </button>
        </div>
      )}
    </div>
  );
}
