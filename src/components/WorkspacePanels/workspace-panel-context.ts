import { createContext } from 'react';
import type { WorkspacePanelPlacementState } from './workspaceGrid';

export type WorkspacePanelMode = 'docked' | 'floating' | 'minimized';

export const freeWorkspacePanelPlacement: WorkspacePanelPlacementState = { kind: 'free' };

export interface WorkspacePanelGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WorkspacePanelState {
  id: string;
  title: string;
  mode: WorkspacePanelMode;
  geometry: WorkspacePanelGeometry;
  zIndex: number;
  restoreMode: Exclude<WorkspacePanelMode, 'minimized'>;
  placement: WorkspacePanelPlacementState;
}

export interface WorkspacePanelRegistration {
  id: string;
  title: string;
  mode?: WorkspacePanelMode;
  geometry: WorkspacePanelGeometry;
}

export interface WorkspacePanelContextValue {
  panels: WorkspacePanelState[];
  allowedPanelIds: ReadonlySet<string>;
  getPanel: (id: string) => WorkspacePanelState | null;
  setMode: (id: string, mode: WorkspacePanelMode) => void;
  setGeometry: (id: string, geometry: WorkspacePanelGeometry) => void;
  setPlacement: (id: string, placement: WorkspacePanelPlacementState) => void;
  focusPanel: (id: string) => void;
  restorePanel: (id: string) => void;
  applyLayoutPanels: (panels: Array<Pick<WorkspacePanelState, 'id' | 'mode' | 'restoreMode' | 'geometry'>>) => void;
}

export const WorkspacePanelContext = createContext<WorkspacePanelContextValue | null>(null);
