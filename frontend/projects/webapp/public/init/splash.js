(function () {
  var frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  var el = document.getElementById("pulpe-splash-braille");
  if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var i = 0;
  var intervalId = setInterval(function () {
    if (!el.isConnected) {
      clearInterval(intervalId);
      return;
    }
    i = (i + 1) % frames.length;
    el.textContent = frames[i];
  }, 80);
})();
