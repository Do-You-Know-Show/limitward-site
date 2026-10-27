/* Firm rule presets. Every preset carries its source and the date it was last checked.
   Rules change often: always tell users to confirm with the firm. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Presets = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var TOPSTEP_SRC = 'https://help.topstep.com/en/articles/8284204-what-is-the-maximum-loss-limit';
  var FTMO_SRC = 'https://ftmo.com/en/trading-objectives/';
  return {
    firms: [
      {
        id: 'topstep',
        name: 'Topstep',
        label: 'Topstep Combine',
        product: 'Trading Combine (futures)',
        verified: '2026-10-20',
        source: TOPSTEP_SRC,
        summary: 'The Maximum Loss Limit (MLL) trails your end-of-day balance upward, never moves down, and locks once it reaches your starting balance. Open (unrealized) losses count in real time.',
        notes: [
          'Monitored in real time, but the floor only updates at the end of each trading day.',
          'Both realized and unrealized P&L count toward the limit.',
          'On breach the Combine account is liquidated and you must Reset before funding.'
        ],
        accounts: [
          { label: '$50K', start: 50000, maxLoss: 2000 },
          { label: '$100K', start: 100000, maxLoss: 3000 },
          { label: '$150K', start: 150000, maxLoss: 4500 }
        ],
        faq: [
          { q: 'How does the Topstep Maximum Loss Limit work?', a: 'In the Trading Combine the Maximum Loss Limit starts $2,000, $3,000 or $4,500 below the account size (for the $50K, $100K and $150K accounts). It rises as your end-of-day balance grows and never moves down.' },
          { q: 'Do open (unrealized) losses count toward the Topstep limit?', a: 'Yes. According to Topstep, both realized and unrealized profit and loss count toward the Maximum Loss Limit, so an open loss that reaches the limit can trigger liquidation.' },
          { q: 'When does the Topstep Maximum Loss Limit stop trailing?', a: 'In the Trading Combine it locks permanently once it reaches your starting balance.' }
        ],
        rule: { model: 'trailing_eod' }
      },
      {
        id: 'topstep-xfa',
        name: 'Topstep',
        label: 'Topstep Express Funded',
        product: 'Express Funded Account (futures)',
        verified: '2026-10-20',
        source: TOPSTEP_SRC,
        summary: 'On the Express Funded Account the balance starts at $0 and the Maximum Loss Limit starts below it. It trails your end-of-day balance upward and locks at $0 once your balance reaches the starting limit amount, or after your first payout.',
        notes: [
          'The balance starts at $0, so the limit starts at -$2,000, -$3,000 or -$4,500 for the $50K, $100K and $150K accounts. This calculator uses the account size as the starting balance, which gives the same distances.',
          'The limit locks at $0 (your starting balance in this calculator) once your balance reaches the starting limit amount, and also after your first payout. After a payout, use Custom rules with a static limit if you need to model it.',
          'Both realized and unrealized P&L count toward the limit. On breach the Express Funded Account is permanently closed (Topstep says a Back2Funded option may be available if you are eligible).'
        ],
        accounts: [
          { label: '$50K', start: 50000, maxLoss: 2000 },
          { label: '$100K', start: 100000, maxLoss: 3000 },
          { label: '$150K', start: 150000, maxLoss: 4500 }
        ],
        faq: [
          { q: 'How is the Topstep Express Funded limit different from the Combine?', a: 'The mechanics are the same end-of-day trailing limit, but the Express Funded Account balance starts at $0 and the limit starts below it. It locks at $0 once your balance reaches the starting limit amount, and also after your first payout.' },
          { q: 'What happens if I breach the limit on an Express Funded Account?', a: 'According to Topstep, the account is permanently closed. A Back2Funded option may be available if you are eligible.' },
          { q: 'Do unrealized losses count on the Express Funded Account?', a: 'Yes. Topstep says both realized and unrealized profit and loss count toward the Maximum Loss Limit.' }
        ],
        rule: { model: 'trailing_eod' }
      },
      {
        id: 'ftmo',
        name: 'FTMO',
        label: 'FTMO 2-Step',
        product: '2-Step Challenge (forex / CFD)',
        verified: '2026-10-20',
        source: FTMO_SRC,
        summary: 'Max Daily Loss is 5% of initial capital, measured on equity and recalculated at 00:00 CE(S)T from your balance at that time. Max Loss is a static 10% of initial capital.',
        notes: [
          'Daily loss is measured on equity: balance + open P/L ± swaps – commissions.',
          'The max loss floor is static: it does not move up with profits.',
          'The same percentages apply to the Challenge and Verification phases. The 1-Step and Instant products use different numbers.'
        ],
        accounts: [
          { label: '$10K', start: 10000 },
          { label: '$25K', start: 25000 },
          { label: '$50K', start: 50000 },
          { label: '$100K', start: 100000 },
          { label: '$200K', start: 200000 }
        ],
        faq: [
          { q: 'What is the FTMO Max Daily Loss on the 2-Step Challenge?', a: 'It is 5% of the initial simulated capital. The limit is recalculated daily at 00:00 CE(S)T, starting from your account balance at that time.' },
          { q: 'Is the FTMO daily loss measured on balance or equity?', a: 'Equity. FTMO measures it as balance plus open positions profit and loss, plus or minus swaps, minus commissions.' },
          { q: 'Is the FTMO Max Loss static or trailing?', a: 'On the 2-Step Challenge it is a static 10% of the initial simulated capital. It does not move up with profits. Other FTMO products use different numbers, so check the product you bought.' }
        ],
        dailyLossPct: 5,
        maxLossPct: 10,
        rule: { model: 'static' }
      },
      {
        id: 'ftmo-1step',
        name: 'FTMO',
        label: 'FTMO 1-Step',
        product: '1-Step Challenge (forex / CFD)',
        verified: '2026-10-26',
        source: FTMO_SRC,
        summary: 'Max Daily Loss is 3% of initial capital, measured on equity and recalculated at 00:00 CE(S)T from your balance at that time. Max Loss is 10% of initial capital and trails your end-of-day balance, based on your highest 00:00 CE(S)T balance.',
        notes: [
          'Daily loss is measured on equity, and it is recalculated at 00:00 CE(S)T from your balance at that time.',
          'The max loss limit trails your end-of-day balance: it is based on your highest 00:00 CE(S)T balance, or the initial capital if that is higher.',
          'FTMO says that when you withdraw a Reward the Maximum Loss Limit resets to 90% of the initial capital. Account sizes on this product may differ from the list here: edit the starting balance if yours is different.'
        ],
        accounts: [
          { label: '$10K', start: 10000 },
          { label: '$25K', start: 25000 },
          { label: '$50K', start: 50000 },
          { label: '$100K', start: 100000 },
          { label: '$200K', start: 200000 }
        ],
        faq: [
          { q: 'What are the FTMO 1-Step loss limits?', a: 'According to FTMO, the Max Daily Loss is 3% of the initial simulated capital and the Max Loss is 10%, which is an end-of-day trailing limit based on your highest 00:00 CE(S)T balance.' },
          { q: 'How is the FTMO 1-Step different from the 2-Step?', a: 'The 2-Step Challenge uses a 5% daily loss and a static 10% max loss. The 1-Step uses a 3% daily loss and a 10% max loss that trails your end-of-day balance.' },
          { q: 'Is the FTMO daily loss measured on balance or equity?', a: 'Equity. If equity drops below the limit, FTMO considers the rule violated.' }
        ],
        dailyLossPct: 3,
        maxLossPct: 10,
        rule: { model: 'trailing_eod_nolock' }
      }
    ],
    futures: [
      { symbol: 'ES', name: 'E-mini S&P 500', multiplier: 50, tickSize: 0.25, tickValue: 12.5 },
      { symbol: 'MES', name: 'Micro E-mini S&P 500', multiplier: 5, tickSize: 0.25, tickValue: 1.25 },
      { symbol: 'NQ', name: 'E-mini Nasdaq-100', multiplier: 20, tickSize: 0.25, tickValue: 5 },
      { symbol: 'MNQ', name: 'Micro E-mini Nasdaq-100', multiplier: 2, tickSize: 0.25, tickValue: 0.5 },
      { symbol: 'CL', name: 'Crude Oil', multiplier: 1000, tickSize: 0.01, tickValue: 10 },
      { symbol: 'GC', name: 'Gold', multiplier: 100, tickSize: 0.1, tickValue: 10 }
    ],
    /* Build the Calc.survival rule object for a firm + account. */
    buildRule: function (firm, account) {
      var maxLossAmount = firm.maxLossPct ? account.start * firm.maxLossPct / 100 : account.maxLoss;
      var rule = { model: firm.rule.model, maxLossAmount: maxLossAmount };
      if (firm.dailyLossPct) rule.dailyLossAmount = account.start * firm.dailyLossPct / 100;
      return rule;
    }
  };
});
