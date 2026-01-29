if (Notification.permission !== "granted") {
  Notification.requestPermission().then(permission => {
    if (permission === "granted") {
      console.log("Notifiche abilitate");
    }
  });
}

// Animation mode: 'purple' (img) or 'green' (img2)
let currentAnimationMode = 'purple';

// Map container names to their purple/green variants
const containerModes = {
  'container-zero': { purple: 'container-zero', green: 'container-zero-green' },
  'container-panick': { purple: 'container-panick', green: 'container-panick-green' },
  'container-worry': { purple: 'container-worry', green: 'container-worry-green' },
  'container-time-clock': { purple: 'container-time-clock', green: 'container-time-clock-green' },
  'container-time-clock-2': { purple: 'container-time-clock-2', green: 'container-time-clock-2-green' },
  'container-asleep': { purple: 'container-asleep', green: 'container-asleep-green' },
};

// Listen for animation mode changes from main process
window.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'animation-mode') {
    console.log('Received message:', event.data);
    switchAnimationMode(event.data.mode);
  }
});

// IPC listener for animation mode changes
if (window.electronAPI && window.electronAPI.onAnimationMode) {
  window.electronAPI.onAnimationMode((mode) => {
    switchAnimationMode(mode);
  });
}

function switchAnimationMode(mode) {
  if (mode !== 'purple' && mode !== 'green') return;
  console.log('Switching to mode:', mode);
  currentAnimationMode = mode;
  
  // Hide all containers
  document.querySelectorAll('[data-container]').forEach(el => {
    el.classList.remove('visible');
    el.classList.add('hidden');
    el.style.display = 'none';
  });
  
  // Re-apply current state with new animation mode
  if (asleepActive) {
    setActiveContainer('container-asleep');
  } else {
    handleBatterySwitch(latestBattery);
  }
}

function formatTime(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hrs.toString().padStart(2, "0")}:${mins
    .toString()
    .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

//variable font
const font = document.getElementById("font");
let fontWeight = 32,
  fontSlant = 0,
  fontWidth = 100;

// Time-trigger state
let latestBattery = null;
let lastFiveTrigger = 0; // timestamp of last 5-minute trigger
let lastHourTrigger = 0; // timestamp of last hourly trigger
let tempActiveUntil = 0; // timestamp until which temporary container is active
let tempTimeoutId = null;
// Inactivity (asleep) state
let lastMousePos = { x: null, y: null };
let lastMouseMoveAt = Date.now();
let asleepActive = false;
const ASLEEP_TIMEOUT_MS = 180 * 1000; // 30 seconds

async function updateStats() {
  try {
    const battery = await window.API.getBattery();
    const cpuLoad = await window.API.getCpuLoad();
    const mem = await window.API.getMemory();
    const cpuInfo = await window.API.getCpuInfo();
    const processes = await window.API.getProcesses();
    const timeInfo = await window.API.getTimeInfo();

    //questa funzione serve per inviare a clock il suo valore
    window.dispatchEvent(new CustomEvent("batteryUpdate", { detail: battery }));
    window.dispatchEvent(new CustomEvent("cpuLoadUpdate", { detail: cpuLoad }));

    // Battery (guard element in case it's not present in the DOM)
    const batteryEl = document.getElementById("battery");
    if (batteryEl) {
      batteryEl.innerText = battery.hasBattery
        ? battery.percent.toFixed(0)
        : "N/A";
    }

    // Keep latest battery for restoring after temporary states
    latestBattery = battery;

    // Critical battery states (worry/panick) always override asleep
    const percent = Number(battery.percent || 0);
    if (battery.hasBattery && (percent < 20 || percent < 10)) {
      if (asleepActive) {
        asleepActive = false;
        handleBatterySwitch(battery);
      }
    }

    // Switch containers when battery is low (only if no temporary time display active and not asleep)
    if (Date.now() > tempActiveUntil && !asleepActive) {
      handleBatterySwitch(battery);
    }

    // Check time triggers (use system time) — show temporary containers
    const now = new Date();
    checkTimeTriggers(now);

    // CPU Load
    const cpuPercent = cpuLoad.currentLoad.toFixed(1);
    document.getElementById("cpu").innerText = cpuPercent;

    // RAM Usage
    const ramPercent = ((mem.active / mem.total) * 100).toFixed(1);
    document.getElementById("ram").innerText = ramPercent;

    // CPU Thermometer
    document.getElementById("cpu-thermometer-label").innerText =
      cpuPercent + "%";

    // Uptime
    document.getElementById("uptime").innerText = formatTime(timeInfo.uptime);
    fontSlant = mapRange(cpuPercent, 0, 100, 0, 24);

    // Time now not timeInfo
    let timeNow = new Date();
    document.getElementById("time").innerText = formatTime(
      timeNow.getHours() * 3600 +
        timeNow.getMinutes() * 60 +
        timeNow.getSeconds()
    );
  } catch (err) {
    console.error("Errore nel caricamento statistiche:", err);
  }
}

// Set active container by class name
function setActiveContainer(containerClass) {
  // Get the actual container to show based on current animation mode
  const actualContainerClass = containerModes[containerClass] 
    ? containerModes[containerClass][currentAnimationMode]
    : containerClass;
  
  // Hide all containers
  document.querySelectorAll('[data-container]').forEach(el => {
    el.classList.add('hidden');
    el.classList.remove('visible');
    el.style.display = 'none';
  });
  // Show only the active one
  const active = document.querySelector(`.${actualContainerClass}`);
  if (active) {
    active.classList.remove('hidden');
    active.classList.add('visible');
    active.style.display = 'block';
  }
}

// Audio handling: load `data-sound` for containers and control playback on visibility
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-container]').forEach(el => {
    const src = el.getAttribute('data-sound');
    if (!src) return;
    const audio = new Audio(src);
    audio.preload = 'auto';
    audio.loop = false; // play once per animation start
    audio.volume = 0.8;
    el._audio = audio;
  });
});

// Enhance setActiveContainer behavior to play/pause audio when containers change
const _origSetActiveContainer = setActiveContainer;
setActiveContainer = function(containerClass) {
  // call original to toggle classes
  _origSetActiveContainer(containerClass);

  // handle audio: play for visible container, pause/reset others
  document.querySelectorAll('[data-container]').forEach(el => {
    const a = el._audio;
    if (!a) return;
    if (el.classList.contains('visible')) {
      try {
        a.play().catch(()=>{
          // autoplay may be blocked; ignore silently for now
        });
      } catch (e) {
        // ignore
      }
    } else {
      a.pause();
      // do not reset currentTime so the audio can continue/last longer across visibility changes
    }
  });
};

function handleBatterySwitch(battery) {
  if (!battery || !battery.hasBattery) {
    // Only override asleep if not currently asleep
    if (!asleepActive) {
      setActiveContainer('container-zero');
    }
    return;
  }
  const percent = Number(battery.percent || 0);
  // Critical battery states always override asleep
  if (percent < 20) {
    asleepActive = false; // force wake for critical state
    setActiveContainer('container-panick');
  } else if (percent < 10) {
    asleepActive = false; // force wake for critical state
    setActiveContainer('container-worry');
  } else {
    // Non-critical: only switch if not asleep
    if (!asleepActive) {
      setActiveContainer('container-zero');
    }
  }
}

// Show a temporary container for `durationMs` milliseconds, then restore based on battery
// Skipped if asleep (inactivity takes precedence over time triggers)
function showTemporaryContainer(containerClass, durationMs) {
  // Do not interrupt asleep state with time-based displays
  if (asleepActive) return;

  // Clear any existing temp timeout
  if (tempTimeoutId) {
    clearTimeout(tempTimeoutId);
    tempTimeoutId = null;
  }

  // Activate temporary container and set suppression window for battery switching
  setActiveContainer(containerClass);
  tempActiveUntil = Date.now() + durationMs + 200; // small buffer so updateStats won't immediately revert

  tempTimeoutId = setTimeout(() => {
    tempTimeoutId = null;
    tempActiveUntil = 0;
    // restore to battery-determined state using latestBattery
    try {
      handleBatterySwitch(latestBattery);
    } catch (e) {
      // fallback
      setActiveContainer('container-zero');
    }
  }, durationMs);
}

// Check current clock and fire temporary containers:
// - container-time-clock: every 5 minutes (minute % 5 === 0) at second 0, lasts 2s
// - container-time-clock-2: every hour (minute === 0) at second 0, lasts 1s
function checkTimeTriggers(now) {
  if (!now || !(now instanceof Date)) now = new Date();
  const ms = Date.now();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();

  // Hourly takes priority
  if (minutes === 0 && seconds === 0) {
    // prevent multiple triggers within short interval
    if (ms - lastHourTrigger > 2000) {
      lastHourTrigger = ms;
      showTemporaryContainer('container-time-clock-2', 1000);
    }
    return;
  }

  // Every 1 minutes at second 0
  if (minutes % 1 === 0 && seconds === 0) {
    if (ms - lastFiveTrigger > 3000) {
      lastFiveTrigger = ms;
      showTemporaryContainer('container-time-clock', 1000);
    }
  }
}

async function showMouseCoords() {
  const pos = await window.API.getMousePosition();
  // console.log(`Mouse: x=${pos.x}, y=${pos.y}`);
  const mouseEl = document.getElementById("mouse-coords");
  if (mouseEl) mouseEl.innerText = `X: ${pos.x}, Y: ${pos.y}`;
  fontWeight = mapRange(pos.x, 0, 1500, 32, 120);

  // Inactivity detection: compare with last known position
  const moved = lastMousePos.x !== pos.x || lastMousePos.y !== pos.y;
  if (moved) {
    lastMousePos.x = pos.x;
    lastMousePos.y = pos.y;
    lastMouseMoveAt = Date.now();
    // If we were asleep, wake up and restore state based on battery
    if (asleepActive) {
      asleepActive = false;
      // cancel any temporary suppression
      tempActiveUntil = 0;
      if (tempTimeoutId) {
        clearTimeout(tempTimeoutId);
        tempTimeoutId = null;
      }
      try {
        handleBatterySwitch(latestBattery);
      } catch (e) {
        setActiveContainer('container-zero');
      }
    }
  } else {
    // No movement: if timeout exceeded and not already asleep, activate asleep
    if (!asleepActive && Date.now() - lastMouseMoveAt > ASLEEP_TIMEOUT_MS) {
      asleepActive = true;
      setActiveContainer('container-asleep');
    }
  }
}

//create
function mapRange(value, a, b, c, d) {
  value = (value - a) / (b - a);
  return c + value * (d - c);
}

setInterval(showMouseCoords, 10);
setInterval(updateStats, 500);
updateStats();
