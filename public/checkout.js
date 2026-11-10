/*
 * Hasp checkout: take payment in almost any coin, receive USDC on NEAR.
 *
 *   <script src="https://thehasp.vercel.app/checkout.js"
 *           data-to="yourname.near" data-usd="5" data-item="A coffee"></script>
 *
 * The buyer picks a coin and chain. NEAR Intents (the 1Click API) quotes the exact input for
 * the exact USDC the merchant asked for, gives a one-time deposit address, and settles the swap.
 * The USDC lands on the merchant's NEAR account. Hasp runs in the buyer's browser: it has no
 * server, holds no keys and never touches the funds. Any refund goes to the address the buyer
 * gives for their own chain.
 *
 * Also: window.Hasp.open({ to, usd, item }), and a "hasp:paid" event on the button when NEAR
 * Intents reports SUCCESS. That event is a convenience for the page; a merchant that delivers
 * something should confirm the payment itself with GET /v0/status on the 1Click API.
 */
(function () {
  "use strict";

  var API = "https://1click.chaindefuser.com";
  var USDC_NEAR = "nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1";
  var MAX_USD = 10000;
  var POLL_MS = 5000;

  var CHAINS = {
    near: "NEAR", eth: "Ethereum", base: "Base", arb: "Arbitrum", sol: "Solana", btc: "Bitcoin",
    op: "Optimism", pol: "Polygon", avax: "Avalanche", bsc: "BNB Chain", tron: "Tron", ton: "TON",
    xrp: "XRP Ledger", doge: "Dogecoin", zec: "Zcash", sui: "Sui", aptos: "Aptos", stellar: "Stellar",
    ltc: "Litecoin", bch: "Bitcoin Cash", cardano: "Cardano", gnosis: "Gnosis", bera: "Berachain",
    monad: "Monad", scroll: "Scroll", starknet: "Starknet", xlayer: "X Layer", plasma: "Plasma",
    dash: "Dash", movement: "Movement", aleo: "Aleo", hypercore: "Hyperliquid",
  };

  // Chains where NEAR Intents rejects small chain-to-chain quotes (docs: resources/swap-limits).
  var MIN_USD = { bsc: 1000, tron: 100 };

  var POPULAR = [
    ["near", "wNEAR"], ["near", "USDC"], ["near", "USDT"],
    ["base", "USDC"], ["base", "ETH"], ["arb", "USDC"], ["arb", "ETH"],
    ["eth", "USDC"], ["eth", "ETH"], ["sol", "SOL"], ["sol", "USDC"], ["btc", "BTC"],
  ];

  var EVM = ["eth", "base", "arb", "op", "pol", "avax", "bsc", "gnosis", "bera", "monad", "scroll", "xlayer", "plasma"];
  var NAMED = /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;

  /* ---------- pure helpers (tested in scripts/checkout.test.mjs) ---------- */

  function validNearAccount(value) {
    var s = String(value || "").trim();
    if (s.length < 2 || s.length > 64) return false;
    if (/^[0-9a-f]{64}$/.test(s)) return true;
    return NAMED.test(s);
  }

  /** "5" or "4.50" dollars to USDC base units (6 decimals), or null. */
  function usdToBase(value) {
    var s = String(value == null ? "" : value).trim();
    if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
    var parts = s.split(".");
    var cents = Number(parts[0]) * 100 + Number(((parts[1] || "") + "00").slice(0, 2));
    if (!(cents > 0) || cents > MAX_USD * 100) return null;
    return String(cents * 10000);
  }

  function chainName(id) {
    return CHAINS[id] || String(id).toUpperCase();
  }

  function coinName(token) {
    return token.blockchain === "near" && token.symbol === "wNEAR" ? "NEAR" : token.symbol;
  }

  /** null when the refund address looks right for the chain, else a sentence saying why not. */
  function refundProblem(chain, address) {
    var a = String(address || "").trim();
    if (!a) return "Enter your " + chainName(chain) + " address.";
    if (chain === "near") return validNearAccount(a) ? null : "That is not a NEAR account.";
    if (EVM.indexOf(chain) !== -1) return /^0x[0-9a-fA-F]{40}$/.test(a) ? null : "An address on " + chainName(chain) + " starts with 0x and has 40 more characters.";
    if (chain === "sol") return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a) ? null : "That is not a Solana address.";
    if (chain === "btc") return /^(bc1[a-z0-9]{25,87}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(a) ? null : "That is not a Bitcoin address.";
    return a.length >= 20 ? null : "That address looks too short.";
  }

  /** Tokens a buyer may pay with for this price, popular ones first. */
  function payable(tokens, usd) {
    var list = (tokens || []).filter(function (t) {
      if (!t || !t.assetId || !t.blockchain || !t.symbol) return false;
      if (t.assetId === USDC_NEAR) return true;
      var min = MIN_USD[t.blockchain];
      return !(min && Number(usd) < min);
    });
    function rank(t) {
      for (var i = 0; i < POPULAR.length; i++) if (POPULAR[i][0] === t.blockchain && POPULAR[i][1] === t.symbol) return i;
      return POPULAR.length;
    }
    return list.sort(function (a, b) {
      return rank(a) - rank(b) || chainName(a.blockchain).localeCompare(chainName(b.blockchain)) || a.symbol.localeCompare(b.symbol);
    });
  }

  /* Coin badges: the coin's colour and ticker, with a small chain mark when the coin is not the
     chain's own (USDC on Base, ETH on Arbitrum). Original designs, not the projects' logos. */
  var COIN_COLORS = {
    NEAR: "#1a1714", ETH: "#5b6bb5", WETH: "#5b6bb5", USDC: "#2563c9", USDT: "#2f8a74", SOL: "#6c4bd6",
    BTC: "#e08a2c", WBTC: "#e08a2c", CBBTC: "#e08a2c", DAI: "#d99a1e", ARB: "#2d6fd6", OP: "#e2483d", POL: "#7b4fd6",
    AVAX: "#d8443a", BNB: "#d9a91f", TRX: "#c9302c", TON: "#2e8bd9", DOGE: "#b89a3e", XRP: "#2b3138",
    ZEC: "#d9a43a", SUI: "#4a9fe8", APT: "#2b3138", XLM: "#2b3138", LTC: "#5a7fb5", ADA: "#2a5bd0", BCH: "#3f9c5a",
  };
  var CHAIN_COLORS = {
    near: "#1a1714", eth: "#5b6bb5", base: "#2463eb", arb: "#2d6fd6", sol: "#6c4bd6", btc: "#e08a2c", op: "#e2483d",
    pol: "#7b4fd6", avax: "#d8443a", bsc: "#d9a91f", tron: "#c9302c", ton: "#2e8bd9", gnosis: "#3e6957",
    bera: "#8a5a2b", sui: "#4a9fe8", aptos: "#2b3138", stellar: "#2b3138", xrp: "#2b3138", doge: "#b89a3e",
    zec: "#d9a43a", ltc: "#5a7fb5", bch: "#3f9c5a", cardano: "#2a5bd0", monad: "#6e54d9", scroll: "#c8935a",
  };
  var NATIVE = { near: "NEAR", eth: "ETH", sol: "SOL", btc: "BTC", ton: "TON", tron: "TRX", doge: "DOGE", xrp: "XRP",
    zec: "ZEC", sui: "SUI", aptos: "APT", stellar: "XLM", ltc: "LTC", bch: "BCH", cardano: "ADA", avax: "AVAX", bsc: "BNB", pol: "POL" };

  function hueColor(text) {
    var h = 0;
    for (var i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) % 360;
    return "hsl(" + h + ",45%,42%)";
  }

  /** SVG markup for a coin badge. Tickers are reduced to letters and digits, so nothing is injected. */
  function coinBadge(symbol, chain, size) {
    var sym = String(symbol || "").replace(/^w(?=NEAR$)/, "").toUpperCase();
    var label = sym.replace(/[^A-Z0-9]/g, "").slice(0, 4) || "?";
    var fill = COIN_COLORS[sym] || hueColor(sym);
    var native = NATIVE[chain] === sym;
    var corner = native ? "" :
      '<circle cx="31" cy="31" r="8" fill="' + (CHAIN_COLORS[chain] || hueColor(String(chain))) + '" stroke="#fbfaf6" stroke-width="2"/>' +
      '<text x="31" y="34.2" text-anchor="middle" font-size="8.5" font-weight="700" fill="#fff" font-family="Outfit,system-ui,sans-serif">' +
      chainName(chain).replace(/[^A-Za-z]/g, "").charAt(0).toUpperCase() + "</text>";
    return '<svg width="' + (size || 32) + '" height="' + (size || 32) + '" viewBox="0 0 40 40" aria-hidden="true">' +
      '<circle cx="19" cy="19" r="17" fill="' + fill + '"/>' +
      '<circle cx="19" cy="19" r="17" fill="url(#hasp-shine)"/>' +
      '<circle cx="19" cy="19" r="13.5" fill="none" stroke="#fff" stroke-opacity=".28"/>' +
      '<text x="19" y="' + (label.length > 3 ? 22 : 22.6) + '" text-anchor="middle" font-size="' + (label.length > 3 ? 8 : 10) + '" font-weight="600" fill="#fff" font-family="Outfit,system-ui,sans-serif">' + label + "</text>" +
      corner + "</svg>";
  }

  function quoteRequest(opts) {
    var hours = opts.chain === "btc" || opts.chain === "doge" || opts.chain === "ltc" || opts.chain === "bch" ? 3 : 1;
    return {
      dry: Boolean(opts.dry),
      swapType: "EXACT_OUTPUT",
      slippageTolerance: 100,
      originAsset: opts.originAsset,
      depositType: "ORIGIN_CHAIN",
      destinationAsset: USDC_NEAR,
      amount: opts.amount,
      refundTo: opts.refundTo,
      refundType: "ORIGIN_CHAIN",
      recipient: opts.to,
      recipientType: "DESTINATION_CHAIN",
      deadline: new Date((opts.now || Date.now()) + hours * 3600 * 1000).toISOString(),
      referral: "hasp",
    };
  }

  var STATUS = {
    PENDING_DEPOSIT: "Waiting for your payment…",
    KNOWN_DEPOSIT_TX: "Payment seen. Confirming…",
    INCOMPLETE_DEPOSIT: "Not enough arrived. Send the rest, or you get it back later.",
    PROCESSING: "Received. Almost done…",
    SUCCESS: "Paid.",
    REFUNDED: "Not paid. Your coins were sent back to you.",
    FAILED: "Not paid. Something went wrong on the network.",
  };

  /**
   * The amount to send, rounded up so it never falls below the quote. Base units in, text out.
   * Tokens with more than 8 decimals keep 6; a fraction of a cent extra comes back as a refund.
   */
  function sendAmount(baseUnits, decimals) {
    var raw = String(baseUnits || "");
    if (!/^\d+$/.test(raw)) return null;
    var dec = Number(decimals) || 0;
    var keep = dec <= 8 ? dec : 6;
    var value = BigInt(raw);
    var step = BigInt(10) ** BigInt(dec - keep);
    var rounded = ((value + step - BigInt(1)) / step) * step;
    var whole = (rounded / BigInt(10) ** BigInt(dec)).toString();
    var frac = (rounded % BigInt(10) ** BigInt(dec)).toString().padStart(dec, "0").slice(0, keep).replace(/0+$/, "");
    return frac ? whole + "." + frac : whole;
  }

  /** "about 45 minutes" or "about 2 hours" until a time, for people. */
  function timeLeft(iso, now) {
    var ms = Date.parse(iso) - (now || Date.now());
    if (!(ms > 0)) return null;
    var minutes = Math.round(ms / 60000);
    if (minutes < 90) return "about " + Math.max(1, minutes) + " minutes";
    var hours = Math.round(minutes / 60);
    return hours < 48 ? "about " + hours + " hours" : "about " + Math.round(hours / 24) + " days";
  }

  function statusText(status) {
    return STATUS[status] || "Checking…";
  }

  function finalStatus(status) {
    return status === "SUCCESS" || status === "REFUNDED" || status === "FAILED";
  }

  var core = {
    API: API, USDC_NEAR: USDC_NEAR, validNearAccount: validNearAccount, usdToBase: usdToBase,
    chainName: chainName, coinName: coinName, refundProblem: refundProblem, payable: payable,
    quoteRequest: quoteRequest, coinBadge: coinBadge, statusText: statusText, finalStatus: finalStatus, sendAmount: sendAmount, timeLeft: timeLeft,
  };

  if (typeof document === "undefined") {
    if (typeof module !== "undefined") module.exports = core;
    return;
  }

  /* ---------- network ---------- */

  var tokenCache = null;

  function getTokens() {
    if (!tokenCache) {
      tokenCache = fetch(API + "/v0/tokens").then(function (r) {
        if (!r.ok) throw new Error("NEAR Intents did not answer (" + r.status + ").");
        return r.json();
      });
      tokenCache.catch(function () { tokenCache = null; });
    }
    return tokenCache;
  }

  function postQuote(body) {
    return fetch(API + "/v0/quote", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok || !j.quote) throw new Error(j.message || "No quote (" + r.status + ").");
        return j;
      });
    });
  }

  function getStatus(address, memo) {
    var url = API + "/v0/status?depositAddress=" + encodeURIComponent(address) + (memo ? "&depositMemo=" + encodeURIComponent(memo) : "");
    return fetch(url).then(function (r) { return r.ok ? r.json() : null; });
  }

  function submitTx(address, txHash, memo) {
    var body = { txHash: txHash, depositAddress: address };
    if (memo) body.memo = memo;
    return fetch(API + "/v0/deposit/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).then(function (r) { return r.ok; });
  }

  /* ---------- storage (best effort) ---------- */

  function load(key) {
    try { return JSON.parse(localStorage.getItem(key) || "null"); } catch (e) { return null; }
  }
  function save(key, value) {
    try { if (value == null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode */ }
  }

  /* ---------- UI ---------- */

  var CSS = [
    ":host{all:initial}",
    "*{box-sizing:border-box;font-family:Outfit,'Avenir Next','Segoe UI',system-ui,sans-serif}",
    ".btn{display:inline-flex;align-items:center;gap:.5rem;border:0;border-radius:999px;background:#1a1714;color:#fbfaf6;padding:.75rem 1.25rem;font-size:15px;font-weight:500;cursor:pointer;line-height:1}",
    ".btn:hover{background:#9a5b32}.btn:focus-visible{outline:2px solid #9a5b32;outline-offset:2px}",
    ".btn small{opacity:.7;font-weight:400}",
    ".veil{position:fixed;inset:0;background:rgba(26,23,20,.45);display:flex;align-items:flex-end;justify-content:center;z-index:2147483647;padding:12px}",
    "@media(min-width:560px){.veil{align-items:center}}",
    ".box{width:100%;max-width:440px;max-height:92vh;overflow:auto;background:#fbfaf6;color:#1a1714;border-radius:20px;padding:20px;box-shadow:0 20px 60px rgba(0,0,0,.25);font-size:14px;line-height:1.45}",
    ".top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}",
    ".kick{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#6e675f}",
    "h2{font-family:Newsreader,Georgia,serif;font-weight:500;font-size:24px;margin:4px 0 2px}",
    ".mute{color:#6e675f}.err{color:#9d2c2c;margin-top:10px}",
    ".x{border:0;background:#efe9df;border-radius:999px;width:32px;height:32px;cursor:pointer;font-size:18px;color:#1a1714;flex:none}",
    ".grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}",
    ".coin{display:flex;align-items:center;gap:10px;border:1px solid #e3ddd3;background:#fff;border-radius:12px;padding:9px 10px;text-align:left;cursor:pointer;color:#1a1714}",
    ".coin .ic{flex:none;line-height:0}.coin .tx{min-width:0}",
    ".coin:hover,.coin:focus-visible{border-color:#1a1714;outline:none}",
    ".coin b{display:block;font-weight:500;font-size:14px}.coin .tx span{display:block;font-size:12px;color:#6e675f;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".head{display:flex;align-items:center;gap:10px}.head .ic{line-height:0}",
    "select,input{width:100%;margin-top:6px;border:1px solid #e3ddd3;border-radius:12px;padding:10px 12px;font-size:14px;background:#fff;color:#1a1714}",
    "label{display:block;margin-top:14px;font-size:13px;color:#6e675f}",
    ".go{width:100%;justify-content:center;margin-top:14px}",
    ".go[disabled]{opacity:.5;cursor:wait}",
    ".field{margin-top:12px;border:1px solid #e3ddd3;border-radius:12px;padding:10px 12px;background:#fff}",
    ".field .k{font-size:12px;color:#6e675f}.field .v{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:13px;word-break:break-all;margin-top:2px}",
    ".row{display:flex;justify-content:space-between;align-items:center;gap:8px}",
    ".copy{border:0;background:#efe9df;border-radius:999px;padding:6px 10px;font-size:12px;cursor:pointer;flex:none;color:#1a1714}",
    ".state{margin-top:14px;border-radius:12px;padding:12px;background:#efe9df}",
    ".state.ok{background:#e5f1e8;color:#1d5b36}.state.bad{background:#f6e3e1;color:#7d2620}",
    ".link{color:#9a5b32;text-decoration:underline;cursor:pointer;background:none;border:0;padding:0;font-size:13px}",
    ".foot{margin-top:16px;font-size:12px;color:#6e675f}",
    ".foot a{color:#6e675f}",
  ].join("");

  var SHINE = '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><radialGradient id="hasp-shine" cx="35%" cy="28%" r="75%"><stop offset="0" stop-color="#fff" stop-opacity=".38"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs></svg>';

  function badge(token, size) {
    var span = el("span", { class: "ic" });
    span.innerHTML = coinBadge(token.symbol, token.blockchain, size);
    return span;
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === "text") node.textContent = attrs[k];
      else if (k === "on") for (var ev in attrs.on) node.addEventListener(ev, attrs.on[ev]);
      else if (attrs[k] !== false && attrs[k] != null) node.setAttribute(k, attrs[k]);
    }
    (children || []).forEach(function (c) { if (c) node.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return node;
  }

  function money(usd) {
    var n = Number(usd);
    return "$" + (n % 1 === 0 ? String(n) : n.toFixed(2));
  }

  function copyButton(value) {
    var b = el("button", { class: "copy", type: "button", text: "Copy" });
    b.addEventListener("click", function () {
      var done = function () { b.textContent = "Copied"; setTimeout(function () { b.textContent = "Copy"; }, 1500); };
      if (navigator.clipboard) navigator.clipboard.writeText(value).then(done, function () {});
    });
    return b;
  }

  function field(label, value) {
    return el("div", { class: "field" }, [
      el("div", { class: "row" }, [el("div", { class: "k", text: label }), copyButton(value)]),
      el("div", { class: "v", text: value }),
    ]);
  }

  function Checkout(cfg, origin, pick) {
    this.cfg = cfg;
    this.origin = origin;
    this.pick = pick || null;
    this.key = "hasp:" + cfg.to + ":" + cfg.amount + ":" + (cfg.item || "");
    this.timer = null;
  }

  Checkout.prototype.open = function () {
    var self = this;
    this.host = el("div");
    this.root = this.host.attachShadow({ mode: "open" });
    this.root.appendChild(el("style", { text: CSS }));
    var defs = el("span");
    defs.innerHTML = SHINE;
    this.root.appendChild(defs);
    this.box = el("div", { class: "box", role: "dialog", "aria-modal": "true", "aria-label": "Pay with crypto" });
    this.veil = el("div", { class: "veil", on: { click: function (e) { if (e.target === self.veil) self.close(); } } }, [this.box]);
    this.root.appendChild(this.veil);
    document.body.appendChild(this.host);
    this.onKey = function (e) { if (e.key === "Escape") self.close(); };
    document.addEventListener("keydown", this.onKey);
    var pending = load(this.key);
    if (pending && pending.depositAddress && Date.parse(pending.deadline) > Date.now()) this.showPay(pending);
    else {
      this.showCoins();
      var pick = this.pick;
      if (pick && pick.chain && pick.symbol) {
        getTokens().then(function (tokens) {
          var found = (tokens || []).filter(function (t) { return t.blockchain === pick.chain && t.symbol === pick.symbol; })[0];
          if (found && self.host && self.host.isConnected) self.showRefund(found);
        }).catch(function () {});
      }
    }
  };

  Checkout.prototype.close = function () {
    clearTimeout(this.timer);
    document.removeEventListener("keydown", this.onKey);
    if (this.host && this.host.parentNode) this.host.parentNode.removeChild(this.host);
  };

  Checkout.prototype.frame = function (kicker, title, body) {
    var self = this;
    this.box.textContent = "";
    this.box.appendChild(el("div", { class: "top" }, [
      el("div", null, [el("div", { class: "kick", text: kicker }), el("h2", { text: title })]),
      el("button", { class: "x", type: "button", "aria-label": "Close", text: "×", on: { click: function () { self.close(); } } }),
    ]));
    body.forEach(function (n) { if (n) self.box.appendChild(n); });
    this.box.appendChild(el("p", { class: "foot" }, [
      "Powered by NEAR Intents. Hasp never holds your money. ",
      el("a", { href: "https://thehasp.vercel.app", target: "_blank", rel: "noopener", text: "Hasp" }),
    ]));
  };

  Checkout.prototype.heading = function () {
    var c = this.cfg;
    return money(c.usd) + (c.item ? " · " + c.item : "");
  };

  Checkout.prototype.showCoins = function () {
    var self = this;
    var note = el("p", { class: "mute", text: "Pick a coin to pay with." });
    var grid = el("div", { class: "grid" }, [el("p", { class: "mute", text: "Loading coins." })]);
    var more = el("label", null, ["Or choose another coin"]);
    var err = el("p", { class: "err" });
    this.frame("Pay with crypto", this.heading(), [note, grid, more, err]);
    getTokens().then(function (tokens) {
      var list = payable(tokens, self.cfg.usd);
      grid.textContent = "";
      list.slice(0, 8).forEach(function (t) {
        var est = t.price ? (Number(self.cfg.usd) / t.price) : null;
        grid.appendChild(el("button", { class: "coin", type: "button", on: { click: function () { self.showRefund(t); } } }, [
          badge(t, 32),
          el("span", { class: "tx" }, [
            el("b", { text: coinName(t) }),
            el("span", { text: "on " + chainName(t.blockchain) + (est ? " · ≈ " + (est < 1 ? est.toPrecision(3) : est.toFixed(2)) : "") }),
          ]),
        ]));
      });
      var select = el("select", { "aria-label": "Another coin" }, [el("option", { value: "", text: list.length + " coins" })]);
      list.forEach(function (t, i) { select.appendChild(el("option", { value: String(i), text: coinName(t) + " on " + chainName(t.blockchain) })); });
      select.addEventListener("change", function () { if (select.value) self.showRefund(list[Number(select.value)]); });
      more.appendChild(select);
    }).catch(function (e) { grid.textContent = ""; err.textContent = e.message; });
  };

  Checkout.prototype.showRefund = function (token) {
    var self = this;
    var chain = token.blockchain;
    var saved = load("hasp:refund:" + chain) || "";
    var input = el("input", { value: saved, autocomplete: "off", spellcheck: "false", placeholder: chain === "near" ? "you.near" : "Your " + chainName(chain) + " address" });
    var err = el("p", { class: "err" });
    var go = el("button", { class: "btn go", type: "button", text: "Continue" });
    var back = el("button", { class: "link", type: "button", text: "← Pick another coin", on: { click: function () { self.showCoins(); } } });
    go.addEventListener("click", function () {
      var problem = refundProblem(chain, input.value);
      if (problem) { err.textContent = problem; return; }
      var refundTo = input.value.trim();
      save("hasp:refund:" + chain, refundTo);
      go.disabled = true;
      go.textContent = "Getting your price…";
      err.textContent = "";
      postQuote(quoteRequest({ originAsset: token.assetId, amount: self.cfg.amount, refundTo: refundTo, to: self.cfg.to, chain: chain }))
        .then(function (res) {
          var q = res.quote;
          var payment = {
            depositAddress: q.depositAddress, memo: q.depositMemo || null, deadline: q.deadline,
            cold: q.timeWhenInactive || q.deadline,
            amountIn: sendAmount(q.amountIn, token.decimals) || q.amountInFormatted, minIn: q.minAmountIn, amountInUsd: q.amountInUsd,
            symbol: coinName(token), chain: chain, out: q.amountOutFormatted, refundTo: refundTo,
          };
          save(self.key, payment);
          self.showPay(payment);
        })
        .catch(function (e) { go.disabled = false; go.textContent = "Continue"; err.textContent = e.message; });
    });
    this.frame(coinName(token) + " on " + chainName(chain), this.heading(), [
      el("div", { class: "head" }, [badge(token, 36), el("p", { class: "mute", text: "If anything goes wrong, your " + coinName(token) + " comes back here." })]),
      el("label", null, ["Your " + chainName(chain) + " address", input]),
      go, err, el("p", null, [back]),
    ]);
  };

  Checkout.prototype.showPay = function (p) {
    var self = this;
    var state = el("div", { class: "state", role: "status", text: statusText("PENDING_DEPOSIT") });
    var tx = el("input", { placeholder: p.chain === "near" ? "Transaction hash (optional)" : "Transaction hash (optional)", autocomplete: "off", spellcheck: "false" });
    var txNote = el("p", { class: "mute" });
    var sent = el("button", { class: "link", type: "button", text: "Already paid? Add your transaction ID" });
    var txWrap = el("div", { hidden: "" }, [tx, el("button", { class: "copy", type: "button", text: "Send hash", on: { click: function () {
      if (!tx.value.trim()) return;
      submitTx(p.depositAddress, tx.value.trim(), p.memo).then(function (ok) { txNote.textContent = ok ? "Sent. NEAR Intents is looking for it." : "NEAR Intents did not accept that hash. It still watches the address."; });
    } } }), txNote]);
    sent.addEventListener("click", function () { txWrap.hidden = false; sent.hidden = true; });
    var restart = el("button", { class: "link", type: "button", text: "← Pay with another coin", on: { click: function () { clearTimeout(self.timer); save(self.key, null); self.showCoins(); } } });
    var left = timeLeft(p.cold || p.deadline);
    this.frame("Send exactly", this.heading(), [
      field("Amount", p.amountIn + " " + p.symbol + " on " + chainName(p.chain)),
      field("To this address", p.depositAddress),
      p.memo ? field("Memo (you must add this)", p.memo) : null,
      el("p", { class: "mute", text: "Send from any wallet" + (left ? " within " + left : "") + ". A little extra is fine; it comes back to you." }),
      state,
      el("p", null, [sent]), txWrap,
      el("p", null, [restart]),
    ]);
    this.poll(p, state);
  };

  Checkout.prototype.poll = function (p, state) {
    var self = this;
    clearTimeout(this.timer);
    getStatus(p.depositAddress, p.memo).then(function (s) {
      if (!s || !self.host || !self.host.isConnected) return;
      state.textContent = statusText(s.status);
      if (finalStatus(s.status)) {
        save(self.key, null);
        self.showDone(p, s);
        return;
      }
      self.timer = setTimeout(function () { self.poll(p, state); }, POLL_MS);
    }).catch(function () {
      self.timer = setTimeout(function () { self.poll(p, state); }, POLL_MS * 2);
    });
  };

  Checkout.prototype.showDone = function (p, s) {
    var ok = s.status === "SUCCESS";
    var d = s.swapDetails || {};
    var links = el("p", { class: "mute" }, [
      el("a", { href: API + "/v0/status?depositAddress=" + encodeURIComponent(p.depositAddress), target: "_blank", rel: "noopener", class: "link", text: "Receipt" }),
    ]);
    (d.nearTxHashes || []).slice(-1).forEach(function (h) {
      links.appendChild(document.createTextNode(" · "));
      links.appendChild(el("a", { href: "https://nearblocks.io/txns/" + h, target: "_blank", rel: "noopener", class: "link", text: "NEAR transaction" }));
    });
    this.frame(ok ? "Thank you" : "Not paid", this.heading(), [
      el("div", { class: "state " + (ok ? "ok" : "bad"), role: "status", text: ok
        ? "Paid. " + this.cfg.to + " got " + (d.amountOutFormatted || p.out) + " USDC."
        : statusText(s.status) + (d.refundReason ? " (" + d.refundReason + ")" : "") }),
      links,
    ]);
    if (ok && this.origin) {
      this.origin.dispatchEvent(new CustomEvent("hasp:paid", {
        bubbles: true, composed: true,
        detail: { to: this.cfg.to, usd: this.cfg.usd, item: this.cfg.item, depositAddress: p.depositAddress, amountOut: d.amountOutFormatted || p.out },
      }));
    }
  };

  function readConfig(source) {
    var to = String(source.to || "").trim().toLowerCase();
    var usd = String(source.usd || "").trim();
    var amount = usdToBase(usd);
    if (!validNearAccount(to)) return { error: "Hasp: data-to must be a NEAR account, like yourname.near." };
    if (!amount) return { error: "Hasp: data-usd must be a price like 5 or 4.50, up to " + MAX_USD + "." };
    return { to: to, usd: usd, amount: amount, item: String(source.item || "").trim().slice(0, 80), label: String(source.label || "").trim() };
  }

  function mountButton(anchor, source, place) {
    var cfg = readConfig(source);
    var host = el("span", { class: "hasp-checkout" });
    var root = host.attachShadow({ mode: "open" });
    root.appendChild(el("style", { text: CSS }));
    if (cfg.error) {
      if (window.console) console.warn(cfg.error);
      root.appendChild(el("span", { style: "font:13px system-ui;color:#9d2c2c", text: cfg.error }));
    } else {
      root.appendChild(el("button", { class: "btn", type: "button", on: { click: function () { new Checkout(cfg, host).open(); } } }, [
        cfg.label || "Pay " + money(cfg.usd), el("small", { text: "with any coin" }),
      ]));
    }
    place(host);
    return host;
  }

  function scan() {
    var nodes = document.querySelectorAll("[data-hasp-to]:not([data-hasp-ready])");
    Array.prototype.forEach.call(nodes, function (node) {
      node.setAttribute("data-hasp-ready", "");
      mountButton(node, { to: node.getAttribute("data-hasp-to"), usd: node.getAttribute("data-hasp-usd"), item: node.getAttribute("data-hasp-item"), label: node.getAttribute("data-hasp-label") }, function (h) { node.appendChild(h); });
    });
  }

  var script = document.currentScript;
  window.Hasp = {
    core: core,
    /** Opens the checkout. source.coin = { chain: "base", symbol: "USDC" } skips straight to that coin. */
    open: function (source) {
      var cfg = readConfig(source || {});
      if (cfg.error) throw new Error(cfg.error);
      new Checkout(cfg, null, source && source.coin).open();
    },
    scan: scan,
  };

  function start() {
    if (script && script.getAttribute("data-to")) {
      mountButton(script, { to: script.getAttribute("data-to"), usd: script.getAttribute("data-usd"), item: script.getAttribute("data-item"), label: script.getAttribute("data-label") }, function (h) {
        script.parentNode.insertBefore(h, script.nextSibling);
      });
    }
    scan();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
