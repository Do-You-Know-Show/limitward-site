/* Firm rule presets. Every preset carries its source and the date it was last checked.
   Rules change often: always tell users to confirm with the firm. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Presets = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  return {
    firms: [
      {
        id: 'topstep',
        name: 'Topstep',
        product: 'Trading Combine (futures)',
        verified: '2026-10-20',
        source: 'https://help.topstep.com/en/articles/8284204-what-is-the-maximum-loss-limit',
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
        id: 'ftmo',
        name: 'FTMO',
        product: '2-Step Challenge (forex / CFD)',
        verified: '2026-10-20',
        source: 'https://ftmo.com/en/trading-objectives/',
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
