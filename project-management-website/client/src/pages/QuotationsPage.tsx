import React, { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Project } from './ProjectsPage';
import { calculateQuotationRow, newQuotationRow, QuotationMode, QuotationRow } from '../utils/quotation';

interface Quotation {
    id: number;
    projectId: number;
    name: string;
    mode: QuotationMode;
    rows: QuotationRow[];
}

const money = (value: number) => value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const QuotationsPage: React.FC = () => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [quotations, setQuotations] = useState<Quotation[]>([]);
    const [quotationId, setQuotationId] = useState<number | null>(null);
    const [projectId, setProjectId] = useState('');
    const [name, setName] = useState('');
    const [mode, setMode] = useState<QuotationMode>('english');
    const [rows, setRows] = useState<QuotationRow[]>([newQuotationRow()]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const currency = mode === 'india' ? 'INR' : 'USD';

    useEffect(() => {
        let cancelled = false;
        Promise.all([fetch('/api/projects'), fetch('/api/quotations')])
            .then(async ([projectResponse, quotationResponse]) => {
                if (!projectResponse.ok || !quotationResponse.ok) throw new Error('Failed to load quotations.');
                const projectData: Project[] = await projectResponse.json();
                const quotationData: Quotation[] = await quotationResponse.json();
                if (!cancelled) {
                    setProjects(projectData);
                    setQuotations(quotationData);
                }
            })
            .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Failed to load quotations.'); })
            .then(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        const warnUnsaved = (event: BeforeUnloadEvent) => {
            if (dirty) { event.preventDefault(); event.returnValue = ''; }
        };
        window.addEventListener('beforeunload', warnUnsaved);
        return () => window.removeEventListener('beforeunload', warnUnsaved);
    }, [dirty]);

    const markDirty = () => { setDirty(true); setSuccess(''); };
    const openQuotation = (value: string) => {
        if (dirty && !window.confirm('Discard unsaved quotation changes?')) return;
        const quotation = quotations.find((item) => String(item.id) === value);
        if (quotation && (!Array.isArray(quotation.rows) || (quotation.mode !== 'english' && quotation.mode !== 'india'))) {
            setError('This legacy quotation cannot be edited in the position-based editor. Create a new quotation; the original record will be preserved.');
            return;
        }
        setQuotationId(quotation?.id || null);
        setProjectId(quotation ? String(quotation.projectId) : '');
        setName(quotation?.name || '');
        setMode(quotation?.mode || 'english');
        setRows(quotation ? quotation.rows.map((row) => ({ ...newQuotationRow(), ...row })) : [newQuotationRow()]);
        setDirty(false);
        setError('');
        setSuccess('');
    };

    const updateRow = (index: number, field: keyof QuotationRow, value: string | number) => {
        markDirty();
        setRows((current) => current.map((row, rowIndex) => {
            if (rowIndex !== index) return row;
            const updated = { ...row, [field]: value };
            if (field === 'hourlyRate' || field === 'monthlyWorkingHours') updated.monthlyBill = updated.hourlyRate * updated.monthlyWorkingHours;
            return updated;
        }));
    };

    const calculated = rows.map((row) => calculateQuotationRow(row, mode));
    const totals = calculated.reduce((sum, row) => ({
        monthlyBill: sum.monthlyBill + row.monthlyBill,
        monthlyNR: sum.monthlyNR + row.monthlyNR,
        monthlyCost: sum.monthlyCost + row.monthlyCost,
    }), { monthlyBill: 0, monthlyNR: 0, monthlyCost: 0 });
    const totalGP = totals.monthlyNR ? (totals.monthlyNR - totals.monthlyCost) / totals.monthlyNR * 100 : 0;

    const saveQuotation = async (event: FormEvent) => {
        event.preventDefault();
        setError('');
        setSuccess('');
        if (!name.trim() || !projects.some((project) => project.id === Number(projectId)) || !rows.length || rows.some((row) =>
            !row.position.trim() || !Number.isInteger(row.headcount) || row.headcount < 1 || row.monthlyWorkingHours <= 0 ||
            [row.headcount, row.hourlyRate, row.monthlyWorkingHours, row.monthlyBill, row.costPerPerson].some((value) => !Number.isFinite(value) || value < 0)
        )) {
            setError('Enter a quotation name, project, position titles, positive whole headcounts and hours, and valid non-negative amounts.');
            return;
        }
        setSaving(true);
        try {
            const response = await fetch(quotationId ? `/api/quotations/${quotationId}` : '/api/quotations', {
                method: quotationId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name.trim(), projectId: Number(projectId), mode, currency, rows, amount: totals.monthlyNR }),
            });
            if (!response.ok) throw new Error('Failed to save quotation. Your changes are still available to retry.');
            const saved: Quotation = await response.json();
            setQuotations((current) => quotationId ? current.map((item) => item.id === saved.id ? saved : item) : [...current, saved]);
            setQuotationId(saved.id);
            setDirty(false);
            setSuccess('Quotation saved.');
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Failed to save quotation.');
        } finally { setSaving(false); }
    };

    return (
        <main className="employees-page quotation-page">
            <header>
                <Link className="brand brand-link" to="/"><span>PM</span> ProjectFlow</Link>
                <nav className="page-nav"><Link className="back-link" to="/projects">Projects</Link><Link className="back-link" to="/">Home</Link></nav>
            </header>
            <section className="employees-heading profit-heading"><div><p className="eyebrow">PROJECT QUOTATIONS</p><h1>Quotations</h1></div></section>
            <form className="profit-content quotation-content" onSubmit={saveQuotation}>
                {error && <div className="notice error" role="alert">{error}</div>}
                {success && <div className="notice success" role="status">{success}</div>}
                {loading ? <div className="empty-state">Loading quotations...</div> : (
                    <fieldset disabled={saving} className="quotation-editor">
                        <div className="quotation-toolbar">
                            <label>Saved Quotation<select value={quotationId || ''} onChange={(event) => openQuotation(event.target.value)}><option value="">New Quotation</option>{quotations.map((quotation) => <option key={quotation.id} value={quotation.id}>{quotation.name || `Quotation #${quotation.id}`}</option>)}</select></label>
                            <label>Quotation Name<input required maxLength={100} value={name} onChange={(event) => { setName(event.target.value); markDirty(); }} /></label>
                            <label>Project<select required value={projectId} onChange={(event) => { setProjectId(event.target.value); markDirty(); }}><option value="">Select Project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.projectCode} - {project.name}</option>)}</select></label>
                            <label>Quotation Type<select value={mode} onChange={(event) => { setMode(event.target.value as QuotationMode); markDirty(); }}><option value="english">English (USD)</option><option value="india">India (INR)</option></select></label>
                        </div>
                        {!projects.length && <div className="notice error"><Link to="/projects">Create a project</Link> before saving a quotation.</div>}
                        <datalist id="quotation-hours"><option value="168" /><option value="176" /><option value="200" /></datalist>
                        <div className="table-wrap"><table className="profit-table quotation-table">
                            <thead><tr><th>Position Title</th><th>Headcount</th><th>Hourly Rate ({currency})</th><th>Monthly Working Hours</th><th>Monthly Bill / Person ({currency})</th><th>Monthly NR / Total ({currency})</th><th>Monthly Cost / Person ({currency})</th><th>Monthly Cost / Total ({currency})</th><th>GP2%</th><th>Comment</th><th>Action</th></tr></thead>
                            <tbody>{rows.map((row, index) => <tr key={index}>
                                <td><input aria-label={`Position ${index + 1}`} className="name-input" required value={row.position} onChange={(event) => updateRow(index, 'position', event.target.value)} /></td>
                                <td><input aria-label={`Headcount ${index + 1}`} type="number" required min="1" step="1" value={row.headcount} onChange={(event) => updateRow(index, 'headcount', Number(event.target.value))} /></td>
                                <td><input aria-label={`Hourly rate ${index + 1}`} type="number" required min="0" step="0.01" value={row.hourlyRate} onChange={(event) => updateRow(index, 'hourlyRate', Number(event.target.value))} /></td>
                                <td><input aria-label={`Monthly hours ${index + 1}`} list="quotation-hours" type="number" required min="1" step="1" value={row.monthlyWorkingHours} onChange={(event) => updateRow(index, 'monthlyWorkingHours', Number(event.target.value))} /></td>
                                <td><input aria-label={`Monthly bill ${index + 1}`} type="number" required min="0" step="any" value={row.monthlyBill} onChange={(event) => updateRow(index, 'monthlyBill', Number(event.target.value))} /></td>
                                <td>{money(calculated[index].monthlyNR)}</td>
                                <td><input aria-label={`Monthly cost ${index + 1}`} type="number" required min="0" step="0.01" value={row.costPerPerson} onChange={(event) => updateRow(index, 'costPerPerson', Number(event.target.value))} /></td>
                                <td>{money(calculated[index].monthlyCost)}</td><td>{calculated[index].gp2.toFixed(1)}%</td>
                                <td><input aria-label={`Comment ${index + 1}`} className="comment-input" value={row.comment} onChange={(event) => updateRow(index, 'comment', event.target.value)} /></td>
                                <td><button className="delete-button" type="button" onClick={() => { setRows((current) => current.filter((_, rowIndex) => rowIndex !== index)); markDirty(); }}>Remove</button></td>
                            </tr>)}</tbody>
                            <tfoot><tr><td>Total ({currency})</td><td>{rows.reduce((sum, row) => sum + row.headcount, 0)}</td><td /><td /><td>{money(totals.monthlyBill)}</td><td>{money(totals.monthlyNR)}</td><td /><td>{money(totals.monthlyCost)}</td><td>{totalGP.toFixed(1)}%</td><td /><td /></tr></tfoot>
                        </table></div>
                        <div className="quotation-actions">
                            <button className="secondary-button" type="button" onClick={() => { setRows((current) => [...current, newQuotationRow()]); markDirty(); }}>Add Position</button>
                            <button className="secondary-button" type="button" onClick={() => openQuotation('')}>New Quotation</button>
                            <button className="primary-button" type="submit" disabled={!projects.length || !rows.length}>{saving ? 'Saving...' : 'Save Quotation'}</button>
                        </div>
                    </fieldset>
                )}
            </form>
        </main>
    );
};

export default QuotationsPage;