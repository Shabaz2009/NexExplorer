import { useEffect } from 'react';
import { useTabStore } from '../store/tabStore';
import { useExplorerStore } from '../store/explorerStore';

/**
 * Bidirectional sync between the active tab (tabStore) and the explorer view
 * (explorerStore).
 *
 * History — why this exists:
 *   Previously MainLayout had two opposing useEffects that read store values
 *   from their component-scope closures. Effect 1 (deps [activeTabId])
 *   omitted currentPath/viewMode from its dep array, which is both an
 *   exhaustive-deps smell and a stale-closure risk; adding them would have
 *   re-introduced a tab<->explorer echo.
 *
 * Design:
 *   We keep the two directions as two separate effects because their DEPENDENCY
 *   signals are what tell us the direction of a change:
 *     - effect A runs only when `activeTabId` changes  -> push tab  -> explorer
 *     - effect B runs only when path/viewMode changes  -> push explorer -> tab
 *   Each effect reads the OTHER side's current value live via the store's
 *   getState() instead of from a closure. That removes the stale-closure risk
 *   without adding dependencies that would cause an echo. Both effects keep a
 *   `!== current` guard so once the two sides agree they stop writing — this is
 *   what prevents a loop.
 *
 * Net behavior is identical to the original MainLayout logic; only the failure
 * modes (stale closure, lint smell, dead code in MainLayout) are removed.
 */
export function useTabExplorerSync() {
  // Subscribe only to the signal each effect needs to react to.
  const activeTabId = useTabStore((s) => s.activeTabId);
  const currentPath = useExplorerStore((s) => s.currentPath);
  const viewMode = useExplorerStore((s) => s.viewMode);

  // A) Active tab changed -> push tab's path/viewMode into the explorer.
  useEffect(() => {
    if (!activeTabId) return; // B36 guard: no active tab yet
    const { tabs, activeTabId: liveId } = useTabStore.getState();
    const activeTab = tabs.find((t) => t.id === liveId);
    if (!activeTab) return;

    const explorer = useExplorerStore.getState();
    if (activeTab.path !== explorer.currentPath) {
      explorer.setCurrentPath(activeTab.path);
    }
    if (activeTab.viewMode !== explorer.viewMode) {
      explorer.setViewMode(activeTab.viewMode);
    }
  }, [activeTabId]);

  // B) Explorer path/viewMode changed -> push into the active tab.
  useEffect(() => {
    const { tabs, activeTabId: liveId, updateActiveTab } = useTabStore.getState();
    const activeTab = tabs.find((t) => t.id === liveId);
    if (!activeTab) return;

    const patch: { path?: string; viewMode?: typeof viewMode } = {};
    if (activeTab.path !== currentPath) patch.path = currentPath;
    if (activeTab.viewMode !== viewMode) patch.viewMode = viewMode;
    if (Object.keys(patch).length > 0) {
      updateActiveTab(patch);
    }
  }, [currentPath, viewMode]);
}
