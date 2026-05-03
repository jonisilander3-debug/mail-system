function pushFlash(req, type, message) {
  req.session.flash = req.session.flash || [];
  req.session.flash.push({ type, message });
}

function installFlash(req, res, next) {
  res.locals.flashMessages = req.session.flash || [];
  delete req.session.flash;
  res.locals.currentUser = req.session.user || null;
  next();
}

module.exports = { pushFlash, installFlash };
