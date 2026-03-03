import { BrowserWindow } from "electrobun/bun";
import { startServiceServer } from "./service-server";

const isDev = process.env.ELECTROBUN_BUILD_ENV === "dev";

startServiceServer();

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
