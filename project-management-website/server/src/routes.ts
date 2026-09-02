import { Router } from 'express';
import {
    clientController,
    employeeController,
    invoiceController,
    projectController,
    quotationController,
} from './controllers';

const router = Router();

router.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
});

router.get('/employees', employeeController.getAll);
router.post('/employees', employeeController.create);
router.get('/employees/:id', employeeController.getById);
router.put('/employees/:id', employeeController.update);
router.delete('/employees/:id', employeeController.remove);

router.get('/clients', clientController.getAll);
router.post('/clients', clientController.create);
router.get('/clients/:id', clientController.getById);
router.put('/clients/:id', clientController.update);
router.delete('/clients/:id', clientController.remove);

router.get('/projects', projectController.getAll);
router.post('/projects', projectController.create);
router.get('/projects/:id', projectController.getById);
router.put('/projects/:id', projectController.update);
router.delete('/projects/:id', projectController.remove);

router.get('/quotations', quotationController.getAll);
router.post('/quotations', quotationController.create);
router.get('/quotations/:id', quotationController.getById);
router.put('/quotations/:id', quotationController.update);
router.delete('/quotations/:id', quotationController.remove);

router.get('/invoices', invoiceController.getAll);
router.post('/invoices', invoiceController.create);
router.get('/invoices/:id', invoiceController.getById);
router.put('/invoices/:id', invoiceController.update);
router.delete('/invoices/:id', invoiceController.remove);

export default router;