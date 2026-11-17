const router = require('express').Router();
const controller = require('../controllers/employeeController');
const { requireRole } = require('../middleware/auth');
const { verifyCsrfToken } = require('../middleware/csrf');
const validate = require('../middleware/validate');
const schemas = require('../validators/schemas');
const { upload, verifyImageContents } = require('../middleware/upload');

router.use(requireRole('employee'));
router.get('/dashboard', controller.dashboard);
router.get('/complaints', controller.list);
router.get('/complaints/:id', controller.show);
router.patch('/complaints/:id/status', upload.array('proofImages', 5), verifyImageContents, verifyCsrfToken, validate(schemas.employeeStatus), controller.updateStatus);
router.post('/complaints/:id/withdraw', verifyCsrfToken, controller.withdraw);
router.post('/complaints/:id/resolution/withdraw', verifyCsrfToken, controller.withdrawResolution);
module.exports = router;
