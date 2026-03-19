// TICK-035 — Composant DropZone (réutilisable)
'use client';

import { useRef, useState, DragEvent, ChangeEvent } from 'react';

export interface DropZoneProps {
  currentImageUrl?: string;
  onUploadSuccess: (url: string) => void;
  onRemove?: () => void;
  label?: string;
  aspectRatio?: 'square' | 'banner';
}

export default function DropZone({
  currentImageUrl,
  onUploadSuccess,
  onRemove,
  label = 'Image',
  aspectRatio = 'square',
}: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | undefined>(currentImageUrl);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewRatio =
    aspectRatio === 'banner' ? 'aspect-[16/3]' : 'aspect-square';

  const maxWidth = aspectRatio === 'square' ? 'max-w-[140px]' : 'w-full';

  async function uploadFile(file: File) {
    setError(null);
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Erreur lors de l\'upload');
        return;
      }
      setPreview(json.url);
      onUploadSuccess(json.url);
    } catch {
      setError('Erreur réseau. Réessayez.');
    } finally {
      setLoading(false);
    }
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(true);
  }

  function handleDragLeave() {
    setDragging(false);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    // reset pour permettre re-sélection du même fichier
    e.target.value = '';
  }

  function handleRemove() {
    setPreview(undefined);
    setError(null);
    onRemove?.();
  }

  const dropZoneId = `dropzone-${label.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <div className="space-y-2">
      {label && (
        <label htmlFor={dropZoneId} className="block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}

      {preview ? (
        /* ── Prévisualisation ── */
        <div className={`relative ${maxWidth} ${previewRatio} rounded-lg overflow-hidden border border-gray-200`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt={label}
            className="w-full h-full object-cover"
            onError={() => setPreview(undefined)}
          />
          <button
            type="button"
            onClick={handleRemove}
            aria-label="Supprimer l'image"
            className="absolute top-2 right-2 bg-white/90 hover:bg-white text-gray-700 rounded-full w-7 h-7 flex items-center justify-center shadow text-sm font-bold transition"
          >
            ✕
          </button>
        </div>
      ) : (
        /* ── Zone de drop ── */
        <div
          id={dropZoneId}
          role="button"
          tabIndex={0}
          aria-label={`Zone de dépôt pour ${label}`}
          aria-describedby={`${dropZoneId}-hint`}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            ${maxWidth} ${previewRatio} rounded-lg border-2 border-dashed cursor-pointer
            flex flex-col items-center justify-center gap-2 transition-colors
            ${dragging
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/40'
            }
          `}
        >
          {loading ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-gray-500">Upload en cours…</span>
            </div>
          ) : (
            <>
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <p id={`${dropZoneId}-hint`} className="text-xs text-gray-500 text-center px-3">
                Glissez une image ici ou <span className="text-blue-600 font-medium">cliquez pour parcourir</span>
              </p>
              <p className="text-xs text-gray-400">JPEG, PNG, WebP, GIF — max 5 Mo</p>
            </>
          )}
        </div>
      )}

      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleChange}
        className="hidden"
        aria-label={`Sélectionner une image pour ${label}`}
      />
    </div>
  );
}
