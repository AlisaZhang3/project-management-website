import { Request, Response } from 'express';
import { entityStore } from './database';

interface CrudController {
    getAll: (req: Request, res: Response) => void;
    create: (req: Request, res: Response) => void;
    getById: (req: Request, res: Response) => void;
    update: (req: Request, res: Response) => void;
    remove: (req: Request, res: Response) => void;
}

const createCrudController = (resource: 'employees' | 'projects' | 'clients' | 'quotations' | 'invoices'): CrudController => {
    return {
        getAll: (_req, res) => {
            res.json(entityStore.list(resource));
        },
        create: (req, res) => {
            res.status(201).json(entityStore.create(resource, req.body));
        },
        getById: (req, res) => {
            const entity = entityStore.get(resource, Number(req.params.id));

            if (!entity) {
                res.status(404).json({ message: 'Resource not found' });
                return;
            }

            res.json(entity);
        },
        update: (req, res) => {
            const entity = entityStore.update(resource, Number(req.params.id), req.body);
            if (!entity) {
                res.status(404).json({ message: 'Resource not found' });
                return;
            }
            res.json(entity);
        },
        remove: (req, res) => {
            if (!entityStore.remove(resource, Number(req.params.id))) {
                res.status(404).json({ message: 'Resource not found' });
                return;
            }
            res.status(204).send();
        },
    };
};

export const employeeController = createCrudController('employees');
export const clientController = createCrudController('clients');
export const projectController = createCrudController('projects');
export const quotationController = createCrudController('quotations');
export const invoiceController = createCrudController('invoices');