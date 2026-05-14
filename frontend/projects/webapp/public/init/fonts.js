(function () {
  var link = document.getElementById("material-symbols-link");
  if (!link) return;
  function activate() {
    if (link.media !== "all") link.media = "all";
  }
  if (link.sheet) {
    activate();
    return;
  }
  link.addEventListener("load", activate, { once: true });
  link.addEventListener("error", activate, { once: true });
  setTimeout(activate, 3000);
})();
