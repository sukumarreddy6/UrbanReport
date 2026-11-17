const router = require('express').Router();
const controller = require('../controllers/citizenController');
const { requireRole } = require('../middleware/auth');
const { verifyCsrfToken } = require('../middleware/csrf');
const validate = require('../middleware/validate');
const { upload, verifyImageContents } = require('../middleware/upload');
const schemas = require('../validators/schemas');
const rateLimit = require('express-rate-limit');

router.use(requireRole('citizen'));
const complaintLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false, message: 'Too many reports submitted. Try again later.' });
router.get('/dashboard', controller.dashboard);
router.get('/complaints', controller.list);
router.get('/complaints/new', controller.newForm);
router.post('/complaints', complaintLimiter, upload.array('images', 5), verifyImageContents, verifyCsrfToken, validate(schemas.complaint), controller.create);
router.get('/complaints/:id/edit', controller.editForm);
router.put('/complaints/:id', upload.array('images', 5), verifyImageContents, verifyCsrfToken, validate(schemas.complaint), controller.update);
router.delete('/complaints/:id', verifyCsrfToken, controller.remove);
router.get('/complaints/:id', controller.show);
router.post('/complaints/:id/messages', verifyCsrfToken, validate(schemas.message), controller.message);
router.post('/complaints/:id/reopen', verifyCsrfToken, validate(schemas.reopen), controller.reopen);
router.post('/complaints/:id/confirm-resolution', verifyCsrfToken, validate(schemas.resolutionOtp), controller.confirmResolution);
const resolutionCodeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 3, standardHeaders: 'draft-7', legacyHeaders: false, message: 'Too many code requests. Please wait 15 minutes before requesting another.' });
router.post('/complaints/:id/resolution-code', resolutionCodeLimiter, verifyCsrfToken, controller.resendResolutionCode);

module.exports = router;
