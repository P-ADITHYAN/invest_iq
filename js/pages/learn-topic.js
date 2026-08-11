/**
 * pages/learn-topic.js — Single topic detail: explanation, example,
 * why it matters, common beginner mistake (spec §42).
 */
(function () {
  "use strict";

  const params = new URLSearchParams(window.location.search);
  const slug = params.get("topic");
  const root = document.getElementById("topicContent");

  let topic = null, category = null;
  LEARN_CATEGORIES.forEach(function (cat) {
    const found = cat.topics.find(function (t) { return t.slug === slug; });
    if (found) { topic = found; category = cat; }
  });

  if (!topic) {
    root.innerHTML = UI.errorState("Topic not found.");
  } else {
    document.title = topic.title + " — " + CONFIG.APP_NAME;
    root.innerHTML =
      '<span class="badge badge-neutral" style="margin-bottom:var(--space-3)">' + category.title + "</span>" +
      "<h1>" + topic.title + "</h1>" +
      '<div class="card stack-4" style="margin-top:var(--space-4)">' +
      section("Explanation", topic.explanation) +
      section("Example", topic.example) +
      section("Why it matters", topic.whyItMatters) +
      section("Common beginner mistake", topic.commonMistake, true) +
      "</div>";
  }

  function section(title, body, warn) {
    return (
      '<div>' +
      '<h4 style="margin-bottom:4px;' + (warn ? "color:var(--color-warning)" : "") + '">' + title + "</h4>" +
      '<p style="margin:0">' + body + "</p>" +
      "</div>"
    );
  }
})();
