import React, { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { Link, Prompt } from 'react-router-dom';
import { Download, Pencil, Save, Upload, X } from 'lucide-react';
import { Project } from './ProjectsPage';

const ContractsPage: React.FC = () => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploadingId, setUploadingId] = useState<number | null>(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [editingId, setEditingId] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [form, setForm] = useState({ startDate: '', endDate: '', poNumber: '', poAmount: '' });
    const inputRefs = useRef<Record<number, HTMLInputElement | null>>({});

    useEffect(() => {
        const warnUnsaved = (event: BeforeUnloadEvent) => {
            if (dirty) { event.preventDefault(); event.returnValue = ''; }
        };
        window.addEventListener('beforeunload', warnUnsaved);
        return () => window.removeEventListener('beforeunload', warnUnsaved);
    }, [dirty]);

    const editDetails = (project: Project) => {
        if (dirty && !window.confirm('Discard unsaved contract changes?')) return;
        setEditingId(project.id);
        setForm({ startDate: project.startDate || '', endDate: project.endDate || '', poNumber: project.poNumber || '', poAmount: project.poAmount == null ? '' : String(project.poAmount) });
        setDirty(false); setError(''); setSuccess('');
    };

    const saveDetails = async (event: FormEvent) => {
        event.preventDefault();
        const amount = Number(form.poAmount);
        if (!form.startDate || !form.endDate || form.endDate < form.startDate || !form.poNumber.trim() || !form.poAmount.trim() || !Number.isFinite(amount) || amount < 0) {
            setError('Enter valid project dates, a PO number and a non-negative PO amount.');
            return;
        }
        setSaving(true); setError(''); setSuccess('');
        try {
            const response = await fetch(`/api/projects/${editingId}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...form, poNumber: form.poNumber.trim(), poAmount: amount }),
            });
            if (!response.ok) { const detail = await response.json().catch(() => ({})); throw new Error(detail.message || 'Failed to save contract details.'); }
            const updated: Project = await response.json();
            setProjects((current) => current.map((project) => project.id === updated.id ? updated : project));
            setEditingId(null); setDirty(false); setSuccess('Contract details saved.');
        } catch (reason) { setError(reason instanceof Error ? reason.message : 'Failed to save contract details.'); }
        finally { setSaving(false); }
    };

    useEffect(() => {
        fetch('/api/projects')
            .then((response) => { if (!response.ok) throw new Error('Failed to load projects'); return response.json(); })
            .then(setProjects)
            .catch((reason) => setError(reason instanceof Error ? reason.message : 'Failed to load projects'))
            .then(() => setLoading(false));
    }, []);

    const importSow = async (project: Project, event: ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files || []);
        event.target.value = '';
        if (!files.length) return;
        const invalid = files.find((file) => !file.name.trim() || file.size <= 0 || file.size > 20 * 1024 * 1024);
        if (invalid) {
            setError('Each SOW file must be non-empty and no larger than 20 MB.');
            return;
        }
        setUploadingId(project.id); setError(''); setSuccess('');
        try {
            let updated: Project = project;
            for (const file of files) {
                const response = await fetch(`/api/projects/${project.id}/sow`, {
                    method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name) }, body: file,
                });
                if (!response.ok) { const detail = await response.json().catch(() => ({})); throw new Error(detail.message || 'Failed to upload SOW'); }
                updated = await response.json();
            }
            setProjects((current) => current.map((item) => item.id === updated.id ? updated : item));
            setSuccess(`${files.length} SOW file${files.length === 1 ? '' : 's'} uploaded for ${project.name}.`);
        } catch (reason) { setError(reason instanceof Error ? reason.message : 'Failed to upload SOW'); }
        finally { setUploadingId(null); }
    };

    return (
        <main className="employees-page contracts-page">
            <Prompt when={dirty} message="Discard unsaved contract changes?" />
            <header><nav className="page-nav"><Link className="back-link" to="/projects">Projects</Link><Link className="back-link" to="/">Home</Link></nav></header>
            <section className="employees-heading"><div><p className="eyebrow">PROJECT CONTRACTS</p><h1>Contracts</h1></div></section>
            {error && <div className="notice error contracts-notice" role="alert">{error}</div>}
            {success && <div className="notice success contracts-notice" role="status">{success}</div>}
            {loading ? <div className="empty-state">Loading projects...</div> : !projects.length ? <div className="empty-state"><h3>No projects yet</h3><p>Create a project before adding contract details.</p><Link className="primary-button" to="/projects">Create Project</Link></div> : (
                <section className="contracts-grid">
                    {projects.map((project) => <article className="contract-card" key={project.id}>
                        <div className="contract-card-heading"><span className="project-code">{project.projectCode}</span><span className="business-type-tag">{project.businessType || 'Others'}</span></div>
                        <h2>{project.name}</h2><p className="contract-pm">Project Manager: <strong>{project.pm}</strong></p>
                        {editingId === project.id ? <form className="contract-edit-form" onSubmit={saveDetails}>
                            <fieldset disabled={saving || uploadingId !== null} onChange={() => setDirty(true)}>
                                <label>Project Start Date<input required type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} /></label>
                                <label>Project End Date<input required type="date" min={form.startDate} value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} /></label>
                                <label>PO Number<input required maxLength={50} value={form.poNumber} onChange={(event) => setForm({ ...form, poNumber: event.target.value })} /></label>
                                <label>PO Amount<input required type="number" min="0" step="0.01" value={form.poAmount} onChange={(event) => setForm({ ...form, poAmount: event.target.value })} /></label>
                                <div className="contract-actions"><button className="secondary-button" type="button" onClick={() => { if (dirty && !window.confirm('Discard unsaved contract changes?')) return; setEditingId(null); setDirty(false); }}><X size={16} /> Cancel</button><button className="primary-button" type="submit"><Save size={16} /> {saving ? 'Saving...' : 'Save Details'}</button></div>
                            </fieldset>
                        </form> : <>
                            <dl className="contract-details"><div><dt>Project Dates</dt><dd>{project.startDate || '-'} to {project.endDate || '-'}</dd></div><div><dt>PO Number</dt><dd>{project.poNumber || '-'}</dd></div><div><dt>PO Amount</dt><dd>{project.poAmount != null ? project.poAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</dd></div></dl>
                            <div className="contract-actions"><button className="edit-button" disabled={saving || uploadingId !== null} type="button" onClick={() => editDetails(project)}><Pencil size={16} /> Edit Details</button></div>
                        </>}
                        <div className="sow-row"><div><span className="sow-label">SOW Documents</span>{project.sowFiles?.length || project.sowName ? <div className="sow-files">{(project.sowFiles || (project.sowName ? [{ id: 'legacy', name: project.sowName, size: 0, mimeType: 'application/pdf', uploadedAt: project.sowUploadedAt || '' }] : [])).map((file) => <div className="sow-file" key={file.id}><a className="sow-file-name" href={`/api/projects/${project.id}/sow/${file.id}?view=1`} target="_blank" rel="noreferrer" title={`View ${file.name}`}>{file.name}</a><span>{file.size ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : ''}</span><a className="secondary-button" href={`/api/projects/${project.id}/sow/${file.id}`} download><Download size={16} /> Download</a><button className="delete-button" type="button" disabled={uploadingId !== null || saving} onClick={async () => { if (!window.confirm(`Delete SOW "${file.name}"?`)) return; const response = await fetch(`/api/projects/${project.id}/sow/${file.id}`, { method: 'DELETE' }); if (!response.ok) { setError('Failed to delete SOW.'); return; } const updated: Project = await response.json(); setProjects((current) => current.map((item) => item.id === updated.id ? updated : item)); setSuccess('SOW deleted.'); }} >Delete</button></div>)}</div> : <strong>No SOW uploaded</strong>}</div><div className="contract-actions"><button className="secondary-button" type="button" disabled={uploadingId !== null || saving} onClick={() => inputRefs.current[project.id]?.click()}><Upload size={16} /> {uploadingId === project.id ? 'Uploading...' : 'Import SOW Files'}</button><input ref={(element) => { inputRefs.current[project.id] = element; }} hidden type="file" multiple accept="*/*" onChange={(event) => importSow(project, event)} /></div></div>
                    </article>)}
                </section>
            )}
        </main>
    );
};

export default ContractsPage;