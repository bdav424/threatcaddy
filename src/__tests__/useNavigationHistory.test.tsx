import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useNavigationHistory, type NavState } from '../hooks/useNavigationHistory';

function NavigationHistoryHarness({
  initialState,
  onViewChange,
}: {
  initialState?: NavState;
  onViewChange: (state: NavState) => void;
}) {
  useNavigationHistory({ initialState, onViewChange });
  return null;
}

describe('useNavigationHistory', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('seeds browser history from the provided initial navigation state', async () => {
    render(
      <NavigationHistoryHarness
        initialState={{ view: 'workspace', selectedFolderId: 'case-1' }}
        onViewChange={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(window.history.state).toMatchObject({
        __bn: true,
        view: 'workspace',
        selectedFolderId: 'case-1',
      });
    });
  });
});
