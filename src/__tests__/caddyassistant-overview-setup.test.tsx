import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { CaddyAssistantOverviewPanel } from '../components/CaddyAssistant/CaddyAssistantOverviewPanel';

const navigateToMock = vi.fn();
const openSettingsMock = vi.fn();
const fetchMock = vi.fn();

vi.mock('../contexts/NavigationContext', () => ({
  useNavigation: () => ({
    navigateTo: navigateToMock,
  }),
}));

vi.mock('../contexts/UIModalContext', () => ({
  useUIModals: () => ({
    openSettings: openSettingsMock,
  }),
}));

describe('AssistantCaddy overview setup routing', () => {
  beforeEach(() => {
    navigateToMock.mockReset();
    openSettingsMock.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    window.localStorage.clear();
  });

  it('routes compact setup controls to the owning local setup surfaces', () => {
    render(<CaddyAssistantOverviewPanel />);

    const setupRoutes = within(screen.getByRole('region', { name: 'AssistantCaddy setup routes' }));
    expect(setupRoutes.getByText('Setup routes: AI setup, EmailCaddy, CalendarCaddy, Integrations')).toBeInTheDocument();
    expect(setupRoutes.getByText(/overview does not connect, probe, or store credentials/i)).toBeInTheDocument();

    fireEvent.click(setupRoutes.getByRole('button', { name: 'Open AI setup' }));
    expect(openSettingsMock).toHaveBeenLastCalledWith('ai');

    fireEvent.click(setupRoutes.getByRole('button', { name: 'Open email setup' }));
    expect(navigateToMock).toHaveBeenLastCalledWith('cademail');

    fireEvent.click(setupRoutes.getByRole('button', { name: 'Open calendar setup' }));
    expect(navigateToMock).toHaveBeenLastCalledWith('calendarcaddy');

    fireEvent.click(setupRoutes.getByRole('button', { name: 'Open source catalog' }));
    expect(openSettingsMock).toHaveBeenLastCalledWith('integrations');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps expanded setup copy operational and catalog-focused', () => {
    render(<CaddyAssistantOverviewPanel />);

    const compactSetup = within(screen.getByRole('region', { name: 'AssistantCaddy setup routes' }));
    fireEvent.click(compactSetup.getByRole('button', { name: 'Expand' }));

    const expandedSetup = within(screen.getByRole('region', { name: 'AssistantCaddy setup routes' }));
    expect(expandedSetup.getByRole('heading', { name: 'AI setup in Settings' })).toBeInTheDocument();
    expect(expandedSetup.getByRole('heading', { name: 'EmailCaddy account setup' })).toBeInTheDocument();
    expect(expandedSetup.getByRole('heading', { name: 'CalendarCaddy local calendar' })).toBeInTheDocument();
    expect(expandedSetup.getByRole('heading', { name: 'Integrations source catalog' })).toBeInTheDocument();
    expect(expandedSetup.getByText(/source catalog lives under Integrations/i)).toBeInTheDocument();
    expect(expandedSetup.queryByRole('button', { name: 'Mark staged' })).not.toBeInTheDocument();

    fireEvent.click(expandedSetup.getByRole('button', { name: 'Open AI setup' }));
    expect(openSettingsMock).toHaveBeenLastCalledWith('ai');

    fireEvent.click(expandedSetup.getByRole('button', { name: 'Open email setup' }));
    expect(navigateToMock).toHaveBeenLastCalledWith('cademail');

    fireEvent.click(expandedSetup.getByRole('button', { name: 'Open calendar setup' }));
    expect(navigateToMock).toHaveBeenLastCalledWith('calendarcaddy');

    fireEvent.click(expandedSetup.getByRole('button', { name: 'Open source catalog' }));
    expect(openSettingsMock).toHaveBeenLastCalledWith('integrations');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
