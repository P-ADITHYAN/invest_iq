/**
 * ruleEngine.js — Modular automated-rule (stop-loss / target / trailing)
 * evaluation engine. All actions here are virtual/simulated — no real
 * orders are ever placed. See spec §38-40.
 *
 * evaluateRules(account, symbol, newPrice, actions) checks every ACTIVE
 * alert attached to `symbol`, and for any rule whose condition is met:
 *   1. Executes a virtual sell of the full held quantity via actions.sellStock
 *   2. Marks the rule "triggered"
 *   3. Creates an in-app notification via actions.notify
 * matching the 6-stage flow: Rule -> Trigger -> Virtual Sell -> Holdings
 * Update -> Cash Update -> Transaction Record -> Notification (the
 * holdings/cash/transaction update all happen inside actions.sellStock,
 * which is provided by api.js against the same account object).
 */
(function (global) {
  "use strict";

  function conditionMet(rule, price) {
    switch (rule.ruleType) {
      case "stop_loss": return price <= rule.threshold;
      case "target": return price >= rule.threshold;
      case "pct_stop": return price <= rule.entryPrice * (1 - rule.threshold / 100);
      case "pct_target": return price >= rule.entryPrice * (1 + rule.threshold / 100);
      case "trailing_stop": return price <= rule.highestPrice * (1 - rule.threshold / 100);
      default: return false;
    }
  }

  function ruleLabel(rule) {
    switch (rule.ruleType) {
      case "stop_loss": return "Stop Loss @ " + UI.formatINR(rule.threshold);
      case "target": return "Target @ " + UI.formatINR(rule.threshold);
      case "pct_stop": return "Falls " + rule.threshold + "%";
      case "pct_target": return "Rises " + rule.threshold + "%";
      case "trailing_stop": return "Trailing Stop " + rule.threshold + "%";
      default: return rule.ruleType;
    }
  }

  function evaluateRules(account, symbol, newPrice, actions) {
    const holding = account.holdings[symbol];
    const entryPrice = holding ? holding.avgPrice : null;
    const triggeredRules = [];

    account.alerts.forEach(function (rule) {
      if (rule.symbol !== symbol || rule.status !== "active") return;
      rule.entryPrice = entryPrice != null ? entryPrice : rule.entryPrice;

      // Trailing-stop rules track the highest observed price since creation.
      if (rule.ruleType === "trailing_stop") {
        rule.highestPrice = Math.max(rule.highestPrice || newPrice, newPrice);
      }

      if (!holding || holding.quantity <= 0) return; // nothing left to protect

      if (conditionMet(rule, newPrice)) {
        const qty = holding.quantity;
        const txn = actions.sellStock(symbol, qty, newPrice);
        rule.status = "triggered";
        rule.triggeredAt = new Date().toISOString();
        rule.triggerPrice = newPrice;
        actions.notify(
          symbol + " " + ruleLabel(rule) + " Triggered",
          "Your virtual position in " + symbol + " was automatically sold because the configured condition (" + ruleLabel(rule) + ") was reached at " + UI.formatINR(newPrice) + "."
        );
        triggeredRules.push({ rule: rule, transaction: txn });
      }
    });

    return { symbol: symbol, price: newPrice, triggeredRules: triggeredRules };
  }

  global.RuleEngine = { evaluateRules: evaluateRules, ruleLabel: ruleLabel, conditionMet: conditionMet };
})(window);
