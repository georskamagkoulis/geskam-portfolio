/* Portfolio: progressive enhancement only. Without this file the site works the same.

   Visitor statistics (GoatCounter, no cookies). Only runs when the page has
   <meta name="goatcounter" content="...">, which build.mjs adds once analytics.goatcounterCode
   is set in data/site.json. Each count is a tiny image request, allowed by the page's CSP. */
(function () {
  'use strict';
  var counter = document.querySelector('meta[name="goatcounter"]');
  if (!counter || location.protocol !== 'https:') return;
  var endpoint = counter.getAttribute('content');

  var count = function (path, title, isEvent) {
    new Image().src = endpoint +
      '?p=' + encodeURIComponent(path) +
      '&t=' + encodeURIComponent(title) +
      (isEvent ? '&e=true' : '&r=' + encodeURIComponent(document.referrer)) +
      '&rnd=' + Math.random().toString(36).slice(2);
  };

  count(location.pathname, document.title, false);   // one page view

  // Clicks that matter: someone asking for an offer or opening a project.
  document.addEventListener('click', function (e) {
    var link = e.target.closest && e.target.closest('a[href]');
    if (!link) return;
    var href = link.getAttribute('href');
    if (href.indexOf('mailto:') === 0) count('Κλικ: Email', 'Email', true);
    else if (href.indexOf('afras-chop-shop') !== -1) count('Κλικ: Afra\'s site', 'Afra\'s', true);
  });
})();
