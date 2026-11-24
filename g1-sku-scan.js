/* Passive SKU and offerIdToken collection; original responses pass through. */
"use strict";

(function () {
  var STORE_KEY = "g1.sku.scan.v1";
  var LIMIT = 300;
  var url = typeof $request === "object" && $request ? $request.url : "";
  var body = typeof $response === "object" && $response ? $response.body : undefined;

  if (typeof url !== "string" || !/^https:\/\/one\.google\.com\//.test(url) ||
      /^https:\/\/one\.google\.com\/g1-sku-report\/?(?:\?|$)/.test(url) ||
      typeof body !== "string") {
    $done({});
    return;
  }

  var now = new Date().toISOString();
  var saved = {};
  try {
    if (typeof $persistentStore !== "undefined" && typeof $persistentStore.read === "function") {
      saved = JSON.parse($persistentStore.read(STORE_KEY) || "{}");
    }
  } catch (error) {
    saved = {};
  }
  if (!saved || saved.schemaVersion !== 1) saved = {};

  var byId = Object.create(null);
  var ids = [];
  var validId = /^(?:g1\.|com\.google\.one\.)[A-Za-z0-9._-]{1,160}$/;
  var oldRows = Array.isArray(saved.skus) ? saved.skus : [];
  oldRows.slice(0, LIMIT).forEach(function (row) {
    if (!row || typeof row.id !== "string" || !validId.test(row.id) || byId[row.id]) return;
    var count = Number(row.count);
    byId[row.id] = {
      id: row.id,
      count: isFinite(count) && count > 0 ? Math.floor(count) : 0,
      lastSeen: typeof row.lastSeen === "string" ? row.lastSeen.slice(0, 32) : ""
    };
    ids.push(row.id);
  });

  // Decode escaped dots for discovery only. The response body is kept intact.
  var text = body.replace(/\\u002e|\\x2e|&#0*46;|&#x0*2e;|&period;/gi, ".");
  var token = /(^|[^A-Za-z0-9._@%-])((?:g1\.|com\.google\.one\.)[A-Za-z0-9._-]+)(?=$|[^A-Za-z0-9._-])/g;
  var match;
  var found = Object.create(null);
  var hitCount = 0;
  var truncated = saved.truncated === true;
  while ((match = token.exec(text)) !== null) {
    var id = match[2];
    if (!validId.test(id)) continue;
    found[id] = (found[id] || 0) + 1;
    hitCount += 1;
    if (!byId[id]) {
      if (ids.length >= LIMIT) {
        truncated = true;
        continue;
      }
      byId[id] = { id: id, count: 0, lastSeen: now };
      ids.push(id);
    }
    byId[id].count += 1;
    byId[id].lastSeen = now;
  }

  function priorCount(value) {
    var number = Number(value);
    return isFinite(number) && number > 0 ? Math.floor(number) : 0;
  }
  var offerData = collectOfferData(body, saved, now);
  var state = {
    schemaVersion: 1,
    version: "g1-sku-scan-v7.6.0",
    updatedAt: now,
    scannedResponses: priorCount(saved.scannedResponses) + 1,
    matchedResponses: priorCount(saved.matchedResponses) + (hitCount > 0 ? 1 : 0),
    limit: LIMIT,
    truncated: truncated,
    skus: ids.sort().map(function (id) { return byId[id]; }),
    offerTokens: offerData.offerTokens,
    offerLinks: offerData.offerLinks,
    offerScan: offerData.offerScan
  };
  var stored = false;
  try {
    if (typeof $persistentStore !== "undefined" && typeof $persistentStore.write === "function") {
      stored = $persistentStore.write(JSON.stringify(state), STORE_KEY);
    }
  } catch (error) {
    stored = false;
  }

  console.log("[g1-sku-scan] candidates=" + Object.keys(found).length +
    " occurrences=" + hitCount + " offerTokens=" + offerData.offerTokens.length +
    " offerLinks=" + offerData.offerLinks.length + " saved=" + (stored ? "yes" : "no"));
  $done({});

  // Passive offer extraction shared with the other collector.
  function collectOfferData(body, previous, now) {
    var LIMIT = 200;
    var MAX_TOKEN = 2048;
    var MAX_SCAN = 2 * 1024 * 1024;
    var MAX_NODES = 2000;
    var MAX_DEPTH = 12;
    var MAX_PARSES = 100;
    var MAX_COUNT = 9007199254740991;
    var own = Object.prototype.hasOwnProperty;
    var tokenRows = [];
    var linkRows = [];
    var tokenHistory = Object.create(null);
    var linkHistory = Object.create(null);
    var responseTokens = Object.create(null);
    var responseLinks = Object.create(null);
    var seenTexts = [];
    var scanned = 0;
    var nodes = 0;
    var parses = 0;
    var limited = false;
    var truncated = !!(previous && previous.offerScan && previous.offerScan.truncated === true);
    var stamp = validStamp(now) ? now : "";

    function validStamp(value) {
      return typeof value === "string" && value.length <= 32 && !/[\x00-\x1f\x7f-\x9f]/.test(value);
    }

    function validText(value, maximum) {
      return typeof value === "string" && value.length > 0 && value.length <= maximum &&
        !/^[\s\u00a0]*$/.test(value) && !/[\x00-\x1f\x7f-\x9f]/.test(value);
    }

    function validToken(value) {
      if (typeof value === "string" && value.length > MAX_TOKEN) limited = true;
      return validText(value, MAX_TOKEN);
    }

    function validSku(value) {
      return typeof value === "string" && value.length <= 160 &&
        /^(?:g1\.|com\.google\.one\.)[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value);
    }

    function validCount(value) {
      return typeof value === "number" && isFinite(value) && value >= 1 &&
        value <= MAX_COUNT && Math.floor(value) === value;
    }

    function normalizedKey(key) {
      return key.replace(/[_-]/g, "").toLowerCase();
    }

    function isSkuKey(key) {
      key = key.toLowerCase();
      return key === "sku" || key === "skuid" || key === "sku_id" ||
        key === "productid" || key === "product_id" || key === "id";
    }

    function isOfferKey(key) {
      key = key.toLowerCase();
      return key === "offerid" || key === "offer_id" || key === "baseplanid";
    }

    function linkKey(sku, token, offerId) {
      return sku + "\x00" + token + "\x00" + offerId;
    }

    function keep(rows, history, key, row) {
      if (rows.length >= LIMIT) {
        truncated = true;
        return;
      }
      rows.push(row);
      history[key] = row;
    }

    function touch(rows, row) {
      var i;
      for (i = 0; i < rows.length; i += 1) {
        if (rows[i] === row) {
          rows.splice(i, 1);
          rows.push(row);
          return;
        }
      }
    }

    function rememberToken(token) {
      if (!validToken(token) || own.call(responseTokens, token)) return;
      responseTokens[token] = true;
      var row = tokenHistory[token];
      if (row) {
        row.count = Math.min(MAX_COUNT, row.count + 1);
        row.lastSeen = stamp;
        touch(tokenRows, row);
      } else {
        keep(tokenRows, tokenHistory, token, { token: token, count: 1, lastSeen: stamp });
      }
    }

    function rememberLink(sku, token, offerId) {
      var key = linkKey(sku, token, offerId);
      if (own.call(responseLinks, key)) return;
      responseLinks[key] = true;
      var row = linkHistory[key];
      if (row) {
        row.count = Math.min(MAX_COUNT, row.count + 1);
        row.lastSeen = stamp;
        touch(linkRows, row);
      } else {
        keep(linkRows, linkHistory, key, {
          sku: sku, token: token, offerId: offerId, count: 1, lastSeen: stamp
        });
      }
    }

    function loadPrevious() {
      var rows, i, row, key, offerId, oldLimit;
      rows = previous && previous.offerTokens;
      if (Object.prototype.toString.call(rows) === "[object Array]") {
        oldLimit = Math.min(rows.length, MAX_NODES);
        if (rows.length > oldLimit) limited = true;
        for (i = 0; i < oldLimit; i += 1) {
          row = rows[i];
          if (!row || typeof row !== "object" || !validToken(row.token) ||
              !validCount(row.count) || !validStamp(row.lastSeen) || own.call(tokenHistory, row.token)) continue;
          keep(tokenRows, tokenHistory, row.token, { token: row.token, count: row.count, lastSeen: row.lastSeen });
        }
      }
      rows = previous && previous.offerLinks;
      if (Object.prototype.toString.call(rows) === "[object Array]") {
        oldLimit = Math.min(rows.length, MAX_NODES);
        if (rows.length > oldLimit) limited = true;
        for (i = 0; i < oldLimit; i += 1) {
          row = rows[i];
          if (!row || typeof row !== "object" || !validSku(row.sku) || !validToken(row.token) ||
              !validCount(row.count) || !validStamp(row.lastSeen)) continue;
          offerId = own.call(row, "offerId") ? row.offerId : "";
          if (offerId !== "" && !validText(offerId, 180)) continue;
          key = linkKey(row.sku, row.token, offerId);
          if (own.call(linkHistory, key)) continue;
          keep(linkRows, linkHistory, key, {
            sku: row.sku, token: row.token, offerId: offerId, count: row.count, lastSeen: row.lastSeen
          });
        }
      }
    }

    function addUnique(values, value) {
      var i;
      for (i = 0; i < values.length; i += 1) if (values[i] === value) return;
      values.push(value);
    }

    function parseJSON(text) {
      if (parses >= MAX_PARSES) {
        limited = true;
        return { ok: false };
      }
      parses += 1;
      try {
        return { ok: true, value: JSON.parse(text) };
      } catch (ignore) {
        return { ok: false };
      }
    }

    function walk(value, depth) {
      if (depth > MAX_DEPTH || nodes >= MAX_NODES) {
        limited = true;
        return;
      }
      nodes += 1;
      var kind = Object.prototype.toString.call(value);
      var keys, i, key, item, skus, tokens, offers;
      if (kind === "[object Array]") {
        for (i = 0; i < value.length; i += 1) {
          if (nodes >= MAX_NODES) { limited = true; break; }
          walk(value[i], depth + 1);
        }
      } else if (value && typeof value === "object") {
        keys = [];
        skus = [];
        tokens = [];
        offers = [];
        for (key in value) {
          if (!own.call(value, key)) continue;
          keys.push(key);
          item = value[key];
          if (typeof item !== "string") continue;
          if (isSkuKey(key) && validSku(item)) addUnique(skus, item);
          if (normalizedKey(key) === "offeridtoken" && validToken(item)) {
            addUnique(tokens, item);
            rememberToken(item);
          }
          if (isOfferKey(key) && validText(item, 180)) addUnique(offers, item);
        }
        if (skus.length === 1 && tokens.length === 1) {
          rememberLink(skus[0], tokens[0], offers.length === 1 ? offers[0] : "");
        }
        for (i = 0; i < keys.length; i += 1) {
          if (nodes >= MAX_NODES) { limited = true; break; }
          if (normalizedKey(keys[i]) === "offeridtoken") continue;
          walk(value[keys[i]], depth + 1);
        }
      } else if (typeof value === "string" &&
          (/^\s*[\[{]/.test(value) || /offer[-_]*id[-_]*token|&quot;|\\"/i.test(value))) {
        scanText(value, depth + 1);
      }
    }

    function decodeEscapes(text, strict) {
      var out = "";
      var i, ch, next, hex;
      for (i = 0; i < text.length; i += 1) {
        ch = text.charAt(i);
        if (ch !== "\\") {
          out += ch;
          continue;
        }
        next = text.charAt(i + 1);
        if (next === '"' || next === "\\" || next === "/" || next === "'") {
          out += next;
          i += 1;
        } else if (next === "u" && /^[0-9a-fA-F]{4}$/.test(text.substr(i + 2, 4))) {
          hex = parseInt(text.substr(i + 2, 4), 16);
          out += String.fromCharCode(hex);
          i += 5;
        } else if (next === "b" || next === "f" || next === "n" || next === "r" || next === "t") {
          out += next === "b" ? "\b" : next === "f" ? "\f" : next === "n" ? "\n" : next === "r" ? "\r" : "\t";
          i += 1;
        } else if (strict) {
          return null;
        } else {
          out += ch;
        }
      }
      return out;
    }

    function decodeEntities(text) {
      return text.replace(/&(?:quot|apos|amp|lt|gt|#\d{1,7}|#x[0-9a-f]{1,6});/gi, function (entity) {
        var name = entity.slice(1, -1).toLowerCase();
        var code;
        if (name === "quot") return '"';
        if (name === "apos") return "'";
        if (name === "amp") return "&";
        if (name === "lt") return "<";
        if (name === "gt") return ">";
        code = name.charAt(1) === "x" ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
        if (code < 0 || code > 1114111 || (code >= 55296 && code <= 57343)) return entity;
        if (code <= 65535) return String.fromCharCode(code);
        code -= 65536;
        return String.fromCharCode(55296 + (code >> 10), 56320 + (code & 1023));
      });
    }

    function quotedValue(text, start, html) {
      var quote = text.charAt(start);
      if (quote !== '"' && quote !== "'") return null;
      var i, escaped = false;
      var maximum = Math.min(text.length, start + MAX_TOKEN * 6 + 3);
      for (i = start + 1; i < maximum; i += 1) {
        if (text.charAt(i) === quote && (!escaped || html)) {
          var raw = text.slice(start + 1, i);
          return html ? decodeEntities(raw) : decodeEscapes(raw, true);
        }
        if (!html && text.charAt(i) === "\\") escaped = !escaped;
        else escaped = false;
      }
      if (maximum < text.length) limited = true;
      return null;
    }

    function scanNamedTokens(text) {
      var field = /(?:^|[^A-Za-z0-9_$-])(?:"offer[-_]*id[-_]*token"|'offer[-_]*id[-_]*token'|offer[-_]*id[-_]*token)\s*:\s*/gi;
      var attribute = /(?:^|[\s<])data-offer-id-token\s*=\s*/gi;
      var match, value, start, end, quote, raw;
      var pieces = [];
      var last = 0;
      while ((match = attribute.exec(text)) !== null) {
        start = attribute.lastIndex;
        quote = text.charAt(start);
        if (quote !== '"' && quote !== "'") continue;
        end = text.indexOf(quote, start + 1);
        if (end < 0) {
          end = text.length;
          limited = true;
        } else {
          raw = text.slice(start + 1, end);
          if (raw.length > MAX_TOKEN * 6) limited = true;
          else rememberToken(decodeEntities(raw));
        }
        pieces.push(text.slice(last, start));
        pieces.push(new Array(Math.min(text.length, end + 1) - start + 1).join(" "));
        last = Math.min(text.length, end + 1);
        attribute.lastIndex = last;
      }
      if (pieces.length) {
        pieces.push(text.slice(last));
        text = pieces.join("");
      }
      while ((match = field.exec(text)) !== null) {
        value = quotedValue(text, field.lastIndex, false);
        if (value !== null) rememberToken(value);
      }
      return text;
    }

    function scanFragments(text, depth) {
      var stack = [];
      var overflow = 0;
      var quote = false;
      var escaped = false;
      var i, ch, start, parsed;
      var found = false;
      for (i = 0; i < text.length; i += 1) {
        ch = text.charAt(i);
        if (quote) {
          if (ch === '"' && !escaped) quote = false;
          if (ch === "\\") escaped = !escaped;
          else escaped = false;
          continue;
        }
        if (ch === '"' && (stack.length || overflow)) {
          quote = true;
          escaped = false;
        } else if (ch === "{" || ch === "[") {
          if (stack.length >= MAX_DEPTH + 1 || overflow) {
            overflow += 1;
            limited = true;
          } else {
            stack.push({ at: i, ch: ch });
          }
        } else if (ch === "}" || ch === "]") {
          if (overflow) { overflow -= 1; continue; }
          if (!stack.length) continue;
          start = stack.pop();
          if ((start.ch === "{" && ch !== "}") || (start.ch === "[" && ch !== "]")) {
            stack = [];
            continue;
          }
          if (parses >= MAX_PARSES) { limited = true; return found; }
          parsed = parseJSON(text.slice(start.at, i + 1));
          if (parsed.ok) {
            found = true;
            walk(parsed.value, depth + 1);
          }
        }
      }
      return found;
    }

    function scanText(text, depth) {
      if (depth > MAX_DEPTH) { limited = true; return; }
      var i, remaining, parsed, decoded;
      for (i = 0; i < seenTexts.length; i += 1) if (seenTexts[i] === text) return;
      if (seenTexts.length >= MAX_PARSES) { limited = true; return; }
      remaining = MAX_SCAN - scanned;
      if (remaining <= 0) { limited = true; return; }
      if (text.length > remaining) {
        text = text.slice(0, remaining);
        limited = true;
      }
      seenTexts.push(text);
      scanned += text.length;
      parsed = parseJSON(text);
      if (parsed.ok) {
        walk(parsed.value, depth);
        return;
      }
      text = scanNamedTokens(text);
      if (scanFragments(text, depth)) return;
      if (/[&](?:quot|apos|amp|lt|gt|#)/i.test(text)) {
        decoded = decodeEntities(text);
        if (decoded !== text) scanText(decoded, depth + 1);
      }
      if (/\\(?:"|\\|u[0-9a-fA-F]{4})/.test(text)) {
        decoded = decodeEscapes(text, false);
        if (decoded !== text) scanText(decoded, depth + 1);
      }
    }

    loadPrevious();
    if (typeof body === "string" && body.length) scanText(body, 0);
    return {
      offerTokens: tokenRows,
      offerLinks: linkRows,
      offerScan: { limit: LIMIT, maxTokenLength: MAX_TOKEN, truncated: truncated, limited: limited }
    };
  }
})();
