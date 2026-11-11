import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { entityStore } from './database';
import { dataDirectory } from './storage';

const orgChartDirectory = path.join(dataDirectory, 'client-org-charts');
fs.mkdirSync(orgChartDirectory, { recursive: true });

const orgChartPath = (projectId: number) => {
    // Find if file exists with any extension, default to png
    const existing = fs.readdirSync(orgChartDirectory).find((file) => file.startsWith(`${projectId}.`));
    return existing ? path.join(orgChartDirectory, existing) : path.join(orgChartDirectory, `${projectId}.png`);
};

const getProject = (req: Request, res: Response) => {
    const projectId = Number(req.params.id);
    const project = Number.isInteger(projectId) ? entityStore.get('projects', projectId) : undefined;
    if (!project) {
        res.status(404).json({ message: 'Project not found' });
        return null;
    }
    return { projectId, project };
};

export const uploadClientOrgChart = (req: Request, res: Response) => {
    const result = getProject(req, res);
    if (!result) return;

    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        res.status(400).json({ message: 'An image file is required' });
        return;
    }

    const encodedName = req.header('x-file-name') || 'org-chart.png';
    let originalName = 'org-chart.png';
    try {
        originalName = decodeURIComponent(encodedName);
    } catch {
        originalName = 'org-chart.png';
    }
    originalName = path.basename(originalName).replace(/[\r\n]/g, '') || 'org-chart.png';

    const extMatch = originalName.match(/\.(png|jpe?g|webp|gif|svg)$/i);
    const ext = extMatch ? extMatch[1].toLowerCase() : 'png';

    // Remove any previous file for this project
    const existingFiles = fs.readdirSync(orgChartDirectory).filter((file) => file.startsWith(`${result.projectId}.`));
    for (const file of existingFiles) {
        try {
            fs.unlinkSync(path.join(orgChartDirectory, file));
        } catch {
            // ignore
        }
    }

    const targetPath = path.join(orgChartDirectory, `${result.projectId}.${ext}`);
    fs.writeFileSync(targetPath, req.body);

    const updated = entityStore.update('projects', result.projectId, {
        clientOrgChartName: originalName,
        clientOrgChartUploadedAt: new Date().toISOString(),
    });

    res.json(updated);
};

export const viewClientOrgChart = (req: Request, res: Response) => {
    const result = getProject(req, res);
    if (!result) return;

    const files = fs.readdirSync(orgChartDirectory).filter((file) => file.startsWith(`${result.projectId}.`));
    if (files.length === 0) {
        res.status(404).json({ message: 'Client organization chart not found' });
        return;
    }

    const filePath = path.join(orgChartDirectory, files[0]);
    if (!fs.existsSync(filePath)) {
        res.status(404).json({ message: 'Client organization chart file not found' });
        return;
    }

    const ext = path.extname(filePath).toLowerCase().replace('.', '');
    const mimeTypes: Record<string, string> = {
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        webp: 'image/webp',
        gif: 'image/gif',
        svg: 'image/svg+xml',
    };

    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(filePath);
};

export const removeOrgChartFile = (projectId: number) => {
    try {
        const files = fs.readdirSync(orgChartDirectory).filter((file) => file.startsWith(`${projectId}.`));
        for (const file of files) {
            fs.unlinkSync(path.join(orgChartDirectory, file));
        }
    } catch {
        // ignore
    }
};

export const removeClientOrgChart = (req: Request, res: Response) => {
    const result = getProject(req, res);
    if (!result) return;

    removeOrgChartFile(result.projectId);

    const updated = entityStore.update('projects', result.projectId, {
        clientOrgChartName: null,
        clientOrgChartUploadedAt: null,
    });

    res.json(updated);
};
