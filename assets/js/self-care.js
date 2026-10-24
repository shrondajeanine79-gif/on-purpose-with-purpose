"use strict";
document.querySelectorAll(".print-guide").forEach(button => {
  button.hidden = false;
  button.addEventListener("click", () => window.print());
});
