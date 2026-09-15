import { Request, Response, NextFunction } from 'express';
import { entityStore } from './database';

const validDate = (value: unknown): value is string => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

export const validateProjectContractFields = (req: Request, res: Response, next: NextFunction) => {
    const values = req.body || {};
    const fields = ['startDate', 'endDate', 'poNumber', 'poAmount'];
    if (!fields.some((field) => Object.prototype.hasOwnProperty.call(values, field))) { next(); return; }
    const current = req.params.id ? entityStore.get('projects', Number(req.params.id)) : undefined;
    const merged = { ...current, ...values };
    if (!validDate(merged.startDate) || !validDate(merged.endDate) || merged.endDate < merged.startDate ||
        typeof merged.poNumber !== 'string' || !merged.poNumber.trim() || merged.poNumber.trim().length > 50 ||
        typeof merged.poAmount !== 'number' || !Number.isFinite(merged.poAmount) || merged.poAmount < 0) {
        res.status(400).json({ message: 'Valid project dates, a PO number (up to 50 characters), and a non-negative PO amount are required.' });
        return;
    }
    if (typeof values.poNumber === 'string') values.poNumber = values.poNumber.trim();
    next();
};