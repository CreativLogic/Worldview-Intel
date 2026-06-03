import { pluginManager } from "@/core/plugins/PluginManager";
import { useStore } from "@/core/state/store";

/**
 * Single source of truth for activating or deactivating a plugin layer's data lifecycle.
 * Shared by the UI (LayerPanel) and the agent command bridge (useGlobeCommandBridge)
 * so both paths trigger identical data loading and entity cleanup behaviour.
 *
 * UI-panel-only concerns (highlight layer, open config panel, active config tab,
 * analytics) are NOT handled here -- they stay in LayerPanel.
 */
export function setLayerActive(pluginId: string, enabled: boolean): void {
    const store = useStore.getState();
    if (enabled) {
        void pluginManager.enablePlugin(pluginId);
        store.setLayerEnabled(pluginId, true);
    } else {
        pluginManager.disablePlugin(pluginId);
        store.setLayerEnabled(pluginId, false);
        store.clearEntities(pluginId);
        store.setEntityCount(pluginId, 0);
        if (store.hoveredEntity?.pluginId === pluginId) {
            store.setHoveredEntity(null, null);
        }
        if (store.selectedEntity?.pluginId === pluginId) {
            store.setSelectedEntity(null);
        }
    }
}
