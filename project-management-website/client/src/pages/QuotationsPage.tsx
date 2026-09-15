import React, { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { Project } from './ProjectsPage';
import { calculateQuotationRow, newQuotationRow, QuotationMode, QuotationRow } from '../utils/quotation';

interface Quotation {
    id: number;
    projectId: number | string;
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
    const projectLabel = (project: Project) => `${project.projectCode} - ${project.name}`;
    const quotationProjectName = (quotation: Quotation) => {
        const project = projects.find((item) => item.id === Number(quotation.projectId));
        return project ? projectLabel(project) : String(quotation.projectId);
    };

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
        const quotationProject = quotation && projects.find((project) => project.id === Number(quotation.projectId));
        setProjectId(quotationProject ? projectLabel(quotationProject) : quotation ? String(quotation.projectId) : '');
        setName(quotation?.name || '');
        setMode(quotation?.mode || 'english');
        setRows(quotation ? quotation.rows.map((row) => ({ ...newQuotationRow(), ...row })) : [newQuotationRow()]);
        setDirty(false);
        setError('');
        setSuccess('');
    };

    const startNewQuotation = () => openQuotation('');

    const deleteQuotation = async (quotation: Quotation) => {
        if (!window.confirm(`Delete quotation “${quotation.name || `#${quotation.id}`}”? This action cannot be undone.`)) return;
        setError('');
        setSuccess('');
        try {
            const response = await fetch(`/api/quotations/${quotation.id}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Failed to delete quotation.');
            setQuotations((current) => current.filter((item) => item.id !== quotation.id));
            if (quotationId === quotation.id) startNewQuotation();
            setSuccess('Quotation deleted.');
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Failed to delete quotation.');
        }
    };

    const exportQuotation = (quotation: Quotation) => {
        const quotationCurrency = quotation.mode === 'india' ? 'INR' : 'USD';
        const quotationRows = Array.isArray(quotation.rows) ? quotation.rows : [];
        const calculatedRows = quotationRows.map((row) => calculateQuotationRow(row, quotation.mode));
        const exportTotals = calculatedRows.reduce((sum, row, index) => ({
            headcount: sum.headcount + quotationRows[index].headcount,
            monthlyBill: sum.monthlyBill + row.monthlyBill,
            monthlyNR: sum.monthlyNR + row.monthlyNR,
            monthlyCost: sum.monthlyCost + row.monthlyCost,
        }), { headcount: 0, monthlyBill: 0, monthlyNR: 0, monthlyCost: 0 });
        const exportGP = exportTotals.monthlyNR ? (exportTotals.monthlyNR - exportTotals.monthlyCost) / exportTotals.monthlyNR * 100 : 0;
        const worksheetRows = quotationRows.map((row, index) => ({
            'Position Title': row.position,
            Headcount: row.headcount,
            [`Hourly Rate (${quotationCurrency})`]: row.hourlyRate,
            'Monthly Working Hours': row.monthlyWorkingHours,
            [`Monthly Bill / Person (${quotationCurrency})`]: row.monthlyBill,
            [`Monthly NR / Total (${quotationCurrency})`]: calculatedRows[index].monthlyNR,
            [`Monthly Cost / Person (${quotationCurrency})`]: row.costPerPerson,
            [`Monthly Cost / Total (${quotationCurrency})`]: calculatedRows[index].monthlyCost,
            'GP2%': `${calculatedRows[index].gp2.toFixed(1)}%`,
            Comment: row.comment,
            'Row Number': index + 1,
        }));
        worksheetRows.push({
            'Position Title': 'TOTAL',
            Headcount: exportTotals.headcount,
            [`Hourly Rate (${quotationCurrency})`]: 0,
            'Monthly Working Hours': 0,
            [`Monthly Bill / Person (${quotationCurrency})`]: exportTotals.monthlyBill,
            [`Monthly NR / Total (${quotationCurrency})`]: exportTotals.monthlyNR,
            [`Monthly Cost / Person (${quotationCurrency})`]: 0,
            [`Monthly Cost / Total (${quotationCurrency})`]: exportTotals.monthlyCost,
            'GP2%': `${exportGP.toFixed(1)}%`,
            Comment: 'Overall quotation total',
            'Row Number': 0,
        });
        const worksheet = XLSX.utils.json_to_sheet(worksheetRows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Quotation');
        const summaryWorksheet = XLSX.utils.json_to_sheet([
            { Item: 'Quotation Name', Value: quotation.name || `Quotation #${quotation.id}` },
            { Item: 'Project', Value: quotationProjectName(quotation) },
            { Item: 'Quotation Type', Value: quotation.mode === 'india' ? 'India (INR)' : 'English (USD)' },
            { Item: 'Total Headcount', Value: exportTotals.headcount },
            { Item: `Total Monthly Bill (${quotationCurrency})`, Value: exportTotals.monthlyBill },
            { Item: `Total Monthly NR (${quotationCurrency})`, Value: exportTotals.monthlyNR },
            { Item: `Total Monthly Cost (${quotationCurrency})`, Value: exportTotals.monthlyCost },
            { Item: 'Overall GP2%', Value: `${exportGP.toFixed(1)}%` },
            { Item: `Overall Gross Profit (${quotationCurrency})`, Value: exportTotals.monthlyNR - exportTotals.monthlyCost },
        ]);
        XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Total Summary');
        const fileName = (quotation.name || `quotation-${quotation.id}`).replace(/[^a-z0-9-_]+/gi, '-').replace(/^-|-$/g, '') || `quotation-${quotation.id}`;
        XLSX.writeFile(workbook, `${fileName}.xlsx`);
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
        const selectedProject = projects.find((project) => projectLabel(project) === projectId || project.id === Number(projectId));
        const projectValue = selectedProject ? selectedProject.id : projectId.trim();
        if (!name.trim() || !projectValue || !rows.length || rows.some((row) =>
            !row.position.trim() || !Number.isInteger(row.headcount) || row.headcount < 1 || row.monthlyWorkingHours <= 0 ||
            [row.headcount, row.hourlyRate, row.monthlyWorkingHours, row.monthlyBill, row.costPerPerson].some((value) => !Number.isFinite(value) || value < 0)
        )) {
            setError('Enter a quotation name, choose or enter a project, position titles, positive whole headcounts and hours, and valid non-negative amounts.');
            return;
        }
        setSaving(true);
        try {
            const response = await fetch(quotationId ? `/api/quotations/${quotationId}` : '/api/quotations', {
                method: quotationId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name.trim(), projectId: projectValue, mode, currency, rows, amount: totals.monthlyNR }),
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
                <nav className="page-nav"><Link className="back-link" to="/projects">Projects</Link><Link className="back-link" to="/">Home</Link></nav>
            </header>
            <section className="employees-heading profit-heading"><div><p className="eyebrow">PROJECT QUOTATIONS</p><h1>Quotations</h1></div></section>
            <section className="quotation-list-panel">
                <div className="quotation-list-heading">
                    <div><h2>Saved Quotations</h2><p>{quotations.length} quotation{quotations.length === 1 ? '' : 's'} created</p></div>
                    <button className="primary-button" type="button" onClick={startNewQuotation}>＋ Create Quotation</button>
                </div>
                {loading ? <div className="empty-state">Loading quotations...</div> : quotations.length === 0 ? (
                    <div className="empty-state quotation-list-empty"><h3>No quotations yet</h3><p>Create your first quotation below.</p></div>
                ) : (
                    <div className="quotation-list-table-wrap"><table className="quotation-list-table">
                        <thead><tr><th>Name</th><th>Project</th><th>Type</th><th>Positions</th><th>Actions</th></tr></thead>
                        <tbody>{quotations.map((quotation) => <tr key={quotation.id}>
                            <td>{quotation.name || `Quotation #${quotation.id}`}</td>
                            <td>{quotationProjectName(quotation)}</td>
                            <td>{quotation.mode === 'india' ? 'India (INR)' : 'English (USD)'}</td>
                            <td>{Array.isArray(quotation.rows) ? quotation.rows.length : 0}</td>
                            <td><div className="row-actions">
                                <button className="edit-button" type="button" onClick={() => openQuotation(String(quotation.id))}>Edit</button>
                                <button className="secondary-button" type="button" onClick={() => exportQuotation(quotation)}>Export Excel</button>
                                <button className="delete-button" type="button" onClick={() => deleteQuotation(quotation)}>Delete</button>
                            </div></td>
                        </tr>)}</tbody>
                    </table></div>
                )}
            </section>
            <form className="profit-content quotation-content" onSubmit={saveQuotation}>
                {error && <div className="notice error" role="alert">{error}</div>}
                {success && <div className="notice success" role="status">{success}</div>}
                {loading ? <div className="empty-state">Loading quotations...</div> : (
                    <fieldset disabled={saving} className="quotation-editor">
                        <div className="quotation-toolbar">
                            <label>Saved Quotation<select value={quotationId || ''} onChange={(event) => openQuotation(event.target.value)}><option value="">New Quotation</option>{quotations.map((quotation) => <option key={quotation.id} value={quotation.id}>{quotation.name || `Quotation #${quotation.id}`}</option>)}</select></label>
                            <label>Quotation Name<input required maxLength={100} value={name} onChange={(event) => { setName(event.target.value); markDirty(); }} /></label>
                            <label>Project<input required list="quotation-projects" value={projectId} onChange={(event) => { setProjectId(event.target.value); markDirty(); }} placeholder="Choose or enter a project" /><datalist id="quotation-projects">{projects.map((project) => <option key={project.id} value={projectLabel(project)} />)}</datalist></label>
                            <label>Quotation Type<select value={mode} onChange={(event) => { setMode(event.target.value as QuotationMode); markDirty(); }}><option value="english">English (USD)</option><option value="india">India (INR)</option></select></label>
                        </div>
                        {!projects.length && <div className="notice error">No saved projects found. You can enter a custom project above, or <Link to="/projects">create a project</Link>.</div>}
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
                            <button className="secondary-button" type="button" onClick={startNewQuotation}>New Quotation</button>
                            <button className="secondary-button" type="button" disabled={!quotationId} onClick={() => {
                                const quotation = quotations.find((item) => item.id === quotationId);
                                if (quotation) exportQuotation(quotation);
                            }}>Export Excel</button>
                            <button className="primary-button" type="submit" disabled={!rows.length}>{saving ? 'Saving...' : 'Save Quotation'}</button>
                        </div>
                    </fieldset>
                )}
            </form>
        </main>
    );
};

export default QuotationsPage;