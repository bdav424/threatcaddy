import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProductView } from '../components/Products/ProductView';
import type { Note, NoteTemplate } from '../types';

const product: Note = {
  id: 'product-1',
  title: 'Finished Intel Note',
  content: '# Finished Intel Note\n\n## Executive Summary\n\nCustomer-ready summary.\n\n| Type | Value |\n| --- | --- |\n| ip | 203.0.113.10 |',
  folderId: 'folder-1',
  tags: ['product', 'intel-note'],
  pinned: false,
  archived: false,
  trashed: false,
  createdAt: 1,
  updatedAt: 2,
};

const baseline: NoteTemplate = {
  id: 'baseline-1',
  name: 'INTEL Intelligence Note Baseline',
  content: '# {{ title }}\n\n## Executive Summary\n\n{{ executiveSummary }}',
  category: 'Product Baseline',
  source: 'builtin',
  icon: 'NOTE',
  description: 'Finished intelligence note structure.',
  tags: ['product-baseline', 'jinja'],
  createdAt: 0,
  updatedAt: 0,
};

describe('ProductView', () => {
  it('opens product baselines inside the products surface', () => {
    render(
      <ProductView
        folderName="Test Investigation"
        products={[product]}
        baselines={[baseline]}
        onOpenSourceNote={vi.fn()}
        onOpenChat={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /baselines/i }));

    const dialog = screen.getByRole('dialog', { name: /product baselines/i });
    expect(within(dialog).getAllByText('INTEL Intelligence Note Baseline').length).toBeGreaterThan(0);
    expect(within(dialog).getByText(/{{ executiveSummary }}/)).toBeInTheDocument();
  });

  it('opens a rendered product preview before source-note navigation', () => {
    const openSourceNote = vi.fn();
    render(
      <ProductView
        folderName="Test Investigation"
        products={[product]}
        baselines={[baseline]}
        onOpenSourceNote={openSourceNote}
        onOpenChat={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /preview product/i }));

    const dialog = screen.getByRole('dialog', { name: 'Finished Intel Note' });
    expect(openSourceNote).not.toHaveBeenCalled();
    expect(within(dialog).getByRole('heading', { name: 'Executive Summary' })).toBeInTheDocument();
    expect(within(dialog).getByText('Customer-ready summary.')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: /^source$/i }));
    expect(openSourceNote).toHaveBeenCalledWith('product-1');
  });
});
