const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const flash = require('connect-flash');
const methodOverride = require('method-override');
const helmet = require('helmet');
const passport = require('./config/passport');
const authRoutes = require('./routes/auth');
const citizenRoutes = require('./routes/citizen');
const adminRoutes = require('./routes/admin');
const employeeRoutes = require('./routes/employee');
const departmentRoutes = require('./routes/department');
const languageRoutes = require('./routes/language');
const { attachCsrfToken } = require('./middleware/csrf');
const Notification = require('./models/Notification');
const { translate, supportedLanguages } = require('./config/i18n');
const { icon } = require('./config/icons');
const app = express();

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) throw new Error('SESSION_SECRET must be set to at least 32 characters.');
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: { directives: {
  defaultSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdn.jsdelivr.net'],
  fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdn.jsdelivr.net'], imgSrc: ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com', 'https://*.tile.openstreetmap.fr'],
  scriptSrc: ["'self'", 'https://cdn.jsdelivr.net'], connectSrc: ["'self'", 'https://photon.komoot.io'], frameSrc: ["'self'", 'https://www.openstreetmap.org']
} } }));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: false }));
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/vendor/chart.js', express.static(path.join(__dirname, 'node_modules/chart.js/dist')));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI, collectionName: 'sessions' }),
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 1000 * 60 * 60 * 24 * 7 }
}));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());
app.use(attachCsrfToken);
app.use(async (req, res, next) => {
  res.locals.currentUser = req.user;
  res.locals.currentPath = req.originalUrl;
  res.locals.language = supportedLanguages.includes(req.session.language) ? req.session.language : 'en';
  const statusLabels = { Submitted: 'Under Review', Approved: 'In Progress', Assigned: 'In Progress', Reopened: 'Under Review' };
  res.locals.t = value => translate(res.locals.language, statusLabels[value] || value);
  res.locals.lucide = icon;
  res.locals.successMessages = req.flash('success');
  res.locals.errorMessages = req.flash('error');
  try { res.locals.unreadCount = req.user ? await Notification.countDocuments({ userId: req.user._id, readAt: null }) : 0; }
  catch (error) { return next(error); }
  next();
});

app.get('/', (_req, res) => res.render('public/home', { title: 'UrbanReport' }));
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/', authRoutes);
app.use('/citizen', citizenRoutes);
app.use('/admin', adminRoutes);
app.use('/employee', employeeRoutes);
app.use('/department', departmentRoutes);
app.use('/', languageRoutes);

app.use((_req, res) => res.status(404).render('public/404', {
  title: 'Page not found', message: 'The page you requested could not be found.'
}));
app.use((err, _req, res, _next) => {
  console.error(err);
  const status = err.status || (err.name === 'MulterError' ? 400 : 500);
  if (_req.accepts('json')) {
    const message = process.env.NODE_ENV === 'production' && status === 500
      ? 'Please try again later.'
      : err.message;
    return res.status(status).json({ message });
  }
  if (status === 404) return res.status(404).render('public/404', {
    title: 'Page not found', message: err.message || 'The page you requested could not be found.'
  });
  res.status(status).render('public/error', {
    title: status === 500 ? 'Something went wrong' : 'Request could not be completed', status,
    message: process.env.NODE_ENV === 'production' && status === 500 ? 'Please try again later.' : err.message
  });
});

module.exports = app;
