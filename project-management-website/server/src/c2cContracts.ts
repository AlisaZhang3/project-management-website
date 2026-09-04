import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { entityStore } from './database';

const contractDirectory = path.resolve(__dirname, '../data/c2c-contracts');
fs.mkdirSync(contractDirectory, { recursive: true });

const contractPath = (employeeId: number) => path.join(contractDirectory, `${employeeId}.pdf`);

const getEmployee = (req: Request, res: Response) => {
    const employeeId = Number(req.params.id);
    const employee = Number.isInteger(employeeId) ? entityStore.get('employees', employeeId) : undefined;
    if (!employee) {
        res.status(404).json({ message: 'Employee not found' });
        return null;
    }
    return { employeeId, employee };
};

export const uploadC2CContract = (req: Request, res: Response) => {
    const result = getEmployee(req, res);
    if (!result) return;

    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        res.status(400).json({ message: 'A PDF contract is required' });
        return;
    }
    if (req.body.subarray(0, 5).toString('ascii') !== '%PDF-') {
        res.status(400).json({ message: 'Only valid PDF contracts are accepted' });
        return;
    }

    const encodedName = req.header('x-file-name') || 'C2C-contract.pdf';
    let originalName = 'C2C-contract.pdf';
    try {
        originalName = decodeURIComponent(encodedName);
    } catch {
        originalName = 'C2C-contract.pdf';
    }
    originalName = path.basename(originalName).replace(/[\r\n]/g, '') || 'C2C-contract.pdf';
    if (!originalName.toLowerCase().endsWith('.pdf')) originalName += '.pdf';

    fs.writeFileSync(contractPath(result.employeeId), req.body);
    const employee = entityStore.update('employees', result.employeeId, {
        hasC2C: true,
        c2cContractName: originalName,
        c2cContractUploadedAt: new Date().toISOString(),
    });
    res.json(employee);
};

export const viewC2CContract = (req: Request, res: Response) => {
    const result = getEmployee(req, res);
    if (!result) return;

    const filePath = contractPath(result.employeeId);
    if (!result.employee.hasC2C || !fs.existsSync(filePath)) {
        res.status(404).json({ message: 'C2C contract not found' });
        return;
    }

    const name = typeof result.employee.c2cContractName === 'string'
        ? result.employee.c2cContractName
        : 'C2C-contract.pdf';
    const asciiName = name.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(name)}`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.sendFile(filePath);
};

export const removeC2CContract = (req: Request, res: Response) => {
    const result = getEmployee(req, res);
    if (!result) return;

    const filePath = contractPath(result.employeeId);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    const employee = entityStore.update('employees', result.employeeId, {
        hasC2C: false,
        c2cContractName: null,
        c2cContractUploadedAt: null,
    });
    res.json(employee);
};

export const removeContractFile = (employeeId: number) => {
    const filePath = contractPath(employeeId);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
};
