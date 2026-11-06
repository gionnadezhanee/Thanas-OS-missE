export interface MenuItem {
  label?: string;
  shortcut?: string;
  action?: () => void;
  separator?: boolean;
}

export interface AppMenus {
  File?: MenuItem[];
  Edit?: MenuItem[];
  View?: MenuItem[];
  Window?: MenuItem[];
}

export interface AppConfig {
  id: string;
  name: string;
  icon: string;
  component: React.ComponentType<{ window?: WindowState }>;
  defaultSize?: { width: number; height: number };
  minSize?: { width: number; height: number };
  maxSize?: { width: number; height: number };
  /** Window cannot be resized (hides resize handles). */
  nonResizable?: boolean;
  /** Hide the green traffic light (no maximize). */
  noMaximize?: boolean;
  /**
   * 'default' (with title bar + name), 'transparent' (title bar visible w/ chromeColor, no text),
   * or 'integrated' (no title bar; traffic lights overlaid as floating buttons over the app content).
   */
  chromeMode?: 'default' | 'transparent' | 'integrated';
  /** Background color for the title bar when chromeMode === 'transparent'. */
  chromeColor?: string;
}

export interface OpenAppOptions {
  /** Open an additional window instead of toggling the app's main window. */
  newWindow?: boolean;
  messageId?: string;
  size?: { width: number; height: number };
}

export interface WindowState {
  id: string;
  appId: string;
  messageId?: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  isMinimized: boolean;
  isMaximized: boolean;
  zIndex: number;
  preMaximizePosition?: { x: number; y: number };
  preMaximizeSize?: { width: number; height: number };
}

export interface MacOSSettings {
  wallpaper: string;
  customWallpaper?: string; // data URL
  theme: 'light' | 'dark';
  dockAutoHide: boolean;
  dockMagnification: number;
  reducedMotion: boolean;
  brightness?: number;
  volume?: number;
  wifi?: boolean;
  bluetooth?: boolean;
  airdrop?: boolean;
  focus?: boolean;
  doNotDisturb?: boolean;
  lowPowerMode?: boolean;
}

export interface DockItem {
  appId: string;
  badge?: number;
}

// Cross-app menu registry — apps publish their menus here, MenuBar reads them.
type MenuRegistry = Record<string, AppMenus>;
const registry: MenuRegistry = {};
const subs = new Set<() => void>();

export const registerAppMenus = (appId: string, menus: AppMenus | null) => {
  if (menus) registry[appId] = menus;
  else delete registry[appId];
  subs.forEach(fn => fn());
};
export const getAppMenus = (appId: string): AppMenus | undefined => registry[appId];
export const subscribeMenuRegistry = (fn: () => void) => {
  subs.add(fn);
  return () => { subs.delete(fn); };
};
