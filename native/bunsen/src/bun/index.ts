import { BrowserWindow } from "electrobun/bun";

const isDev = process.env.NODE_ENV !== "production";

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
