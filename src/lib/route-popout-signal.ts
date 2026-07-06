/**
 * Module-level signal for the current route-panel pop-out action.
 *
 * `RoutePanelPopOutSurface` publishes its callback here when it mounts/unmounts.
 * `ActiveFilterBar` subscribes to render the pop-out icon button.
 *
 * This pub/sub lives outside React because `ActiveFilterBar` (sibling above
 * `AppWorkspaceShell`) cannot receive context provided by `RoutePanelPopOutSurface`
 * (nested inside `AppWorkspaceShell`) — context only flows downward.
 */

export interface RoutePopOutSignalValue {
  label: string;
  onPopOut: () => void;
}

let _current: RoutePopOutSignalValue | null = null;
const _listeners = new Set<(v: RoutePopOutSignalValue | null) => void>();

export function getRoutePopOut(): RoutePopOutSignalValue | null {
  return _current;
}

export function setRoutePopOut(v: RoutePopOutSignalValue | null): void {
  _current = v;
  for (const fn of _listeners) fn(v);
}

/**
 * Subscribe to pop-out signal changes.
 * Immediately calls `fn` with the current value, then on every future change.
 * Returns an unsubscribe function.
 */
export function subscribeRoutePopOut(
  fn: (v: RoutePopOutSignalValue | null) => void,
): () => void {
  _listeners.add(fn);
  fn(_current);
  return () => _listeners.delete(fn);
}
