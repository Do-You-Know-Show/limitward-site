/* Risk math for traders. Pure functions, no DOM. Works in browser (window.Calc) and node (require). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Calc = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var EPS = 1e-9;
  function floorSize(x) { return Math.floor(Math.round(x * 1e6) / 1e6 + EPS); }
  function num(v, name) {
    if (typeof v !== 'number' || !isFinite(v)) throw new Error(name + ' must be a number');
    return v;
  }
  function pos(v, name) {
    num(v, name);
    if (v <= 0) throw new Error(name + ' must be greater than 0');
    return v;
  }
  function round(x, d) { var m = Math.pow(10, d); return Math.round(x * m) / m; }

  /* Risk amount in dollars from account equity and a percentage (e.g. 1 = 1%). */
  function riskFromPercent(equity, pct) {
    return pos(equity, 'equity') * pos(pct, 'risk percent') / 100;
  }

  /* STOCKS: shares such that a stop-out costs at most riskDollars, fees included.
     fixedFees = total commission for the round trip; perShareCost = slippage + fees per share. */
  function stockSize(o) {
    var risk = pos(o.riskDollars, 'risk');
    var perShare = Math.abs(num(o.entry, 'entry') - num(o.stop, 'stop')) + (o.perShareCost || 0);
    if (perShare <= 0) throw new Error('entry and stop must differ');
    var avail = risk - (o.fixedFees || 0);
    var size = avail > 0 ? floorSize(avail / perShare) : 0;
    return { size: size, riskPerUnit: perShare, actualRisk: round(size * perShare + (size > 0 ? (o.fixedFees || 0) : 0), 2) };
  }

  /* FUTURES: tickValue = multiplier * tickSize. feeRoundTrip is per contract. */
  function futuresSize(o) {
    var risk = pos(o.riskDollars, 'risk');
    var tickSize = pos(o.tickSize, 'tick size'), tickValue = pos(o.tickValue, 'tick value');
    var dist = Math.abs(num(o.entry, 'entry') - num(o.stop, 'stop'));
    if (dist <= 0) throw new Error('entry and stop must differ');
    var ticks = dist / tickSize;
    var perContract = ticks * tickValue + (o.feeRoundTrip || 0);
    var size = floorSize(risk / perContract);
    return { size: size, ticks: round(ticks, 4), riskPerUnit: round(perContract, 4), actualRisk: round(size * perContract, 2) };
  }

  /* FOREX: pipSize e.g. 0.0001 (0.01 for JPY pairs). quoteToAccount = value of 1 unit of the quote
     currency in account currency (EURUSD with USD account = 1; USDJPY with USD account = 1/price). */
  function forexPipValuePerUnit(pipSize, quoteToAccount) {
    return pos(pipSize, 'pip size') * pos(quoteToAccount, 'quote-to-account rate');
  }
  function forexSize(o) {
    var risk = pos(o.riskDollars, 'risk');
    var pv = forexPipValuePerUnit(o.pipSize, o.quoteToAccount);
    var stopPips = pos(o.stopPips, 'stop pips');
    var perUnit = stopPips * pv;
    var units = floorSize(risk / perUnit);
    return {
      units: units, lots: round(units / 100000, 2), pipValuePerLot: round(pv * 100000, 4),
      actualRisk: round(units * perUnit, 2)
    };
  }

  /* CRYPTO spot / linear perp: feePct is per side, in percent (0.1 = 0.1%). */
  function cryptoSize(o) {
    var risk = pos(o.riskDollars, 'risk');
    var entry = pos(o.entry, 'entry'), stop = pos(o.stop, 'stop');
    var dist = Math.abs(entry - stop);
    if (dist <= 0) throw new Error('entry and stop must differ');
    var feePerUnit = (entry + stop) * ((o.feePct || 0) / 100);
    var perUnit = dist + feePerUnit;
    var qty = risk / perUnit;
    var notional = qty * entry;
    var out = { qty: round(qty, 8), notional: round(notional, 2), feeEstimate: round(qty * feePerUnit, 2) };
    if (o.leverage) {
      out.margin = round(notional / pos(o.leverage, 'leverage'), 2);
    }
    return out;
  }

  /* OPTIONS (long): premium per share, 100 multiplier. */
  function optionLongSize(o) {
    var perContract = pos(o.premium, 'premium') * 100 + (o.feePerContract || 0);
    var n = floorSize(pos(o.riskDollars, 'risk') / perContract);
    return { contracts: n, riskPerContract: round(perContract, 2), actualRisk: round(n * perContract, 2) };
  }
  /* Defined-risk credit spread: max loss per contract = (width - credit) * 100. */
  function creditSpreadSize(o) {
    var width = pos(o.width, 'width'), credit = pos(o.credit, 'credit');
    if (credit >= width) throw new Error('credit must be less than width');
    var perContract = (width - credit) * 100 + (o.feePerContract || 0);
    var n = floorSize(pos(o.riskDollars, 'risk') / perContract);
    return { contracts: n, riskPerContract: round(perContract, 2), actualRisk: round(n * perContract, 2) };
  }

  /* Trade statistics */
  function rMultiple(netPnl, initialRisk) { return num(netPnl, 'pnl') / pos(initialRisk, 'initial risk'); }
  function rewardRisk(entry, stop, target) {
    var risk = Math.abs(entry - stop);
    if (risk <= 0) throw new Error('entry and stop must differ');
    return Math.abs(target - entry) / risk;
  }
  function breakEvenWinRate(rr) { return 1 / (1 + pos(rr, 'reward:risk')); }
  function expectancyR(winRate, avgWinR, avgLossR) {
    if (winRate < 0 || winRate > 1) throw new Error('win rate must be between 0 and 1');
    return winRate * avgWinR - (1 - winRate) * Math.abs(avgLossR);
  }
  /* ---------- Drawdown engine (prop-firm style) ---------- */
  /* model types:
       static            floor = start - maxLoss
       trailing_eod      floor = min(start, peakEodBalance - maxLoss)   [Topstep Combine MLL: locks at start balance]
       trailing_eod_nolock floor = peakEodBalance - maxLoss
       trailing_intraday floor = min(start, peakEquity - maxLoss) (lockAtStart true) or peakEquity - maxLoss
     Daily loss (FTMO style): dailyFloor = dayStartBalance - dailyLossAmount (breach measured on equity). */
  function maxLossFloor(rule, s) {
    var start = pos(s.startBalance, 'start balance');
    var maxLoss = pos(rule.maxLossAmount, 'max loss amount');
    var peakEod = Math.max(start, s.peakEodBalance == null ? start : s.peakEodBalance);
    var peakEq = Math.max(peakEod, s.peakEquity == null ? start : s.peakEquity);
    switch (rule.model) {
      case 'static': return start - maxLoss;
      case 'trailing_eod': return Math.min(start, peakEod - maxLoss);
      case 'trailing_eod_nolock': return peakEod - maxLoss;
      case 'trailing_intraday': return rule.lockAtStart === false ? peakEq - maxLoss : Math.min(start, peakEq - maxLoss);
      default: throw new Error('unknown drawdown model: ' + rule.model);
    }
  }
  function dailyLossFloor(rule, s) {
    if (!rule.dailyLossAmount) return null;
    var base = s.dayStartBalance == null ? s.startBalance : s.dayStartBalance;
    return base - rule.dailyLossAmount;
  }
  /* Returns the binding floor, remaining buffer and a safe per-trade risk.
     s = { startBalance, equity, dayStartBalance, peakEodBalance, peakEquity }
     o = { bufferUsePct (default 50), stopOuts (default 2) }: risk only bufferUsePct of the buffer,
     spread over `stopOuts` consecutive full stop-outs. */
  function survival(rule, s, o) {
    o = o || {};
    var equity = num(s.equity, 'equity');
    var mFloor = maxLossFloor(rule, s);
    var dFloor = dailyLossFloor(rule, s);
    var binding = mFloor, which = 'max loss';
    if (dFloor != null && dFloor > mFloor) { binding = dFloor; which = 'daily loss'; }
    var buffer = equity - binding;
    var usePct = o.bufferUsePct == null ? 50 : o.bufferUsePct;
    var stopOuts = o.stopOuts == null ? 2 : o.stopOuts;
    var safeRisk = buffer > 0 ? buffer * (usePct / 100) / stopOuts : 0;
    return {
      maxLossFloor: round(mFloor, 2),
      dailyLossFloor: dFloor == null ? null : round(dFloor, 2),
      bindingFloor: round(binding, 2), bindingRule: which,
      buffer: round(buffer, 2), breached: buffer <= 0,
      safeRiskPerTrade: round(safeRisk, 2)
    };
  }

  /* A one-page plan for the day from a Calc.survival result. Pure arithmetic on the user's own numbers.
     dailyLossLimit = risk per trade x number of full stop-outs the user chose to survive. Returns null if there is no room. */
  function dailyPlan(surv, opts) {
    opts = opts || {};
    var n = opts.stopOuts == null ? 2 : opts.stopOuts;
    if (!surv || surv.breached || !(surv.buffer > 0) || !(surv.safeRiskPerTrade > 0)) return null;
    return {
      riskPerTrade: surv.safeRiskPerTrade,
      dailyLossLimit: round(surv.safeRiskPerTrade * n, 2),
      stopAfterLosses: n,
      floor: surv.bindingFloor,
      floorRule: surv.bindingRule,
      room: surv.buffer
    };
  }

  return {
    floorSize: floorSize, riskFromPercent: riskFromPercent,
    stockSize: stockSize, futuresSize: futuresSize, forexSize: forexSize, forexPipValuePerUnit: forexPipValuePerUnit,
    cryptoSize: cryptoSize, optionLongSize: optionLongSize, creditSpreadSize: creditSpreadSize,
    rMultiple: rMultiple, rewardRisk: rewardRisk, breakEvenWinRate: breakEvenWinRate, expectancyR: expectancyR,
    maxLossFloor: maxLossFloor, dailyLossFloor: dailyLossFloor, survival: survival, dailyPlan: dailyPlan
  };
});
