const router = require('express').Router();
const { requireRole } = require('../middleware/auth');
const { verifyCsrfToken } = require('../middleware/csrf');
const validate = require('../middleware/validate');
const schemas = require('../validators/schemas');
const controller = require('../controllers/departmentController');

router.use(requireRole('department'));
router.get('/dashboard', controller.dashboard);
router.get('/complaints', controller.list);
router.get('/complaints/:id', controller.show);
router.post('/complaints/:id/assignment', verifyCsrfToken, validate(schemas.employeeAssignment), controller.assignEmployee);
router.post('/complaints/:id/assignment/remove', verifyCsrfToken, controller.removeEmployeeAssignment);
router.get('/employees', controller.employees);
router.post('/employees', verifyCsrfToken, validate(schemas.employee), controller.createEmployee);
router.post('/employees/membership', verifyCsrfToken, validate(schemas.employeeMembership), controller.addExistingEmployee);
router.post('/employees/:id/membership/remove', verifyCsrfToken, controller.removeEmployeeMembership);
module.exports = router;
