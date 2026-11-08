import { Menu, type MenuItemConstructorOptions } from "electron";
import { BRAND, createTranslator, type Language } from "@transcript-editor/core";
import type { MenuCommand } from "@transcript-editor/storage";

export interface MenuDeps {
  language: Language;
  platform: NodeJS.Platform;
  isPackaged: boolean;
  updatesEnabled: boolean;
  hasWindow(): boolean;
  send(command: MenuCommand): void;
  openDocs(): void;
}

/**
 * Builds the application menu from the i18n dictionary. "Guardar" has NO accelerator on purpose:
 * `registerAccelerator` is not reliable on macOS, so the renderer's capture-phase handler owns
 * Ctrl/Cmd+S and the shortcut is only shown as text in the label.
 */
export function buildMenuTemplate(d: MenuDeps): MenuItemConstructorOptions[] {
  const t = createTranslator(d.language);
  const mac = d.platform === "darwin";
  const enabled = d.hasWindow();
  const shortcut = mac ? "Cmd+S" : "Ctrl+S";
  const template: MenuItemConstructorOptions[] = [];
  if (mac) template.push({ role: "appMenu" });
  template.push({
    label: t("menu.file"),
    submenu: [
      { label: t("menu.open"), accelerator: "CmdOrCtrl+O", click: () => d.send("open-folder") },
      { label: `${t("menu.save")}\t${shortcut}`, enabled, click: () => d.send("save") },
      { type: "separator" },
      mac ? { role: "close" } : { role: "quit", label: t("menu.quit") },
    ],
  });
  template.push({
    label: t("menu.edit"),
    submenu: [
      { role: "undo" },
      { role: "redo" },
      { type: "separator" },
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      { role: "selectAll" },
    ],
  });
  const view: MenuItemConstructorOptions[] = [
    { label: t("menu.toggleSidebar"), enabled, click: () => d.send("toggle-sidebar") },
    { type: "separator" },
    { role: "resetZoom" },
    { role: "zoomIn" },
    { role: "zoomOut" },
    { role: "togglefullscreen" },
  ];
  if (!d.isPackaged)
    view.push({ type: "separator" }, { role: "reload" }, { role: "toggleDevTools" });
  template.push({ label: t("menu.view"), submenu: view });
  const help: MenuItemConstructorOptions[] = [
    { label: t("menu.showHelp"), accelerator: "F1", enabled, click: () => d.send("show-help") },
    { label: t("menu.docs"), click: () => d.openDocs() },
  ];
  if (d.updatesEnabled)
    help.push({ label: t("menu.checkUpdates"), click: () => d.send("check-updates") });
  if (!mac) help.push({ type: "separator" }, { role: "about", label: BRAND.productName });
  template.push({ label: t("menu.help"), role: "help", submenu: help });
  return template;
}

export function installMenu(d: MenuDeps): void {
  Menu.setApplicationMenu(Menu.buildFromTemplate(buildMenuTemplate(d)));
}
