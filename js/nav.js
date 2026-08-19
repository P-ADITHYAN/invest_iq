/**
 * nav.js — Injects the sidebar / topbar / bottom-nav app shell into any
 * page that includes a `<div id="appShell" data-page="...">` container,
 * highlights the active section, and enforces the auth guard for
 * protected pages (redirects to login.html if there is no active
 * session). Landing/login/signup pages do not use the shell.
 */
(function (global) {
  "use strict";

  const NAV_ITEMS = [
    { id: "dashboard", label: "Dashboard", href: "dashboard.html", icon: "grid" },
    { id: "recommendations", label: "Recommendations", href: "recommendations.html", icon: "target" },
    { id: "stocks", label: "Stocks", href: "stocks.html", icon: "trend" },
    { id: "portfolio", label: "Portfolio", href: "portfolio.html", icon: "pie" },
    { id: "trade", label: "Trade", href: "trade.html", icon: "swap" },
    { id: "transactions", label: "Transactions", href: "transactions.html", icon: "list" },
    { id: "alerts", label: "Alerts", href: "alerts.html", icon: "bell" },
    { id: "learn", label: "Learn", href: "learn.html", icon: "book" },
    { id: "account", label: "Profile", href: "account.html", icon: "user" }
  ];

  const ICONS = {
    grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
    target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="0.5"/></svg>',
    trend: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 17 9 11 13 15 21 6"/><polyline points="14 6 21 6 21 13"/></svg>',
    pie: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12A9 9 0 1 1 12 3v9z"/><path d="M12 3a9 9 0 0 1 9 9h-9z"/></svg>',
    swap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>'
  };

  function buildSidebar(activePage) {
    const links = NAV_ITEMS.map(function (item) {
      const active = item.id === activePage ? " active" : "";
      return (
        '<a class="sidebar-link' + active + '" href="' + item.href + '" aria-label="' + item.label + '">' +
        ICONS[item.icon] + '<span class="sidebar-label">' + item.label + "</span></a>"
      );
    }).join("");

    return (
      '<nav class="sidebar" aria-label="Primary">' +
      '<a href="dashboard.html" class="sidebar-logo" aria-label="' + CONFIG.APP_NAME + ' home">' + CONFIG.APP_NAME.charAt(0) + "</a>" +
      '<div class="sidebar-nav">' + links + "</div>" +
      '<button type="button" class="sidebar-link" id="navLogoutBtn" aria-label="Log out">' + ICONS.logout + '<span class="sidebar-label">Log out</span></button>' +
      "</nav>"
    );
  }

  function buildBottomNav(activePage) {
    const items = NAV_ITEMS.filter(function (i) {
      return ["dashboard", "recommendations", "stocks", "portfolio", "alerts"].indexOf(i.id) !== -1;
    });
    const links = items.map(function (item) {
      const active = item.id === activePage ? " active" : "";
      return '<a class="bottom-nav-link' + active + '" href="' + item.href + '">' + ICONS[item.icon] + "<span>" + item.label + "</span></a>";
    }).join("");
    return '<nav class="bottom-nav" aria-label="Primary"><div class="bottom-nav-inner">' + links + "</div></nav>";
  }

  function buildTopbar(session) {
    const initials = (session && session.name ? session.name.trim().charAt(0) : "U").toUpperCase();
    return (
      '<header class="topbar">' +
      '<div class="topbar-search"><span aria-hidden="true">🔍</span><span>Search stocks, e.g. TCS, HDFC Bank</span></div>' +
      '<div class="topbar-user">' +
      '<span class="demo-flag" id="dataSourceBadge" title="Checking data source...">Checking data...</span>' +
      '<div class="avatar">' + initials + "</div>" +
      "<div><div style=\"font-weight:600;font-size:var(--font-size-sm)\">" + UI.escapeHTML(session ? session.name : "Guest") + "</div></div>" +
      "</div></header>"
    );
  }

  function mount() {
    const shell = document.getElementById("appShell");
    if (!shell) return;
    const activePage = shell.getAttribute("data-page");
    const requiresAuth = shell.getAttribute("data-auth") !== "false";
    const session = Store.getSession();

    if (requiresAuth && !session) {
      window.location.href = "login.html";
      return;
    }

    shell.classList.add("app-shell");
    shell.insertAdjacentHTML("afterbegin", buildSidebar(activePage) + buildBottomNav(activePage));

    const main = document.createElement("div");
    main.className = "app-main";
    const existingContent = document.getElementById("pageContent");
    main.innerHTML = buildTopbar(session);
    if (existingContent) {
      existingContent.classList.add("app-content");
      main.appendChild(existingContent);
    }
    shell.appendChild(main);

    const logoutBtn = document.getElementById("navLogoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", function () {
        api.logout().then(function () {
          window.location.href = "index.html";
        });
      });
    }

    scheduleDataSourceBadgeUpdate();
    watchTopbarScroll();
  }

  // Toggles the glass/blur look on the sticky topbar once the page has
  // scrolled past a small threshold, so it reads as flat/opaque at the
  // very top (matching card backgrounds) and "lifts" once content is
  // moving underneath it.
  function watchTopbarScroll() {
    const topbar = document.querySelector(".topbar");
    if (!topbar) return;
    function update() {
      topbar.classList.toggle("topbar-scrolled", window.scrollY > 8);
    }
    update();
    window.addEventListener("scroll", update, { passive: true });
  }

  // MarketDataService.getStatus() only reflects reality after the page's
  // own data fetch resolves (nav.js mounts before that). Poll briefly so
  // the badge settles on "Live Data" / "Demo Data" instead of staying on
  // a placeholder — pages that never fetch stocks (e.g. Learn, Account)
  // will simply keep the last-known/default label.
  function scheduleDataSourceBadgeUpdate() {
    let attempts = 0;
    const maxAttempts = 6;
    const timer = setInterval(function () {
      attempts++;
      const badge = document.getElementById("dataSourceBadge");
      if (!badge) { clearInterval(timer); return; }

      if (typeof MarketDataService !== "undefined") {
        const status = MarketDataService.getStatus();
        if (status.lastCheckedAt) {
          badge.textContent = status.live ? "Live Data (Yahoo Finance)" : "Demo Data";
          badge.title = status.live
            ? "Prices and charts are live from Yahoo Finance. Fundamentals (P/E, ROE, etc.) are estimated demo figures."
            : (status.lastError ? "Live data unavailable (" + status.lastError + ") — showing demo data." : "Showing demo/sample data.");
          badge.classList.toggle("demo-flag-live", !!status.live);
          clearInterval(timer);
          return;
        }
      }
      if (attempts >= maxAttempts) {
        badge.textContent = "Demo Data";
        clearInterval(timer);
      }
    }, 400);
  }

  document.addEventListener("DOMContentLoaded", mount);

  global.Nav = { NAV_ITEMS, ICONS };
})(window);
