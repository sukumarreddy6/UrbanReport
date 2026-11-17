const passport = require('passport');
const User = require('../models/User');

passport.use(User.createStrategy());
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    if (!/^[a-f\d]{24}$/i.test(String(id))) return done(null, false);
    const user = await User.findById(id);
    done(null, user?.isActive ? user : false);
  } catch (error) { done(error); }
});

module.exports = passport;
