// Waldmeister Reverse Wherigo — decode / utility logic (DOM-free)
// All digit arrays are 0-indexed: a[0]..a[5] for each 6-digit code.

(function (root) {
  'use strict';

  // Decode three digit arrays into {lat, lon, alg} (decimal degrees) or null.
  // a[3] (4th digit of code A) selects hemisphere; (c[1]+c[4]) parity selects algorithm.
  function waldmeisterDecode(a, b, c) {
    var hemi = a[3];
    if (hemi < 1 || hemi > 4) return null;
    var latSign = (hemi === 1 || hemi === 3) ? 1 : -1;
    var lonSign = (hemi === 1 || hemi === 2) ? 1 : -1;

    var alg = (c[1] + c[4]) % 2 === 0 ? 1 : 2;
    var latDeg, latDec, lonDeg, lonDec;

    if (alg === 1) {
      // Lat: [a[2]][b[4]] . [b[1]][c[3]][a[0]][c[4]][a[5]]
      latDeg = a[2] * 10 + b[4];
      latDec = b[1] * 10000 + c[3] * 1000 + a[0] * 100 + c[4] * 10 + a[5];
      // Lon: [a[1]][c[0]][c[5]] . [b[3]][b[0]][a[4]][c[1]][b[5]]
      lonDeg = a[1] * 100 + c[0] * 10 + c[5];
      lonDec = b[3] * 10000 + b[0] * 1000 + a[4] * 100 + c[1] * 10 + b[5];
    } else {
      // Lat: [b[0]][a[5]] . [a[2]][c[0]][c[3]][c[4]][a[0]]
      latDeg = b[0] * 10 + a[5];
      latDec = a[2] * 10000 + c[0] * 1000 + c[3] * 100 + c[4] * 10 + a[0];
      // Lon: [b[4]][c[5]][a[4]] . [a[1]][b[3]][b[5]][c[1]][b[1]]
      lonDeg = b[4] * 100 + c[5] * 10 + a[4];
      lonDec = a[1] * 10000 + b[3] * 1000 + b[5] * 100 + c[1] * 10 + b[1];
    }

    return {
      lat: latSign * (latDeg + latDec / 100000),
      lon: lonSign * (lonDeg + lonDec / 100000),
      alg: alg
    };
  }

  // Parse a DDM coordinate string into {lat, lon} decimal degrees, or null.
  // Accepts: "N 45 39.257 W 122 56.923", "N 45° 39.257' W 122° 56.923'", decimal "45.654 -122.948"
  function parseDDM(str) {
    if (!str) return null;
    str = str.trim();

    var m = str.match(/([NS])\s*(\d+)[°\s]+(\d+\.?\d*)['’]?\s*([EW])\s*(\d+)[°\s]+(\d+\.?\d*)/i);
    if (m) {
      var lat = (m[1].toUpperCase() === 'S' ? -1 : 1) * (parseFloat(m[2]) + parseFloat(m[3]) / 60);
      var lon = (m[4].toUpperCase() === 'W' ? -1 : 1) * (parseFloat(m[5]) + parseFloat(m[6]) / 60);
      return { lat: lat, lon: lon };
    }

    var dd = str.match(/^(-?\d+\.?\d*)\s*,?\s*(-?\d+\.?\d*)$/);
    if (dd) return { lat: parseFloat(dd[1]), lon: parseFloat(dd[2]) };

    return null;
  }

  // Decimal degrees → DDM display string "N 45° 39.257' W 122° 56.923'"
  function dd2ddm(lat, lon) {
    var latDir = lat >= 0 ? 'N' : 'S';
    var lonDir = lon >= 0 ? 'E' : 'W';
    var absLat = Math.abs(lat);
    var absLon = Math.abs(lon);
    var latDeg = Math.floor(absLat);
    var lonDeg = Math.floor(absLon);
    var latMin = (absLat - latDeg) * 60;
    var lonMin = (absLon - lonDeg) * 60;
    function padDeg(n, w) { return String(n).padStart(w, '0'); }
    function padMin(m) { return m.toFixed(3).padStart(6, '0'); }
    return latDir + ' ' + padDeg(latDeg, 2) + '° ' + padMin(latMin) + '\'' +
           ' ' + lonDir + ' ' + padDeg(lonDeg, 3) + '° ' + padMin(lonMin) + '\'';
  }

  // Haversine distance in km between two decimal-degree coordinates.
  function haversineKm(lat1, lon1, lat2, lon2) {
    var R = 6371;
    var phi1 = lat1 * Math.PI / 180;
    var phi2 = lat2 * Math.PI / 180;
    var dphi = (lat2 - lat1) * Math.PI / 180;
    var dlam = (lon2 - lon1) * Math.PI / 180;
    var a = Math.sin(dphi / 2) * Math.sin(dphi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(dlam / 2) * Math.sin(dlam / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  var ReverseWherigoLogic = { waldmeisterDecode: waldmeisterDecode, parseDDM: parseDDM, dd2ddm: dd2ddm, haversineKm: haversineKm };

  if (typeof module === 'object' && module.exports) {
    module.exports = ReverseWherigoLogic;
  } else {
    root.ReverseWherigoLogic = ReverseWherigoLogic;
  }
}(typeof globalThis !== 'undefined' ? globalThis : this));
