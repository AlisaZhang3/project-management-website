import { Request, Response } from 'express';
import { entityStore } from './database';

interface CrudController {
    getAll: (req: Request, res: Response) => void;
    create: (req: Request, res: Response) => void;
    getById: (req: Request, res: Response) => void;
    update: (req: Request, res: Response) => void;
    remove: (req: Request, res: Response) => void;
}

const createCrudController = (resource: 'employees' | 'projects' | 'clients' | 'quotations' | 'invoices' | 'reports'): CrudController => {
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
const reportMetadata = (report: Record<string, unknown>) => {
    const { contentBase64, ...metadata } = report;
    return metadata;
};

export const reportController: CrudController = {
    ...createCrudController('reports'),
    getAll: (_req, res) => {
        res.json(entityStore.list('reports').map(reportMetadata));
    },
    create: (req, res) => {
        const { projectId, fileName, contentBase64, tag } = req.body || {};
        const validProject = typeof projectId === 'number'
            ? Number.isInteger(projectId) && Boolean(entityStore.get('projects', projectId))
            : typeof projectId === 'string' && projectId.trim().length > 0 && projectId.length <= 200 &&
                [...entityStore.list('quotations'), ...entityStore.list('reports')].some((item) => item.projectId === projectId);
        if (!validProject || typeof fileName !== 'string' || fileName.length > 255 ||
            !/\.(html?|xlsx?)$/i.test(fileName) || /[\\/\x00-\x1f]/.test(fileName) ||
            typeof tag !== 'string' || !tag.trim() || tag.trim().length > 50 ||
            typeof contentBase64 !== 'string' || !contentBase64 ||
            contentBase64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(contentBase64)) {
            res.status(400).json({ message: 'A valid project, HTML/Excel file and tag are required.' });
            return;
        }
        const size = Buffer.byteLength(contentBase64, 'base64');
        if (size > 10 * 1024 * 1024) {
            res.status(413).json({ message: 'Reports must be 10 MB or smaller.' });
            return;
        }
        const mimeType = /\.html?$/i.test(fileName) ? 'text/html' : /\.xlsx$/i.test(fileName)
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/vnd.ms-excel';
        const report = entityStore.create('reports', {
            projectId, fileName, contentBase64, mimeType, size, tag: tag.trim(), createdAt: new Date().toISOString(),
        });
        res.status(201).json(reportMetadata(report));
    },
    update: (req, res) => {
        const tag = req.body?.tag;
        if (typeof tag !== 'string' || !tag.trim() || tag.trim().length > 50) {
            res.status(400).json({ message: 'Enter a tag between 1 and 50 characters.' });
            return;
        }
        const report = entityStore.update('reports', Number(req.params.id), { tag: tag.trim() });
        if (!report) {
            res.status(404).json({ message: 'Report not found.' });
            return;
        }
        res.json(reportMetadata(report));
    },
};