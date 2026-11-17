const router = require('express').Router();
const { verifyCsrfToken } = require('../middleware/csrf');
const { supportedLanguages } = require('../config/i18n');

router.post('/language', verifyCsrfToken, (req, res, next) => {
  req.session.language = supportedLanguages.includes(req.body.language) ? req.body.language : 'en';
  const returnTo = String(req.body.returnTo || '');
  const destination = returnTo.startsWith('/') && !returnTo.startsWith('//') && !returnTo.includes('\\') ? returnTo : '/';
  req.session.save(error => error ? next(error) : res.redirect(destination));
});

module.exports = router;
