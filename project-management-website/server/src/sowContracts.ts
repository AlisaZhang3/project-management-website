import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { entityStore } from './database';
import { dataDirectory } from './storage';

const sowDirectory = path.join(dataDirectory, 'project-sows');
fs.mkdirSync(sowDirectory, { recursive: true });

interface SowFile { id: string; name: string; size: number; mimeType: string; uploadedAt: string; }
const projectDirectory = (projectId: number) => path.join(sowDirectory, String(projectId));
const legacySowPath = (projectId: number) => path.join(sowDirectory, `${projectId}.pdf`);
const sowPath = (projectId: number, file: SowFile) => path.join(projectDirectory(projectId), `${file.id}${path.extname(file.name)}`);
const getFiles = (project: Record<string, unknown>, projectId: number): SowFile[] => {
    const files = Array.isArray(project.sowFiles) ? project.sowFiles as SowFile[] : [];
    if (!files.length && typeof project.sowName === 'string' && fs.existsSync(legacySowPath(projectId))) {
        return [{ id: 'legacy', name: project.sowName, size: fs.statSync(legacySowPath(projectId)).size, mimeType: 'application/pdf', uploadedAt: String(project.sowUploadedAt || '') }];
    }
    return files;
};
const fileById = (project: Record<string, unknown>, projectId: number, fileId: string) => getFiles(project, projectId).find((file) => file.id === fileId);

const getProject = (req: Request, res: Response) => {
    const projectId = Number(req.params.id);
    const project = Number.isInteger(projectId) ? entityStore.get('projects', projectId) : undefined;
    if (!project) {
        res.status(404).json({ message: 'Project not found' });
        return null;
    }
    return { projectId, project };
};

export const uploadProjectSow = (req: Request, res: Response) => {
    const result = getProject(req, res);
    if (!result) return;
    if (!Buffer.isBuffer(req.body) || req.body.length === 0 || req.body.length > 20 * 1024 * 1024) {
        res.status(400).json({ message: 'A non-empty SOW file up to 20 MB is required' });
        return;
    }
    let originalName = 'SOW-file';
    try { originalName = decodeURIComponent(req.header('x-file-name') || 'SOW-file'); } catch { originalName = 'SOW-file'; }
    originalName = path.basename(originalName).replace(/[\r\n]/g, '') || 'SOW-file';
    const file: SowFile = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: originalName, size: req.body.length, mimeType: req.header('content-type') || 'application/octet-stream', uploadedAt: new Date().toISOString() };
    fs.mkdirSync(projectDirectory(result.projectId), { recursive: true });
    fs.writeFileSync(sowPath(result.projectId, file), req.body);
    const files = [...getFiles(result.project, result.projectId).filter((item) => item.id !== 'legacy'), file];
    const project = entityStore.update('projects', result.projectId, {
        sowFiles: files,
        sowName: null,
        sowUploadedAt: null,
    });
    res.json(project);
};

export const viewProjectSow = (req: Request, res: Response) => {
    const result = getProject(req, res);
    if (!result) return;
    const file = fileById(result.project, result.projectId, String(req.params.fileId || 'legacy'));
    const filePath = file?.id === 'legacy' ? legacySowPath(result.projectId) : file ? sowPath(result.projectId, file) : '';
    if (!file || !filePath || !fs.existsSync(filePath)) {
        res.status(404).json({ message: 'Project SOW file not found' });
        return;
    }
    const name = file.name;
    const asciiName = name.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    const disposition = req.query.view === '1' ? 'inline' : 'attachment';
    res.setHeader('Content-Disposition', `${disposition}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(name)}`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.sendFile(filePath);
};

export const deleteProjectSow = (req: Request, res: Response) => {
    const result = getProject(req, res);
    if (!result) return;
    const file = fileById(result.project, result.projectId, String(req.params.fileId));
    if (!file) { res.status(404).json({ message: 'Project SOW file not found' }); return; }
    const filePath = file.id === 'legacy' ? legacySowPath(result.projectId) : sowPath(result.projectId, file);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.json(entityStore.update('projects', result.projectId, { sowFiles: getFiles(result.project, result.projectId).filter((item) => item.id !== file.id), sowName: null, sowUploadedAt: null }));
};

export const removeProjectSow = (projectId: number) => {
    const directory = projectDirectory(projectId);
    if (fs.existsSync(directory)) fs.rmSync(directory, { recursive: true, force: true });
    const filePath = legacySowPath(projectId);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
};