// Offline support (see sw.js). Browsers without service workers just skip it.
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js");

const button = document.getElementById("hello");
let taps = 0;
button.addEventListener("click", () => {
  taps++;
  button.textContent = `Tapped ${taps} ${taps === 1 ? "time" : "times"}`;
});
