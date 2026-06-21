/**
 * Event Gadget zero-config loader.
 *
 * Usage (one line in any HTML page):
 *   <script src="http://your-server:3001/sg.js" data-app-id="my-app"></script>
 *
 * Optional data attributes:
 *   data-app-id      — required, your application identifier
 *   data-endpoint    — collect endpoint, defaults to same origin /collect
 *   data-user-id     — optional user identifier
 *   data-debug       — "true" to enable debug logging
 *
 * This script:
 * 1. Reads config from its own <script> tag data attributes
 * 2. Loads tracker.umd.js from the same server
 * 3. Calls initTracker() with the config
 */
(function () {
  var currentScript = document.currentScript;
  if (!currentScript) {
    console.error('[Event Gadget] Cannot find current script tag. Are you using a browser that supports document.currentScript?');
    return;
  }

  var appId = currentScript.getAttribute('data-app-id');
  if (!appId) {
    console.error('[Event Gadget] data-app-id is required. Add data-app-id="your-app-id" to the script tag.');
    return;
  }

  // Use the resolved .src (a full URL) instead of getAttribute('src') (which
  // returns the literal author-written attribute — typically a relative path
  // like "/sg.js"). The resolved URL gives us a stable absolute base so the
  // derived tracker.js / collect endpoint URLs don't accidentally inherit
  // the current document's path when this script is loaded into a sub-page.
  var scriptSrc = currentScript.src || currentScript.getAttribute('src') || '';
  var baseUrl = scriptSrc.replace(/sg\.js(\?.*)?$/, '');
  var endpoint = currentScript.getAttribute('data-endpoint') || (baseUrl + 'collect');
  var userId = currentScript.getAttribute('data-user-id') || undefined;
  var debug = currentScript.getAttribute('data-debug') === 'true';

  var trackerUrl = baseUrl + 'tracker.js';

  var s = document.createElement('script');
  s.src = trackerUrl;
  s.onload = function () {
    var init = (typeof EventGadget !== 'undefined' && typeof EventGadget.initTracker === 'function')
      ? EventGadget.initTracker
      : (typeof initTracker === 'function' ? initTracker : null);
    if (init) {
      var instance = init({
        endpoint: endpoint,
        appId: appId,
        userId: userId,
        debug: debug,
      });
      // Expose for manual API: window.eventGadget.setView('采购订单')
      window.eventGadget = instance;
      if (debug) console.log('[Event Gadget] Tracker initialized. appId=' + appId + ', endpoint=' + endpoint);
    } else {
      console.error('[Event Gadget] initTracker not found after loading tracker.js');
    }
  };
  s.onerror = function () {
    console.error('[Event Gadget] Failed to load tracker from ' + trackerUrl);
  };
  document.head.appendChild(s);
})();
