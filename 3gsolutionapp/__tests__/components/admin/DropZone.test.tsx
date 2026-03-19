import { describe, it, expect, vi, beforeEach, afterEach, afterAll, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import DropZone from '@/components/admin/DropZone';

const server = setupServer(
  http.post('/api/upload', () =>
    HttpResponse.json({ url: 'https://blob.vercel-storage.com/test.jpg' })
  )
);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('DropZone', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rendu initial sans currentImageUrl → zone de drop visible, pas d\'img', () => {
    render(<DropZone onUploadSuccess={vi.fn()} label="Image du produit" />);
    expect(screen.getByText(/glissez une image/i)).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('currentImageUrl fourni → image prévisualisée dès le rendu', () => {
    render(
      <DropZone
        currentImageUrl="https://example.com/existing.jpg"
        onUploadSuccess={vi.fn()}
        label="Image du produit"
      />
    );
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://example.com/existing.jpg');
  });

  it('sélection fichier valide → onUploadSuccess appelé avec l\'URL', async () => {
    const onUploadSuccess = vi.fn();
    render(<DropZone onUploadSuccess={onUploadSuccess} label="Test" />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['content'], 'photo.jpg', { type: 'image/jpeg' });
    // configurable: true pour permettre la redéfinition si le même élément est réutilisé
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    fireEvent.change(input);

    await waitFor(() => {
      expect(onUploadSuccess).toHaveBeenCalledWith('https://blob.vercel-storage.com/test.jpg');
    });
  });

  it('upload échoue (400) → message d\'erreur inline visible', async () => {
    server.use(
      http.post('/api/upload', () =>
        HttpResponse.json({ error: 'Type non supporté' }, { status: 400 })
      )
    );
    render(<DropZone onUploadSuccess={vi.fn()} label="Test" />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['content'], 'doc.pdf', { type: 'application/pdf' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText(/type non supporté/i)).toBeInTheDocument();
    });
  });

  it('clic bouton supprimer → img retirée, onRemove appelé', () => {
    const onRemove = vi.fn();
    render(
      <DropZone
        currentImageUrl="https://example.com/img.jpg"
        onUploadSuccess={vi.fn()}
        onRemove={onRemove}
        label="Test"
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /supprimer/i }));
    expect(onRemove).toHaveBeenCalledOnce();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('label affiché au-dessus de la zone', () => {
    render(<DropZone onUploadSuccess={vi.fn()} label="Bannière du site" />);
    expect(screen.getByText('Bannière du site')).toBeInTheDocument();
  });
});
