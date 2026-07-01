// Waldmeister Reverse Wherigo — brute-force worker
// Message IN (JSON): { codeA, codeB, codeC, refLat, refLon, maxKm }
//   Each code is a 6-element array: integer digit (0-9) or null (wildcard).
// Message OUT (JSON): progress { status:'progress', checked, found, total, results }
//                     final   { status:'done',     checked, found, total, results, stopped }

importScripts('reversewherigo-logic.js');

var decode       = ReverseWherigoLogic.waldmeisterDecode;
var distKm       = ReverseWherigoLogic.haversineKm;
var dd2ddm       = ReverseWherigoLogic.dd2ddm;
var PROXIMITY_KM = 0.009144; // 30 ft
var shouldStop = false;

onmessage = function (e) {
  var req = JSON.parse(e.data);
  if (req.cmd === 'stop') { shouldStop = true; return; }

  shouldStop = false;
  var codeA = req.codeA, codeB = req.codeB, codeC = req.codeC;
  var refLat = req.refLat, refLon = req.refLon, maxKm = req.maxKm;

  // Build wildcard slot list: [{ci:0/1/2, idx:0-5}, ...]
  var slots = [];
  [codeA, codeB, codeC].forEach(function (code, ci) {
    code.forEach(function (v, idx) { if (v === null) slots.push({ ci: ci, idx: idx }); });
  });

  // Working digit arrays (start with fixed values; nulls become 0 initially)
  var a = codeA.map(function (v) { return v === null ? 0 : v; });
  var b = codeB.map(function (v) { return v === null ? 0 : v; });
  var c = codeC.map(function (v) { return v === null ? 0 : v; });

  var n = slots.length;
  var total = Math.pow(10, n);
  var results = [];
  var seen    = {};   // coord dedup: "lat,lon" → true
  var checked = 0;
  var limitReached = false;

  // Bounding-box pre-filter: ±1% margin over the exact radius
  var maxLatDelta = maxKm / 111.32 * 1.01;
  var maxLonDelta = maxKm / (111.32 * Math.cos(refLat * Math.PI / 180)) * 1.01;

  // Odometer digit counter (avoids division/modulo on every iteration)
  var digits = new Array(n).fill(0);

  var REPORT = 200000; // send progress every N iterations

  outer:
  for (var iter = 0; iter < total; iter++) {
    if (shouldStop) break;

    // Apply current odometer digits to working arrays
    for (var s = 0; s < n; s++) {
      var slot = slots[s];
      var d = digits[s];
      if (slot.ci === 0) a[slot.idx] = d;
      else if (slot.ci === 1) b[slot.idx] = d;
      else c[slot.idx] = d;
    }

    var res = decode(a, b, c);
    if (res) {
      // Fast bbox reject before Haversine
      if (Math.abs(res.lat - refLat) <= maxLatDelta &&
          Math.abs(res.lon - refLon) <= maxLonDelta) {
        var dist = distKm(refLat, refLon, res.lat, res.lon);
        if (dist <= maxKm) {
          var skip = false;
          if (req.dedupMode === 'unique') {
            var key = dd2ddm(res.lat, res.lon);
            if (seen[key]) { skip = true; } else { seen[key] = true; }
          } else if (req.dedupMode === 'proximity') {
            for (var p = 0; p < results.length; p++) {
              if (distKm(res.lat, res.lon, results[p].lat, results[p].lon) < PROXIMITY_KM) {
                skip = true; break;
              }
            }
          }
          if (!skip) {
            results.push({
              codeA: a.join(''), codeB: b.join(''), codeC: c.join(''),
              alg: res.alg, lat: res.lat, lon: res.lon, distKm: dist
            });
            if (results.length >= 100) { limitReached = true; break outer; }
          }
        }
      }
    }

    checked++;

    // Advance odometer (right-to-left carry)
    for (var s2 = n - 1; s2 >= 0; s2--) {
      digits[s2]++;
      if (digits[s2] < 10) break;
      digits[s2] = 0;
    }

    if (checked % REPORT === 0) {
      self.postMessage(JSON.stringify({
        status: 'progress', checked: checked, found: results.length, total: total, results: results
      }));
    }
  }

  self.postMessage(JSON.stringify({
    status: 'done', checked: checked, found: results.length, total: total,
    results: results, stopped: shouldStop, limitReached: limitReached
  }));
};
