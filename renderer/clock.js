(function () {
  function updateClock() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();

    // Percentuali per le barre
    const hoursPercent = (hours / 24) * 100;
    const minutesPercent = (minutes / 60) * 100;
    const secondsPercent = (seconds / 60) * 100;

    // Aggiorna larghezze
    document.getElementById("hours").style.width = `${hoursPercent}%`;
    document.getElementById("minutes").style.width = `${minutesPercent}%`;
    document.getElementById("seconds").style.width = `${secondsPercent}%`;

    //every minute show notification
    if(seconds === 0) {
      showNotification("System Monitor", "Un minuto è passato!");
    }
  }

  window.addEventListener("cpuLoadUpdate", (e) => {
    const data = e.detail;
    let wrap = document.querySelector(".wrap");
    let dataValue = map(data.currentLoad, 0, 100, 0, 40);
    wrap.style.gap = `${dataValue}px`;
  });

  //create a map function from 0 to 360
  function map(value, min, max, minOut, maxOut) {
    return ((value - min) / (max - min)) * (maxOut - minOut) + minOut;
  }


  function showNotification(title, body) {
    if (Notification.permission === "granted") {
      new Notification(title, {
        body: body,
      });
    }
  }

  updateClock();
  setInterval(updateClock, 1000);
})();
