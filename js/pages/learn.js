/**
 * pages/learn.js — Renders the 5 learning categories and their topics.
 */
(function () {
  "use strict";

  document.title = "Learn — " + CONFIG.APP_NAME;
  const root = document.getElementById("learnContent");

  root.innerHTML = LEARN_CATEGORIES.map(function (cat) {
    return (
      '<div>' +
      '<h3 style="margin-bottom:var(--space-3)">' + cat.title + "</h3>" +
      '<div class="grid grid-3">' +
      cat.topics.map(function (t) {
        return (
          '<a class="card" href="learn-topic.html?topic=' + t.slug + '" style="display:block">' +
          '<h4 style="margin-bottom:6px">' + t.title + "</h4>" +
          '<p class="text-muted" style="margin:0;font-size:var(--font-size-sm)">' + t.explanation.slice(0, 90) + "...</p>" +
          "</a>"
        );
      }).join("") +
      "</div></div>"
    );
  }).join("");
})();
