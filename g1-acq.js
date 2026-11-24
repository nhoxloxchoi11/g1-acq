/* Google One combined 2TB / 20TB / 30TB mappings for Shadowrocket. */
"use strict";

(function () {
  var VERSION = "g1-acq-v7.7.0";
  var SOURCE_PREFIX = "g1.ios.2tb.";
  // User-selected 12-month offer ID from the screenshot; store metadata is still unverified.
  var TARGET = "g1.2tb.ai.12months_ip_90p";
  var SKU_MAP = {
    "g1.ios.ai.2tb.m.ip_1mo_90p.acq": "g1.2tb.ai.12months_eft",
    "g1.ios.20tb.m.v2": "g1.2tb.ai.18months_eft",
    "g1.ios.30tb.ai.pro.m": "g1.ai.ultra.1month_eft.acq"
  };
  var TEST_KEY = "g1.pro.annual.test.v1";
  var SCAN_KEY = "g1.sku.scan.v1";
  var SCAN_LIMIT = 300;
  var RECENT_LIMIT = 10;
  var MAX_EVENT_COUNT = 9007199254740991;
  var url = typeof $request === "object" && $request ? $request.url : "";

  if (typeof url !== "string" || !/^https:\/\/one\.google\.com\//.test(url) ||
      /^https:\/\/one\.google\.com\/g1-sku-report\/?(?:\?|$)/.test(url)) {
    $done({});
    return;
  }

  var body = typeof $response === "object" && $response ? $response.body : undefined;
  var responseHeaders = typeof $response === "object" && $response ? $response.headers : {};
  var scanInput = skuScanInput(body, url, responseHeaders);
  try {
    collectOriginalSkus(body);
  } catch (error) {
    console.log("[g1-acq] SKU collection unavailable");
  }

  if (scanInput.binary || !/^https:\/\/one\.google\.com\/ai\?/.test(url)) {
    $done({});
    return;
  }

  var mappings = Object.create(null);
  var hits = 0;
  var annualHits = 0;
  var out = body;

  if (typeof body === "string") {
    // Each source uses its configured fixed target.
    // Match complete tokens before selecting the 2TB prefix or an exact source ID.
    out = body.replace(
      /(^|[^A-Za-z0-9._@%-])(g1\.[A-Za-z0-9._-]+)(?=$|[^A-Za-z0-9._-])/g,
      function (match, before, id) {
        var isAnnual = id.indexOf(SOURCE_PREFIX) === 0 && id.length > SOURCE_PREFIX.length;
        var to;
        var fallback = false;
        if (isAnnual) {
          to = TARGET;
        } else if (Object.prototype.hasOwnProperty.call(SKU_MAP, id)) {
          to = SKU_MAP[id];
        } else {
          return match;
        }
        if (!mappings[id]) mappings[id] = { id: id, to: to, count: 0, fallback: fallback };
        mappings[id].count += 1;
        hits += 1;
        if (isAnnual || id === "g1.ios.ai.2tb.m.ip_1mo_90p.acq") annualHits += 1;
        return before + to;
      }
    );
  }

  var sources = Object.keys(mappings).sort().map(function (id) {
    return mappings[id];
  });
  var record = {
    schemaVersion: 1,
    version: VERSION,
    updatedAt: new Date().toISOString(),
    sourcePrefix: SOURCE_PREFIX,
    target: TARGET,
    targetOrigin: "user-specified",
    hitCount: hits,
    // Legacy field name: counts 2TB/Pro rewrites, not the billing interval.
    annualHitCount: annualHits,
    matchedFrom: sources,
    status: typeof body !== "string" ? "non-text" : hits ? "rewritten" : "no-match"
  };

  try {
    if (typeof $persistentStore !== "undefined" &&
        typeof $persistentStore.write === "function") {
      if (!$persistentStore.write(JSON.stringify(record), TEST_KEY)) {
        console.log("[g1-acq] local record write failed");
      }
    }
  } catch (error) {
    console.log("[g1-acq] local record unavailable");
  }

  console.log("[g1-acq] " + VERSION + " hits=" + hits + " annualHits=" + annualHits);
  $done(hits ? { body: out } : {});

  function collectOriginalSkus(originalBody) {
    var now = new Date().toISOString();
    var saved = {};
    try {
      if (typeof $persistentStore !== "undefined" && typeof $persistentStore.read === "function") {
        saved = JSON.parse($persistentStore.read(SCAN_KEY) || "{}");
      }
    } catch (error) {
      saved = {};
    }
    if (!saved || saved.schemaVersion !== 1) saved = {};

    var byId = Object.create(null);
    var ids = [];
    var oldRows = Array.isArray(saved.skus) ? saved.skus : [];
    oldRows.slice(0, SCAN_LIMIT).forEach(function (row) {
      if (!row) return;
      var id = cleanSkuCandidate(row.id);
      if (!id || byId[id]) return;
      var count = Number(row.count);
      byId[id] = {
        id: id,
        count: isFinite(count) && count > 0 ? Math.floor(count) : 0,
        lastSeen: typeof row.lastSeen === "string" ? row.lastSeen.slice(0, 32) : ""
      };
      ids.push(id);
    });

    var isText = scanInput.isText;
    var found = Object.create(null);
    var hitCount = 0;
    var addedCount = 0;
    var omittedCount = 0;
    var truncated = saved.truncated === true;
    if (scanInput.text) {
      // Discovery copies may include the URL and Location; the original body stays intact.
      var text = scanInput.text;
      var token = /(^|[^A-Za-z0-9._@%-])((?:g1[._:]|com\.google\.one\.)[A-Za-z0-9._:-]{2,240})(?=$|[^A-Za-z0-9._:@-])/gi;
      var match;
      while ((match = token.exec(text)) !== null) {
        var id = cleanSkuCandidate(match[2]);
        if (!id) continue;
        found[id] = (found[id] || 0) + 1;
        hitCount += 1;
        if (!byId[id]) {
          if (ids.length >= SCAN_LIMIT) {
            truncated = true;
            if (found[id] === 1) omittedCount += 1;
            continue;
          }
          byId[id] = { id: id, count: 0, lastSeen: now };
          ids.push(id);
          addedCount += 1;
        }
        byId[id].count += 1;
        byId[id].lastSeen = now;
      }
    }

    var offerData = collectOfferData(originalBody, saved, now, url, responseHeaders);
    offerData.offerScan.limited = offerData.offerScan.limited || scanInput.limited;
    offerData.currentDecodedSkus.forEach(function (raw) {
      var id = cleanSkuCandidate(raw);
      if (!id || found[id]) return;
      found[id] = 1;
      hitCount += 1;
      if (!byId[id]) {
        if (ids.length >= SCAN_LIMIT) { truncated = true; omittedCount += 1; return; }
        byId[id] = { id: id, count: 0, lastSeen: now };
        ids.push(id);
        addedCount += 1;
      }
      byId[id].count += 1;
      byId[id].lastSeen = now;
    });
    var candidateCount = Object.keys(found).length;
    var bodyType = isText ? "text" : "non-text";
    var status = responseStatus(bodyType, candidateCount, addedCount, omittedCount);
    var recentResponses = [];
    var oldResponses = Array.isArray(saved.recentResponses) ? saved.recentResponses : [];
    oldResponses.slice(-RECENT_LIMIT).forEach(function (row) {
      var event = priorResponse(row);
      if (event) recentResponses.push(event);
    });
    // Preserve arrival order even if the device clock moves backward.
    recentResponses.push({
      at: now,
      path: safeRoute(url),
      bodyType: bodyType,
      status: status,
      candidateCount: candidateCount,
      addedCount: addedCount,
      omittedCount: omittedCount
    });

    function priorCount(value) {
      var number = Number(value);
      return isFinite(number) && number > 0 ? Math.floor(number) : 0;
    }
    var state = {
      schemaVersion: 1,
      version: VERSION,
      updatedAt: now,
      scannedResponses: priorCount(saved.scannedResponses) + (isText ? 1 : 0),
      matchedResponses: priorCount(saved.matchedResponses) + (hitCount > 0 ? 1 : 0),
      nonTextResponses: priorCount(saved.nonTextResponses) + (isText ? 0 : 1),
      matchedOfferTokenResponses: priorCount(saved.matchedOfferTokenResponses) + (offerData.offerScan.tokenCount > 0 ? 1 : 0),
      recentResponses: recentResponses.slice(-RECENT_LIMIT),
      limit: SCAN_LIMIT,
      truncated: truncated,
      skus: ids.sort().map(function (id) { return byId[id]; }),
      offerTokens: offerData.offerTokens,
      offerLinks: offerData.offerLinks,
      offerScan: offerData.offerScan,
      encodedCandidates: offerData.encodedCandidates
    };
    var stored = false;
    try {
      if (typeof $persistentStore !== "undefined" && typeof $persistentStore.write === "function") {
        stored = $persistentStore.write(JSON.stringify(state), SCAN_KEY);
      }
    } catch (error) {
      stored = false;
    }

    console.log("[g1-acq] " + VERSION + " status=" + status + " addedCount=" + addedCount +
      " candidates=" + candidateCount + " omittedCount=" + omittedCount +
      " occurrences=" + hitCount + " offerTokens=" + offerData.offerTokens.length +
      " offerLinks=" + offerData.offerLinks.length + " saved=" + (stored ? "yes" : "no"));
  }

  function safeRoute(requestUrl) {
    var path = requestUrl.replace(/^https:\/\/one\.google\.com/, "").split(/[?#]/)[0];
    path = path.replace(/\/+$/, "") || "/";
    if (path === "/" || path === "/ai" || path === "/plans") return path;
    if (/^\/_\/[^?#]+\/data\/batchexecute$/.test(path)) return "/_/…/data/batchexecute";
    return "[其他 one.google.com 路径]";
  }

  function responseStatus(bodyType, candidateCount, addedCount, omittedCount) {
    if (bodyType === "non-text") return "non-text";
    if (addedCount > 0) return "new-skus";
    if (omittedCount > 0) return "limit-reached";
    return candidateCount > 0 ? "known-skus" : "no-skus";
  }

  function priorResponse(row) {
    if (!row || typeof row !== "object" || Array.isArray(row)) return null;
    if (typeof row.at !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(row.at) ||
        !isFinite(Date.parse(row.at)) || new Date(row.at).toISOString() !== row.at) return null;
    if (row.path !== "/" && row.path !== "/ai" && row.path !== "/plans" &&
        row.path !== "/_/…/data/batchexecute" && row.path !== "[其他 one.google.com 路径]") return null;
    if (row.bodyType !== "text" && row.bodyType !== "non-text") return null;

    function counter(value, maximum) {
      if (typeof value !== "number" || !isFinite(value)) return null;
      return Math.max(0, Math.min(maximum, Math.floor(value)));
    }
    var candidateCount = counter(row.candidateCount, MAX_EVENT_COUNT);
    if (candidateCount === null) return null;
    var addedCount = counter(row.addedCount, Math.min(SCAN_LIMIT, candidateCount));
    if (addedCount === null) return null;
    var omittedCount = counter(row.omittedCount, candidateCount - addedCount);
    if (omittedCount === null) return null;
    if (row.status !== responseStatus(row.bodyType, candidateCount, addedCount, omittedCount)) return null;
    return {
      at: row.at,
      path: row.path,
      bodyType: row.bodyType,
      status: row.status,
      candidateCount: candidateCount,
      addedCount: addedCount,
      omittedCount: omittedCount
    };
  }

  // Passive offer extraction shared with the other collector.
  function cleanSkuCandidate(raw) {
    if (typeof raw !== "string") return "";
    var id = raw.replace(/[.:]+$/, "");
    if (!/^(?:g1[._:]|com\.google\.one\.)[A-Za-z0-9._:-]{2,240}$/i.test(id)) return "";
    if (/^g1[._:]/i.test(id)) {
      var suffix = id.slice(3);
      if (/^(?:prototype|constructor|length|call|apply|bind|tostring|valueof|hasownproperty|push|pop|shift|unshift|slice|splice|map|filter|foreach|reduce|indexof|includes|split|join|replace|match|test|exec|trim|keys|values|entries|then|catch|finally|style|classname|classlist|innerhtml|textcontent|parentnode|childnodes|appendchild|removechild|getattribute|setattribute|addeventlistener|removeeventlistener|target|currenttarget|preventdefault|stoppropagation|src|href|width|height|top|left|right|bottom|focus|blur|click|checked|disabled|selected|options|nodetype|nodename|tagname|dataset|documentelement|body|head|value|name|id)$/i.test(suffix)) return "";
      if (/\.(?:js|mjs|cjs|css|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|eot|map|html?|xml|com|net|org|io|dev|app|gstatic\.com|googleapis\.com|googleusercontent\.com)$/i.test(id)) return "";
    }
    return id;
  }

  function normalizeSkuText(input) {
    var value = typeof input === "string" ? input : "";
    if (!/[\\&%]/.test(value)) return value;
    function ascii(code, original) {
      return code >= 32 && code <= 126 ? String.fromCharCode(code) : original;
    }
    for (var pass = 0; pass < 2; pass += 1) {
      value = value.replace(/\\+u([0-9a-f]{4})/gi, function (all, hex) { return ascii(parseInt(hex, 16), " "); });
      value = value.replace(/\\+x([0-9a-f]{2})/gi, function (all, hex) { return ascii(parseInt(hex, 16), " "); });
      value = value.replace(/\\+[nrt]/g, " ").replace(/\\+(["'\/])/g, "$1");
      value = value.replace(/&#0*(\d+);/g, function (all, dec) { return ascii(parseInt(dec, 10), all); });
      value = value.replace(/&#x0*([0-9a-f]+);/gi, function (all, hex) { return ascii(parseInt(hex, 16), all); });
      value = value.replace(/&period;/gi, ".").replace(/&quot;/gi, '"').replace(/&apos;/gi, "'")
        .replace(/&amp;/gi, "&").replace(/&colon;/gi, ":").replace(/&equals;/gi, "=")
        .replace(/&sol;/gi, "/").replace(/&lowbar;/gi, "_").replace(/&hyphen;|&dash;/gi, "-");
      value = value.replace(/%([0-9a-f]{2})/gi, function (all, hex) { return ascii(parseInt(hex, 16), all); });
    }
    return value;
  }

  function skuScanInput(body, requestUrl, headers) {
    var contentType = "";
    var location = "";
    if (headers && typeof headers === "object") {
      Object.keys(headers).forEach(function (key) {
        var value = headers[key];
        if (Array.isArray(value)) value = value.slice(0, 10).filter(function (item) { return typeof item === "string"; }).join("\n");
        if (typeof value !== "string") return;
        if (key.toLowerCase() === "content-type") contentType = value.toLowerCase().replace(/^\s+|\s+$/g, "");
        if (key.toLowerCase() === "location") location = value;
      });
    }
    var binary = /^(?:image|audio|video|font)\/|^application\/(?:wasm|pdf|font[^;]*|x-font[^;]*|vnd\.ms-fontobject)(?:\s*;|$)/.test(contentType);
    function bounded(value, maximum) {
      if (typeof value !== "string") return "";
      return value.slice(0, maximum);
    }
    return {
      isText: typeof body === "string" && !binary,
      binary: binary,
      limited: (typeof body === "string" && !binary && body.length > 4 * 1024 * 1024) ||
        (typeof requestUrl === "string" && requestUrl.length > 65536) || location.length > 65536,
      text: [normalizeSkuText(bounded(requestUrl, 65536)), normalizeSkuText(bounded(location, 65536)),
        binary ? "" : normalizeSkuText(bounded(body, 4 * 1024 * 1024))].join(" ")
    };
  }

  function collectOfferData(body, previous, now, requestUrl, responseHeaders) {
    var LIMIT = 200;
    var MAX_TOKEN = 2048;
    var MAX_SCAN = 4 * 1024 * 1024;
    var MAX_AUX = 64 * 1024;
    var MAX_B64_PROBES = 600;
    var MAX_NODES = 2000;
    var MAX_DEPTH = 12;
    var MAX_PARSES = 100;
    var MAX_COUNT = 9007199254740991;
    var own = Object.prototype.hasOwnProperty;
    var tokenRows = [];
    var linkRows = [];
    var candidateRows = [];
    var tokenHistory = Object.create(null);
    var linkHistory = Object.create(null);
    var candidateHistory = Object.create(null);
    var responseTokens = Object.create(null);
    var responseLinks = Object.create(null);
    var responseCandidates = Object.create(null);
    var currentDecodedSkus = [];
    var currentDecodedSkuMap = Object.create(null);
    var decodedCache = Object.create(null);
    var seenTexts = [];
    var scanned = { body: 0, url: 0, location: 0 };
    var base64Probes = 0;
    var nodes = 0;
    var parses = 0;
    var limited = false;
    var truncated = !!(previous && ((previous.offerScan && previous.offerScan.truncated === true) || previous.offerTokensTruncated === true));
    var stamp = validStamp(now) ? now : "";
    var noiseSuffixRe = /^(?:prototype|constructor|length|call|apply|bind|tostring|valueof|hasownproperty|push|pop|shift|unshift|slice|splice|map|filter|foreach|reduce|indexof|includes|split|join|replace|match|test|exec|trim|keys|values|entries|then|catch|finally|style|classname|classlist|innerhtml|textcontent|parentnode|childnodes|appendchild|removechild|getattribute|setattribute|addeventlistener|removeeventlistener|target|currenttarget|preventdefault|stoppropagation|src|href|width|height|top|left|right|bottom|focus|blur|click|checked|disabled|selected|options|nodetype|nodename|tagname|dataset|documentelement|body|head|value|name|id)$/i;
    var assetEndRe = /\.(?:js|mjs|cjs|css|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|eot|map|html?|xml|com|net|org|io|dev|app|gstatic\.com|googleapis\.com|googleusercontent\.com)$/i;

    function validStamp(value) {
      return typeof value === "string" && value.length <= 32 && !/[\x00-\x1f\x7f-\x9f]/.test(value);
    }

    function validText(value, maximum) {
      return typeof value === "string" && value.length > 0 && value.length <= maximum &&
        !/^[\s\u00a0]*$/.test(value) && !/[\x00-\x1f\x7f-\x9f]/.test(value);
    }

    function validToken(value) {
      if (typeof value === "string" && value.length > MAX_TOKEN) limited = true;
      return validText(value, MAX_TOKEN) &&
        !/^(?:undefined|function|arguments|offeridtoken|offer_id_token|offertoken|offer_token|offer-id-token)$/i.test(value);
    }

    function cleanSku(value) {
      if (typeof value !== "string") return "";
      var id = value.replace(/[.:]+$/, "");
      if (!/^(?:g1[._:]|com\.google\.one\.)[A-Za-z0-9._:-]{2,240}$/i.test(id)) return "";
      if (/^g1[._:]/i.test(id) && (noiseSuffixRe.test(id.slice(3)) || assetEndRe.test(id))) return "";
      return id;
    }

    function validCount(value) {
      return typeof value === "number" && isFinite(value) && value >= 1 &&
        value <= MAX_COUNT && Math.floor(value) === value;
    }

    function normalizedKey(key) {
      return key.replace(/[_-]/g, "").toLowerCase();
    }

    function isTokenKey(key) {
      key = normalizedKey(key);
      return /^[a-z0-9]*offer(?:id)?token$/.test(key);
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

    function rememberToken(token, source) {
      if (!validToken(token)) return;
      probeBase64(token, source);
      if (own.call(responseTokens, token)) return;
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

    function candidateKey(token, decoded, source) {
      return token + "\x00" + decoded.skus.join("\x00") + "\x00" + decoded.format + "\x00" + source;
    }

    function rememberCandidate(token, decoded, source, count, lastSeen, historical) {
      if (!decoded || !decoded.skus.length) return;
      var key = candidateKey(token, decoded, source);
      var row = candidateHistory[key];
      if (historical) {
        if (!row) keep(candidateRows, candidateHistory, key, {
          token: token, skus: decoded.skus.slice(0), format: decoded.format,
          source: source, count: count, lastSeen: lastSeen
        });
        return;
      }
      var i;
      for (i = 0; i < decoded.skus.length; i += 1) {
        if (!own.call(currentDecodedSkuMap, decoded.skus[i])) {
          currentDecodedSkuMap[decoded.skus[i]] = true;
          currentDecodedSkus.push(decoded.skus[i]);
        }
      }
      if (own.call(responseCandidates, key)) return;
      responseCandidates[key] = true;
      if (row) {
        row.count = Math.min(MAX_COUNT, row.count + 1);
        row.lastSeen = stamp;
        touch(candidateRows, row);
      } else keep(candidateRows, candidateHistory, key, {
        token: token, skus: decoded.skus.slice(0), format: decoded.format,
        source: source, count: 1, lastSeen: stamp
      });
    }

    function decodeBase64(str) {
      if (typeof str !== "string" || str.length < 16 || str.length > MAX_TOKEN ||
          !/^[A-Za-z0-9+\/_-]+={0,2}$/.test(str)) return null;
      var clean = str.replace(/-/g, "+").replace(/_/g, "/");
      var core = clean.replace(/=+$/, "");
      var padding = clean.length - core.length;
      var remainder = core.length % 4;
      if (remainder === 1 || (padding && (clean.length % 4 !== 0 ||
          padding !== (remainder === 2 ? 2 : remainder === 3 ? 1 : 0)))) return null;
      var alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
      var bytes = [];
      var i, a, b, c, d;
      for (i = 0; i < core.length; i += 4) {
        a = alphabet.indexOf(core.charAt(i));
        b = alphabet.indexOf(core.charAt(i + 1));
        c = i + 2 < core.length ? alphabet.indexOf(core.charAt(i + 2)) : -1;
        d = i + 3 < core.length ? alphabet.indexOf(core.charAt(i + 3)) : -1;
        if (a < 0 || b < 0 || (c < 0 && (b & 15)) || (d < 0 && c >= 0 && (c & 3))) return null;
        bytes.push((a << 2) | (b >> 4));
        if (c >= 0) bytes.push(((b & 15) << 4) | (c >> 2));
        if (d >= 0) bytes.push(((c & 3) << 6) | d);
      }
      return bytes;
    }

    function extractEncodedSkus(token) {
      if (own.call(decodedCache, token)) return decodedCache[token];
      if (typeof token !== "string" || token.length < 16 || token.length > MAX_TOKEN ||
          !/^[A-Za-z0-9+\/_-]+={0,2}$/.test(token)) return null;
      if (base64Probes >= MAX_B64_PROBES) { limited = true; return null; }
      base64Probes += 1;
      var bytes = decodeBase64(token);
      var found = [];
      var seen = Object.create(null);
      var result = null;
      decodedCache[token] = null;
      if (!bytes) return null;

      function add(value) {
        var id = cleanSku(value);
        if (!id || own.call(seen, id)) return;
        if (found.length >= 10) { limited = true; return; }
        seen[id] = true;
        found.push(id);
      }

      function varint(at) {
        var value = 0;
        var multiplier = 1;
        var index, byte;
        for (index = 0; index < 5 && at + index < bytes.length; index += 1) {
          byte = bytes[at + index];
          value += (byte & 127) * multiplier;
          if (!(byte & 128)) return { value: value, end: at + index + 1 };
          multiplier *= 128;
        }
        return null;
      }

      var i, j, tag, length, chars, ok;
      for (i = 0; i < bytes.length - 2; i += 1) {
        tag = varint(i);
        if (!tag || tag.value < 10 || tag.value % 8 !== 2 || tag.value > 4294967295) continue;
        length = varint(tag.end);
        if (!length || length.value < 5 || length.value > 256 || length.end + length.value > bytes.length) continue;
        chars = [];
        ok = true;
        for (j = length.end; j < length.end + length.value; j += 1) {
          if (bytes[j] < 32 || bytes[j] > 126) { ok = false; break; }
          chars.push(String.fromCharCode(bytes[j]));
        }
        if (ok) add(chars.join(""));
      }
      if (found.length) result = { skus: found.sort(), format: "protobuf" };
      else {
        chars = [];
        for (i = 0; i < bytes.length; i += 1) {
          chars.push(bytes[i] >= 32 && bytes[i] <= 126 ? String.fromCharCode(bytes[i]) : " ");
        }
        var inner = /(^|[^A-Za-z0-9._@%-])((?:g1[._:]|com\.google\.one\.)[A-Za-z0-9._:-]{2,240})(?=$|[^A-Za-z0-9._:@-])/gi;
        var match;
        var ascii = chars.join("");
        while ((match = inner.exec(ascii)) !== null) add(match[2]);
        if (found.length) result = { skus: found.sort(), format: "ascii" };
      }
      decodedCache[token] = result;
      return result;
    }

    function hasSkuPrefixHint(token) {
      if (typeof token !== "string" || token.length < 16 || token.length > MAX_TOKEN ||
          !/^[A-Za-z0-9+\/_-]+={0,2}$/.test(token)) return false;
      if (/ZzEu|cxL|nMS|ZzFf|cxX|nMV|ZzE6|cxO|nMT|RzEu|HMS|RzFf|HMV|RzE6|HMT|Y29tLmdvb2dsZS5vbmU|NvbS5nb29nbGUub25lL|jb20uZ29vZ2xlLm9uZS/.test(token)) return true;
      var alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
      var clean = token.replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");
      var expected = "com.google.one.";
      var comState = 0;
      var gState = 0;
      var i, a, b, c, d;
      function accept(byte) {
        if (byte >= 65 && byte <= 90) byte += 32;
        if (gState === 2 && (byte === 46 || byte === 95 || byte === 58)) return true;
        if (gState === 1 && byte === 49) gState = 2;
        else gState = byte === 103 ? 1 : 0;
        if (byte === expected.charCodeAt(comState)) comState += 1;
        else comState = byte === 99 ? 1 : 0;
        return comState === expected.length;
      }
      for (i = 0; i < clean.length; i += 4) {
        a = alphabet.indexOf(clean.charAt(i));
        b = alphabet.indexOf(clean.charAt(i + 1));
        c = i + 2 < clean.length ? alphabet.indexOf(clean.charAt(i + 2)) : -1;
        d = i + 3 < clean.length ? alphabet.indexOf(clean.charAt(i + 3)) : -1;
        if (a < 0 || b < 0) return false;
        if (accept((a << 2) | (b >> 4))) return true;
        if (c >= 0 && accept(((b & 15) << 4) | (c >> 2))) return true;
        if (d >= 0 && c >= 0 && accept(((c & 3) << 6) | d)) return true;
      }
      return false;
    }

    function probeBase64(token, source, unlabeled) {
      if (unlabeled && !hasSkuPrefixHint(token)) return;
      var decoded = extractEncodedSkus(token);
      if (decoded) rememberCandidate(token, decoded, source, 1, stamp, false);
    }

    function loadPrevious() {
      var rows, i, row, key, offerId, oldLimit, sku, decoded, source, count, lastSeen;
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
          if (!row || typeof row !== "object" || !(sku = cleanSku(row.sku)) || !validToken(row.token) ||
              !validCount(row.count) || !validStamp(row.lastSeen)) continue;
          offerId = own.call(row, "offerId") ? row.offerId : "";
          if (offerId !== "" && !validText(offerId, 180)) continue;
          key = linkKey(sku, row.token, offerId);
          if (own.call(linkHistory, key)) continue;
          keep(linkRows, linkHistory, key, {
            sku: sku, token: row.token, offerId: offerId, count: row.count, lastSeen: row.lastSeen
          });
        }
      }
      rows = previous && previous.encodedCandidates;
      if (Object.prototype.toString.call(rows) === "[object Array]") {
        oldLimit = Math.min(rows.length, MAX_NODES);
        if (rows.length > oldLimit) limited = true;
        for (i = 0; i < oldLimit; i += 1) {
          row = rows[i];
          if (!row || !validToken(row.token) || !validCount(row.count) || !validStamp(row.lastSeen) ||
              (row.source !== "body" && row.source !== "url" && row.source !== "location") ||
              (row.format !== "protobuf" && row.format !== "ascii")) continue;
          decoded = extractEncodedSkus(row.token);
          if (decoded) rememberCandidate(row.token, decoded, row.source, row.count, row.lastSeen, true);
        }
      }
      rows = previous && previous.offerIdTokens;
      if (Object.prototype.toString.call(rows) === "[object Array]") {
        oldLimit = Math.min(rows.length, MAX_NODES);
        if (rows.length > oldLimit) limited = true;
        for (i = 0; i < oldLimit; i += 1) {
          row = rows[i];
          if (!row || !validToken(row.token)) continue;
          if (typeof row.count !== "number" && typeof row.count !== "string") continue;
          count = Number(row.count);
          if (!isFinite(count) || count < 1 || count > MAX_COUNT) continue;
          count = Math.floor(count);
          lastSeen = validStamp(row.lastSeen) ? row.lastSeen : "";
          if (!own.call(tokenHistory, row.token)) keep(tokenRows, tokenHistory, row.token, {
            token: row.token, count: count, lastSeen: lastSeen
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

    function walk(value, depth, source) {
      if (depth > MAX_DEPTH || nodes >= MAX_NODES) {
        limited = true;
        return;
      }
      nodes += 1;
      var kind = Object.prototype.toString.call(value);
      var keys, i, key, item, skus, tokens, offers, sku;
      if (kind === "[object Array]") {
        if (value.length === 2 && typeof value[0] === "string" && isTokenKey(value[0]) && typeof value[1] === "string") {
          rememberToken(value[1], source);
          return;
        }
        for (i = 0; i < value.length; i += 1) {
          if (nodes >= MAX_NODES) { limited = true; break; }
          walk(value[i], depth + 1, source);
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
          sku = isSkuKey(key) ? cleanSku(item) : "";
          if (sku) addUnique(skus, sku);
          if (isTokenKey(key) && validToken(item)) {
            addUnique(tokens, item);
            rememberToken(item, source);
          }
          if (isOfferKey(key) && validText(item, 180)) addUnique(offers, item);
        }
        if (skus.length === 1 && tokens.length === 1) {
          rememberLink(skus[0], tokens[0], offers.length === 1 ? offers[0] : "");
        }
        for (i = 0; i < keys.length; i += 1) {
          if (nodes >= MAX_NODES) { limited = true; break; }
          if (isTokenKey(keys[i])) continue;
          walk(value[keys[i]], depth + 1, source);
        }
      } else if (typeof value === "string") {
        probeBase64(value, source, true);
        if (/^\s*[\[{]/.test(value) || /offer[-_]*(?:id[-_]*)?token|&quot;|\\["xu]|%[0-9a-f]{2}/i.test(value)) {
          scanText(value, depth + 1, source);
        }
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
        } else if (next === "x" && /^[0-9a-fA-F]{2}$/.test(text.substr(i + 2, 2))) {
          out += String.fromCharCode(parseInt(text.substr(i + 2, 2), 16));
          i += 3;
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
      return text.replace(/&(?:quot|apos|amp|lt|gt|period|colon|equals|sol|lowbar|hyphen|dash|#\d{1,7}|#x[0-9a-f]{1,6});/gi, function (entity) {
        var name = entity.slice(1, -1).toLowerCase();
        var code;
        if (name === "quot") return '"';
        if (name === "apos") return "'";
        if (name === "amp") return "&";
        if (name === "lt") return "<";
        if (name === "gt") return ">";
        if (name === "period") return ".";
        if (name === "colon") return ":";
        if (name === "equals") return "=";
        if (name === "sol") return "/";
        if (name === "lowbar") return "_";
        if (name === "hyphen" || name === "dash") return "-";
        code = name.charAt(1) === "x" ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
        if (code < 0 || code > 1114111 || (code >= 55296 && code <= 57343)) return entity;
        if (code <= 65535) return String.fromCharCode(code);
        code -= 65536;
        return String.fromCharCode(55296 + (code >> 10), 56320 + (code & 1023));
      });
    }

    function decodePercent(text) {
      if (!/%[0-9a-f]{2}/i.test(text)) return text;
      try { return decodeURIComponent(text); }
      catch (ignore) {
        return text.replace(/%([0-9a-f]{2})/gi, function (all, hex) {
          return String.fromCharCode(parseInt(hex, 16));
        });
      }
    }

    function discoveryValue(text) {
      var pass, next;
      for (pass = 0; pass < 2; pass += 1) {
        next = decodePercent(decodeEntities(decodeEscapes(text, false)));
        if (next === text) break;
        text = next;
      }
      return text;
    }

    function readValue(text, start, html) {
      var quote = text.charAt(start);
      var i, raw, escaped = false;
      if (quote !== '"' && quote !== "'") {
        if (!html) return null;
        i = start;
        while (i < text.length && !/[\s>]/.test(text.charAt(i))) i += 1;
        raw = text.slice(start, i);
        if (!raw) return null;
        if (raw.length > MAX_TOKEN * 6) { limited = true; return { value: null, start: start, end: i }; }
        return { value: discoveryValue(raw), start: start, end: i };
      }
      for (i = start + 1; i < text.length; i += 1) {
        if (text.charAt(i) === quote && (!escaped || html)) {
          raw = text.slice(start + 1, i);
          if (raw.length > MAX_TOKEN * 6) { limited = true; return { value: null, start: start, end: i + 1 }; }
          return { value: html ? discoveryValue(raw) : decodeEscapes(raw, true), start: start, end: i + 1 };
        }
        if (!html && text.charAt(i) === "\\") escaped = !escaped;
        else escaped = false;
      }
      limited = true;
      return { value: null, start: start, end: text.length };
    }

    function maskSpans(text, spans) {
      if (!spans.length) return text;
      spans.sort(function (a, b) { return a.start - b.start; });
      var pieces = [];
      var last = 0;
      var i, start, end;
      for (i = 0; i < spans.length; i += 1) {
        start = Math.max(last, spans[i].start);
        end = Math.min(text.length, spans[i].end);
        if (end <= start) continue;
        pieces.push(text.slice(last, start));
        pieces.push(new Array(end - start + 1).join(" "));
        last = end;
      }
      pieces.push(text.slice(last));
      return pieces.join("");
    }

    function scanBase64Text(text, source) {
      var re = /(?:^|[^A-Za-z0-9+\/_-])([A-Za-z0-9+\/_-]{16,2048}={0,2})(?=$|[^A-Za-z0-9+\/_=-])/g;
      var match;
      while ((match = re.exec(text)) !== null) {
        probeBase64(match[1], source, true);
        if (base64Probes >= MAX_B64_PROBES) { limited = true; return; }
      }
    }

    function scanNamedTokens(text, source) {
      var field = /(?:^|[^A-Za-z0-9_$-])(?:"[A-Za-z0-9_-]*offer[-_]*(?:id[-_]*)?token"|'[A-Za-z0-9_-]*offer[-_]*(?:id[-_]*)?token'|[A-Za-z0-9_-]*offer[-_]*(?:id[-_]*)?token)\s*[:=]\s*/gi;
      var attribute = /(?:^|[\s<])[A-Za-z0-9_-]*offer[-_]*(?:id[-_]*)?token\s*=\s*/gi;
      var input = /<input\b/gi;
      var match, value, start, end, quote, ch, i, tag, part, names, values;
      var htmlSpans = [];
      var fieldSpans = [];
      while ((match = input.exec(text)) !== null) {
        start = match.index;
        quote = "";
        end = Math.min(text.length, start + 16384);
        for (i = input.lastIndex; i < end; i += 1) {
          ch = text.charAt(i);
          if (quote) { if (ch === quote) quote = ""; }
          else if (ch === '"' || ch === "'") quote = ch;
          else if (ch === ">") break;
        }
        if (i >= end) { limited = true; continue; }
        tag = text.slice(start, i + 1);
        names = [];
        values = [];
        part = /(?:^|\s)(name|value)\s*=\s*/gi;
        while ((match = part.exec(tag)) !== null) {
          value = readValue(tag, part.lastIndex, true);
          if (!value) continue;
          part.lastIndex = value.end;
          if (match[1].toLowerCase() === "name") {
            if (typeof value.value === "string") addUnique(names, value.value);
          } else values.push(value);
        }
        if (names.length === 1 && isTokenKey(names[0])) {
          for (end = 0; end < values.length; end += 1) {
            value = values[end];
            if (value.value !== null) rememberToken(value.value, source);
            htmlSpans.push({ start: start + value.start, end: start + value.end });
          }
        }
        input.lastIndex = i + 1;
      }
      text = maskSpans(text, htmlSpans);
      htmlSpans = [];
      while ((match = attribute.exec(text)) !== null) {
        ch = text.charAt(attribute.lastIndex);
        if (ch !== '"' && ch !== "'" && !/data[-_][A-Za-z0-9_-]*offer/i.test(match[0])) continue;
        value = readValue(text, attribute.lastIndex, true);
        if (!value) continue;
        if (value.value !== null) rememberToken(value.value, source);
        htmlSpans.push({ start: value.start, end: value.end });
        attribute.lastIndex = value.end;
      }
      text = maskSpans(text, htmlSpans);
      while ((match = field.exec(text)) !== null) {
        value = readValue(text, field.lastIndex, false);
        if (!value) continue;
        if (value.value !== null) rememberToken(value.value, source);
        fieldSpans.push({ start: value.start, end: value.end });
        field.lastIndex = value.end;
      }
      var safe = maskSpans(text, fieldSpans);
      var param = /(?:^|[?&#;\s])([A-Za-z0-9_-]*offer[-_]*(?:id[-_]*)?token)=([^&#;\s"'<>),}\]]+)/gi;
      while ((match = param.exec(safe)) !== null) {
        if (match[2].length > MAX_TOKEN * 6) limited = true;
        else {
          value = discoveryValue(match[2]);
          rememberToken(value, source);
        }
        fieldSpans.push({ start: param.lastIndex - match[2].length, end: param.lastIndex });
      }
      var pair = /["']([A-Za-z0-9_-]*offer[-_]*(?:id[-_]*)?token)["']\s*,\s*/gi;
      safe = maskSpans(text, fieldSpans);
      while ((match = pair.exec(safe)) !== null) {
        value = readValue(safe, pair.lastIndex, false);
        if (!value) continue;
        if (value.value !== null) rememberToken(value.value, source);
        fieldSpans.push({ start: value.start, end: value.end });
        pair.lastIndex = value.end;
      }
      safe = maskSpans(text, fieldSpans);
      scanBase64Text(safe, source);
      fieldSpans.sort(function (a, b) { return a.start - b.start; });
      return { text: text, safe: safe, spans: fieldSpans };
    }

    function scanFragments(text, depth, source, spans) {
      var stack = [];
      var overflow = 0;
      var quote = false;
      var escaped = false;
      var i, ch, start, parsed;
      var spanIndex = 0;
      var found = false;
      for (i = 0; i < text.length; i += 1) {
        while (spanIndex < spans.length && spans[spanIndex].end <= i) spanIndex += 1;
        if (spanIndex < spans.length && spans[spanIndex].start <= i) {
          i = spans[spanIndex].end - 1;
          continue;
        }
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
            walk(parsed.value, depth + 1, source);
          }
        }
      }
      return found;
    }

    function scanText(text, depth, source) {
      if (depth > MAX_DEPTH) { limited = true; return; }
      var i, remaining, parsed, decoded, named;
      for (i = 0; i < seenTexts.length; i += 1) if (seenTexts[i].text === text && seenTexts[i].source === source) return;
      if (seenTexts.length >= MAX_PARSES) { limited = true; return; }
      remaining = (source === "body" ? MAX_SCAN : MAX_AUX) - scanned[source];
      if (remaining <= 0) { limited = true; return; }
      if (text.length > remaining) {
        text = text.slice(0, remaining);
        limited = true;
      }
      seenTexts.push({ text: text, source: source });
      scanned[source] += text.length;
      parsed = parseJSON(text);
      if (parsed.ok) {
        walk(parsed.value, depth, source);
        return;
      }
      named = scanNamedTokens(text, source);
      if (scanFragments(named.text, depth, source, named.spans)) return;
      text = named.safe;
      decoded = decodeEntities(text);
      if (decoded !== text) {
        scanText(decoded, depth + 1, source);
        return;
      }
      decoded = decodeEscapes(text, false);
      if (decoded !== text) {
        scanText(decoded, depth + 1, source);
        return;
      }
      decoded = decodePercent(text);
      if (decoded !== text) scanText(decoded, depth + 1, source);
    }

    function headerValue(name) {
      if (!responseHeaders || typeof responseHeaders !== "object") return "";
      var key, value, count = 0;
      for (key in responseHeaders) {
        if (!own.call(responseHeaders, key)) continue;
        count += 1;
        if (count > MAX_NODES) { limited = true; return ""; }
        if (key.toLowerCase() !== name) continue;
        value = responseHeaders[key];
        if (typeof value === "string") return value;
        if (Object.prototype.toString.call(value) === "[object Array]") {
          var parts = [];
          var i;
          for (i = 0; i < value.length && i < 10; i += 1) if (typeof value[i] === "string") parts.push(value[i]);
          if (value.length > 10) limited = true;
          return parts.join("\n");
        }
      }
      return "";
    }

    loadPrevious();
    if (typeof requestUrl === "string" && requestUrl.length) scanText(requestUrl, 0, "url");
    var location = headerValue("location");
    if (location) scanText(location, 0, "location");
    var contentType = headerValue("content-type").replace(/^\s+|\s+$/g, "").toLowerCase();
    var binary = /^(?:image|audio|video|font)\/|^application\/(?:wasm|pdf|font[^;]*|x-font[^;]*|vnd\.ms-fontobject)(?:\s*;|$)/.test(contentType);
    if (!binary && typeof body === "string" && body.length) scanText(body, 0, "body");
    return {
      offerTokens: tokenRows,
      offerLinks: linkRows,
      encodedCandidates: candidateRows,
      currentDecodedSkus: currentDecodedSkus,
      offerScan: {
        limit: LIMIT, maxTokenLength: MAX_TOKEN, maxBodyChars: MAX_SCAN,
        maxBase64Probes: MAX_B64_PROBES, base64Probes: base64Probes,
        tokenCount: Object.keys(responseTokens).length,
        encodedCandidateCount: Object.keys(responseCandidates).length,
        truncated: truncated, limited: limited
      }
    };
  }
})();
