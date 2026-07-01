import { useContext } from 'react';
import {
  WorkspacePanelContext,
  type WorkspacePanelGeometry,
  type WorkspacePanelMode,
} from './workspace-panel-context';
import type { WorkspacePanelPlacementState } from './workspaceGrid';

export function useWorkspacePanels() {
  const context = useContext(WorkspacePanelContext);
  if (!context) {
    throw new Error('useWorkspacePanels must be used inside WorkspacePanelProvider');
  }

  return context;
}

export function useWorkspacePanel(id: string) {
  const context = useWorkspacePanels();
  const panel = context.getPanel(id);
  if (!panel) {
    throw new Error(`Workspace panel "${id}" is not registered`);
  }

  return {
    panel,
    setMode: (mode: WorkspacePanelMode) => context.setMode(id, mode),
    setGeometry: (geometry: WorkspacePanelGeometry) => context.setGeometry(id, geometry),
    setPlacement: (placement: WorkspacePanelPlacementState) => context.setPlacement(id, placement),
    focus: () => context.focusPanel(id),
    restore: () => context.restorePanel(id),
  };
}
