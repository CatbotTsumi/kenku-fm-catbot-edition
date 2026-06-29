import { store } from "../../app/store";
import { getDrawerWidth } from "../../common/ActionDrawer";
import { showWindowControls } from "../../common/showWindowControls";

export function getBounds() {
  const controls = document.getElementById("controls");
  const y = controls?.clientHeight || 0;
  const collapsed =
    showWindowControls && store.getState().settings.sidebarCollapsed;
  const width = getDrawerWidth(collapsed);
  return {
    x: width,
    y,
    width: window.innerWidth - width,
    height: window.innerHeight - y,
  };
}
