import { BrowserWindow, ApplicationMenu } from "electrobun/bun";
import { startServiceServer } from "./service-server";

const isDev = process.env.ELECTROBUN_BUILD_ENV === "dev";

startServiceServer();

// Native macOS application menu — must be set BEFORE creating BrowserWindow
// Required for Cmd+C/V/X/A/Z/Q to work in WebKit webviews
ApplicationMenu.setApplicationMenu([
  {
    // First item: no label (macOS uses CFBundleName automatically)
    submenu: [
      { role: "about" },
      { type: "separator" },
      { role: "hide" },
      { role: "hideOthers" },
      { role: "showAll" },
      { type: "separator" },
      { role: "quit" },
    ],
  },
  {
    label: "Edit",
    submenu: [
      { role: "undo" },
      { role: "redo" },
      { type: "separator" },
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      { role: "pasteAndMatchStyle" },
      { role: "delete" },
      { role: "selectAll" },
    ],
  },
  {
    label: "Window",
    submenu: [
      { role: "minimize" },
      { role: "zoom" },
      { role: "close" },
      { type: "separator" },
      { role: "toggleFullScreen" },
    ],
  },
]);

const mainWindow = new BrowserWindow({
  title: "Hudson",
  url: isDev ? "http://localhost:5188" : "views://mainview/index.html",
  frame: {
    x: 100,
    y: 100,
    width: 1400,
    height: 900,
  },
  titleBarStyle: "hiddenInset",
});
