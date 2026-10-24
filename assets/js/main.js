"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const menuToggle = document.getElementById("menu-toggle");
  const navigation = document.getElementById("navigation");
  const year = document.getElementById("year");

  if (year) year.textContent = new Date().getFullYear();

  if (!menuToggle || !navigation) return;

  const closeMenu = (restoreFocus = false) => {
    const wasOpen = navigation.classList.contains("is-open");
    navigation.classList.remove("is-open");
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Open navigation");
    if (restoreFocus && wasOpen) menuToggle.focus();
  };

  menuToggle.addEventListener("click", () => {
    const isOpen = navigation.classList.toggle("is-open");
    menuToggle.setAttribute("aria-expanded", String(isOpen));
    menuToggle.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
  });

  navigation.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => closeMenu());
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeMenu(true);
  });

  document.addEventListener("pointerdown", event => {
    if (!navigation.contains(event.target) && !menuToggle.contains(event.target)) {
      closeMenu();
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 760) closeMenu();
  });
});
