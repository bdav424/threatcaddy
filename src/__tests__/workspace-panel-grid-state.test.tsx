import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { WorkspacePanel } from '../components/WorkspacePanels/WorkspacePanel';
import { WorkspacePanelDock } from '../components/WorkspacePanels/WorkspacePanelDock';
import { WorkspacePanelProvider } from '../components/WorkspacePanels/WorkspacePanelProvider';
import { useWorkspacePanel } from '../components/WorkspacePanels/useWorkspacePanels';
import type { WorkspacePanelPlacementState } from '../components/WorkspacePanels/workspaceGrid';

const affixedPlacement: WorkspacePanelPlacementState = {
  kind: 'affixed',
  id: 'grid-4x1-c3-r0',
  grid: '4x1',
  columns: 4,
  rows: 1,
  column: 3,
  row: 0,
  columnSpan: 1,
  rowSpan: 1,
  rect: { x: 1200, y: 64, width: 400, height: 900 },
  legacyZone: null,
};

function PlacementHarness() {
  const { panel, setMode, setPlacement, restore } = useWorkspacePanel('notes-workspace');
  const placementLabel = panel.placement.kind === 'affixed'
    ? `${panel.placement.grid}:${panel.placement.column},${panel.placement.row}:${panel.placement.columnSpan}x${panel.placement.rowSpan}`
    : 'free';

  return (
    <section>
      <div data-testid="mode">{panel.mode}</div>
      <div data-testid="placement">{placementLabel}</div>
      <button type="button" onClick={() => setPlacement(affixedPlacement)}>Affix</button>
      <button type="button" onClick={() => setMode('minimized')}>Minimize</button>
      <button type="button" onClick={restore}>Restore</button>
      <button type="button" onClick={() => setMode('docked')}>Dock</button>
    </section>
  );
}

function DockHarness() {
  const notes = useWorkspacePanel('notes-workspace');
  const tasks = useWorkspacePanel('tasks-workspace');

  return (
    <section>
      <button type="button" onClick={() => notes.setMode('minimized')}>Set Notes minimized</button>
      <button type="button" onClick={() => tasks.setMode('minimized')}>Set Tasks minimized</button>
      <WorkspacePanel
        id={notes.panel.id}
        title={notes.panel.title}
        mode={notes.panel.mode}
        geometry={notes.panel.geometry}
        zIndex={notes.panel.zIndex}
        onModeChange={notes.setMode}
        onGeometryChange={notes.setGeometry}
        onPanelFocus={notes.focus}
        onRestore={notes.restore}
        active
        resizeLabelBase="Notes panel"
        floatingAriaLabel="Notes panel"
        minimizeLabel="Minimize Notes"
        closeLabel="Close Notes workspace panel"
        restoreLabel="Restore Notes panel"
      >
        <p>Notes body</p>
      </WorkspacePanel>
      <WorkspacePanel
        id={tasks.panel.id}
        title={tasks.panel.title}
        mode={tasks.panel.mode}
        geometry={tasks.panel.geometry}
        zIndex={tasks.panel.zIndex}
        onModeChange={tasks.setMode}
        onGeometryChange={tasks.setGeometry}
        onPanelFocus={tasks.focus}
        onRestore={tasks.restore}
        active
        resizeLabelBase="Tasks panel"
        floatingAriaLabel="Tasks panel"
        minimizeLabel="Minimize Tasks"
        closeLabel="Close Tasks workspace panel"
        restoreLabel="Restore Tasks panel"
      >
        <p>Tasks body</p>
      </WorkspacePanel>
      <WorkspacePanelDock />
    </section>
  );
}

function ZOrderHarness() {
  const notes = useWorkspacePanel('notes-workspace');
  const tasks = useWorkspacePanel('tasks-workspace');

  return (
    <section>
      <div data-testid="notes-z">{notes.panel.zIndex}</div>
      <div data-testid="tasks-z">{tasks.panel.zIndex}</div>
      <button type="button" onClick={notes.focus}>Focus Notes</button>
      <button type="button" onClick={tasks.focus}>Focus Tasks</button>
    </section>
  );
}

function TopClampHarness() {
  const notes = useWorkspacePanel('notes-workspace');
  const onGeometryChange = vi.fn(notes.setGeometry);

  return (
    <section>
      <div data-testid="notes-y">{notes.panel.geometry.y}</div>
      <WorkspacePanel
        id={notes.panel.id}
        title={notes.panel.title}
        mode={notes.panel.mode}
        geometry={notes.panel.geometry}
        zIndex={notes.panel.zIndex}
        onModeChange={notes.setMode}
        onGeometryChange={onGeometryChange}
        onPanelFocus={notes.focus}
        onRestore={notes.restore}
        active
        resizeLabelBase="Notes panel"
        floatingAriaLabel="Notes panel"
        minimizeLabel="Minimize Notes"
        closeLabel="Close Notes to workspace dock"
        restoreLabel="Restore Notes panel"
      >
        <p>Notes body</p>
      </WorkspacePanel>
    </section>
  );
}

function DynamicWorkspaceHeaderClampHarness() {
  const [workspaceActive, setWorkspaceActive] = useState(false);
  const notes = useWorkspacePanel('notes-workspace');

  return (
    <section>
      <div data-testid="notes-y">{notes.panel.geometry.y}</div>
      <button type="button" onClick={() => setWorkspaceActive(true)}>Show Workspace header</button>
      {workspaceActive && (
        <div
          data-workspace-investigation-layer="true"
          ref={(element) => {
            if (!element) return;
            element.getBoundingClientRect = () => ({
              x: 0,
              y: 80,
              width: 1280,
              height: 40,
              top: 80,
              right: 1280,
              bottom: 120,
              left: 0,
              toJSON: () => ({}),
            } as DOMRect);
          }}
        />
      )}
      <WorkspacePanel
        id={notes.panel.id}
        title={notes.panel.title}
        mode={notes.panel.mode}
        geometry={notes.panel.geometry}
        zIndex={notes.panel.zIndex}
        onModeChange={notes.setMode}
        onGeometryChange={notes.setGeometry}
        onPanelFocus={notes.focus}
        onRestore={notes.restore}
        active={workspaceActive}
        resizeLabelBase="Notes panel"
        floatingAriaLabel="Notes panel"
        minimizeLabel="Minimize Notes"
        closeLabel="Close Notes to workspace dock"
        restoreLabel="Restore Notes panel"
      >
        <p>Notes body</p>
      </WorkspacePanel>
    </section>
  );
}

describe('workspace panel grid placement state', () => {
  it('preserves affixed grid reservation through minimize and restore but clears on dock', () => {
    render(
      <WorkspacePanelProvider
        initialPanels={[{
          id: 'notes-workspace',
          title: 'Notes',
          mode: 'floating',
          geometry: { x: 320, y: 80, width: 560, height: 380 },
        }]}
      >
        <PlacementHarness />
      </WorkspacePanelProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Affix' }));
    expect(screen.getByTestId('placement')).toHaveTextContent('4x1:3,0:1x1');

    fireEvent.click(screen.getByRole('button', { name: 'Minimize' }));
    expect(screen.getByTestId('mode')).toHaveTextContent('minimized');
    expect(screen.getByTestId('placement')).toHaveTextContent('4x1:3,0:1x1');

    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));
    expect(screen.getByTestId('mode')).toHaveTextContent('floating');
    expect(screen.getByTestId('placement')).toHaveTextContent('4x1:3,0:1x1');

    fireEvent.click(screen.getByRole('button', { name: 'Dock' }));
    expect(screen.getByTestId('mode')).toHaveTextContent('docked');
    expect(screen.getByTestId('placement')).toHaveTextContent('free');
  });

  it('does not render bottom dock chips for minimized panels and keeps inline restore reachable', () => {
    render(
      <WorkspacePanelProvider
        initialPanels={[
          {
            id: 'notes-workspace',
            title: 'Notes',
            mode: 'floating',
            geometry: { x: 320, y: 80, width: 560, height: 380 },
          },
          {
            id: 'tasks-workspace',
            title: 'Tasks',
            mode: 'floating',
            geometry: { x: 380, y: 120, width: 420, height: 340 },
          },
        ]}
      >
        <DockHarness />
      </WorkspacePanelProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Set Notes minimized' }));
    fireEvent.click(screen.getByRole('button', { name: 'Set Tasks minimized' }));

    expect(screen.queryByRole('region', { name: 'Workspace panel dock' })).not.toBeInTheDocument();
    expect(document.querySelector('[data-workspace-panel-dock-chip]')).toBeNull();

    const minimizedNotes = document.querySelector('[data-workspace-panel="notes-workspace"][data-workspace-panel-state="minimized"]');
    expect(minimizedNotes).toBeInTheDocument();
    expect(within(minimizedNotes as HTMLElement).getByRole('button', { name: 'Restore Notes panel' })).toBeInTheDocument();
    expect(within(minimizedNotes as HTMLElement).queryByText(/^Dock$/)).not.toBeInTheDocument();

    fireEvent.click(within(minimizedNotes as HTMLElement).getByRole('button', { name: 'Restore Notes panel' }));

    expect(screen.getByRole('dialog', { name: 'Notes panel' })).toHaveAttribute('data-workspace-panel-state', 'floating');
  });

  it('raises the last focused floating panel above earlier popouts', () => {
    render(
      <WorkspacePanelProvider
        initialPanels={[
          {
            id: 'notes-workspace',
            title: 'Notes',
            mode: 'floating',
            geometry: { x: 320, y: 80, width: 560, height: 380 },
          },
          {
            id: 'tasks-workspace',
            title: 'Tasks',
            mode: 'floating',
            geometry: { x: 380, y: 120, width: 420, height: 340 },
          },
        ]}
      >
        <ZOrderHarness />
      </WorkspacePanelProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Focus Notes' }));
    const notesAfterFocus = Number(screen.getByTestId('notes-z').textContent);
    const tasksBeforeFocus = Number(screen.getByTestId('tasks-z').textContent);
    expect(notesAfterFocus).toBeGreaterThan(tasksBeforeFocus);

    fireEvent.click(screen.getByRole('button', { name: 'Focus Tasks' }));
    const notesBeforeFocus = Number(screen.getByTestId('notes-z').textContent);
    const tasksAfterFocus = Number(screen.getByTestId('tasks-z').textContent);
    expect(tasksAfterFocus).toBeGreaterThan(notesBeforeFocus);
  });

  it('recovers floating panel geometry when the header starts above the reachable top edge', async () => {
    render(
      <WorkspacePanelProvider
        initialPanels={[{
          id: 'notes-workspace',
          title: 'Notes',
          mode: 'floating',
          geometry: { x: 320, y: -240, width: 560, height: 380 },
        }]}
      >
        <TopClampHarness />
      </WorkspacePanelProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('notes-y')).toHaveTextContent('16');
    });
    expect(screen.getByRole('dialog', { name: 'Notes panel' })).toHaveStyle({ top: '16px' });
  });

  it('reclamps floating panel geometry after the Workspace investigation layer mounts', async () => {
    render(
      <WorkspacePanelProvider
        initialPanels={[{
          id: 'notes-workspace',
          title: 'Notes',
          mode: 'floating',
          geometry: { x: 320, y: 72, width: 560, height: 380 },
        }]}
      >
        <DynamicWorkspaceHeaderClampHarness />
      </WorkspacePanelProvider>,
    );

    expect(screen.getByTestId('notes-y')).toHaveTextContent('72');
    fireEvent.click(screen.getByRole('button', { name: 'Show Workspace header' }));

    await waitFor(() => {
      expect(screen.getByTestId('notes-y')).toHaveTextContent('128');
    });
    expect(screen.getByRole('dialog', { name: 'Notes panel' })).toHaveStyle({ top: '128px' });
  });
});
