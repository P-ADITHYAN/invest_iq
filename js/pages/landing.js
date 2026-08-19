/**
 * pages/landing.js — Landing page controller: branding injection, sticky
 * nav glass state on scroll, and a lightweight IntersectionObserver that
 * reveals `.reveal` sections (with optional `.stagger` children) as they
 * scroll into view. No animation library — just CSS transitions toggled
 * by an `in-view` class.
 */
(function () {
  "use strict";

  document.getElementById("brandName").textContent = CONFIG.APP_NAME;
  document.getElementById("brandMark").textContent = CONFIG.APP_NAME.charAt(0);
  document.title = CONFIG.APP_NAME + " — " + CONFIG.APP_TAGLINE;
  document.getElementById("year").textContent = new Date().getFullYear();
  document.querySelector(".hero-ctas .btn-primary").href = Store.getSession() ? "dashboard.html" : "signup.html";

  // ---- Sticky nav glass state ----
  const nav = document.getElementById("landingNav");
  function updateNav() {
    nav.classList.toggle("nav-scrolled", window.scrollY > 8);
  }
  updateNav();
  window.addEventListener("scroll", updateNav, { passive: true });

  // ---- Scroll-reveal ----
  // `.reveal` blocks (single elements like a section title or CTA band)
  // fade in as a whole via a CSS transition (see landing.css).
  // `.stagger` grids (steps/features) instead get the keyframe
  // `anim-fade-in-up` animation added to each child, so the existing
  // `.stagger > :nth-child(n)` animation-delay rule in base.css staggers
  // them one after another instead of all appearing in one block.
  const revealTargets = document.querySelectorAll(".reveal");
  const staggerTargets = document.querySelectorAll(".stagger");

  function revealEl(el) { el.classList.add("in-view"); }
  function staggerEl(el) {
    Array.prototype.forEach.call(el.children, function (child) {
      child.classList.add("anim-fade-in-up");
    });
  }

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        if (entry.target.classList.contains("stagger")) staggerEl(entry.target);
        else revealEl(entry.target);
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
    revealTargets.forEach(function (el) { observer.observe(el); });
    staggerTargets.forEach(function (el) { observer.observe(el); });
  } else {
    // No IntersectionObserver support — just show everything immediately.
    revealTargets.forEach(revealEl);
    staggerTargets.forEach(staggerEl);
  }
})();
