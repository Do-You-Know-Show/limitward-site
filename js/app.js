/* UI glue. Uses window.Calc and window.Presets. All output is written with textContent (no innerHTML from user input). */
(function () {
  'use strict';
  var C = window.Calc, P = window.Presets;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var money = function (n) {
    return (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  var el = function (tag, attrs, text) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (text != null) e.textContent = text;
    return e;
  };
  var read = function (id) {
    var v = $('#' + id);
    if (!v || v.value.trim() === '') return undefined;
    var n = Number(v.value);
    return isFinite(n) ? n : NaN;
  };
  function field(id, label, opts) {
    opts = opts || {};
    var w = el('div');
    w.appendChild(el('label', { for: id }, label));
    var i;
    if (opts.options) {
      i = el('select', { id: id });
      opts.options.forEach(function (o) { i.appendChild(el('option', { value: o.value }, o.label)); });
    } else {
      i = el('input', { id: id, type: 'number', inputmode: 'decimal', step: 'any', autocomplete: 'off' });
      if (opts.value != null) i.value = opts.value;
    }
    w.appendChild(i);
    if (opts.hint) w.appendChild(el('div', { class: 'hint' }, opts.hint));
    return w;
  }
  function renderResult(box, big, rows, bad) {
    box.textContent = '';
    box.className = 'result' + (bad ? ' bad' : '');
    box.appendChild(el('div', { class: 'big' }, big));
    var dl = el('dl');
    rows.forEach(function (r) { dl.appendChild(el('dt', null, r[0])); dl.appendChild(el('dd', null, r[1])); });
    box.appendChild(dl);
  }
  function req(v, name) {
    if (v === undefined || Number.isNaN(v)) throw new Error('Enter a number for ' + name + '.');
    return v;
  }

  /* ---------------- Position size calculator ---------------- */
  function initPositionSize(root) {
    var assets = {
      stocks: {
        label: 'Stocks', fields: function (f) {
          f.push(field('entry', 'Entry price'), field('stop', 'Stop price'),
            field('fixedFees', 'Total commissions (round trip)', { value: 0 }),
            field('perShare', 'Slippage + fees per share', { value: 0 }));
        },
        calc: function (risk) {
          var r = C.stockSize({ riskDollars: risk, entry: req(read('entry'), 'entry'), stop: req(read('stop'), 'stop'), fixedFees: read('fixedFees') || 0, perShareCost: read('perShare') || 0 });
          return [r.size + ' shares', [['Risk per share', money(r.riskPerUnit)], ['Actual risk', money(r.actualRisk)]]];
        }
      },
      futures: {
        label: 'Futures', fields: function (f) {
          f.push(field('sym', 'Contract', { options: P.futures.map(function (x) { return { value: x.symbol, label: x.symbol + ' – ' + x.name }; }).concat([{ value: 'custom', label: 'Custom' }]) }),
            field('tickSize', 'Tick size', { value: 0.25 }), field('tickValue', 'Tick value ($)', { value: 12.5 }),
            field('entry', 'Entry price'), field('stop', 'Stop price'),
            field('fee', 'Round-trip fee per contract ($)', { value: 0, hint: 'Include commissions and exchange fees.' }));
        },
        after: function () {
          $('#sym').addEventListener('change', function () {
            var x = P.futures.filter(function (f) { return f.symbol === $('#sym').value; })[0];
            if (x) { $('#tickSize').value = x.tickSize; $('#tickValue').value = x.tickValue; }
          });
        },
        calc: function (risk) {
          var r = C.futuresSize({ riskDollars: risk, entry: req(read('entry'), 'entry'), stop: req(read('stop'), 'stop'), tickSize: req(read('tickSize'), 'tick size'), tickValue: req(read('tickValue'), 'tick value'), feeRoundTrip: read('fee') || 0 });
          return [r.size + (r.size === 1 ? ' contract' : ' contracts'), [['Stop distance', r.ticks + ' ticks'], ['Risk per contract (with fees)', money(r.riskPerUnit)], ['Actual risk', money(r.actualRisk)]]];
        }
      },
      forex: {
        label: 'Forex', fields: function (f) {
          f.push(field('pipSize', 'Pip size', { options: [{ value: '0.0001', label: '0.0001 (most pairs)' }, { value: '0.01', label: '0.01 (JPY pairs)' }] }),
            field('q2a', 'Quote currency → account currency rate', { value: 1, hint: 'USD account: EURUSD/GBPUSD = 1. USDJPY = 1 ÷ price (e.g. 1 ÷ 150 = 0.006667). EURGBP = GBPUSD rate.' }),
            field('stopPips', 'Stop distance (pips)'));
        },
        calc: function (risk) {
          var r = C.forexSize({ riskDollars: risk, pipSize: Number($('#pipSize').value), quoteToAccount: req(read('q2a'), 'rate'), stopPips: req(read('stopPips'), 'stop pips') });
          return [r.lots.toFixed(2) + ' lots', [['Units', r.units.toLocaleString('en-US')], ['Pip value per standard lot', money(r.pipValuePerLot)], ['Actual risk', money(r.actualRisk)]]];
        }
      },
      crypto: {
        label: 'Crypto', fields: function (f) {
          f.push(field('entry', 'Entry price'), field('stop', 'Stop price'),
            field('feePct', 'Fee per side (%)', { value: 0.1 }), field('lev', 'Leverage (optional)', { hint: 'Perps only. Leave blank for spot.' }));
        },
        calc: function (risk) {
          var lev = read('lev');
          var r = C.cryptoSize({ riskDollars: risk, entry: req(read('entry'), 'entry'), stop: req(read('stop'), 'stop'), feePct: read('feePct') || 0, leverage: lev || undefined });
          var rows = [['Position value', money(r.notional)], ['Estimated fees (both sides)', money(r.feeEstimate)]];
          if (r.margin != null) rows.push(['Margin needed', money(r.margin)]);
          return [r.qty + ' units', rows];
        }
      },
      option: {
        label: 'Options (long)', fields: function (f) {
          f.push(field('premium', 'Premium per share'), field('ofee', 'Fees per contract ($)', { value: 0 }));
        },
        calc: function (risk) {
          var r = C.optionLongSize({ riskDollars: risk, premium: req(read('premium'), 'premium'), feePerContract: read('ofee') || 0 });
          return [r.contracts + (r.contracts === 1 ? ' contract' : ' contracts'), [['Cost per contract', money(r.riskPerContract)], ['Max loss', money(r.actualRisk)]]];
        }
      },
      spread: {
        label: 'Credit spread', fields: function (f) {
          f.push(field('width', 'Spread width ($)'), field('credit', 'Credit received per share ($)'), field('sfee', 'Fees per contract ($)', { value: 0 }));
        },
        calc: function (risk) {
          var r = C.creditSpreadSize({ riskDollars: risk, width: req(read('width'), 'width'), credit: req(read('credit'), 'credit'), feePerContract: read('sfee') || 0 });
          return [r.contracts + (r.contracts === 1 ? ' contract' : ' contracts'), [['Max loss per contract', money(r.riskPerContract)], ['Total max loss', money(r.actualRisk)]]];
        }
      }
    };
    var current = 'futures';
    var tabs = $('.tabs', root), fieldsBox = $('#fields', root), out = $('#out', root), err = $('#err', root);
    Object.keys(assets).forEach(function (k) {
      var b = el('button', { type: 'button', 'data-k': k, 'aria-pressed': 'false' }, assets[k].label);
      b.addEventListener('click', function () { select(k); });
      tabs.appendChild(b);
    });
    function select(k) {
      current = k;
      Array.prototype.forEach.call(tabs.children, function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-k') === k)); });
      fieldsBox.textContent = ''; out.textContent = ''; out.className = ''; err.textContent = '';
      var f = []; assets[k].fields(f);
      var row = el('div', { class: 'row' });
      f.forEach(function (x) { row.appendChild(x); });
      fieldsBox.appendChild(row);
      if (assets[k].after) assets[k].after();
    }
    $('#riskMode', root).addEventListener('change', function () {
      $('#riskLabel', root).textContent = this.value === 'pct' ? 'Risk per trade (% of account)' : 'Risk per trade ($)';
      $('#acctWrap', root).style.display = this.value === 'pct' ? '' : 'none';
    });
    $('#go', root).addEventListener('click', function () {
      err.textContent = '';
      try {
        var mode = $('#riskMode', root).value;
        var rv = req(read('riskVal'), 'risk');
        var risk = mode === 'pct' ? C.riskFromPercent(req(read('equity'), 'account size'), rv) : rv;
        var res = assets[current].calc(risk);
        renderResult(out, res[0], [['Risk budget', money(risk)]].concat(res[1]));
      } catch (e) {
        out.textContent = ''; out.className = ''; err.textContent = e.message;
      }
    });
    select(current);
  }

  /* ---------------- Drawdown / survival calculator ---------------- */
  function initDrawdown(root) {
    var preset = root.getAttribute('data-firm');
    var firmSel = $('#firm', root), acctSel = $('#acct', root), modelSel = $('#model', root);
    var out = $('#out', root), err = $('#err', root);
    P.firms.forEach(function (f) { firmSel.appendChild(el('option', { value: f.id }, f.name + ' – ' + f.product)); });
    firmSel.appendChild(el('option', { value: 'custom' }, 'Custom rules'));
    if (preset) firmSel.value = preset;
    var firm = function () { return P.firms.filter(function (f) { return f.id === firmSel.value; })[0]; };
    function syncFirm() {
      var f = firm(), custom = !f;
      $('#customBox', root).style.display = custom ? '' : 'none';
      $('#peakWrap', root).style.display = (custom ? modelSel.value : f.rule.model).indexOf('trailing_eod') === 0 ? '' : 'none';
      acctSel.parentNode.style.display = custom ? 'none' : '';
      acctSel.textContent = '';
      if (f) {
        f.accounts.forEach(function (a, i) { acctSel.appendChild(el('option', { value: String(i) }, a.label)); });
        $('#startBal', root).value = f.accounts[0].start;
      }
    }
    firmSel.addEventListener('change', syncFirm);
    modelSel.addEventListener('change', syncFirm);
    acctSel.addEventListener('change', function () { var f = firm(); if (f) $('#startBal', root).value = f.accounts[Number(acctSel.value)].start; });
    P.futures.forEach(function (x) { $('#inst', root).appendChild(el('option', { value: x.symbol }, x.symbol + ' – ' + x.name)); });
    syncFirm();

    $('#go', root).addEventListener('click', function () {
      err.textContent = ''; out.textContent = ''; out.className = '';
      try {
        var f = firm(), rule, startBalance = req(read('startBal'), 'starting balance');
        if (f) {
          rule = P.buildRule(f, f.accounts[Number(acctSel.value)]);
        } else {
          rule = { model: modelSel.value, maxLossAmount: req(read('maxLoss'), 'max loss ($)') };
          var dl = read('dailyLoss'); if (dl) rule.dailyLossAmount = dl;
        }
        var equity = req(read('equity'), 'current equity');
        var s = C.survival(rule,
          { startBalance: startBalance, equity: equity, dayStartBalance: read('dayStart') == null ? startBalance : read('dayStart'), peakEodBalance: read('peakEod') == null ? startBalance : read('peakEod') },
          { bufferUsePct: req(read('usePct'), 'buffer to use'), stopOuts: req(read('stopOuts'), 'stop-outs') });
        var rows = [['Max-loss floor', money(s.maxLossFloor)]];
        if (s.dailyLossFloor != null) rows.push(['Daily-loss floor', money(s.dailyLossFloor)]);
        rows.push(['Binding rule', s.bindingRule], ['Buffer to the floor', money(s.buffer)], ['Safe risk per trade', money(s.safeRiskPerTrade)]);
        var stopPts = read('stopPts');
        if (stopPts && s.safeRiskPerTrade > 0) {
          var inst = P.futures.filter(function (x) { return x.symbol === $('#inst', root).value; })[0];
          var fee = read('feeRt') || 0;
          var sz = C.futuresSize({ riskDollars: s.safeRiskPerTrade, entry: 1000, stop: 1000 - stopPts, tickSize: inst.tickSize, tickValue: inst.tickValue, feeRoundTrip: fee });
          rows.push([inst.symbol + ' size for a ' + stopPts + '-point stop', sz.size + (sz.size === 1 ? ' contract' : ' contracts')]);
        }
        renderResult(out, s.breached ? 'At or below the floor' : money(s.buffer) + ' of room', rows, s.breached);
      } catch (e) { err.textContent = e.message; }
    });
  }

  /* ---------------- Waitlist ---------------- */
  function initWaitlist() {
    Array.prototype.forEach.call(document.querySelectorAll('form.wl'), function (form) {
      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var msg = $('.msg', form.parentNode), email = form.elements.email.value.trim();
        var url = (window.SITE_CONFIG || {}).WAITLIST_ENDPOINT;
        if (!/^\S+@\S+\.\S+$/.test(email)) { msg.textContent = 'Please enter a valid email address.'; return; }
        if (!url) { msg.textContent = 'The waitlist is not open yet. Please check back soon.'; return; }
        msg.textContent = 'Sending…';
        fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email, source: location.pathname }) })
          .then(function (r) { if (!r.ok) throw new Error(); msg.textContent = 'You are on the list. Thank you.'; form.reset(); })
          .catch(function () { msg.textContent = 'Something went wrong. Please try again.'; });
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var ps = $('#position-size'); if (ps) initPositionSize(ps);
    var dd = $('#drawdown'); if (dd) initDrawdown(dd);
    initWaitlist();
  });
})();
