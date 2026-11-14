(function () {
  // Runs before the page is drawn. The written-out page is English, light, normal size and for one
  // address. If this visitor would see something else, hide it so it is never shown by mistake.
  var skip = false;
  try {
    var html = document.documentElement;
    var here = location.pathname.replace(/\/+$/, '') || '/';
    var prefs = JSON.parse(localStorage.getItem('kavach.prefs') || '{}');
    var lang = localStorage.getItem('kavach.lang');
    skip =
      here !== html.dataset.prerendered ||
      (!!lang && lang !== 'en') ||
      (!!prefs.theme && prefs.theme !== 'light') ||
      (!!prefs.text && prefs.text !== 'normal') ||
      prefs.highContrast === true;
  } catch {
    skip = false;
  }
  if (skip) document.documentElement.setAttribute('data-skip-prerender', '');
})();
