/* eslint-disable react-refresh/only-export-components -- geometry helpers + hooks are co-located with the provider by design */
import {
  useCallback,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from 'react';
import {
  WorkspacePanelContext,
  freeWorkspacePanelPlacement,
  type SeamEdge,
  type WorkspacePanelContextValue,
  type WorkspacePanelGeometry,
  type WorkspacePanelMode,
  type WorkspacePanelRegistration,
  type WorkspacePanelState,
} from './workspace-panel-context';
import type { WorkspacePanelPlacementState } from './workspaceGrid';

interface WorkspacePanelStore {
  panels: Record<string, WorkspacePanelState>;
  defaultGeometries: Record<string, WorkspacePanelGeometry>;
  zCursor: number;
}

const WORKSPACE_PANEL_Z_INDEX_BASE = 120;
const STALE_LAYOUT_MIN_WIDTH = 240;
const STALE_LAYOUT_MIN_HEIGHT = 180;

type WorkspacePanelAction =
  | { type: 'set-mode'; id: string; mode: WorkspacePanelMode }
  | { type: 'set-geometry'; id: string; geometry: WorkspacePanelGeometry }
  | { type: 'set-placement'; id: string; placement: WorkspacePanelPlacementState }
  | { type: 'focus'; id: string }
  | { type: 'apply-layout'; panels: Array<Pick<WorkspacePanelState, 'id' | 'mode' | 'restoreMode' | 'geometry'>> };

function createInitialStore(initialPanels: WorkspacePanelRegistration[]): WorkspacePanelStore {
  const defaultGeometries: Record<string, WorkspacePanelGeometry> = {};
  const panels = initialPanels.reduce<Record<string, WorkspacePanelState>>((accumulator, panel, index) => {
    const mode = panel.mode ?? 'docked';
    defaultGeometries[panel.id] = panel.geometry;
    accumulator[panel.id] = {
      id: panel.id,
      title: panel.title,
      mode,
      geometry: panel.geometry,
      zIndex: WORKSPACE_PANEL_Z_INDEX_BASE + index,
      restoreMode: mode === 'minimized' ? 'docked' : mode,
      placement: freeWorkspacePanelPlacement,
    };
    return accumulator;
  }, {});

  return {
    panels,
    defaultGeometries,
    zCursor: WORKSPACE_PANEL_Z_INDEX_BASE + initialPanels.length,
  };
}

export function fitWorkspacePanelGeometryToCompactDefault(
  geometry: WorkspacePanelGeometry,
  defaultGeometry: WorkspacePanelGeometry,
): WorkspacePanelGeometry {
  const staleGeometry = geometry.width <= STALE_LAYOUT_MIN_WIDTH
    || geometry.height <= STALE_LAYOUT_MIN_HEIGHT
    || !Number.isFinite(geometry.x)
    || !Number.isFinite(geometry.y)
    || !Number.isFinite(geometry.width)
    || !Number.isFinite(geometry.height);

  if (staleGeometry) {
    return { ...defaultGeometry };
  }

  return {
    x: Math.round(geometry.x),
    y: Math.round(geometry.y),
    width: Math.round(geometry.width),
    height: Math.round(geometry.height),
  };
}

function workspacePanelReducer(state: WorkspacePanelStore, action: WorkspacePanelAction): WorkspacePanelStore {
  switch (action.type) {
    case 'set-mode': {
      const panel = state.panels[action.id];
      if (!panel) return state;
      const nextZCursor = action.mode === 'floating' ? state.zCursor + 1 : state.zCursor;
      return {
        ...state,
        zCursor: nextZCursor,
        panels: {
          ...state.panels,
          [action.id]: {
            ...panel,
            mode: action.mode,
            zIndex: action.mode === 'floating' ? nextZCursor : panel.zIndex,
            placement: action.mode === 'docked' ? freeWorkspacePanelPlacement : panel.placement,
            restoreMode: action.mode === 'minimized'
              ? panel.mode === 'minimized'
                ? panel.restoreMode
                : panel.mode
              : action.mode,
          },
        },
      };
    }

    case 'set-geometry': {
      const panel = state.panels[action.id];
      if (!panel) return state;
      return {
        ...state,
        panels: {
          ...state.panels,
          [action.id]: {
            ...panel,
            geometry: action.geometry,
          },
        },
      };
    }

    case 'set-placement': {
      const panel = state.panels[action.id];
      if (!panel) return state;
      return {
        ...state,
        panels: {
          ...state.panels,
          [action.id]: {
            ...panel,
            placement: action.placement,
          },
        },
      };
    }

    case 'focus': {
      const panel = state.panels[action.id];
      if (!panel) return state;
      const nextZCursor = state.zCursor + 1;
      return {
        ...state,
        zCursor: nextZCursor,
        panels: {
          ...state.panels,
          [action.id]: {
            ...panel,
            zIndex: nextZCursor,
          },
        },
      };
    }

    case 'apply-layout': {
      const nextPanels = { ...state.panels };
      let nextZCursor = state.zCursor;

      action.panels.forEach((layoutPanel) => {
        const current = nextPanels[layoutPanel.id];
        if (!current) return;
        const defaultGeometry = state.defaultGeometries[layoutPanel.id] ?? current.geometry;
        nextZCursor += 1;
        nextPanels[layoutPanel.id] = {
          ...current,
          mode: layoutPanel.mode,
          restoreMode: layoutPanel.restoreMode,
          geometry: fitWorkspacePanelGeometryToCompactDefault(layoutPanel.geometry, defaultGeometry),
          placement: freeWorkspacePanelPlacement,
          zIndex: nextZCursor,
        };
      });

      return {
        ...state,
        zCursor: nextZCursor,
        panels: nextPanels,
      };
    }

    default:
      return state;
  }
}

export function WorkspacePanelProvider({
  children,
  initialPanels,
}: {
  children: ReactNode;
  initialPanels: WorkspacePanelRegistration[];
}) {
  const [store, dispatch] = useReducer(workspacePanelReducer, initialPanels, createInitialStore);
  const panels = useMemo(() => Object.values(store.panels), [store.panels]);
  const [activeSeamEdges, setActiveSeamEdges] = useState<ReadonlyMap<string, SeamEdge>>(new Map());
  const notifySeamEdge = useCallback((panelId: string, edge: SeamEdge | null) => {
    setActiveSeamEdges((prev) => {
      const next = new Map(prev);
      if (edge === null) next.delete(panelId);
      else next.set(panelId, edge);
      return next;
    });
  }, []);
  const allowedPanelIds = useMemo(
    () => new Set(initialPanels.map((panel) => panel.id)),
    [initialPanels],
  );

  const value = useMemo<WorkspacePanelContextValue>(() => ({
    panels,
    allowedPanelIds,
    activeSeamEdges,
    notifySeamEdge,
    getPanel: (id) => store.panels[id] ?? null,
    setMode: (id, mode) => dispatch({ type: 'set-mode', id, mode }),
    setGeometry: (id, geometry) => dispatch({ type: 'set-geometry', id, geometry }),
    setPlacement: (id, placement) => dispatch({ type: 'set-placement', id, placement }),
    focusPanel: (id) => dispatch({ type: 'focus', id }),
    restorePanel: (id) => {
      const panel = store.panels[id];
      if (!panel) return;
      dispatch({ type: 'set-mode', id, mode: panel.restoreMode });
    },
    applyLayoutPanels: (layoutPanels) => dispatch({ type: 'apply-layout', panels: layoutPanels }),
  }), [activeSeamEdges, allowedPanelIds, notifySeamEdge, panels, store.panels]);

  return (
    <WorkspacePanelContext.Provider value={value}>
      {children}
    </WorkspacePanelContext.Provider>
  );
}

export type {
  SeamEdge,
  WorkspacePanelGeometry,
  WorkspacePanelMode,
  WorkspacePanelRegistration,
  WorkspacePanelState,
} from './workspace-panel-context';
