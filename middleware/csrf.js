const crypto = require('node:crypto');

function attachCsrfToken(req, res, next) {
  if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  res.locals.csrfToken = req.session.csrfToken;
  next();
}

function verifyCsrfToken(req, res, next) {
  const sent = req.body?._csrf;
  const saved = req.session?.csrfToken;
  const sentBuffer = sent ? Buffer.from(String(sent)) : Buffer.alloc(0);
  const savedBuffer = saved ? Buffer.from(String(saved)) : Buffer.alloc(0);
  if (!sent || !saved || sentBuffer.length !== savedBuffer.length || !crypto.timingSafeEqual(sentBuffer, savedBuffer)) {
    req.flash('error', 'That form expired. Please try again.');
    const referrer = req.get('referer');
    let destination = '/';
    try {
      if (referrer) {
        const url = new URL(referrer);
        if (url.host === req.get('host')) destination = `${url.pathname}${url.search}`;
      }
    } catch { /* use the homepage */ }
    return res.redirect(destination);
  }
  next();
}

module.exports = { attachCsrfToken, verifyCsrfToken };
