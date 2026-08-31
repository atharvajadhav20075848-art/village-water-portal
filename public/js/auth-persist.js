// ── Persistent Auth Layer ──────────────────────────────────────────
// Automatically sends x-user-email header with every fetch request
// so Vercel serverless functions can re-hydrate the session.
// This script MUST be loaded BEFORE any other scripts that call fetch().
(function() {
  const _originalFetch = window.fetch;
  window.fetch = function(url, opts) {
    opts = opts || {};
    const savedEmail = localStorage.getItem('gram_user_email');
    if (savedEmail) {
      if (!opts.headers) {
        opts.headers = {};
      }
      if (opts.headers instanceof Headers) {
        if (!opts.headers.has('x-user-email')) {
          opts.headers.set('x-user-email', encodeURIComponent(savedEmail));
        }
      } else if (typeof opts.headers === 'object') {
        if (!opts.headers['x-user-email']) {
          opts.headers['x-user-email'] = encodeURIComponent(savedEmail);
        }
      }
    }
    return _originalFetch.call(window, url, opts);
  };
})();

// Helper: call this on logout from any page
function gramLogout() {
  if (!confirm("Are you sure you want to logout?")) return;
  localStorage.removeItem('gram_user_email');
  localStorage.removeItem('gram_user_role');
  fetch('/api/auth/logout', { method: 'POST' })
    .catch(function(){})
    .finally(function() {
      window.location.href = '/login';
    });
}
