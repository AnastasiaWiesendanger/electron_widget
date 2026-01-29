const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("API", {
  openSettings: () => ipcRenderer.send("open-settings"),
  getBattery: () => ipcRenderer.invoke("get-battery"),
  getCpuLoad: () => ipcRenderer.invoke("get-cpu"),
  getMemory: () => ipcRenderer.invoke("get-mem"),
  getCpuInfo: () => ipcRenderer.invoke("get-cpu-info"),
  getProcesses: () => ipcRenderer.invoke("get-processes"),
  getTimeInfo: () => ipcRenderer.invoke("get-time-info"),
  getMousePosition: () => ipcRenderer.invoke("get-mouse-position"),
});
// Listen for animation mode changes
ipcRenderer.on("animation-mode", (event, mode) => {
  // Send message to renderer process
  window.postMessage({ type: "animation-mode", mode: mode }, "*");
});