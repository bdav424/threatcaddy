import { createContext, useContext } from 'react';

export interface RoutePopOutValue {
  label: string;
  onPopOut: () => void;
}

/** Provided by RoutePanelPopOutSurface-less wrappers (e.g. ChatWorkspacePanel) so the
 *  panel content can render the Pop out button inline in its own toolbar. */
export const RoutePopOutContext = createContext<RoutePopOutValue | null>(null);

export function useRoutePopOut(): RoutePopOutValue | null {
  return useContext(RoutePopOutContext);
}
