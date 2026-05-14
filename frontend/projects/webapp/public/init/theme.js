(function () {
  if (matchMedia("(prefers-color-scheme: dark)").matches) {
    document.documentElement.classList.add("dark-theme");
  }
})();
