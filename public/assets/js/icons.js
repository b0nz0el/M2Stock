/* ═══════════════════════════════════════════════════
   Aquastock Pro — icons.js
   Local Lucide SVG Subset (74 icons)
   ═══════════════════════════════════════════════════ */
(function() {
  const ICONS = {
  "activity": "<path d=\"M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2\"></path>",
  "alert-circle": "<circle cx=\"12\" cy=\"12\" r=\"10\"></circle><line x1=\"12\" x2=\"12\" y1=\"8\" y2=\"12\"></line><line x1=\"12\" x2=\"12.01\" y1=\"16\" y2=\"16\"></line>",
  "alert-triangle": "<path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3\"></path><path d=\"M12 9v4\"></path><path d=\"M12 17h.01\"></path>",
  "arrow-down": "<path d=\"M12 5v14\"></path><path d=\"m19 12-7 7-7-7\"></path>",
  "arrow-up": "<path d=\"m5 12 7-7 7 7\"></path><path d=\"M12 19V5\"></path>",
  "arrow-up-down": "<path d=\"m21 16-4 4-4-4\"></path><path d=\"M17 20V4\"></path><path d=\"m3 8 4-4 4 4\"></path><path d=\"M7 4v16\"></path>",
  "arrow-down-a-z": "<path d=\"m3 16 4 4 4-4\"></path><path d=\"M7 20V4\"></path><path d=\"M20 8h-5\"></path><path d=\"M15 10V6.5a2.5 2.5 0 0 1 5 0V10\"></path><path d=\"M15 14h5l-5 6h5\"></path>",
  "arrow-up-z-a": "<path d=\"m3 8 4-4 4 4\"></path><path d=\"M7 4v16\"></path><path d=\"M15 4h5l-5 6h5\"></path><path d=\"M15 20v-3.5a2.5 2.5 0 0 1 5 0V20\"></path><path d=\"M20 18h-5\"></path>",
  "arrow-down-left": "<path d=\"M17 7 7 17\"></path><path d=\"M17 17H7V7\"></path>",
  "arrow-left": "<path d=\"m12 19-7-7 7-7\"></path><path d=\"M19 12H5\"></path>",
  "arrow-left-right": "<path d=\"m8 3-4 4 4 4\"></path><path d=\"M4 7h16\"></path><path d=\"m16 21 4-4-4-4\"></path><path d=\"M20 17H4\"></path>",
  "arrow-down-circle": "<circle cx=\"12\" cy=\"12\" r=\"10\"></circle><path d=\"M12 8v8\"></path><path d=\"m8 12 4 4 4-4\"></path>",
  "arrow-right": "<path d=\"M5 12h14\"></path><path d=\"m12 5 7 7-7 7\"></path>",
  "arrow-up-right": "<path d=\"M7 7h10v10\"></path><path d=\"M7 17 17 7\"></path>",
  "arrow-up-circle": "<circle cx=\"12\" cy=\"12\" r=\"10\"></circle><path d=\"m16 12-4-4-4 4\"></path><path d=\"M12 16V8\"></path>",
  "banknote": "<rect width=\"20\" height=\"12\" x=\"2\" y=\"6\" rx=\"2\"></rect><circle cx=\"12\" cy=\"12\" r=\"2\"></circle><path d=\"M6 12h.01M18 12h.01\"></path>",
  "bar-chart-3": "<path d=\"M3 3v16a2 2 0 0 0 2 2h16\"></path><path d=\"M18 17V9\"></path><path d=\"M13 17V5\"></path><path d=\"M8 17v-3\"></path>",
  "bell": "<path d=\"M10.268 21a2 2 0 0 0 3.464 0\"></path><path d=\"M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326\"></path>",
  "bell-off": "<path d=\"M10.268 21a2 2 0 0 0 3.464 0\"></path><path d=\"M6.26 6.26A6 6 0 0 0 6 8c0 4.5-1.41 5.96-2.74 7.33A1 1 0 0 0 4 17h13\"></path><path d=\"M18 8a6 6 0 0 0-9.2-5.1\"></path><path d=\"m2 2 20 20\"></path>",
  "bell-ring": "<path d=\"M10.27 21a2 2 0 0 0 3.46 0\"></path><path d=\"M18 8a6 6 0 0 0-12 0c0 4.5-1.41 5.96-2.74 7.33A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.67C19.41 13.96 18 12.5 18 8\"></path><path d=\"M2 8c0-2 1-3.5 2.5-4.5\"></path><path d=\"M22 8c0-2-1-3.5-2.5-4.5\"></path>",
  "calendar": "<path d=\"M8 2v3\"></path><path d=\"M16 2v3\"></path><rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\"></rect><path d=\"M3 9h18\"></path>",
  "calendar-days": "<path d=\"M8 2v3\"></path><path d=\"M16 2v3\"></path><rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\"></rect><path d=\"M3 9h18\"></path><path d=\"M8 13h.01\"></path><path d=\"M12 13h.01\"></path><path d=\"M16 13h.01\"></path><path d=\"M8 17h.01\"></path><path d=\"M12 17h.01\"></path><path d=\"M16 17h.01\"></path>",
  "camera": "<path d=\"M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z\"></path><circle cx=\"12\" cy=\"13\" r=\"3\"></circle>",
  "check": "<path d=\"M20 6 9 17l-5-5\"></path>",
  "check-circle": "<circle cx=\"12\" cy=\"12\" r=\"10\"></circle><path d=\"m9 12 2 2 4-4\"></path>",
  "check-circle-2": "<circle cx=\"12\" cy=\"12\" r=\"10\"></circle><path d=\"m9 12 2 2 4-4\"></path>",
  "check-check": "<path d=\"M18 6 7 17l-5-5\"></path><path d=\"m22 10-7.5 7.5L13 16\"></path>",
  "chevron-left": "<path d=\"m15 18-6-6 6-6\"></path>",
  "chevron-right": "<path d=\"m9 18 6-6-6-6\"></path>",
  "clipboard-check": "<rect width=\"8\" height=\"4\" x=\"8\" y=\"2\" rx=\"1\" ry=\"1\"></rect><path d=\"M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2\"></path><path d=\"m9 14 2 2 4-4\"></path>",
  "clipboard-list": "<rect width=\"8\" height=\"4\" x=\"8\" y=\"2\" rx=\"1\" ry=\"1\"></rect><path d=\"M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2\"></path><path d=\"M12 11h4\"></path><path d=\"M12 16h4\"></path><path d=\"M8 11h.01\"></path><path d=\"M8 16h.01\"></path>",
  "clipboard-pen": "<rect width=\"8\" height=\"4\" x=\"8\" y=\"2\" rx=\"1\"></rect><path d=\"M16 4h2a2 2 0 0 1 2 2v8\"></path><path d=\"M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6\"></path><path d=\"m18 15 3 3-5 5h-3v-3z\"></path>",
  "clipboard-x": "<rect width=\"8\" height=\"4\" x=\"8\" y=\"2\" rx=\"1\"></rect><path d=\"M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2\"></path><path d=\"m9 11 6 6\"></path><path d=\"m15 11-6 6\"></path>",
  "clock": "<circle cx=\"12\" cy=\"12\" r=\"10\"></circle><path d=\"M12 6v6l4 2\"></path>",
  "cloud": "<path d=\"M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z\"></path>",
  "coins": "<circle cx=\"8\" cy=\"8\" r=\"6\"></circle><path d=\"M18.09 10.37A6 6 0 1 1 10.34 18\"></path><path d=\"M7 6h1v4\"></path><path d=\"m16.71 13.88.7.71-2.82 2.82\"></path>",
  "credit-card": "<rect width=\"20\" height=\"14\" x=\"2\" y=\"5\" rx=\"2\"></rect><path d=\"M2 10h20\"></path>",
  "crown": "<path d=\"M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z\"></path><path d=\"M5 21h14\"></path>",
  "database-backup": "<ellipse cx=\"12\" cy=\"5\" rx=\"9\" ry=\"3\"></ellipse><path d=\"M3 12a9 3 0 0 0 5 2.69\"></path><path d=\"M21 9.3V5\"></path><path d=\"M3 5v14a9 3 0 0 0 6.47 2.88\"></path><path d=\"M12 12v4h4\"></path><path d=\"M13 20a5 5 0 0 0 9-3 4.5 4.5 0 0 0-4.5-4.5c-1.33 0-2.54.54-3.41 1.41L12 16\"></path>",
  "database": "<ellipse cx=\"12\" cy=\"5\" rx=\"9\" ry=\"3\"></ellipse><path d=\"M3 5v14a9 3 0 0 0 18 0V5\"></path><path d=\"M3 12a9 3 0 0 0 18 0\"></path>",
  "download": "<path d=\"M12 15V3\"></path><path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\"></path><path d=\"m7 10 5 5 5-5\"></path>",
  "download-cloud": "<path d=\"M12 13v8\"></path><path d=\"m8 17 4 4 4-4\"></path><path d=\"M20 16.2A5 5 0 0 0 18 7h-1.3A8 8 0 1 0 4 15.3\"></path>",
  "edit-3": "<path d=\"M12 20h9\"></path><path d=\"M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z\"></path><path d=\"m15 5 4 4\"></path>",
  "eye": "<path d=\"M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0\"></path><circle cx=\"12\" cy=\"12\" r=\"3\"></circle>",
  "eye-off": "<path d=\"M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49\"></path><path d=\"M14.084 14.158a3 3 0 0 1-4.242-4.242\"></path><path d=\"M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143\"></path><path d=\"m2 2 20 20\"></path>",
  "external-link": "<path d=\"M15 3h6v6\"></path><path d=\"M10 14 21 3\"></path><path d=\"M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6\"></path>",
  "factory": "<path d=\"M12 16h.01\"></path><path d=\"M16 16h.01\"></path><path d=\"M3 19a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5a.5.5 0 0 0-.769-.422l-4.462 2.844A.5.5 0 0 1 15 10.5v-2a.5.5 0 0 0-.769-.422L9.77 10.922A.5.5 0 0 1 9 10.5V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2z\"></path><path d=\"M8 16h.01\"></path>",
  "file-archive": "<path d=\"M13.659 22H18a2 2 0 0 0 2-2V8a2.4 2.4 0 0 0-.706-1.706l-3.588-3.588A2.4 2.4 0 0 0 14 2H6a2 2 0 0 0-2 2v11.5\"></path><path d=\"M14 2v5a1 1 0 0 0 1 1h5\"></path><path d=\"M8 12v-1\"></path><path d=\"M8 18v-2\"></path><path d=\"M8 7V6\"></path><circle cx=\"8\" cy=\"20\" r=\"2\"></circle>",
  "file-text": "<path d=\"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z\"></path><path d=\"M14 2v5a1 1 0 0 0 1 1h5\"></path><path d=\"M10 9H8\"></path><path d=\"M16 13H8\"></path><path d=\"M16 17H8\"></path>",
  "file-edit": "<path d=\"M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h7\"></path><path d=\"M14 2v6h6\"></path><path d=\"M14 2 20 8\"></path><path d=\"m18 15 3 3-6 6H12v-3z\"></path>",
  "file-check": "<path d=\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h8\"></path><path d=\"M14 2v6h6\"></path><path d=\"m16 19 2 2 4-4\"></path><path d=\"M14 2 20 8\"></path>",
  "file-code": "<path d=\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\"></path><path d=\"M14 2v6h6\"></path><path d=\"m10 13-2 2 2 2\"></path><path d=\"m14 13 2 2-2 2\"></path>",
  "file-plus": "<path d=\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h7\"></path><path d=\"M14 2v6h6\"></path><path d=\"M14 2 20 8\"></path><path d=\"M19 16v6\"></path><path d=\"M16 19h6\"></path>",
  "file-spreadsheet": "<path d=\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\"></path><path d=\"M14 2v6h6\"></path><path d=\"M8 13h8\"></path><path d=\"M8 17h8\"></path><path d=\"M12 13v8\"></path>",
  "fish": "<path d=\"M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.47-3.44 6-7 6s-7.56-2.53-8.5-6Z\"></path><path d=\"M18 12v.5\"></path><path d=\"M16 17.93a9.77 9.77 0 0 1 0-11.86\"></path><path d=\"M7 10.67C7 8 5.58 5.97 2.73 5.5c-1 1.5-1 5 .23 6.5-1.24 1.5-1.24 5-.23 6.5C5.58 18.03 7 16 7 13.33\"></path><path d=\"M10.46 7.26C10.2 5.88 9.17 4.24 8 3h5.8a2 2 0 0 1 1.98 1.67l.23 1.4\"></path><path d=\"m16.01 17.93-.23 1.4A2 2 0 0 1 13.8 21H9.5a5.96 5.96 0 0 0 1.49-3.98\"></path>",
  "flashlight": "<path d=\"M18 6c0 2-2 2-2 4v10a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V10c0-2-2-2-2-4V2h12z\"></path><line x1=\"6\" x2=\"18\" y1=\"6\" y2=\"6\"></line><line x1=\"12\" x2=\"12\" y1=\"12\" y2=\"12\"></line>",
  "globe": "<circle cx=\"12\" cy=\"12\" r=\"10\"></circle><path d=\"M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20\"></path><path d=\"M2 12h20\"></path>",
  "history": "<path d=\"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8\"></path><path d=\"M3 3v5h5\"></path><path d=\"M12 7v5l4 2\"></path>",
  "image": "<rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\"></rect><circle cx=\"9\" cy=\"9\" r=\"2\"></circle><path d=\"m21 15-4-4L5 21\"></path>",
  "inbox": "<path d=\"M4 4h16l2 11v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-4z\"></path><path d=\"M2 15h6l2 3h4l2-3h6\"></path>",
  "info": "<circle cx=\"12\" cy=\"12\" r=\"10\"></circle><line x1=\"12\" x2=\"12\" y1=\"16\" y2=\"12\"></line><line x1=\"12\" x2=\"12.01\" y1=\"8\" y2=\"8\"></line>",
  "key": "<path d=\"m2 21 9.6-9.6\"></path><path d=\"m7.5 15.5 2.3 2.3a1 1 0 0 1 0 1.4l-2.1 2.1a1 1 0 0 1-1.4 0L4 19\"></path><circle cx=\"15.5\" cy=\"7.5\" r=\"5.5\"></circle>",
  "layers": "<path d=\"M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z\"></path><path d=\"M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12\"></path><path d=\"M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17\"></path>",
  "layout-dashboard": "<rect width=\"7\" height=\"9\" x=\"3\" y=\"3\" rx=\"1\"></rect><rect width=\"7\" height=\"5\" x=\"14\" y=\"3\" rx=\"1\"></rect><rect width=\"7\" height=\"9\" x=\"14\" y=\"12\" rx=\"1\"></rect><rect width=\"7\" height=\"5\" x=\"3\" y=\"16\" rx=\"1\"></rect>",
  "lightbulb": "<path d=\"M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5\"></path><path d=\"M9 18h6\"></path><path d=\"M10 22h4\"></path>",
  "line-chart": "<path d=\"M3 3v16a2 2 0 0 0 2 2h16\"></path><path d=\"m19 9-5 5-4-4-3 3\"></path>",
  "link": "<path d=\"M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71\"></path><path d=\"M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71\"></path>",
  "list-plus": "<path d=\"M16 5H3\"></path><path d=\"M11 12H3\"></path><path d=\"M16 19H3\"></path><path d=\"M18 9v6\"></path><path d=\"M21 12h-6\"></path>",
  "lock": "<rect width=\"18\" height=\"11\" x=\"3\" y=\"11\" rx=\"2\" ry=\"2\"></rect><path d=\"M7 11V7a5 5 0 0 1 10 0v4\"></path>",
  "log-out": "<path d=\"m16 17 5-5-5-5\"></path><path d=\"M21 12H9\"></path><path d=\"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4\"></path>",
  "loader-2": "<path d=\"M12 2v4\"></path><path d=\"M12 18v4\"></path><path d=\"m4.93 4.93 2.83 2.83\"></path><path d=\"m16.24 16.24 2.83 2.83\"></path><path d=\"M2 12h4\"></path><path d=\"M18 12h4\"></path><path d=\"m4.93 19.07 2.83-2.83\"></path><path d=\"m16.24 7.76 2.83-2.83\"></path>",
  "mail": "<path d=\"m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7\"></path><rect x=\"2\" y=\"4\" width=\"20\" height=\"16\" rx=\"2\"></rect>",
  "menu": "<path d=\"M4 5h16\"></path><path d=\"M4 12h16\"></path><path d=\"M4 19h16\"></path>",
  "maximize-2": "<polyline points=\"15 3 21 3 21 9\"></polyline><polyline points=\"9 21 3 21 3 15\"></polyline><line x1=\"21\" x2=\"14\" y1=\"3\" y2=\"10\"></line><line x1=\"3\" x2=\"10\" y1=\"21\" y2=\"14\"></line>",
  "package-plus": "<path d=\"m16.5 9.4-9-5.19\"></path><path d=\"M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0\"></path><path d=\"M3.3 7 12 12l8.7-5\"></path><path d=\"M12 22V12\"></path><path d=\"M19 16v6\"></path><path d=\"M16 19h6\"></path>",
  "package-search": "<path d=\"m16.5 9.4-9-5.19\"></path><path d=\"M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4\"></path><path d=\"M3.3 7 12 12l8.7-5\"></path><path d=\"M12 22V12\"></path><circle cx=\"18\" cy=\"18\" r=\"3\"></circle><path d=\"m20.2 20.2 1.8 1.8\"></path>",
  "package-check": "<path d=\"m16.5 9.4-9-5.19\"></path><path d=\"M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0\"></path><path d=\"M3.3 7 12 12l8.7-5\"></path><path d=\"M12 22V12\"></path><path d=\"m15 17 2 2 4-4\"></path>",
  "package-x": "<path d=\"m16.5 9.4-9-5.19\"></path><path d=\"M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0\"></path><path d=\"M3.3 7 12 12l8.7-5\"></path><path d=\"M12 22V12\"></path><path d=\"m15 16 5 5\"></path><path d=\"m20 16-5 5\"></path>",
  "pause-circle": "<circle cx=\"12\" cy=\"12\" r=\"10\"></circle><path d=\"M10 15V9\"></path><path d=\"M14 15V9\"></path>",
  "palette": "<circle cx=\"13.5\" cy=\"6.5\" r=\".5\"></circle><circle cx=\"17.5\" cy=\"10.5\" r=\".5\"></circle><circle cx=\"8.5\" cy=\"7.5\" r=\".5\"></circle><circle cx=\"6.5\" cy=\"12.5\" r=\".5\"></circle><path d=\"M12 22a10 10 0 1 1 10-10c0 1.1-.9 2-2 2h-2a2 2 0 0 0-1 3.73A2 2 0 0 1 16 21h-4z\"></path>",
  "plus-circle": "<circle cx=\"12\" cy=\"12\" r=\"10\"></circle><path d=\"M12 8v8\"></path><path d=\"M8 12h8\"></path>",
  "rotate-cw": "<path d=\"M21 7v6h-6\"></path><path d=\"M20.49 13A9 9 0 0 0 5.64 5.64L3 8\"></path><path d=\"M3 3v5h5\"></path><path d=\"M3.51 11A9 9 0 0 0 18.36 18.36L21 16\"></path>",
  "scale": "<path d=\"m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z\"></path><path d=\"m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z\"></path><path d=\"M7 21h10\"></path><path d=\"M12 3v18\"></path><path d=\"M3 7h2c2 0 3-1 4-2s2-2 3-2 2 1 3 2 2 2 4 2h2\"></path>",
  "user-check": "<path d=\"M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2\"></path><circle cx=\"10\" cy=\"7\" r=\"4\"></circle><path d=\"m16 11 2 2 4-4\"></path>",
  "user-x": "<path d=\"M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2\"></path><circle cx=\"10\" cy=\"7\" r=\"4\"></circle><path d=\"m17 8 5 5\"></path><path d=\"m22 8-5 5\"></path>",
  "package": "<path d=\"M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z\"></path><path d=\"M12 22V12\"></path><polyline points=\"3.29 7 12 12 20.71 7\"></polyline><path d=\"m7.5 4.27 9 5.15\"></path>",
  "package-open": "<path d=\"M12 22v-9\"></path><path d=\"M15.14 3.65 18 6.5l-4.5 4.5\"></path><path d=\"m3 7.8 9-5.1 9 5.1\"></path><path d=\"M4.5 10.5 9 15\"></path><path d=\"m21 16-9 5-9-5V8l9 5 9-5Z\"></path>",
  "pause": "<rect x=\"14\" y=\"3\" width=\"5\" height=\"18\" rx=\"1\"></rect><rect x=\"5\" y=\"3\" width=\"5\" height=\"18\" rx=\"1\"></rect>",
  "pencil": "<path d=\"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z\"></path><path d=\"m15 5 4 4\"></path>",
  "piggy-bank": "<path d=\"M11 17h3v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-3a3.16 3.16 0 0 0 2-2h1a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1h-1a5 5 0 0 0-2-4V3a4 4 0 0 0-3.2 1.6l-.3.4H11a6 6 0 0 0-6 6v1a5 5 0 0 0 2 4v3a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1z\"></path><path d=\"M16 10h.01\"></path><path d=\"M2 8v1a2 2 0 0 0 2 2h1\"></path>",
  "pill": "<path d=\"m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z\"></path><path d=\"m8.5 8.5 7 7\"></path>",
  "plus": "<path d=\"M5 12h14\"></path><path d=\"M12 5v14\"></path>",
  "printer": "<path d=\"M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2\"></path><path d=\"M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6\"></path><rect x=\"6\" y=\"14\" width=\"12\" height=\"8\" rx=\"1\"></rect>",
  "receipt": "<path d=\"M12 17V7\"></path><path d=\"M16 8h-6a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H8\"></path><path d=\"M4 3a1 1 0 0 1 1-1 1.3 1.3 0 0 1 .7.2l.933.6a1.3 1.3 0 0 0 1.4 0l.934-.6a1.3 1.3 0 0 1 1.4 0l.933.6a1.3 1.3 0 0 0 1.4 0l.933-.6a1.3 1.3 0 0 1 1.4 0l.934.6a1.3 1.3 0 0 0 1.4 0l.933-.6A1.3 1.3 0 0 1 19 2a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1 1.3 1.3 0 0 1-.7-.2l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.934.6a1.3 1.3 0 0 1-1.4 0l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-1.4 0l-.934-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-.7.2 1 1 0 0 1-1-1z\"></path>",
  "redo-2": "<path d=\"m15 14 5-5-5-5\"></path><path d=\"M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13\"></path>",
  "refresh-cw": "<path d=\"M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8\"></path><path d=\"M21 3v5h-5\"></path><path d=\"M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16\"></path><path d=\"M8 16H3v5\"></path>",
  "rotate-ccw": "<path d=\"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8\"></path><path d=\"M3 3v5h5\"></path>",
  "ruler": "<path d=\"M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z\"></path><path d=\"m14.5 12.5 2-2\"></path><path d=\"m11.5 9.5 2-2\"></path><path d=\"m8.5 6.5 2-2\"></path><path d=\"m17.5 15.5 2-2\"></path>",
  "scan-line": "<path d=\"M3 7V5a2 2 0 0 1 2-2h2\"></path><path d=\"M17 3h2a2 2 0 0 1 2 2v2\"></path><path d=\"M21 17v2a2 2 0 0 1-2 2h-2\"></path><path d=\"M7 21H5a2 2 0 0 1-2-2v-2\"></path><line x1=\"7\" x2=\"17\" y1=\"12\" y2=\"12\"></line>",
  "scroll-text": "<path d=\"M15 12h-5\"></path><path d=\"M15 8h-5\"></path><path d=\"M19 17V5a2 2 0 0 0-2-2H4\"></path><path d=\"M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3\"></path>",
  "search": "<path d=\"m21 21-4.34-4.34\"></path><circle cx=\"11\" cy=\"11\" r=\"8\"></circle>",
  "search-x": "<circle cx=\"11\" cy=\"11\" r=\"8\"></circle><path d=\"m21 21-4.35-4.35\"></path><path d=\"m8.5 8.5 5 5\"></path><path d=\"m13.5 8.5-5 5\"></path>",
  "settings": "<path d=\"M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915\"></path><circle cx=\"12\" cy=\"12\" r=\"3\"></circle>",
  "share-2": "<circle cx=\"18\" cy=\"5\" r=\"3\"></circle><circle cx=\"6\" cy=\"12\" r=\"3\"></circle><circle cx=\"18\" cy=\"19\" r=\"3\"></circle><line x1=\"8.59\" x2=\"15.42\" y1=\"13.51\" y2=\"17.49\"></line><line x1=\"15.41\" x2=\"8.59\" y1=\"6.51\" y2=\"10.49\"></line>",
  "send": "<path d=\"m22 2-7 20-4-9-9-4Z\"></path><path d=\"M22 2 11 13\"></path>",
  "sheet": "<rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\" ry=\"2\"></rect><line x1=\"3\" x2=\"21\" y1=\"9\" y2=\"9\"></line><line x1=\"3\" x2=\"21\" y1=\"15\" y2=\"15\"></line><line x1=\"9\" x2=\"9\" y1=\"9\" y2=\"21\"></line><line x1=\"15\" x2=\"15\" y1=\"9\" y2=\"21\"></line>",
  "sparkles": "<path d=\"m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z\"></path><path d=\"m19 14 1.2 2.8L23 18l-2.8 1.2L19 22l-1.2-2.8L15 18l2.8-1.2z\"></path><path d=\"m5 2 .8 1.7L7.5 4.5l-1.7.8L5 7l-.8-1.7-1.7-.8 1.7-.8z\"></path>",
  "shield-check": "<path d=\"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z\"></path><path d=\"m9 12 2 2 4-4\"></path>",
  "shopping-bag": "<path d=\"M16 10a4 4 0 0 1-8 0\"></path><path d=\"M3.103 6.034h17.794\"></path><path d=\"M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z\"></path>",
  "shopping-cart": "<path d=\"m2.05 2.05 1.099-.028a1 1 0 0 1 1.008.815l2.69 14.347A1 1 0 0 0 7.83 18H18\"></path><path d=\"M4.563 5h16.435a1 1 0 0 1 .981 1.204l-1.026 6.226A2 2 0 0 1 18.962 14H6.25\"></path><circle cx=\"18\" cy=\"20\" r=\"2\"></circle><circle cx=\"8\" cy=\"20\" r=\"2\"></circle>",
  "smartphone": "<rect width=\"14\" height=\"20\" x=\"5\" y=\"2\" rx=\"2\" ry=\"2\"></rect><path d=\"M12 18h.01\"></path>",
  "sliders": "<line x1=\"4\" x2=\"4\" y1=\"21\" y2=\"14\"></line><line x1=\"4\" x2=\"4\" y1=\"10\" y2=\"3\"></line><line x1=\"12\" x2=\"12\" y1=\"21\" y2=\"12\"></line><line x1=\"12\" x2=\"12\" y1=\"8\" y2=\"3\"></line><line x1=\"20\" x2=\"20\" y1=\"21\" y2=\"16\"></line><line x1=\"20\" x2=\"20\" y1=\"12\" y2=\"3\"></line><line x1=\"1\" x2=\"7\" y1=\"14\" y2=\"14\"></line><line x1=\"9\" x2=\"15\" y1=\"8\" y2=\"8\"></line><line x1=\"17\" x2=\"23\" y1=\"16\" y2=\"16\"></line>",
  "sliders-horizontal": "<line x1=\"21\" x2=\"14\" y1=\"4\" y2=\"4\"></line><line x1=\"10\" x2=\"3\" y1=\"4\" y2=\"4\"></line><line x1=\"21\" x2=\"12\" y1=\"12\" y2=\"12\"></line><line x1=\"8\" x2=\"3\" y1=\"12\" y2=\"12\"></line><line x1=\"21\" x2=\"16\" y1=\"20\" y2=\"20\"></line><line x1=\"12\" x2=\"3\" y1=\"20\" y2=\"20\"></line><line x1=\"14\" x2=\"14\" y1=\"2\" y2=\"6\"></line><line x1=\"8\" x2=\"8\" y1=\"10\" y2=\"14\"></line><line x1=\"16\" x2=\"16\" y1=\"18\" y2=\"22\"></line>",
  "star": "<polygon points=\"12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2\"></polygon>",
  "save": "<path d=\"M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z\"></path><path d=\"M17 21v-8H7v8\"></path><path d=\"M7 3v5h8\"></path>",
  "store": "<path d=\"M15 21v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5\"></path><path d=\"M17.774 10.31a1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.451 0 1.12 1.12 0 0 0-1.548 0 2.5 2.5 0 0 1-3.452 0 1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.77-3.248l2.889-4.184A2 2 0 0 1 7 2h10a2 2 0 0 1 1.653.873l2.895 4.192a2.5 2.5 0 0 1-3.774 3.244\"></path><path d=\"M4 10.95V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8.05\"></path>",
  "tag": "<path d=\"M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z\"></path><circle cx=\"7.5\" cy=\"7.5\" r=\".5\" fill=\"currentColor\"></circle>",
  "tags": "<path d=\"M13.172 2a2 2 0 0 1 1.414.586l6.71 6.71a2.4 2.4 0 0 1 0 3.408l-4.592 4.592a2.4 2.4 0 0 1-3.408 0l-6.71-6.71A2 2 0 0 1 6 9.172V3a1 1 0 0 1 1-1z\"></path><path d=\"M2 7v6.172a2 2 0 0 0 .586 1.414l6.71 6.71a2.4 2.4 0 0 0 3.191.193\"></path><circle cx=\"10.5\" cy=\"6.5\" r=\".5\" fill=\"currentColor\"></circle>",
  "thermometer": "<path d=\"M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z\"></path>",
  "table": "<rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\"></rect><path d=\"M3 9h18\"></path><path d=\"M3 15h18\"></path><path d=\"M9 3v18\"></path><path d=\"M15 3v18\"></path>",
  "trash": "<path d=\"M3 6h18\"></path><path d=\"M8 6V4h8v2\"></path><path d=\"M19 6l-1 14H6L5 6\"></path>",
  "trash-2": "<path d=\"M10 11v6\"></path><path d=\"M14 11v6\"></path><path d=\"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6\"></path><path d=\"M3 6h18\"></path><path d=\"M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2\"></path>",
  "trending-down": "<path d=\"M16 17h6v-6\"></path><path d=\"m22 17-8.5-8.5-5 5L2 7\"></path>",
  "trending-up": "<path d=\"M16 7h6v6\"></path><path d=\"m22 7-8.5 8.5-5-5L2 17\"></path>",
  "trophy": "<path d=\"M10 14.66V17a1 1 0 0 1-1 1 2 2 0 0 0-2 2v2\"></path><path d=\"M14 14.66V17a1 1 0 0 0 1 1 2 2 0 0 1 2 2v2\"></path><path d=\"M17.916 10H19.5A2.5 2.5 0 0 0 22 7.5V5a1 1 0 0 0-1-1h-3\"></path><path d=\"M4 22h16\"></path><path d=\"M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z\"></path><path d=\"M6.084 10H4.5A2.5 2.5 0 0 1 2 7.5V5a1 1 0 0 1 1-1h3\"></path>",
  "truck": "<path d=\"M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2\"></path><path d=\"M15 18H9\"></path><path d=\"M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14\"></path><circle cx=\"17\" cy=\"18\" r=\"2\"></circle><circle cx=\"7\" cy=\"18\" r=\"2\"></circle>",
  "undo-2": "<path d=\"M9 14 4 9l5-5\"></path><path d=\"M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11\"></path>",
  "upload": "<path d=\"M12 3v12\"></path><path d=\"m17 8-5-5-5 5\"></path><path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\"></path>",
  "upload-cloud": "<path d=\"M12 13v8\"></path><path d=\"M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242\"></path><path d=\"m8 17 4-4 4 4\"></path>",
  "user": "<path d=\"M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2\"></path><circle cx=\"12\" cy=\"7\" r=\"4\"></circle>",
  "user-cog": "<path d=\"M10 15H6a4 4 0 0 0-4 4v2\"></path><path d=\"m14.305 16.53.923-.382\"></path><path d=\"m15.228 13.852-.923-.383\"></path><path d=\"m16.852 12.228-.383-.923\"></path><path d=\"m16.852 17.772-.383.924\"></path><path d=\"m19.148 12.228.383-.923\"></path><path d=\"m19.53 18.696-.382-.924\"></path><path d=\"m20.772 13.852.924-.383\"></path><path d=\"m20.772 16.148.924.383\"></path><circle cx=\"18\" cy=\"15\" r=\"3\"></circle><circle cx=\"9\" cy=\"7\" r=\"4\"></circle>",
  "user-plus": "<path d=\"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2\"></path><circle cx=\"9\" cy=\"7\" r=\"4\"></circle><line x1=\"19\" x2=\"19\" y1=\"8\" y2=\"14\"></line><line x1=\"22\" x2=\"16\" y1=\"11\" y2=\"11\"></line>",
  "users": "<path d=\"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2\"></path><path d=\"M16 3.128a4 4 0 0 1 0 7.744\"></path><path d=\"M22 21v-2a4 4 0 0 0-3-3.87\"></path><circle cx=\"9\" cy=\"7\" r=\"4\"></circle>",
  "wallet": "<path d=\"M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1\"></path><path d=\"M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4\"></path>",
  "x": "<path d=\"M18 6 6 18\"></path><path d=\"m6 6 12 12\"></path>"
};

  function refreshIcons(root) {
    const container = root && root.querySelectorAll ? root : document;
    const elements = container.querySelectorAll('[data-lucide]');
    elements.forEach(function(el) {
      const name = el.getAttribute('data-lucide');
      const inner = ICONS[name];
      if (!inner) return;

      if (el.tagName.toLowerCase() === 'svg') {
        el.innerHTML = inner;
        const baseClass = (el.getAttribute('class') || '').replace(/\blucide(-\S+)?\b/g, '').trim();
        el.setAttribute('class', ('lucide lucide-' + name + ' ' + baseClass).trim());
        return;
      }

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      svg.setAttribute('width', '24');
      svg.setAttribute('height', '24');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', '2');
      svg.setAttribute('stroke-linecap', 'round');
      svg.setAttribute('stroke-linejoin', 'round');
      svg.setAttribute('data-lucide', name);

      const existingClass = el.getAttribute('class') || '';
      const finalClass = ('lucide lucide-' + name + ' ' + existingClass).trim();
      svg.setAttribute('class', finalClass);

      for (let i = 0; i < el.attributes.length; i++) {
        const attr = el.attributes[i];
        if (attr.name !== 'class' && attr.name !== 'data-lucide') {
          svg.setAttribute(attr.name, attr.value);
        }
      }

      svg.innerHTML = inner;
      el.replaceWith(svg);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { refreshIcons(); });
  } else {
    refreshIcons();
  }

  window.refreshIcons = refreshIcons;
  window.lucide = window.lucide || {};
  window.lucide.createIcons = refreshIcons;
})();
