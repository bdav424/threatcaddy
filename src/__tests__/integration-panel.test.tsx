import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IntegrationPanel } from '../components/Integrations/IntegrationPanel';

const mocks = vi.hoisted(() => ({
  addToast: vi.fn(),
  clearCatalogCache: vi.fn(),
  createInstallation: vi.fn(),
  deleteInstallation: vi.fn(),
  fetchCatalog: vi.fn(),
  fetchTeamTemplates: vi.fn(),
  fetchTemplate: vi.fn(),
  importTemplate: vi.fn(),
  installTemplate: vi.fn(),
  shareIntegrationTemplate: vi.fn(),
  updateInstallation: vi.fn(),
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ connected: true, user: null, serverUrl: null }),
}));

vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({ addToast: mocks.addToast, toasts: [], removeToast: vi.fn() }),
}));

vi.mock('../hooks/useIntegrations', () => ({
  useIntegrations: () => ({
    templates: [],
    installations: [],
    runs: [],
    importTemplate: mocks.importTemplate,
    installTemplate: mocks.installTemplate,
    createInstallation: mocks.createInstallation,
    updateInstallation: mocks.updateInstallation,
    deleteInstallation: mocks.deleteInstallation,
    loading: false,
  }),
}));

vi.mock('../lib/integration-catalog', () => ({
  fetchCatalog: mocks.fetchCatalog,
  fetchTemplate: mocks.fetchTemplate,
  clearCatalogCache: mocks.clearCatalogCache,
}));

vi.mock('../lib/server-api', () => ({
  shareIntegrationTemplate: mocks.shareIntegrationTemplate,
  fetchTeamTemplates: mocks.fetchTeamTemplates,
  deleteTeamTemplate: vi.fn(),
}));

describe('IntegrationPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchCatalog.mockResolvedValue([]);
    mocks.fetchTeamTemplates.mockResolvedValue([]);
  });

  it('keeps community and team catalog fetches lazy until the Catalog tab is opened', async () => {
    render(<IntegrationPanel />);

    expect(mocks.fetchCatalog).not.toHaveBeenCalled();
    expect(mocks.fetchTeamTemplates).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /catalog|panel\.catalog/i }));

    await waitFor(() => expect(mocks.fetchCatalog).toHaveBeenCalledTimes(1));
    expect(mocks.fetchTeamTemplates).toHaveBeenCalledTimes(1);
  });
});
