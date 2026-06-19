import type { WorkspacePanelState } from './WorkspacePanelProvider';

export function WorkspacePanelDock({
  onRestorePanel,
}: {
  onRestorePanel?: (panel: WorkspacePanelState) => void;
}) {
  void onRestorePanel;
  return null;
}
