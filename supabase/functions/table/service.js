// Fichier généré par `npm run build:server` à partir de src/online et src/engine : ne pas modifier.

// src/engine/cards.ts
var RANK_CHARS = "23456789TJQKA";
var SUIT_SYMBOLS = ["\u2660", "\u2665", "\u2666", "\u2663"];
var RANK_LABELS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "V", "D", "R", "A"];
var RANK_NAMES_FR = [
  ["Deux", "Deux"],
  ["Trois", "Trois"],
  ["Quatre", "Quatre"],
  ["Cinq", "Cinq"],
  ["Six", "Six"],
  ["Sept", "Sept"],
  ["Huit", "Huit"],
  ["Neuf", "Neuf"],
  ["Dix", "Dix"],
  ["Valet", "Valets"],
  ["Dame", "Dames"],
  ["Roi", "Rois"],
  ["As", "As"]
];
var rankOf = (c) => c >> 2;
var suitOf = (c) => c & 3;
function rankName(rank, plural = false) {
  return RANK_NAMES_FR[rank][plural ? 1 : 0];
}
function deRank(rank, plural = true) {
  const name2 = rankName(rank, plural);
  return rank === 12 ? `d'${name2}` : `de ${name2}`;
}
function auxRank(rank) {
  return `aux ${rankName(rank, true)}`;
}
function cardLabel(c) {
  return RANK_LABELS[rankOf(c)] + SUIT_SYMBOLS[suitOf(c)];
}
function cardsLabel(cards) {
  return cards.map(cardLabel).join(" ");
}
function fullDeck() {
  return Array.from({ length: 52 }, (_, i) => i);
}

// src/engine/ranges.ts
var GRID_RANKS = [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0];
function classFromRanks(hi, lo, suited) {
  if (hi < lo) [hi, lo] = [lo, hi];
  if (hi === lo) return RANK_CHARS[hi] + RANK_CHARS[lo];
  return RANK_CHARS[hi] + RANK_CHARS[lo] + (suited ? "s" : "o");
}
function handClassOf(c1, c2) {
  return classFromRanks(rankOf(c1), rankOf(c2), suitOf(c1) === suitOf(c2));
}
function gridClass(row, col) {
  const r1 = GRID_RANKS[row];
  const r2 = GRID_RANKS[col];
  if (row === col) return classFromRanks(r1, r1, false);
  if (row < col) return classFromRanks(r1, r2, true);
  return classFromRanks(r1, r2, false);
}
var ALL_CLASSES = (() => {
  const out = [];
  for (let r = 0; r < 13; r++) for (let c = 0; c < 13; c++) out.push(gridClass(r, c));
  return out;
})();
function parseClass(hc) {
  const hi = RANK_CHARS.indexOf(hc[0]);
  const lo = RANK_CHARS.indexOf(hc[1]);
  if (hi < 0 || lo < 0) throw new Error(`Main invalide : ${hc}`);
  if (hi === lo) return { hi, lo, kind: "pair" };
  const k = hc[2];
  if (k !== "s" && k !== "o") throw new Error(`Main invalide : ${hc}`);
  return hi > lo ? { hi, lo, kind: k } : { hi: lo, lo: hi, kind: k };
}
function comboCount(hc) {
  const { kind } = parseClass(hc);
  return kind === "pair" ? 6 : kind === "s" ? 4 : 12;
}
function parseRange(text) {
  const out = /* @__PURE__ */ new Set();
  const tokens = text.split(/[,\s]+/).map((t) => t.trim()).filter(Boolean);
  for (const raw of tokens) {
    const tok = normalize(raw);
    if (tok.includes("-")) {
      const [a, b] = raw.split("-").map(normalize);
      const A = parseClass(a);
      const B = parseClass(b);
      if (A.kind === "pair" && B.kind === "pair") {
        const [lo, hi] = [Math.min(A.hi, B.hi), Math.max(A.hi, B.hi)];
        for (let r = lo; r <= hi; r++) out.add(classFromRanks(r, r, false));
      } else if (A.hi === B.hi && A.kind === B.kind) {
        const [lo, hi] = [Math.min(A.lo, B.lo), Math.max(A.lo, B.lo)];
        for (let r = lo; r <= hi; r++) out.add(classFromRanks(A.hi, r, A.kind === "s"));
      } else {
        throw new Error(`Intervalle invalide : ${raw}`);
      }
      continue;
    }
    const plus = tok.endsWith("+");
    const base = plus ? tok.slice(0, -1) : tok;
    if (base.length === 2 && base[0] !== base[1]) {
      for (const k of ["s", "o"]) addToken(out, base + k, plus);
    } else {
      addToken(out, base, plus);
    }
  }
  return out;
}
function normalize(t) {
  return t.slice(0, 2).toUpperCase() + t.slice(2).toLowerCase();
}
function addToken(out, hc, plus) {
  const { hi, lo, kind } = parseClass(hc);
  if (!plus) {
    out.add(kind === "pair" ? classFromRanks(hi, hi, false) : classFromRanks(hi, lo, kind === "s"));
    return;
  }
  if (kind === "pair") {
    for (let r = hi; r <= 12; r++) out.add(classFromRanks(r, r, false));
  } else {
    for (let r = lo; r < hi; r++) out.add(classFromRanks(hi, r, kind === "s"));
  }
}

// src/data/preflopEquity.ts
var PREFLOP_EQUITY = {
  "AA": [0.8504, 0.7333, 0.6387, 0.5607, 0.4917],
  "AKs": [0.6711, 0.5048, 0.4147, 0.3508, 0.312],
  "AQs": [0.664, 0.4981, 0.3949, 0.3325, 0.2909],
  "AJs": [0.6532, 0.484, 0.3799, 0.3221, 0.2795],
  "ATs": [0.6462, 0.4764, 0.3686, 0.3087, 0.2655],
  "A9s": [0.6295, 0.4497, 0.3411, 0.2861, 0.2426],
  "A8s": [0.6224, 0.4374, 0.3322, 0.2712, 0.2306],
  "A7s": [0.6087, 0.4229, 0.3238, 0.2632, 0.2248],
  "A6s": [0.5979, 0.4124, 0.3107, 0.2606, 0.2153],
  "A5s": [0.5954, 0.4154, 0.318, 0.2611, 0.2241],
  "A4s": [0.5869, 0.4018, 0.3075, 0.2548, 0.215],
  "A3s": [0.5801, 0.3977, 0.2992, 0.2453, 0.2113],
  "A2s": [0.5725, 0.3881, 0.2902, 0.2405, 0.2084],
  "AKo": [0.6575, 0.4806, 0.3899, 0.3227, 0.2851],
  "KK": [0.8231, 0.6849, 0.583, 0.5044, 0.426],
  "KQs": [0.6307, 0.4748, 0.3861, 0.3245, 0.2836],
  "KJs": [0.6267, 0.4582, 0.3692, 0.3115, 0.2698],
  "KTs": [0.6174, 0.4501, 0.3574, 0.3005, 0.2583],
  "K9s": [0.5992, 0.4268, 0.328, 0.2747, 0.2337],
  "K8s": [0.5845, 0.4048, 0.3098, 0.256, 0.2144],
  "K7s": [0.5736, 0.3904, 0.2983, 0.2388, 0.2057],
  "K6s": [0.5672, 0.3819, 0.2928, 0.235, 0.1988],
  "K5s": [0.5579, 0.3752, 0.2814, 0.2289, 0.1965],
  "K4s": [0.5482, 0.3601, 0.2753, 0.2212, 0.1902],
  "K3s": [0.5416, 0.3573, 0.2671, 0.2159, 0.1862],
  "K2s": [0.5331, 0.3503, 0.2622, 0.2174, 0.1809],
  "AQo": [0.6436, 0.4626, 0.3747, 0.3084, 0.262],
  "KQo": [0.6118, 0.4473, 0.3537, 0.297, 0.2532],
  "QQ": [0.8015, 0.6481, 0.5353, 0.4499, 0.3722],
  "QJs": [0.6044, 0.4388, 0.3585, 0.3081, 0.2642],
  "QTs": [0.5982, 0.4332, 0.347, 0.2894, 0.2536],
  "Q9s": [0.5739, 0.4025, 0.3164, 0.2614, 0.224],
  "Q8s": [0.5634, 0.3858, 0.2988, 0.2409, 0.2069],
  "Q7s": [0.5413, 0.3643, 0.2779, 0.2281, 0.1887],
  "Q6s": [0.5366, 0.3589, 0.2643, 0.2212, 0.1843],
  "Q5s": [0.5279, 0.3459, 0.2644, 0.2145, 0.179],
  "Q4s": [0.5192, 0.3425, 0.2524, 0.2088, 0.1752],
  "Q3s": [0.5106, 0.3331, 0.2518, 0.2006, 0.1707],
  "Q2s": [0.5066, 0.3192, 0.2407, 0.1949, 0.1663],
  "AJo": [0.6383, 0.4514, 0.3564, 0.2884, 0.2411],
  "KJo": [0.6038, 0.4341, 0.3387, 0.2795, 0.234],
  "QJo": [0.5803, 0.411, 0.3232, 0.268, 0.2268],
  "JJ": [0.775, 0.6107, 0.4993, 0.4081, 0.3337],
  "JTs": [0.5783, 0.4205, 0.3371, 0.2865, 0.2476],
  "J9s": [0.5557, 0.3903, 0.3212, 0.2581, 0.2258],
  "J8s": [0.5404, 0.3721, 0.2897, 0.2447, 0.2039],
  "J7s": [0.5237, 0.3548, 0.2638, 0.2231, 0.1909],
  "J6s": [0.5052, 0.3347, 0.2546, 0.208, 0.1756],
  "J5s": [0.4974, 0.3282, 0.2479, 0.2022, 0.1658],
  "J4s": [0.4933, 0.3185, 0.2382, 0.1967, 0.1661],
  "J3s": [0.4847, 0.3116, 0.2336, 0.1865, 0.1602],
  "J2s": [0.4721, 0.304, 0.2246, 0.1836, 0.1555],
  "ATo": [0.6233, 0.4437, 0.3413, 0.2779, 0.2311],
  "KTo": [0.5961, 0.4178, 0.3228, 0.2616, 0.2251],
  "QTo": [0.5755, 0.3979, 0.3115, 0.2554, 0.2159],
  "JTo": [0.5542, 0.3856, 0.3071, 0.2522, 0.2181],
  "TT": [0.7494, 0.5739, 0.4479, 0.3655, 0.2974],
  "T9s": [0.5374, 0.3885, 0.3109, 0.2594, 0.2223],
  "T8s": [0.5255, 0.3688, 0.2863, 0.2424, 0.2015],
  "T7s": [0.5073, 0.3456, 0.2673, 0.2249, 0.1894],
  "T6s": [0.4864, 0.3297, 0.2503, 0.2031, 0.1736],
  "T5s": [0.4707, 0.3062, 0.2311, 0.1871, 0.1634],
  "T4s": [0.4622, 0.2997, 0.2302, 0.1849, 0.16],
  "T3s": [0.4572, 0.2937, 0.222, 0.1804, 0.1533],
  "T2s": [0.4455, 0.2874, 0.214, 0.1753, 0.148],
  "A9o": [0.6086, 0.4154, 0.3103, 0.2456, 0.201],
  "K9o": [0.576, 0.388, 0.2931, 0.2334, 0.1923],
  "Q9o": [0.5537, 0.3701, 0.2815, 0.2309, 0.1867],
  "J9o": [0.5344, 0.3652, 0.2823, 0.2293, 0.1854],
  "T9o": [0.5154, 0.3522, 0.2772, 0.2232, 0.1847],
  "99": [0.7201, 0.5411, 0.4174, 0.3252, 0.2691],
  "98s": [0.507, 0.3594, 0.2838, 0.2363, 0.2024],
  "97s": [0.4933, 0.3372, 0.268, 0.2229, 0.1887],
  "96s": [0.4742, 0.32, 0.2477, 0.2063, 0.1755],
  "95s": [0.4563, 0.3008, 0.2319, 0.1889, 0.1619],
  "94s": [0.438, 0.2866, 0.2157, 0.1734, 0.1434],
  "93s": [0.4336, 0.2791, 0.2019, 0.1668, 0.1451],
  "92s": [0.4245, 0.2673, 0.2021, 0.1603, 0.1381],
  "A8o": [0.5997, 0.406, 0.2997, 0.2348, 0.1954],
  "K8o": [0.5582, 0.3704, 0.2731, 0.2153, 0.1743],
  "Q8o": [0.5379, 0.3525, 0.2617, 0.2061, 0.1707],
  "J8o": [0.5175, 0.3393, 0.2569, 0.2061, 0.167],
  "T8o": [0.4961, 0.3353, 0.2572, 0.2059, 0.1655],
  "98o": [0.4822, 0.3272, 0.2521, 0.1992, 0.1669],
  "88": [0.69, 0.4991, 0.3788, 0.293, 0.2403],
  "87s": [0.4819, 0.3382, 0.2648, 0.2213, 0.1908],
  "86s": [0.4622, 0.3155, 0.2502, 0.2093, 0.1753],
  "85s": [0.4473, 0.3044, 0.2307, 0.1937, 0.1618],
  "84s": [0.4247, 0.278, 0.2136, 0.1761, 0.1484],
  "83s": [0.4099, 0.2627, 0.1958, 0.1604, 0.1352],
  "82s": [0.4025, 0.2586, 0.1939, 0.1571, 0.1306],
  "A7o": [0.5885, 0.3934, 0.2862, 0.2244, 0.1825],
  "K7o": [0.5476, 0.36, 0.2646, 0.2065, 0.1676],
  "Q7o": [0.5182, 0.3346, 0.2368, 0.1843, 0.1459],
  "J7o": [0.4994, 0.3224, 0.2351, 0.1869, 0.1505],
  "T7o": [0.4804, 0.3146, 0.2338, 0.1807, 0.1513],
  "97o": [0.4626, 0.3044, 0.2309, 0.1845, 0.1505],
  "87o": [0.4494, 0.3007, 0.2313, 0.1829, 0.152],
  "77": [0.6635, 0.4616, 0.3447, 0.2627, 0.2213],
  "76s": [0.4522, 0.3141, 0.247, 0.2063, 0.1749],
  "75s": [0.4365, 0.3014, 0.2353, 0.1949, 0.1657],
  "74s": [0.4173, 0.2822, 0.2188, 0.1795, 0.1558],
  "73s": [0.3998, 0.2655, 0.1986, 0.161, 0.1403],
  "72s": [0.3813, 0.2497, 0.1835, 0.1548, 0.1293],
  "A6o": [0.5792, 0.3806, 0.2759, 0.2141, 0.1756],
  "K6o": [0.5446, 0.3461, 0.2549, 0.1976, 0.1601],
  "Q6o": [0.5096, 0.3219, 0.2297, 0.1776, 0.1484],
  "J6o": [0.4811, 0.3006, 0.2118, 0.1659, 0.1307],
  "T6o": [0.4624, 0.2884, 0.2151, 0.1634, 0.1338],
  "96o": [0.4453, 0.2862, 0.2121, 0.1632, 0.1328],
  "86o": [0.4332, 0.2818, 0.212, 0.1712, 0.1377],
  "76o": [0.4218, 0.2842, 0.2173, 0.1708, 0.1421],
  "66": [0.6332, 0.4299, 0.3186, 0.2468, 0.202],
  "65s": [0.4324, 0.3007, 0.2344, 0.1995, 0.1693],
  "64s": [0.4094, 0.2878, 0.2201, 0.1834, 0.1571],
  "63s": [0.3964, 0.2675, 0.2022, 0.1659, 0.1455],
  "62s": [0.379, 0.2478, 0.1836, 0.1549, 0.1344],
  "A5o": [0.5792, 0.3854, 0.2789, 0.2204, 0.182],
  "K5o": [0.5322, 0.3405, 0.2462, 0.1889, 0.1476],
  "Q5o": [0.5026, 0.3138, 0.2211, 0.1699, 0.1397],
  "J5o": [0.4737, 0.2924, 0.2074, 0.1568, 0.1281],
  "T5o": [0.4439, 0.2728, 0.1913, 0.1508, 0.1163],
  "95o": [0.4258, 0.2709, 0.1897, 0.1474, 0.117],
  "85o": [0.4159, 0.2634, 0.1915, 0.1486, 0.1237],
  "75o": [0.4069, 0.27, 0.1946, 0.1531, 0.1282],
  "65o": [0.3974, 0.2708, 0.1982, 0.1564, 0.1328],
  "55": [0.6001, 0.4076, 0.2862, 0.2249, 0.184],
  "54s": [0.416, 0.2868, 0.2267, 0.1898, 0.164],
  "53s": [0.3972, 0.2726, 0.2093, 0.179, 0.1524],
  "52s": [0.3767, 0.253, 0.1961, 0.1604, 0.1404],
  "A4o": [0.5686, 0.3691, 0.2692, 0.2136, 0.1772],
  "K4o": [0.5227, 0.3292, 0.2367, 0.1814, 0.1481],
  "Q4o": [0.4942, 0.3033, 0.2152, 0.1659, 0.1337],
  "J4o": [0.4623, 0.2841, 0.2028, 0.1531, 0.1216],
  "T4o": [0.4371, 0.2604, 0.1856, 0.1457, 0.1136],
  "94o": [0.4042, 0.2458, 0.1723, 0.1309, 0.1029],
  "84o": [0.3924, 0.2497, 0.1776, 0.1317, 0.1045],
  "74o": [0.3879, 0.2461, 0.1809, 0.1388, 0.1138],
  "64o": [0.3815, 0.2482, 0.1826, 0.1419, 0.1209],
  "54o": [0.3786, 0.2529, 0.1884, 0.1546, 0.1275],
  "44": [0.573, 0.3681, 0.2595, 0.2087, 0.175],
  "43s": [0.3863, 0.2627, 0.2046, 0.1678, 0.1484],
  "42s": [0.3674, 0.2457, 0.1876, 0.1565, 0.1362],
  "A3o": [0.5548, 0.3634, 0.2656, 0.2069, 0.1687],
  "K3o": [0.5131, 0.3209, 0.2252, 0.1755, 0.1388],
  "Q3o": [0.4844, 0.2999, 0.2048, 0.1605, 0.1267],
  "J3o": [0.4516, 0.2724, 0.1927, 0.1479, 0.1182],
  "T3o": [0.426, 0.253, 0.1857, 0.1379, 0.1096],
  "93o": [0.4016, 0.2391, 0.1687, 0.1281, 0.1014],
  "83o": [0.3755, 0.2229, 0.1599, 0.1195, 0.0949],
  "73o": [0.368, 0.2231, 0.1639, 0.1212, 0.1009],
  "63o": [0.3586, 0.2239, 0.1633, 0.132, 0.1053],
  "53o": [0.3643, 0.2348, 0.1715, 0.1366, 0.1142],
  "43o": [0.3514, 0.2238, 0.1622, 0.1298, 0.1071],
  "33": [0.5379, 0.3341, 0.2401, 0.1919, 0.1603],
  "32s": [0.3602, 0.2374, 0.1822, 0.1477, 0.1317],
  "A2o": [0.5485, 0.353, 0.2497, 0.1983, 0.1598],
  "K2o": [0.5043, 0.3091, 0.221, 0.1703, 0.137],
  "Q2o": [0.4705, 0.2886, 0.2011, 0.1578, 0.1251],
  "J2o": [0.4435, 0.2651, 0.1856, 0.1427, 0.1117],
  "T2o": [0.4155, 0.2486, 0.1724, 0.1343, 0.1081],
  "92o": [0.3896, 0.2317, 0.1612, 0.1225, 0.0942],
  "82o": [0.367, 0.2181, 0.1499, 0.1147, 0.0919],
  "72o": [0.346, 0.2034, 0.1424, 0.1086, 0.088],
  "62o": [0.3413, 0.2041, 0.1498, 0.1136, 0.0898],
  "52o": [0.3459, 0.217, 0.1515, 0.121, 0.1017],
  "42o": [0.3323, 0.2039, 0.1459, 0.1182, 0.0953],
  "32o": [0.3237, 0.199, 0.1409, 0.1093, 0.0912],
  "22": [0.5036, 0.3044, 0.2191, 0.1782, 0.1547]
};

// src/data/charts.ts
var RFI_RANGES = {
  UTG: "22+, A2s+, K9s+, QTs+, JTs, T9s, 98s, AJo+, KQo",
  HJ: "22+, A2s+, K8s+, Q9s+, J9s+, T9s, 98s, 87s, 76s, ATo+, KJo+, QJo",
  CO: "22+, A2s+, K5s+, Q8s+, J8s+, T8s+, 97s+, 86s+, 75s+, 65s, 54s, A8o+, KTo+, QTo+, JTo",
  BTN: "22+, A2s+, K2s+, Q4s+, J6s+, T6s+, 96s+, 85s+, 74s+, 63s+, 53s+, 43s, A2o+, K8o+, Q9o+, J9o+, T8o+, 98o, 87o",
  SB: "22+, A2s+, K3s+, Q5s+, J7s+, T7s+, 96s+, 86s+, 75s+, 64s+, 54s, A4o+, K9o+, Q9o+, J9o+, T9o"
};
var RFI_SETS = {
  UTG: parseRange(RFI_RANGES.UTG),
  HJ: parseRange(RFI_RANGES.HJ),
  CO: parseRange(RFI_RANGES.CO),
  BTN: parseRange(RFI_RANGES.BTN),
  SB: parseRange(RFI_RANGES.SB)
};
var HANDS_BY_STRENGTH = ALL_CLASSES.slice().sort(
  (a, b) => PREFLOP_EQUITY[b][0] - PREFLOP_EQUITY[a][0]
);
var HAND_TOP_PERCENT = (() => {
  const out = {};
  let cum = 0;
  for (const hc of HANDS_BY_STRENGTH) {
    cum += comboCount(hc);
    out[hc] = cum / 1326 * 100;
  }
  return out;
})();

// src/engine/evaluator.ts
var Cat = {
  HIGH_CARD: 0,
  PAIR: 1,
  TWO_PAIR: 2,
  TRIPS: 3,
  STRAIGHT: 4,
  FLUSH: 5,
  FULL_HOUSE: 6,
  QUADS: 7,
  STRAIGHT_FLUSH: 8
};
var rankCounts = new Int8Array(13);
var suitCounts = new Int8Array(4);
var suitMasks = new Int32Array(4);
function enc(cat, a = 0, b = 0, c = 0, d = 0, e = 0) {
  return cat << 20 | a << 16 | b << 12 | c << 8 | d << 4 | e;
}
function straightHigh(mask) {
  for (let hi = 12; hi >= 4; hi--) {
    const m = 31 << hi - 4;
    if ((mask & m) === m) return hi;
  }
  if ((mask & 4111) === 4111) return 3;
  return -1;
}
function topRanks(mask, n, out) {
  out.length = 0;
  for (let r = 12; r >= 0 && out.length < n; r--) {
    if (mask & 1 << r) out.push(r);
  }
  while (out.length < n) out.push(0);
}
var kick = [];
function evaluate(cards, n = cards.length) {
  rankCounts.fill(0);
  suitCounts.fill(0);
  suitMasks.fill(0);
  let mask = 0;
  for (let i = 0; i < n; i++) {
    const c = cards[i];
    const r = c >> 2;
    const s = c & 3;
    rankCounts[r]++;
    suitCounts[s]++;
    suitMasks[s] |= 1 << r;
    mask |= 1 << r;
  }
  let flushSuit = -1;
  for (let s = 0; s < 4; s++) if (suitCounts[s] >= 5) flushSuit = s;
  if (flushSuit >= 0) {
    const sh2 = straightHigh(suitMasks[flushSuit]);
    if (sh2 >= 0) return enc(Cat.STRAIGHT_FLUSH, sh2);
  }
  let quad = -1;
  let trips1 = -1;
  let trips2 = -1;
  let pair1 = -1;
  let pair2 = -1;
  for (let r = 12; r >= 0; r--) {
    const cnt = rankCounts[r];
    if (cnt === 4) quad = r;
    else if (cnt === 3) {
      if (trips1 < 0) trips1 = r;
      else if (trips2 < 0) trips2 = r;
    } else if (cnt === 2) {
      if (pair1 < 0) pair1 = r;
      else if (pair2 < 0) pair2 = r;
    }
  }
  if (quad >= 0) {
    topRanks(mask & ~(1 << quad), 1, kick);
    return enc(Cat.QUADS, quad, kick[0]);
  }
  if (trips1 >= 0 && (trips2 >= 0 || pair1 >= 0)) {
    return enc(Cat.FULL_HOUSE, trips1, Math.max(trips2, pair1));
  }
  if (flushSuit >= 0) {
    topRanks(suitMasks[flushSuit], 5, kick);
    return enc(Cat.FLUSH, kick[0], kick[1], kick[2], kick[3], kick[4]);
  }
  const sh = straightHigh(mask);
  if (sh >= 0) return enc(Cat.STRAIGHT, sh);
  if (trips1 >= 0) {
    topRanks(mask & ~(1 << trips1), 2, kick);
    return enc(Cat.TRIPS, trips1, kick[0], kick[1]);
  }
  if (pair1 >= 0 && pair2 >= 0) {
    topRanks(mask & ~(1 << pair1) & ~(1 << pair2), 1, kick);
    return enc(Cat.TWO_PAIR, pair1, pair2, kick[0]);
  }
  if (pair1 >= 0) {
    topRanks(mask & ~(1 << pair1), 3, kick);
    return enc(Cat.PAIR, pair1, kick[0], kick[1], kick[2]);
  }
  topRanks(mask, 5, kick);
  return enc(Cat.HIGH_CARD, kick[0], kick[1], kick[2], kick[3], kick[4]);
}
var categoryOf = (score) => score >> 20;
function nib(score, i) {
  return score >> 16 - 4 * i & 15;
}
function describeScore(score) {
  const cat = categoryOf(score);
  const a = nib(score, 0);
  const b = nib(score, 1);
  switch (cat) {
    case Cat.STRAIGHT_FLUSH:
      return a === 12 ? "Quinte flush royale" : `Quinte flush hauteur ${rankName(a)}`;
    case Cat.QUADS:
      return `Carr\xE9 ${deRank(a)}`;
    case Cat.FULL_HOUSE:
      return `Full ${auxRank(a)} par les ${rankName(b, true)}`;
    case Cat.FLUSH:
      return `Couleur hauteur ${rankName(a)}`;
    case Cat.STRAIGHT:
      return `Quinte hauteur ${rankName(a)}`;
    case Cat.TRIPS:
      return `Brelan ${deRank(a)}`;
    case Cat.TWO_PAIR:
      return `Double paire, ${rankName(a, true)} et ${rankName(b, true)}`;
    case Cat.PAIR:
      return `Paire ${deRank(a)}`;
    default:
      return `Hauteur ${rankName(a)}`;
  }
}

// src/engine/random.ts
var defaultRng = Math.random;
function randInt(rng, n) {
  return Math.floor(rng() * n);
}
function shuffle(arr, rng = defaultRng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1);
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}

// src/engine/equity.ts
var MAX_EXACT_RUNOUTS = 2e3;
function combinations(n, k) {
  let r = 1;
  for (let i = 0; i < k; i++) r = r * (n - i) / (i + 1);
  return Math.round(r);
}
function computeEquity(players, board, opts = {}) {
  const n = players.length;
  const rng = opts.rng ?? defaultRng;
  const iterations = opts.iterations ?? 2e4;
  const win = new Float64Array(n);
  const tie = new Float64Array(n);
  const eq = new Float64Array(n);
  const used = new Uint8Array(52);
  for (const c of board) used[c] = 1;
  for (const p of players) if (p && "cards" in p) for (const c of p.cards) used[c] = 1;
  const allKnown = players.every((p) => p && "cards" in p && p.cards.length === 2);
  const needed = 5 - board.length;
  const avail = fullDeck().filter((c) => !used[c]);
  const hands = players.map(() => new Array(7));
  const scores = new Int32Array(n);
  const boardBuf = new Array(5);
  for (let i = 0; i < board.length; i++) boardBuf[i] = board[i];
  const scoreRound = (weight) => {
    let best = -1;
    let count = 0;
    for (let i = 0; i < n; i++) {
      const h = hands[i];
      for (let j = 0; j < 5; j++) h[2 + j] = boardBuf[j];
      const s = evaluate(h, 7);
      scores[i] = s;
      if (s > best) {
        best = s;
        count = 1;
      } else if (s === best) count++;
    }
    for (let i = 0; i < n; i++) {
      if (scores[i] === best) {
        if (count === 1) win[i] += weight;
        else tie[i] += weight;
        eq[i] += weight / count;
      }
    }
  };
  if (allKnown && !opts.forceMonteCarlo && combinations(avail.length, needed) <= MAX_EXACT_RUNOUTS) {
    players.forEach((p, i) => {
      const cards = p.cards;
      hands[i][0] = cards[0];
      hands[i][1] = cards[1];
    });
    let total = 0;
    const rec = (start, depth) => {
      if (depth === needed) {
        scoreRound(1);
        total++;
        return;
      }
      for (let i = start; i < avail.length; i++) {
        boardBuf[board.length + depth] = avail[i];
        rec(i + 1, depth + 1);
      }
    };
    rec(0, 0);
    return finalize(win, tie, eq, total, true);
  }
  let samples = 0;
  const iterUsed = new Uint8Array(52);
  const rangeIdx = [];
  const randomIdx = [];
  players.forEach((p, i) => {
    if (p === null) randomIdx.push(i);
    else if ("range" in p) rangeIdx.push(i);
    else {
      hands[i][0] = p.cards[0];
      hands[i][1] = p.cards[1];
    }
  });
  for (let it = 0; it < iterations; it++) {
    iterUsed.set(used);
    let ok = true;
    for (const i of rangeIdx) {
      const range = players[i].range;
      let found = false;
      for (let tries = 0; tries < 30 && range.length > 0; tries++) {
        const combo = range[Math.floor(rng() * range.length)];
        if (!iterUsed[combo[0]] && !iterUsed[combo[1]]) {
          hands[i][0] = combo[0];
          hands[i][1] = combo[1];
          iterUsed[combo[0]] = 1;
          iterUsed[combo[1]] = 1;
          found = true;
          break;
        }
      }
      if (!found) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    let k = 0;
    const draw = () => {
      for (; ; ) {
        const j = k + Math.floor(rng() * (avail.length - k));
        const t = avail[k];
        avail[k] = avail[j];
        avail[j] = t;
        const c = avail[k++];
        if (!iterUsed[c]) {
          iterUsed[c] = 1;
          return c;
        }
      }
    };
    for (const i of randomIdx) {
      hands[i][0] = draw();
      hands[i][1] = draw();
    }
    for (let j = board.length; j < 5; j++) boardBuf[j] = draw();
    scoreRound(1);
    samples++;
  }
  return finalize(win, tie, eq, samples, false);
}
function finalize(win, tie, eq, total, exact) {
  const d = total || 1;
  return {
    win: Array.from(win, (x) => x / d),
    tie: Array.from(tie, (x) => x / d),
    equity: Array.from(eq, (x) => x / d),
    samples: total,
    exact
  };
}
function equityVsRandom(hole, board, opponents, iterations = 3e3, rng = defaultRng) {
  const players = [{ cards: hole }];
  for (let i = 0; i < opponents; i++) players.push(null);
  return computeEquity(players, board, { iterations, rng }).equity[0];
}

// src/engine/game.ts
var clone = (x) => structuredClone(x);
function formatBB(chips, bigBlind) {
  const v = chips / bigBlind;
  const rounded = Math.round(v * 10) / 10;
  return `${rounded.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} BB`;
}
function createGame(seats, smallBlind = 5, bigBlind = 10) {
  return {
    smallBlind,
    bigBlind,
    players: seats.map((s) => ({
      ...s,
      hole: [],
      bet: 0,
      contributed: 0,
      folded: false,
      allIn: false,
      hasActed: false,
      sittingOut: s.stack <= 0,
      lastAction: null,
      shown: false
    })),
    button: -1,
    sbIndex: -1,
    bbIndex: -1,
    street: "showdown",
    board: [],
    deck: [],
    currentBet: 0,
    minRaise: bigBlind,
    toAct: null,
    lastAggressor: null,
    preflopAggressor: null,
    handNumber: 0,
    history: [],
    log: [],
    result: null,
    positions: seats.map(() => null),
    startStacks: seats.map((s) => s.stack)
  };
}
var inHand = (p) => !p.sittingOut && !p.folded;
var canAct = (p) => inHand(p) && !p.allIn;
function potTotal(s) {
  return s.players.reduce((a, p) => a + p.contributed, 0);
}
function nextIndex(s, from, pred) {
  const n = s.players.length;
  for (let k = 1; k <= n; k++) {
    const i = ((from + k) % n + n) % n;
    if (pred(s.players[i], i)) return i;
  }
  return -1;
}
function name(s, i) {
  return s.players[i].isHuman ? "Vous" : s.players[i].name;
}
function verb(s, i, human, other) {
  return s.players[i].isHuman ? human : other;
}
function bb(s, chips) {
  return formatBB(chips, s.bigBlind);
}
function log(s, text, kind = "action") {
  s.log.push({ street: s.street, text, kind });
}
function computePositions(s) {
  const out = s.players.map(() => null);
  const order = [];
  let i = s.button;
  do {
    if (!s.players[i].sittingOut) order.push(i);
    i = (i + 1) % s.players.length;
  } while (i !== s.button);
  const n = order.length;
  if (n === 2) {
    out[order[0]] = "BTN";
    out[order[1]] = "BB";
    return out;
  }
  out[order[0]] = "BTN";
  out[order[1]] = "SB";
  out[order[2]] = "BB";
  const early = ["UTG", "HJ", "CO"].slice(3 - (n - 3));
  for (let k = 3; k < n; k++) out[order[k]] = early[k - 3] ?? "MP";
  return out;
}
function postBlind(s, i, amount, label) {
  const p = s.players[i];
  const paid = Math.min(amount, p.stack);
  const potBefore = potTotal(s);
  p.stack -= paid;
  p.bet = paid;
  p.contributed = paid;
  if (p.stack === 0) p.allIn = true;
  p.lastAction = `${label} ${bb(s, paid)}`;
  s.history.push({ player: i, street: "preflop", type: "blind", amount: paid, to: paid, allIn: p.allIn, facing: 0, potBefore });
  log(s, `${name(s, i)} ${verb(s, i, "payez", "paie")} la ${label === "SB" ? "petite" : "grosse"} blind (${bb(s, paid)})`);
}
function startHand(state, rng = defaultRng) {
  const s = clone(state);
  s.handNumber++;
  s.board = [];
  s.history = [];
  s.log = [];
  s.result = null;
  s.currentBet = 0;
  s.minRaise = s.bigBlind;
  s.lastAggressor = null;
  s.preflopAggressor = null;
  for (const p of s.players) {
    p.hole = [];
    p.bet = 0;
    p.contributed = 0;
    p.folded = false;
    p.allIn = false;
    p.hasActed = false;
    p.lastAction = null;
    p.shown = false;
    p.sittingOut = p.stack <= 0;
  }
  s.startStacks = s.players.map((p) => p.stack);
  const active = s.players.filter((p) => !p.sittingOut).length;
  if (active < 2) throw new Error("Il faut au moins deux joueurs avec des jetons.");
  if (s.button < 0) {
    const candidates = s.players.map((p, i) => p.sittingOut ? -1 : i).filter((i) => i >= 0);
    s.button = candidates[randInt(rng, candidates.length)];
  } else {
    s.button = nextIndex(s, s.button, (p) => !p.sittingOut);
  }
  if (active === 2) {
    s.sbIndex = s.button;
    s.bbIndex = nextIndex(s, s.button, (p) => !p.sittingOut);
  } else {
    s.sbIndex = nextIndex(s, s.button, (p) => !p.sittingOut);
    s.bbIndex = nextIndex(s, s.sbIndex, (p) => !p.sittingOut);
  }
  s.positions = computePositions(s);
  s.street = "preflop";
  log(s, `Main n\xB0 ${s.handNumber} \u2014 bouton : ${name(s, s.button)}`, "info");
  postBlind(s, s.sbIndex, s.smallBlind, "SB");
  postBlind(s, s.bbIndex, s.bigBlind, "BB");
  s.currentBet = s.bigBlind;
  s.deck = shuffle(fullDeck(), rng);
  for (let round = 0; round < 2; round++) {
    let i = s.sbIndex;
    for (let k = 0; k < active; k++) {
      s.players[i].hole.push(s.deck.pop());
      i = nextIndex(s, i, (p) => !p.sittingOut);
    }
  }
  const human = s.players.findIndex((p) => p.isHuman && !p.sittingOut);
  if (human >= 0) log(s, `Vous recevez ${cardsLabel(s.players[human].hole)}`, "info");
  s.toAct = s.bbIndex;
  progress(s, s.bbIndex);
  return s;
}
function getLegalActions(s) {
  if (s.toAct === null || s.result) return null;
  const p = s.players[s.toAct];
  const toCall = Math.min(s.currentBet - p.bet, p.stack);
  const maxRaiseTo = p.bet + p.stack;
  const minRaiseTo = Math.min(s.currentBet + s.minRaise, maxRaiseTo);
  const othersCanAct = s.players.some((q, i) => i !== s.toAct && canAct(q));
  const othersInHand = s.players.some((q, i) => i !== s.toAct && inHand(q) && q.bet + q.stack > s.currentBet);
  return {
    toCall,
    canCheck: p.bet >= s.currentBet,
    canRaise: p.stack > toCall && !p.hasActed && othersCanAct && othersInHand,
    minRaiseTo,
    maxRaiseTo,
    pot: potTotal(s)
  };
}
function applyAction(state, action) {
  const s = clone(state);
  const legal = getLegalActions(s);
  if (!legal || s.toAct === null) throw new Error("Aucun joueur ne doit parler.");
  const i = s.toAct;
  const p = s.players[i];
  const potBefore = potTotal(s);
  const facing = legal.toCall;
  let type = action.type;
  if (type === "call" && legal.toCall === 0) type = "check";
  if (type === "check" && !legal.canCheck) throw new Error("Impossible de checker : il y a une mise \xE0 payer.");
  if (type === "raise" && !legal.canRaise) type = legal.toCall > 0 ? "call" : "check";
  switch (type) {
    case "fold": {
      p.folded = true;
      p.lastAction = "Couch\xE9";
      log(s, `${name(s, i)} ${verb(s, i, "vous couchez", "se couche")}`);
      s.history.push({ player: i, street: s.street, type: "fold", amount: 0, to: p.bet, allIn: false, facing, potBefore });
      break;
    }
    case "check": {
      p.lastAction = "Parole";
      log(s, `${name(s, i)} ${verb(s, i, "checkez", "checke")}`);
      s.history.push({ player: i, street: s.street, type: "check", amount: 0, to: p.bet, allIn: false, facing, potBefore });
      break;
    }
    case "call": {
      const chips = legal.toCall;
      p.stack -= chips;
      p.bet += chips;
      p.contributed += chips;
      if (p.stack === 0) p.allIn = true;
      p.lastAction = p.allIn ? `Tapis ${bb(s, p.bet)}` : `Suit ${bb(s, p.bet)}`;
      log(
        s,
        p.allIn ? `${name(s, i)} ${verb(s, i, "suivez", "suit")} pour ${bb(s, chips)} et ${verb(s, i, "\xEAtes", "est")} \xE0 tapis` : `${name(s, i)} ${verb(s, i, "suivez", "suit")} ${bb(s, chips)}`
      );
      s.history.push({ player: i, street: s.street, type: "call", amount: chips, to: p.bet, allIn: p.allIn, facing, potBefore });
      break;
    }
    case "raise": {
      let to = Math.round(action.amount ?? legal.minRaiseTo);
      to = Math.max(legal.minRaiseTo, Math.min(legal.maxRaiseTo, to));
      const chips = to - p.bet;
      const isBet = s.currentBet === 0;
      const raiseSize = to - s.currentBet;
      p.stack -= chips;
      p.bet = to;
      p.contributed += chips;
      if (p.stack === 0) p.allIn = true;
      if (raiseSize >= s.minRaise) {
        s.minRaise = raiseSize;
        for (const [j, q] of s.players.entries()) if (j !== i && canAct(q)) q.hasActed = false;
      }
      s.currentBet = to;
      s.lastAggressor = i;
      if (s.street === "preflop") s.preflopAggressor = i;
      const word = isBet ? "Mise" : "Relance";
      p.lastAction = p.allIn ? `Tapis ${bb(s, to)}` : `${word} ${bb(s, to)}`;
      if (p.allIn) log(s, `${name(s, i)} ${verb(s, i, "faites", "fait")} tapis (${bb(s, to)})`);
      else if (isBet) log(s, `${name(s, i)} ${verb(s, i, "misez", "mise")} ${bb(s, to)}`);
      else log(s, `${name(s, i)} ${verb(s, i, "relancez", "relance")} \xE0 ${bb(s, to)}`);
      s.history.push({ player: i, street: s.street, type: "raise", amount: chips, to, allIn: p.allIn, facing, potBefore });
      break;
    }
  }
  p.hasActed = true;
  progress(s, i);
  return s;
}
function isRoundComplete(s) {
  const actors = s.players.filter(canAct);
  if (actors.length === 0) return true;
  if (actors.length === 1) {
    const p = actors[0];
    const othersInHand = s.players.filter((q) => inHand(q) && q !== p).length;
    if (othersInHand === 0) return true;
    return p.bet >= s.currentBet && (p.hasActed || s.players.every((q) => q === p || !inHand(q) || q.allIn));
  }
  return actors.every((p) => p.hasActed && p.bet === s.currentBet);
}
function progress(s, from) {
  const remaining = s.players.map((p, i) => inHand(p) ? i : -1).filter((i) => i >= 0);
  if (remaining.length === 1) {
    awardUncontested(s, remaining[0]);
    return;
  }
  if (isRoundComplete(s)) {
    const actors = s.players.filter(canAct).length;
    if (actors <= 1) {
      while (s.board.length < 5) dealNextStreet(s);
      showdown(s);
      return;
    }
    if (s.street === "river") {
      showdown(s);
      return;
    }
    dealNextStreet(s);
    s.toAct = nextIndex(s, s.button, canAct);
    return;
  }
  s.toAct = nextIndex(s, from, (p) => canAct(p) && (!p.hasActed || p.bet < s.currentBet));
}
function dealNextStreet(s) {
  for (const p of s.players) {
    p.bet = 0;
    p.hasActed = false;
    if (inHand(p) && !p.allIn) p.lastAction = null;
  }
  s.currentBet = 0;
  s.minRaise = s.bigBlind;
  s.lastAggressor = null;
  if (s.board.length === 0) {
    s.street = "flop";
    s.board.push(s.deck.pop(), s.deck.pop(), s.deck.pop());
    log(s, `Flop : ${cardsLabel(s.board)}`, "board");
  } else if (s.board.length === 3) {
    s.street = "turn";
    s.board.push(s.deck.pop());
    log(s, `Turn : ${cardsLabel(s.board)}`, "board");
  } else {
    s.street = "river";
    s.board.push(s.deck.pop());
    log(s, `River : ${cardsLabel(s.board)}`, "board");
  }
}
function refundUncalled(s) {
  let top = -1;
  let topAmt = -1;
  let second = 0;
  s.players.forEach((p, i) => {
    if (p.contributed > topAmt) {
      second = Math.max(second, topAmt);
      topAmt = p.contributed;
      top = i;
    } else second = Math.max(second, p.contributed);
  });
  const extra = topAmt - second;
  if (top >= 0 && extra > 0) {
    const p = s.players[top];
    p.contributed -= extra;
    p.stack += extra;
    p.bet = Math.max(0, p.bet - extra);
    if (p.stack > 0) p.allIn = false;
    log(s, `${name(s, top)} ${verb(s, top, "r\xE9cup\xE9rez", "r\xE9cup\xE8re")} ${bb(s, extra)} non suivis`, "info");
  }
}
function finish(s, result, summary) {
  s.toAct = null;
  for (const p of s.players) p.bet = 0;
  s.result = {
    ...result,
    net: s.players.map((p, i) => p.stack - s.startStacks[i]),
    summary
  };
}
function awardUncontested(s, winner) {
  refundUncalled(s);
  const pot = potTotal(s);
  s.players[winner].stack += pot;
  log(s, `${name(s, winner)} ${verb(s, winner, "remportez", "remporte")} ${bb(s, pot)} sans abattage`, "win");
  finish(
    s,
    {
      pots: [{ amount: pot, eligible: [winner], winners: [winner], label: "Pot" }],
      showdown: false,
      scores: s.players.map(() => null),
      handNames: s.players.map(() => null)
    },
    `${name(s, winner)} ${verb(s, winner, "remportez", "remporte")} ${bb(s, pot)}`
  );
}
function buildPots(players) {
  const levels = Array.from(
    new Set(players.filter((p) => !p.folded && !p.sittingOut && p.contributed > 0).map((p) => p.contributed))
  ).sort((a, b) => a - b);
  const pots = [];
  let prev = 0;
  for (const level of levels) {
    let amount = 0;
    for (const p of players) amount += Math.max(0, Math.min(p.contributed, level) - prev);
    const eligible = players.map((p, i) => !p.folded && !p.sittingOut && p.contributed >= level ? i : -1).filter((i) => i >= 0);
    if (amount > 0) pots.push({ amount, eligible });
    prev = level;
  }
  const total = players.reduce((a, p) => a + p.contributed, 0);
  const counted = pots.reduce((a, p) => a + p.amount, 0);
  if (pots.length && total > counted) pots[pots.length - 1].amount += total - counted;
  return pots;
}
function showdown(s) {
  refundUncalled(s);
  s.street = "showdown";
  const scores = s.players.map(
    (p) => inHand(p) ? evaluate([...p.hole, ...s.board]) : null
  );
  const handNames = scores.map((sc) => sc === null ? null : describeScore(sc));
  s.players.forEach((p, i) => {
    if (inHand(p)) {
      p.shown = true;
      log(s, `${name(s, i)} ${verb(s, i, "montrez", "montre")} ${cardsLabel(p.hole)} \u2014 ${handNames[i]}`, "info");
    }
  });
  const pots = buildPots(s.players);
  const results = [];
  const n = s.players.length;
  const seatOrder = (i) => (i - s.button - 1 + n) % n;
  pots.forEach((pot, k) => {
    let best = -1;
    for (const i of pot.eligible) best = Math.max(best, scores[i]);
    const winners = pot.eligible.filter((i) => scores[i] === best).sort((a, b) => seatOrder(a) - seatOrder(b));
    const share = Math.floor(pot.amount / winners.length);
    let odd = pot.amount - share * winners.length;
    for (const w of winners) {
      s.players[w].stack += share + (odd > 0 ? 1 : 0);
      if (odd > 0) odd--;
    }
    const label = pots.length === 1 ? "Pot" : k === 0 ? "Pot principal" : `Pot annexe ${k}`;
    results.push({ amount: pot.amount, eligible: pot.eligible, winners, label });
    const who = winners.map((w) => name(s, w)).join(" et ");
    const plural = winners.length > 1 || s.players[winners[0]].isHuman;
    log(
      s,
      `${who} ${plural ? winners.length > 1 ? "se partagent" : "remportez" : "remporte"} ${label.toLowerCase()} (${bb(s, pot.amount)}) avec ${handNames[winners[0]]}`,
      "win"
    );
  });
  const main = results[0];
  const mainWinners = main.winners.map((w) => name(s, w)).join(" et ");
  const summary = main.winners.length > 1 ? `Partage : ${mainWinners} (${handNames[main.winners[0]]})` : `${mainWinners} ${s.players[main.winners[0]].isHuman ? "gagnez" : "gagne"} avec ${handNames[main.winners[0]]}`;
  finish(s, { pots: results, showdown: true, scores, handNames }, summary);
}

// src/engine/bot.ts
var BOT_PROFILES = [
  {
    id: "roc",
    label: "Roc",
    style: "Serr\xE9-passif",
    description: "Joue peu de mains et mise surtout quand il a du jeu. Une relance de sa part est rarement un bluff.",
    looseness: -0.35,
    aggression: 0.3,
    bluff: 0.03,
    stickiness: 0.25
  },
  {
    id: "reg",
    label: "R\xE9gulier",
    style: "Serr\xE9-agressif",
    description: "Proche des ranges standard, mise pour la valeur et c-bet souvent. L\u2019adversaire de r\xE9f\xE9rence.",
    looseness: 0,
    aggression: 0.6,
    bluff: 0.12,
    stickiness: 0.4
  },
  {
    id: "lag",
    label: "Agressif",
    style: "Large-agressif",
    description: "Ouvre large, relance et bluffe beaucoup. Il faut savoir payer plus l\xE9ger contre lui.",
    looseness: 0.45,
    aggression: 0.8,
    bluff: 0.26,
    stickiness: 0.45
  },
  {
    id: "station",
    label: "Station",
    style: "Large-passif",
    description: "Paye trop souvent et bluffe peu. Misez vos mains fortes pour la valeur, \xE9vitez de le bluffer.",
    looseness: 0.55,
    aggression: 0.15,
    bluff: 0.03,
    stickiness: 0.9
  }
];
var PROFILE_BY_ID = Object.fromEntries(BOT_PROFILES.map((p) => [p.id, p]));
var OPEN_PERCENT = { UTG: 15, HJ: 19, CO: 27, BTN: 43, SB: 40, BB: 50, MP: 17 };
function rfiPosition(pos, playersInHand) {
  if (playersInHand === 2) return "BTN";
  if (pos === "UTG" || pos === "HJ" || pos === "CO" || pos === "BTN" || pos === "SB") return pos;
  return "HJ";
}
function preflopRaises(s) {
  return s.history.filter((h) => h.street === "preflop" && h.type === "raise").length;
}
function roundTo(chips, unit) {
  return Math.max(unit, Math.round(chips / unit) * unit);
}
function decideBot(s, rng = defaultRng) {
  const i = s.toAct;
  const p = s.players[i];
  const prof = PROFILE_BY_ID[p.profile ?? "reg"] ?? BOT_PROFILES[1];
  const legal = getLegalActions(s);
  const bbAmt = s.bigBlind;
  const opponents = s.players.filter((q, j) => j !== i && !q.folded && !q.sittingOut).length;
  const pot = potTotal(s);
  const raiseTo = (to) => {
    if (!legal.canRaise) return legal.toCall > 0 ? { type: "call" } : { type: "check" };
    let amt = Math.max(legal.minRaiseTo, Math.min(legal.maxRaiseTo, Math.round(to)));
    if (amt - p.bet > 0.7 * p.stack) amt = legal.maxRaiseTo;
    return { type: "raise", amount: amt };
  };
  const passive = () => legal.toCall === 0 ? { type: "check" } : { type: "fold" };
  const call = () => legal.toCall === 0 ? { type: "check" } : { type: "call" };
  if (s.street === "preflop") {
    const hc = handClassOf(p.hole[0], p.hole[1]);
    const top = HAND_TOP_PERCENT[hc];
    const raises = preflopRaises(s);
    const pos = s.positions[i];
    const stackBB = (p.stack + p.bet) / bbAmt;
    const widen = 1 + prof.looseness;
    const noise = (rng() - 0.5) * 6;
    if (stackBB <= 12) {
      const pushPct = (raises === 0 ? 30 : 12) * widen + noise;
      if (top <= pushPct) return raiseTo(legal.maxRaiseTo);
      return passive();
    }
    if (raises === 0) {
      const limpers = s.history.filter((h) => h.street === "preflop" && h.type === "call").length;
      if (pos === "BB") {
        if (top <= 12 * widen + noise && rng() < 0.5 + prof.aggression / 2) return raiseTo(bbAmt * (3 + limpers));
        return { type: "check" };
      }
      const rfi = rfiPosition(pos, opponents + 1);
      const inChart = RFI_SETS[rfi].has(hc);
      const openPct = OPEN_PERCENT[rfi] * widen + noise;
      const opens = prof.looseness === 0 ? inChart || top <= openPct * 0.9 : top <= openPct;
      if (opens) {
        if (rng() < 0.35 + prof.aggression * 0.75) return raiseTo(bbAmt * (limpers > 0 ? 3.5 + limpers : rfi === "SB" ? 3 : 2.5));
        return call();
      }
      if (prof.aggression < 0.4 && top <= openPct * 1.6 && rng() < 0.4) return call();
      if (pos === "SB" && legal.toCall <= bbAmt / 2 && top <= 60 * widen && rng() < 0.3 + prof.looseness) return call();
      return passive();
    }
    const toCallBB = legal.toCall / bbAmt;
    if (raises === 1) {
      const threeBetPct = 4 * (1 + prof.looseness * 0.8) * (0.6 + prof.aggression);
      if (top <= threeBetPct + noise / 3) return raiseTo(s.currentBet * (pos === "BB" || pos === "SB" ? 4 : 3));
      if (hc.endsWith("s") && top <= 35 && rng() < prof.bluff * 0.5) return raiseTo(s.currentBet * 3);
      const priceFactor = Math.min(1.4, 3 / Math.max(1, toCallBB));
      let callPct2 = (pos === "BB" ? 30 : pos === "BTN" || pos === "CO" ? 16 : 11) * priceFactor;
      callPct2 *= 1 + prof.looseness + prof.stickiness * 0.4;
      if (top <= callPct2 + noise) return call();
      return passive();
    }
    if (top <= 2.6 * (1 + prof.looseness * 0.5)) return raiseTo(s.currentBet * 2.3);
    const callPct = (raises === 2 ? 7 : 3.5) * (1 + prof.looseness * 0.5 + prof.stickiness * 0.4);
    if (top <= callPct + noise / 4 && toCallBB < stackBB * 0.45) return call();
    return passive();
  }
  let equity = equityVsRandom(p.hole, s.board, Math.max(1, opponents), 450, rng);
  const streetRaises = s.history.filter((h) => h.street === s.street && h.type === "raise").length;
  const caution = Math.pow(0.86 + prof.stickiness * 0.1, streetRaises);
  equity = equity * caution + (rng() - 0.5) * 0.06;
  const potOdds = legal.toCall / (pot + legal.toCall);
  const wasAggressor = s.preflopAggressor === i;
  if (legal.toCall === 0) {
    if (equity > 0.68 && rng() < 0.45 + prof.aggression * 0.5) return raiseTo(roundTo(pot * (rng() < 0.5 ? 0.66 : 0.75), bbAmt / 2));
    if (equity > 0.52 && rng() < prof.aggression * 0.7) return raiseTo(roundTo(pot * 0.5, bbAmt / 2));
    if (s.street === "flop" && wasAggressor && opponents <= 2 && rng() < 0.35 + prof.aggression * 0.35)
      return raiseTo(roundTo(pot * 0.33, bbAmt / 2));
    if (rng() < prof.bluff * (opponents === 1 ? 1 : 0.5)) return raiseTo(roundTo(pot * 0.6, bbAmt / 2));
    return { type: "check" };
  }
  if (equity > 0.78 && rng() < prof.aggression) return raiseTo(s.currentBet * 3);
  const threshold = potOdds * (1.1 - prof.stickiness * 0.35);
  if (equity >= threshold) return { type: "call" };
  if (s.street !== "river" && streetRaises === 1 && rng() < prof.bluff * 0.3) return raiseTo(s.currentBet * 2.8);
  return { type: "fold" };
}

// src/online/logic.ts
var SMALL_BLIND = 5;
var BIG_BLIND = 10;
var START_STACK = 100 * BIG_BLIND;
var BOT_DELAY_MS = 900;
var AWAY_DELAY_MS = 400;
var TURN_MS = 3e4;
var NEXT_HAND_MS = 5e3;
var MAX_TIMEOUTS = 2;
var HANDS_PER_LEVEL = 6;
var BLIND_LEVELS = [
  [5, 10],
  [10, 20],
  [15, 30],
  [25, 50],
  [50, 100],
  [75, 150],
  [100, 200],
  [150, 300],
  [200, 400],
  [300, 600],
  [500, 1e3],
  [750, 1500],
  [1e3, 2e3],
  [1500, 3e3],
  [2500, 5e3]
];
function blindLevel(handNumber) {
  const i = Math.min(BLIND_LEVELS.length - 1, Math.floor(Math.max(0, handNumber - 1) / HANDS_PER_LEVEL));
  const [smallBlind, bigBlind] = BLIND_LEVELS[i];
  return {
    level: i + 1,
    smallBlind,
    bigBlind,
    handsLeft: HANDS_PER_LEVEL - Math.max(0, handNumber - 1) % HANDS_PER_LEVEL,
    last: i === BLIND_LEVELS.length - 1
  };
}
var BOT_PROFILES2 = ["reg", "lag", "roc", "station"];
var BOT_NAMES = ["Nora", "Marc", "L\xE9a", "Omar", "In\xE8s"];
var HIDDEN = -1;
var TableError = class extends Error {
};
function newTable(seats, rng, now) {
  if (seats.length < 2) throw new TableError("Il faut au moins deux joueurs pour lancer la partie.");
  const game = createGame(
    seats.map((s, i) => ({
      id: s.userId ?? `bot-${i}`,
      name: s.name,
      // Côté serveur personne n'est « vous » : chaque navigateur se reconnaît dans la vue publique.
      isHuman: false,
      profile: s.bot,
      stack: START_STACK
    })),
    SMALL_BLIND,
    BIG_BLIND
  );
  const t = { game: startHand(game, rng), seats, nextAt: null, deadline: null, timeouts: {}, eliminations: [], over: false };
  return settle(t, now);
}
function schedule(t, now) {
  const g = t.game;
  if (t.over) return { ...t, nextAt: null, deadline: null };
  if (g.result || g.toAct === null) return { ...t, nextAt: now + NEXT_HAND_MS, deadline: null };
  const seat = t.seats[g.toAct];
  if (seat.bot) return { ...t, nextAt: now + BOT_DELAY_MS, deadline: null };
  if (seat.away) return { ...t, nextAt: now + AWAY_DELAY_MS, deadline: null };
  const deadline = now + TURN_MS;
  return { ...t, nextAt: deadline, deadline };
}
function humansInPlay(t, g) {
  return t.seats.filter((s, i) => s.userId && !s.away && g.players[i].stack > 0).length;
}
function settle(t, now) {
  const g = t.game;
  if (!g.result) return schedule(t, now);
  const eliminations = t.eliminations.slice();
  const alive = g.players.filter((p) => p.stack > 0).length;
  const busted = g.players.map((p, i) => ({ p, i })).filter(({ p, i }) => p.stack === 0 && g.startStacks[i] > 0).sort((a, b) => g.startStacks[b.i] - g.startStacks[a.i]);
  let place = alive + busted.length;
  for (const { i } of busted.slice().reverse()) {
    eliminations.push({ name: t.seats[i].name, userId: t.seats[i].userId, place: place-- });
  }
  const next = { ...t, eliminations };
  return alive <= 1 || humansInPlay(next, g) === 0 ? finish2(next) : schedule(next, now);
}
function finish2(t) {
  const left = t.game.players.map((p, i) => ({ p, i })).filter(({ p }) => p.stack > 0).sort((a, b) => b.p.stack - a.p.stack);
  const eliminations = [
    ...t.eliminations,
    ...left.map(({ i }, k) => ({ name: t.seats[i].name, userId: t.seats[i].userId, place: k + 1 }))
  ];
  return { ...t, eliminations, over: true, nextAt: null, deadline: null };
}
function checkAction(g, a) {
  const legal = getLegalActions(g);
  if (!legal) throw new TableError("Ce n\u2019est pas le moment de jouer.");
  switch (a.type) {
    case "fold":
      return { type: "fold" };
    case "check":
      if (!legal.canCheck) throw new TableError("Impossible de checker : il y a une mise \xE0 payer.");
      return { type: "check" };
    case "call":
      if (legal.canCheck) return { type: "check" };
      return { type: "call" };
    case "raise": {
      if (!legal.canRaise) throw new TableError("Relance impossible.");
      const amount = Math.round(Number(a.amount));
      if (!Number.isFinite(amount)) throw new TableError("Montant de relance invalide.");
      return { type: "raise", amount: Math.max(legal.minRaiseTo, Math.min(legal.maxRaiseTo, amount)) };
    }
    default:
      throw new TableError("Action inconnue.");
  }
}
function playerAction(t, userId, action, now) {
  const g = t.game;
  if (t.over || g.result || g.toAct === null) throw new TableError("Ce n\u2019est pas le moment de jouer.");
  if (t.seats[g.toAct].userId !== userId) throw new TableError("Ce n\u2019est pas \xE0 vous de parler.");
  const seats = t.seats.map((s) => s.userId === userId ? { ...s, away: false } : s);
  const timeouts = { ...t.timeouts, [userId]: 0 };
  return settle({ ...t, seats, timeouts, game: applyAction(g, checkAction(g, action)) }, now);
}
function autoAction(g) {
  const legal = getLegalActions(g);
  return legal?.canCheck ? { type: "check" } : { type: "fold" };
}
function step(t, now, rng) {
  if (t.over || t.nextAt === null || now < t.nextAt) return null;
  const g = t.game;
  if (g.result || g.toAct === null) {
    const lvl = blindLevel(g.handNumber + 1);
    return settle({ ...t, game: startHand({ ...g, smallBlind: lvl.smallBlind, bigBlind: lvl.bigBlind }, rng) }, now);
  }
  const seat = t.seats[g.toAct];
  if (seat.bot) return settle({ ...t, game: applyAction(g, decideBot(g, rng)) }, now);
  const timeouts = { ...t.timeouts };
  let seats = t.seats;
  if (!seat.away && seat.userId) {
    timeouts[seat.userId] = (timeouts[seat.userId] ?? 0) + 1;
    if (timeouts[seat.userId] >= MAX_TIMEOUTS) seats = seats.map((s) => s.userId === seat.userId ? { ...s, away: true } : s);
  }
  return settle({ ...t, seats, timeouts, game: applyAction(g, autoAction(g)) }, now);
}
function setAway(t, userId, away, now) {
  if (!t.seats.some((s) => s.userId === userId)) return t;
  const seats = t.seats.map((s) => s.userId === userId ? { ...s, away } : s);
  const timeouts = { ...t.timeouts, [userId]: 0 };
  const next = { ...t, seats, timeouts };
  if (next.over) return next;
  if (away && humansInPlay(next, next.game) === 0) return finish2(next);
  return next.game.toAct !== null && seats[next.game.toAct].userId === userId ? schedule(next, now) : next;
}
function publicView(t) {
  const g = t.game;
  return {
    game: {
      ...g,
      deck: [],
      players: g.players.map((p) => ({ ...p, hole: p.shown ? p.hole : p.hole.map(() => HIDDEN) }))
    },
    seats: t.seats,
    nextAt: t.nextAt,
    deadline: t.deadline,
    eliminations: t.eliminations,
    over: t.over
  };
}
function privateHands(t) {
  return t.seats.flatMap(
    (s, i) => s.userId && t.game.players[i].hole.length ? [{ userId: s.userId, hand: t.game.handNumber, cards: t.game.players[i].hole }] : []
  );
}
function botSeats(count, taken, rng) {
  const names = BOT_NAMES.filter((n) => !taken.includes(n));
  const out = [];
  for (let i = 0; i < count; i++) {
    const profile = BOT_PROFILES2[Math.floor(rng() * BOT_PROFILES2.length)];
    out.push({ userId: null, bot: profile, name: names[i] ?? `Bot ${i + 1}`, away: false });
  }
  return out;
}

// src/online/service.ts
var CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
var CODE_LENGTH = 5;
function normalizeCode(code) {
  return String(code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, CODE_LENGTH);
}
function cleanName(name2) {
  const n = String(name2 ?? "").replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 20);
  if (!n) throw new TableError("Choisissez un pseudo.");
  return n;
}
function newCode(rng) {
  let c = "";
  for (let i = 0; i < CODE_LENGTH; i++) c += CODE_CHARS[Math.floor(rng() * CODE_CHARS.length)];
  return c;
}
async function roomOf(store, roomId) {
  const room = await store.getRoom(String(roomId ?? ""));
  if (!room) throw new TableError("Cette table n\u2019existe plus.");
  return room;
}
async function memberOf(store, room, userId) {
  const m = (await store.members(room.id)).find((x) => x.userId === userId);
  if (!m) throw new TableError("Vous n\u2019\xEAtes pas assis \xE0 cette table.");
  return m;
}
function statusOf(t) {
  return t.over ? "terminee" : "en-cours";
}
async function save(store, room, before, after) {
  const dealt = !before || before.game.handNumber !== after.game.handNumber;
  return store.saveTable(room.id, room.version, statusOf(after), publicView(after), after, dealt ? privateHands(after) : null);
}
async function mutate(store, roomId, change) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const room = await roomOf(store, roomId);
    const t = await store.loadTable(room.id);
    if (!t) throw new TableError("La partie n\u2019a pas encore commenc\xE9.");
    const next = change(room, t);
    if (!next) return { changed: false, table: t };
    if (await save(store, room, t, next)) return { changed: true, table: next };
  }
  throw new TableError("La table est tr\xE8s sollicit\xE9e, r\xE9essayez.");
}
async function seatsForGame(store, room, rng) {
  const members = (await store.members(room.id)).sort((a, b) => a.seat - b.seat);
  const seats = members.map((m) => ({ userId: m.userId, bot: null, name: m.name, away: false }));
  if (room.bots && seats.length < room.maxSeats) {
    seats.push(...botSeats(room.maxSeats - seats.length, seats.map((s) => s.name), rng));
  }
  if (seats.length < 2) throw new TableError("Attendez au moins un autre joueur, ou activez les bots.");
  return seats;
}
async function handle(store, userId, req, now, rng) {
  switch (req.action) {
    case "creer": {
      const name2 = cleanName(req.name);
      const maxSeats = Math.max(2, Math.min(6, Math.round(Number(req.maxSeats) || 6)));
      for (let attempt = 0; attempt < 8; attempt++) {
        const room = await store.insertRoom({ code: newCode(rng), host: userId, maxSeats, bots: !!req.bots, status: "attente" });
        if (!room) continue;
        await store.insertMember(room.id, { userId, seat: 0, name: name2, away: false });
        return { roomId: room.id, code: room.code };
      }
      throw new TableError("Impossible de cr\xE9er la table, r\xE9essayez.");
    }
    case "rejoindre": {
      const name2 = cleanName(req.name);
      const room = await store.findRoomByCode(normalizeCode(req.code));
      if (!room) throw new TableError("Aucune table avec ce code.");
      const members = await store.members(room.id);
      const me = members.find((m) => m.userId === userId);
      if (me) {
        if (me.away || me.name !== name2) await store.updateMember(room.id, userId, { away: false, ...room.status === "attente" ? { name: name2 } : {} });
        if (room.status === "en-cours") await mutate(store, room.id, (_r, t) => t.seats.find((s) => s.userId === userId)?.away ? setAway(t, userId, false, now) : null);
        return { roomId: room.id, code: room.code };
      }
      if (room.status === "en-cours") throw new TableError("La partie a d\xE9j\xE0 commenc\xE9 \xE0 cette table : attendez la fin de la partie.");
      for (let attempt = 0; attempt < 4; attempt++) {
        const taken = new Set((await store.members(room.id)).map((m) => m.seat));
        let seat = 0;
        while (taken.has(seat)) seat++;
        if (seat >= room.maxSeats) throw new TableError("La table est compl\xE8te.");
        if (await store.insertMember(room.id, { userId, seat, name: name2, away: false })) return { roomId: room.id, code: room.code };
      }
      throw new TableError("Impossible de rejoindre la table, r\xE9essayez.");
    }
    case "quitter": {
      const room = await roomOf(store, req.roomId);
      await memberOf(store, room, userId);
      if (room.status === "attente") {
        await store.deleteMember(room.id, userId);
        if (room.host === userId) {
          const rest = (await store.members(room.id)).sort((a, b) => a.seat - b.seat);
          if (rest.length) await store.setHost(room.id, rest[0].userId);
          else await store.deleteRoom(room.id);
        }
        return { changed: true };
      }
      await store.updateMember(room.id, userId, { away: true });
      if (room.status === "en-cours") await mutate(store, room.id, (_r, t) => setAway(t, userId, true, now));
      return { changed: true };
    }
    case "lancer":
    case "rejouer": {
      const room = await roomOf(store, req.roomId);
      if (room.host !== userId) throw new TableError("Seul l\u2019h\xF4te de la table peut lancer la partie.");
      if (req.action === "lancer" && room.status !== "attente") throw new TableError("La partie est d\xE9j\xE0 lanc\xE9e.");
      if (req.action === "rejouer" && room.status !== "terminee") throw new TableError("La partie n\u2019est pas termin\xE9e.");
      const before = req.action === "rejouer" ? await store.loadTable(room.id) : null;
      const t = newTable(await seatsForGame(store, room, rng), rng, now);
      if (req.action === "rejouer") {
        for (const m of await store.members(room.id)) if (m.away) await store.updateMember(room.id, m.userId, { away: false });
      }
      const ok = await store.saveTable(room.id, room.version, "en-cours", publicView(t), t, privateHands(t));
      if (!ok && !before) throw new TableError("La partie vient d\u2019\xEAtre lanc\xE9e.");
      return { changed: ok, nextAt: t.nextAt };
    }
    case "jouer": {
      const room = await roomOf(store, req.roomId);
      await memberOf(store, room, userId);
      const { table } = await mutate(store, room.id, (_r, t) => playerAction(t, userId, req.move, now));
      return { changed: true, nextAt: table?.nextAt ?? null };
    }
    case "avancer": {
      const room = await roomOf(store, req.roomId);
      await memberOf(store, room, userId);
      if (room.status !== "en-cours") return { changed: false, nextAt: null };
      const { changed, table } = await mutate(store, room.id, (_r, t) => step(t, now, rng));
      return { changed, nextAt: table?.nextAt ?? null };
    }
    default:
      throw new TableError("Requ\xEAte inconnue.");
  }
}
export {
  CODE_LENGTH,
  TableError,
  cleanName,
  handle,
  normalizeCode
};
