import React, { ChangeEvent, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Eye, Trash2, Upload, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Project } from './ProjectsPage';

interface Report {
    id: number;
    projectId: number | string;
    fileName: string;
    mimeType: string;
    contentBase64?: string;
    tag: string;
    createdAt?: string;
}

interface ReportProps {
    embedded?: boolean;
    quotationProjects?: { projectId: number | string }[];
}

const REPORT_TAGS = ['Weekly', 'Monthly', 'Quarterly', 'Annual', 'Other'];
const projectKey = (value: number | string) => `${typeof value}:${value}`;
const reportBytes = (content: string) => Uint8Array.from(atob(content), (character) => character.charCodeAt(0));

const Reports: React.FC<ReportProps> = ({ embedded = false, quotationProjects }) => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [customProjects, setCustomProjects] = useState<{ projectId: number | string }[]>([]);
    const [reports, setReports] = useState<Report[]>([]);
    const [selectedProject, setSelectedProject] = useState('');
    const [tag, setTag] = useState('Weekly');
    const [tagFilter, setTagFilter] = useState('');
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [preview, setPreview] = useState<{ name: string; html?: string; workbook?: XLSX.WorkBook } | null>(null);
    const [sheetName, setSheetName] = useState('');
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const previewRef = useRef<HTMLDialogElement | null>(null);

    const projectOptions = new Map<string, { id: number | string; label: string }>();
    projects.forEach((project) => projectOptions.set(projectKey(project.id), { id: project.id, label: `${project.projectCode} - ${project.name}` }));
    [...(quotationProjects || customProjects), ...reports].forEach(({ projectId }) => {
        if (projectId !== null && projectId !== undefined && !projectOptions.has(projectKey(projectId))) {
            projectOptions.set(projectKey(projectId), { id: projectId, label: String(projectId) });
        }
    });
    const selected = projectOptions.get(selectedProject);
    const projectReports = reports.filter((report) => !selectedProject || projectKey(report.projectId) === selectedProject);
    const visibleReports = projectReports.filter((report) => !tagFilter || report.tag === tagFilter);
    const tags = Array.from(new Set([...REPORT_TAGS, ...reports.map((report) => report.tag)]));
    const previewRows = preview?.workbook && sheetName ? XLSX.utils.sheet_to_json<string[]>(preview.workbook.Sheets[sheetName], { header: 1, raw: false, defval: '' }) : [];

    useEffect(() => {
        let cancelled = false;
        Promise.all(['/api/projects', '/api/reports', '/api/quotations'].map(async (url) => {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Failed to load project reports.');
            return response.json();
        })).then(([projectData, reportData, quotationData]) => {
            if (!cancelled) { setProjects(projectData); setReports(reportData); setCustomProjects(quotationData); }
        }).catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Failed to load reports.'); })
            .then(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        if (preview) previewRef.current?.showModal();
    }, [preview]);

    const readResponse = async (response: Response) => {
        if (!response.ok) {
            const detail = await response.json().catch(() => ({}));
            throw new Error(detail.message || 'Report request failed. Please retry.');
        }
        return response.json();
    };

    const importReport = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        if (!selected || !tag.trim()) { setError('Select a project and enter a tag.'); return; }
        if (!/\.(html?|xlsx?)$/i.test(file.name)) { setError('Only HTML and Excel files are supported.'); return; }
        if (!file.size || file.size > 10 * 1024 * 1024) { setError('Select a non-empty report up to 10 MB.'); return; }
        setBusy(true); setError(''); setSuccess('');
        try {
            const contentBase64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
                reader.onerror = () => reject(new Error('Could not read the selected file.'));
                reader.readAsDataURL(file);
            });
            const saved: Report = await readResponse(await fetch('/api/reports', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId: selected.id, fileName: file.name, contentBase64, tag: tag.trim() }),
            }));
            setReports((current) => [...current, saved]);
            setTagFilter('');
            setSuccess(`Imported ${file.name}.`);
        } catch (reason) { setError(reason instanceof Error ? reason.message : 'Failed to import report.'); }
        finally { setBusy(false); }
    };

    const updateTag = async (report: Report, value: string) => {
        if (value.trim() === report.tag) return;
        setBusy(true); setError(''); setSuccess('');
        try {
            const updated: Report = await readResponse(await fetch(`/api/reports/${report.id}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tag: value.trim() }),
            }));
            setReports((current) => current.map((item) => item.id === report.id ? updated : item));
            setSuccess('Report tag updated.');
        } catch (reason) { setError(reason instanceof Error ? reason.message : 'Failed to update tag.'); }
        finally { setBusy(false); }
    };

    const deleteReport = async (report: Report) => {
        if (!window.confirm(`Delete report "${report.fileName}"?`)) return;
        setBusy(true); setError(''); setSuccess('');
        try {
            const response = await fetch(`/api/reports/${report.id}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Failed to delete report.');
            setReports((current) => current.filter((item) => item.id !== report.id));
            setSuccess('Report deleted.');
        } catch (reason) { setError(reason instanceof Error ? reason.message : 'Failed to delete report.'); }
        finally { setBusy(false); }
    };

    const openReport = async (report: Report, download = false) => {
        setBusy(true); setError('');
        try {
            const saved: Report = await readResponse(await fetch(`/api/reports/${report.id}`));
            const bytes = reportBytes(saved.contentBase64 || '');
            if (download) {
                const url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
                const link = document.createElement('a');
                link.href = url; link.download = report.fileName; link.click();
                window.setTimeout(() => URL.revokeObjectURL(url), 1000);
            } else if (/\.html?$/i.test(report.fileName)) {
                const document = new DOMParser().parseFromString(new TextDecoder().decode(bytes), 'text/html');
                document.querySelectorAll('script, iframe, object, embed, base, meta[http-equiv]').forEach((element) => element.remove());
                const policy = document.createElement('meta');
                policy.httpEquiv = 'Content-Security-Policy';
                policy.content = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; form-action 'none'; base-uri 'none'";
                document.head.prepend(policy);
                setPreview({ name: report.fileName, html: document.documentElement.outerHTML });
            } else {
                const workbook = XLSX.read(bytes, { type: 'array', sheetRows: 201, cellHTML: false });
                setSheetName(workbook.SheetNames[0] || '');
                setPreview({ name: report.fileName, workbook });
            }
        } catch (reason) { setError(reason instanceof Error ? reason.message : 'Failed to open report.'); }
        finally { setBusy(false); }
    };

    const content = <>
        {error && <div className="notice error" role="alert">{error}</div>}
        {success && <div className="notice success" role="status">{success}</div>}
        <div className="reports-layout">
            <aside className="project-filter report-project-filter">
                <h3>Projects</h3>
                <button type="button" disabled={busy} className={!selectedProject ? 'active' : ''} onClick={() => { setSelectedProject(''); setTagFilter(''); }}><span>All Projects</span><b>{reports.length}</b></button>
                {Array.from(projectOptions.entries()).map(([key, project]) => <button type="button" disabled={busy} key={key} className={selectedProject === key ? 'active' : ''} onClick={() => { setSelectedProject(key); setTagFilter(''); }}><span>{project.label}</span><b>{reports.filter((report) => projectKey(report.projectId) === key).length}</b></button>)}
            </aside>
            <section className="reports-content">
                <div className="reports-toolbar">
                    <div><h2>{selected?.label || 'Project Reports'}</h2><p>{visibleReports.length} reports</p></div>
                    <div className="report-import-actions">
                        <label>Import Tag<input list="report-tags" maxLength={50} value={tag} disabled={busy} onChange={(event) => setTag(event.target.value)} /></label>
                        <button className="primary-button" type="button" disabled={!selected || busy || loading || !tag.trim()} onClick={() => fileInputRef.current?.click()}><Upload size={16} /> {busy ? 'Processing...' : 'Import Report'}</button>
                        <input ref={fileInputRef} hidden type="file" accept=".html,.htm,.xls,.xlsx" onChange={importReport} />
                    </div>
                </div>
                <datalist id="report-tags">{tags.map((item) => <option key={item} value={item} />)}</datalist>
                <label className="report-filter">Tag<select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}><option value="">All Tags</option>{tags.map((item) => <option key={item}>{item}</option>)}</select></label>
                {loading ? <div className="empty-state">Loading reports...</div> : !visibleReports.length ? <div className="empty-state"><h3>No reports</h3></div> : <div className="report-cards">
                    {visibleReports.map((report) => <article className="report-card" key={report.id}>
                        <div className="report-card-top"><span className="report-file-type">{/\.html?$/i.test(report.fileName) ? 'HTML' : 'EXCEL'}</span><span className="report-tag">{report.tag}</span></div>
                        <h3>{report.fileName}</h3><p>{projectOptions.get(projectKey(report.projectId))?.label} / {report.createdAt ? new Date(report.createdAt).toLocaleDateString() : '-'}</p>
                        <label className="report-tag-edit">Tag<input key={report.tag} list="report-tags" aria-label={`Tag for ${report.fileName}`} defaultValue={report.tag} maxLength={50} disabled={busy} onBlur={(event) => { const value = event.target.value; event.target.value = report.tag; void updateTag(report, value); }} /></label>
                        <div className="report-card-actions">
                            <button className="edit-button" title="View report" type="button" disabled={busy} onClick={() => openReport(report)}><Eye size={16} /> View</button>
                            <button className="secondary-button" title="Download original report" type="button" disabled={busy} onClick={() => openReport(report, true)}><Download size={16} /> Download</button>
                            <button className="delete-button" title="Delete report" type="button" disabled={busy} onClick={() => deleteReport(report)}><Trash2 size={16} /> Delete</button>
                        </div>
                    </article>)}
                </div>}
            </section>
        </div>
        {preview && <dialog ref={previewRef} className="report-preview" onClose={() => setPreview(null)}>
            <div className="reports-toolbar"><h2>{preview.name}</h2><button className="secondary-button" type="button" title="Close preview" aria-label="Close preview" onClick={() => previewRef.current?.close()}><X size={18} /></button></div>
            {preview.html !== undefined ? <iframe title="HTML report preview" sandbox="" referrerPolicy="no-referrer" srcDoc={preview.html} /> : <>
                <label className="report-filter">Worksheet<select value={sheetName} onChange={(event) => setSheetName(event.target.value)}>{preview.workbook?.SheetNames.map((item) => <option key={item}>{item}</option>)}</select><span>{previewRows.length} preview rows (max 201)</span></label>
                <div className="report-sheet"><table><tbody>{previewRows.map((row, rowIndex) => <tr key={rowIndex}>{row.slice(0, 100).map((cell, columnIndex) => <td key={columnIndex}>{String(cell)}</td>)}</tr>)}</tbody></table></div>
            </>}
        </dialog>}
    </>;

    return embedded ? <section className="reports-section" aria-label="Project reports">{content}</section> : <main className="employees-page reports-page">
        <header><nav className="page-nav"><Link className="back-link" to="/quotations">Quotations</Link><Link className="back-link" to="/">Home</Link></nav></header>
        <section className="employees-heading"><h1>Reports</h1></section>{content}
    </main>;
};

export default Reports;