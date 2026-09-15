import express, { Router } from 'express';
import {
    clientController,
    employeeController,
    invoiceController,
    projectController,
    quotationController,
    reportController,
} from './controllers';
import { removeC2CContract, removeContractFile, uploadC2CContract, viewC2CContract } from './c2cContracts';
import { removeClientOrgChart, removeOrgChartFile, uploadClientOrgChart, viewClientOrgChart } from './clientOrgCharts';
import { deleteProjectSow, removeProjectSow, uploadProjectSow, viewProjectSow } from './sowContracts';
import { entityStore } from './database';
import { validateProjectContractFields } from './projectContractFields';

const router = Router();

router.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
});

router.get('/employees', employeeController.getAll);
router.post('/employees', employeeController.create);
router.put('/employees/:id/c2c-contract', express.raw({ type: 'application/pdf', limit: '20mb' }), uploadC2CContract);
router.get('/employees/:id/c2c-contract', viewC2CContract);
router.delete('/employees/:id/c2c-contract', removeC2CContract);
router.get('/employees/:id', employeeController.getById);
router.put('/employees/:id', employeeController.update);
router.delete('/employees/:id', (req, res) => {
    removeContractFile(Number(req.params.id));
    employeeController.remove(req, res);
});

router.get('/clients', clientController.getAll);
router.post('/clients', clientController.create);
router.get('/clients/:id', clientController.getById);
router.put('/clients/:id', clientController.update);
router.delete('/clients/:id', clientController.remove);

router.get('/projects', projectController.getAll);
router.post('/projects', validateProjectContractFields, projectController.create);
router.put('/projects/:id/sow', express.raw({ type: '*/*', limit: '20mb' }), uploadProjectSow);
router.get('/projects/:id/sow/:fileId', viewProjectSow);
router.get('/projects/:id/sow', viewProjectSow);
router.delete('/projects/:id/sow/:fileId', deleteProjectSow);
router.put('/projects/:id/client-org-chart', express.raw({ type: () => true, limit: '25mb' }), uploadClientOrgChart);
router.get('/projects/:id/client-org-chart', viewClientOrgChart);
router.delete('/projects/:id/client-org-chart', removeClientOrgChart);
router.get('/projects/:id', projectController.getById);
router.put('/projects/:id', validateProjectContractFields, projectController.update);
router.delete('/projects/:id', (req, res) => {
    removeOrgChartFile(Number(req.params.id));
    removeProjectSow(Number(req.params.id));
    projectController.remove(req, res);
});

router.get('/quotations', quotationController.getAll);
router.post('/quotations', quotationController.create);
router.get('/quotations/:id', quotationController.getById);
router.put('/quotations/:id', quotationController.update);
router.delete('/quotations/:id', quotationController.remove);

router.get('/reports', reportController.getAll);
router.post('/reports', reportController.create);
router.get('/reports/:id', reportController.getById);
router.put('/reports/:id', reportController.update);
router.delete('/reports/:id', reportController.remove);

router.get('/invoices', invoiceController.getAll);
router.post('/invoices', invoiceController.create);
router.get('/invoices/:id', invoiceController.getById);
router.put('/invoices/:id', invoiceController.update);
router.delete('/invoices/:id', invoiceController.remove);

export default router;