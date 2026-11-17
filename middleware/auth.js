function requireAuth(req, res, next) {
  if (req.isAuthenticated()) return next();
  req.flash('error', 'Please sign in to continue.');
  res.redirect('/login');
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.isAuthenticated()) {
      req.flash('error', 'Please sign in to continue.');
      return res.redirect('/login');
    }
    if (!roles.includes(req.user.role)) return res.status(403).render('public/error', {
      title: 'Access denied', status: 403, message: 'Your account cannot access this page.'
    });
    next();
  };
}

module.exports = { requireAuth, requireRole };
