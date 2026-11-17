module.exports = schema => (req, res, next) => {
  const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true, convert: true });
  if (error) {
    req.flash('error', error.details.map(detail => detail.message.replace(/"/g, '')).join(' '));
    let fallback = '/';
    try {
      const referer = req.get('referer');
      if (referer) {
        const url = new URL(referer);
        if (url.host === req.get('host')) fallback = `${url.pathname}${url.search}`;
      }
    } catch { /* use the homepage */ }
    return res.redirect(fallback);
  }
  req.body = value;
  next();
};
