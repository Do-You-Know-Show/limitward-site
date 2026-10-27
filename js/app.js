/* UI glue. Uses window.Calc and window.Presets. All output is written with textContent (no innerHTML from user input).
   Numbers you type stay in your browser (local storage and, if you press Copy link, in the link's # part). Nothing is sent to a server. */
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
  function copyText(text, onDone) {
    function fallback() {
      try {
        var t = el('textarea'); t.value = text; t.style.position = 'fixed'; t.style.opacity = '0';
        document.body.appendChild(t); t.select(); var ok = document.execCommand('copy'); document.body.removeChild(t);
        onDone(ok);
      } catch (e) { onDone(false); }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { onDone(true); }, fallback);
    else fallback();
  }

  /* ---------------- Remember numbers, share link ---------------- */
  var STATE_KEY = 'lw_state_' + location.pathname;
  var ID_RE = /^[A-Za-z][A-Za-z0-9]{0,30}$/;
  function b64enc(s) { return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function b64dec(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return decodeURIComponent(escape(atob(s))); }
  function sanitize(state) {
    // Accept only {a?: string, v: {id: short string}} and drop everything else.
    if (!state || typeof state !== 'object' || typeof state.v !== 'object' || !state.v) return null;
    var clean = { v: {} };
    if (typeof state.a === 'string' && ID_RE.test(state.a)) clean.a = state.a;
    Object.keys(state.v).slice(0, 40).forEach(function (k) {
      var val = state.v[k];
      if (ID_RE.test(k) && (typeof val === 'string' || typeof val === 'number') && String(val).length <= 40) clean.v[k] = String(val);
    });
    return clean;
  }
  function readHashState() {
    var m = /(?:^|[#&])s=([A-Za-z0-9_-]+)/.exec(location.hash || '');
    if (!m || m[1].length > 2000) return null;
    try { return sanitize(JSON.parse(b64dec(m[1]))); } catch (e) { return null; }
  }
  function collect(root) {
    var v = {};
    Array.prototype.forEach.call(root.querySelectorAll('input, select'), function (e) { if (e.id && ID_RE.test(e.id)) v[e.id] = e.value; });
    return v;
  }
  function applyValues(root, v, skip) {
    Object.keys(v || {}).forEach(function (id) {
      if (!ID_RE.test(id) || (skip && skip.indexOf(id) >= 0)) return;
      var e = root.querySelector('#' + id);
      if (!e) return;
      var val = String(v[id]);
      if (e.tagName === 'SELECT') {
        var ok = false;
        for (var i = 0; i < e.options.length; i++) if (e.options[i].value === val) ok = true;
        if (!ok) return;
      }
      e.value = val;
    });
  }
  /* api = { get(): state, set(state): void }. Returns true if the page was restored from a shared link. */
  function wirePersistence(root, api) {
    var fromHash = readHashState();
    var saved = null;
    try { saved = sanitize(JSON.parse(localStorage.getItem(STATE_KEY) || 'null')); } catch (e) { saved = null; }
    var state = fromHash || saved;
    if (state) { try { api.set(state); } catch (e) { /* ignore a bad saved state */ } }
    var timer;
    function save() {
      clearTimeout(timer);
      timer = setTimeout(function () { try { localStorage.setItem(STATE_KEY, JSON.stringify(api.get())); } catch (e) { /* storage unavailable */ } }, 300);
    }
    root.addEventListener('input', save);
    root.addEventListener('change', save);
    var msg = $('.toolmsg', root);
    var share = $('#share', root), clear = $('#clear', root);
    if (share) share.addEventListener('click', function () {
      var url = location.origin + location.pathname + '#s=' + b64enc(JSON.stringify(api.get()));
      copyText(url, function (ok) { if (msg) msg.textContent = ok ? 'Link copied. It contains your numbers in the address, and nothing is sent to us.' : 'Your link is now in the address bar. Copy it from there.'; });
      try { history.replaceState(null, '', '#s=' + b64enc(JSON.stringify(api.get()))); } catch (e) { /* ignore */ }
    });
    if (clear) clear.addEventListener('click', function () {
      try { localStorage.removeItem(STATE_KEY); } catch (e) { /* ignore */ }
      location.href = location.pathname;
    });
    return !!fromHash;
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
    function run() {
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
    }
    $('#go', root).addEventListener('click', run);
    select(current);
    var fromLink = wirePersistence(root, {
      get: function () { return { a: current, v: collect(root) }; },
      set: function (s) {
        if (s.a && assets[s.a]) select(s.a);
        applyValues(root, s.v);
        $('#riskMode', root).dispatchEvent(new Event('change'));
      }
    });
    if (fromLink) run();
  }

  /* ---------------- Drawdown / survival calculator + daily plan ---------------- */
  function initDrawdown(root) {
    var preset = root.getAttribute('data-firm');
    var firmSel = $('#firm', root), acctSel = $('#acct', root), modelSel = $('#model', root);
    var out = $('#out', root), err = $('#err', root), planBox = $('#plan', root);
    P.firms.forEach(function (f) { firmSel.appendChild(el('option', { value: f.id }, (f.label || f.name) + ' – ' + f.product)); });
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
    firmSel.addEventListener('change', function () {
      syncFirm();
      // On a firm page, switching firm goes to that firm's page so the rules text matches.
      var f = firm();
      if (preset && f && f.id !== preset) location.href = '../' + f.id + '/';
      if (preset && !f) location.href = '../../prop-firm-drawdown/';
    });
    modelSel.addEventListener('change', syncFirm);
    acctSel.addEventListener('change', function () { var f = firm(); if (f) $('#startBal', root).value = f.accounts[Number(acctSel.value)].start; });
    P.futures.forEach(function (x) { $('#inst', root).appendChild(el('option', { value: x.symbol }, x.symbol + ' – ' + x.name)); });
    syncFirm();

    function renderPlan(plan, extra) {
      planBox.textContent = '';
      if (!plan) { planBox.hidden = true; return; }
      var lines = [
        ['Risk per trade', 'no more than ' + money(plan.riskPerTrade)],
        ['Daily loss limit', money(plan.dailyLossLimit) + '. When I reach it, I stop for the day'],
        ['Stop after', plan.stopAfterLosses + ' losing trades in a row'],
        ['Firm limit', 'floor ' + money(plan.floor) + ' (' + plan.floorRule + '), room ' + money(plan.room)]
      ];
      if (extra) lines.push(['Size', extra]);
      planBox.hidden = false;
      planBox.appendChild(el('h3', null, 'Your plan for today'));
      var ul = el('ul', { class: 'plain' });
      lines.forEach(function (l) { var li = el('li'); li.appendChild(el('strong', null, l[0] + ': ')); li.appendChild(document.createTextNode(l[1])); ul.appendChild(li); });
      planBox.appendChild(ul);
      planBox.appendChild(el('p', { class: 'hint' }, 'A planning aid built from your own numbers, not advice. Confirm the rules with your firm.'));
      var row = el('div', { class: 'ctarow noprint' });
      var copy = el('button', { type: 'button' }, 'Copy plan');
      var print = el('button', { type: 'button', class: 'ghost' }, 'Print');
      var msg = el('span', { class: 'hint', role: 'status' });
      var text = 'My trading plan for today (limitward.app)\n' + lines.map(function (l) { return '- ' + l[0] + ': ' + l[1]; }).join('\n') + '\nA planning aid from my own numbers, not advice.';
      copy.addEventListener('click', function () { copyText(text, function (ok) { msg.textContent = ok ? 'Copied.' : 'Could not copy.'; }); });
      print.addEventListener('click', function () {
        document.body.classList.add('print-plan');
        window.print();
        setTimeout(function () { document.body.classList.remove('print-plan'); }, 500);
      });
      row.appendChild(copy); row.appendChild(print); row.appendChild(msg);
      planBox.appendChild(row);
    }

    function run() {
      err.textContent = ''; out.textContent = ''; out.className = ''; planBox.hidden = true;
      try {
        var f = firm(), rule, startBalance = req(read('startBal'), 'starting balance');
        if (f) {
          rule = P.buildRule(f, f.accounts[Number(acctSel.value)]);
        } else {
          rule = { model: modelSel.value, maxLossAmount: req(read('maxLoss'), 'max loss ($)') };
          var dl = read('dailyLoss'); if (dl) rule.dailyLossAmount = dl;
        }
        var equity = req(read('equity'), 'current equity');
        var stopOuts = req(read('stopOuts'), 'stop-outs');
        var s = C.survival(rule,
          { startBalance: startBalance, equity: equity, dayStartBalance: read('dayStart') == null ? startBalance : read('dayStart'), peakEodBalance: read('peakEod') == null ? startBalance : read('peakEod') },
          { bufferUsePct: req(read('usePct'), 'buffer to use'), stopOuts: stopOuts });
        var rows = [['Max-loss floor', money(s.maxLossFloor)]];
        if (s.dailyLossFloor != null) rows.push(['Daily-loss floor', money(s.dailyLossFloor)]);
        rows.push(['Binding rule', s.bindingRule], ['Buffer to the floor', money(s.buffer)], ['Safe risk per trade', money(s.safeRiskPerTrade)]);
        var stopPts = read('stopPts'), extra = null;
        if (stopPts && s.safeRiskPerTrade > 0) {
          var inst = P.futures.filter(function (x) { return x.symbol === $('#inst', root).value; })[0];
          var fee = read('feeRt') || 0;
          var sz = C.futuresSize({ riskDollars: s.safeRiskPerTrade, entry: 1000, stop: 1000 - stopPts, tickSize: inst.tickSize, tickValue: inst.tickValue, feeRoundTrip: fee });
          extra = inst.symbol + ': ' + sz.size + (sz.size === 1 ? ' contract' : ' contracts') + ' for a ' + stopPts + '-point stop';
          rows.push([inst.symbol + ' size for a ' + stopPts + '-point stop', sz.size + (sz.size === 1 ? ' contract' : ' contracts')]);
        }
        renderResult(out, s.breached ? 'At or below the floor' : money(s.buffer) + ' of room', rows, s.breached);
        renderPlan(C.dailyPlan(s, { stopOuts: stopOuts }), extra);
      } catch (e) { err.textContent = e.message; }
    }
    $('#go', root).addEventListener('click', run);

    var fromLink = wirePersistence(root, {
      get: function () { return { v: collect(root) }; },
      set: function (s) {
        var v = s.v || {};
        if (!preset && v.firm) {
          var ok = false; for (var i = 0; i < firmSel.options.length; i++) if (firmSel.options[i].value === v.firm) ok = true;
          if (ok) { firmSel.value = v.firm; syncFirm(); }
        }
        applyValues(root, v, ['firm', 'acct']);
        if (v.acct && acctSel.querySelector('option[value="' + String(v.acct).replace(/[^0-9]/g, '') + '"]')) acctSel.value = String(v.acct).replace(/[^0-9]/g, '');
        if (!firm()) syncFirm(); // custom rules: refresh which fields show (does not touch values)
      }
    });
    if (fromLink) run();
  }

  /* ---------------- Risk-reward / expectancy calculator ---------------- */
  function initRiskReward(root) {
    var out = $('#out', root), err = $('#err', root);
    function run() {
      err.textContent = ''; out.textContent = ''; out.className = '';
      try {
        var entry = req(read('entry'), 'entry'), stop = req(read('stop'), 'stop'), target = req(read('target'), 'target');
        if (stop === entry || target === entry) throw new Error('Entry, stop and target must all be different.');
        if ((target - entry) * (stop - entry) > 0) throw new Error('The stop and the target should be on opposite sides of the entry.');
        var rr = C.rewardRisk(entry, stop, target);
        var rows = [['Risk per unit', Math.abs(entry - stop).toFixed(4).replace(/\.?0+$/, '')], ['Reward per unit', Math.abs(target - entry).toFixed(4).replace(/\.?0+$/, '')], ['Break-even win rate (before costs)', (C.breakEvenWinRate(rr) * 100).toFixed(1) + '%']];
        var wr = read('winRate');
        if (wr !== undefined) {
          if (Number.isNaN(wr) || wr <= 0 || wr >= 100) throw new Error('Win rate must be between 0 and 100.');
          var ex = C.expectancyR(wr / 100, rr, 1);
          rows.push(['Your win rate', wr + '%'], ['Expectancy per trade', (ex >= 0 ? '+' : '') + ex.toFixed(2) + ' R']);
        }
        renderResult(out, '1 : ' + rr.toFixed(2) + ' risk-reward', rows, false);
      } catch (e) { err.textContent = e.message; }
    }
    $('#go', root).addEventListener('click', run);
    var fromLink = wirePersistence(root, { get: function () { return { v: collect(root) }; }, set: function (s) { applyValues(root, s.v); } });
    if (fromLink) run();
  }

  /* ---------------- Waitlist ---------------- */
  function initWaitlist() {
    Array.prototype.forEach.call(document.querySelectorAll('form.wl'), function (form) {
      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var msg = $('.msg', form.parentNode), email = form.elements.email.value.trim();
        var consent = !!(form.elements.consent && form.elements.consent.checked);
        var url = (window.SITE_CONFIG || {}).WAITLIST_ENDPOINT;
        if (!/^\S+@\S+\.\S+$/.test(email)) { msg.textContent = 'Please enter a valid email address.'; return; }
        if (!consent) { msg.textContent = 'Please tick the box to agree to receive emails.'; return; }
        if (!url) { msg.textContent = 'The waitlist is not open yet. Please check back soon.'; return; }
        msg.textContent = 'Sending…';
        fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email, consent: true, website: form.elements.website ? form.elements.website.value : '', source: location.pathname }) })
          .then(function (r) { if (r.status === 429) { msg.textContent = 'Too many attempts. Please try again later.'; return; }
            if (!r.ok) throw new Error(); msg.textContent = 'You are on the list. Thank you.'; form.reset(); })
          .catch(function () { msg.textContent = 'Something went wrong. Please try again.'; });
      });
    });
  }

  /* ---------------- One-click poll ---------------- */
  function initPoll() {
    var box = $('.poll');
    var url = (window.SITE_CONFIG || {}).POLL_ENDPOINT;
    if (!box || !url) return; // stays hidden unless the API endpoint is configured
    var question = box.getAttribute('data-question');
    var key = 'lw_poll_' + question;
    var msg = $('.msg', box), btns = $('.poll-buttons', box);
    var prior = null;
    try { prior = localStorage.getItem(key); } catch (e) { prior = null; }
    box.hidden = false;
    if (prior) { btns.style.display = 'none'; msg.textContent = 'Thanks, you answered "' + prior + '".'; return; }
    Array.prototype.forEach.call(btns.querySelectorAll('button'), function (b) {
      b.addEventListener('click', function () {
        var answer = b.getAttribute('data-answer');
        Array.prototype.forEach.call(btns.querySelectorAll('button'), function (x) { x.disabled = true; });
        msg.textContent = 'Sending…';
        fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: question, answer: answer, page: location.pathname }) })
          .then(function (r) {
            if (r.status === 429) { msg.textContent = 'Too many answers from this connection. Thank you!'; return; }
            if (!r.ok) throw new Error();
            try { localStorage.setItem(key, answer); } catch (e) { /* ignore */ }
            btns.style.display = 'none';
            msg.textContent = 'Thanks, that helps.';
          })
          .catch(function () {
            msg.textContent = 'Could not send. Please try again.';
            Array.prototype.forEach.call(btns.querySelectorAll('button'), function (x) { x.disabled = false; });
          });
      });
    });
  }

  /* "Report a mistake" links open an email with the page address filled in. */
  function initReportLinks() {
    Array.prototype.forEach.call(document.querySelectorAll('a.report'), function (a) {
      a.href = 'mailto:support@limitward.app?subject=' + encodeURIComponent('Correction: ' + document.title) +
        '&body=' + encodeURIComponent('Page: ' + location.href.split('#')[0] + '\n\nWhat looks wrong or missing?\n\n');
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var ps = $('#position-size'); if (ps) initPositionSize(ps);
    var dd = $('#drawdown'); if (dd) initDrawdown(dd);
    var rr = $('#risk-reward'); if (rr) initRiskReward(rr);
    initWaitlist();
    initPoll();
    initReportLinks();
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('/sw.js').catch(function () { /* offline support is optional */ });
  });
})();
