import React, { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Employee } from './EmployeesPage';
import { Project } from './ProjectsPage';

interface ProfitRow extends Employee {
    hourlyRate: number;
    monthlyWorkingHours: number;
    monthlyBill: number;
    monthlyNR: number;
    monthlyCost: number;
    gp2: number;
    comment: string;
}

type NumericField = 'hourlyRate' | 'monthlyWorkingHours' | 'monthlyBill' | 'monthlyNR' | 'gp2';

const number = (value: unknown) => Number(value) || 0;
const calculateNR = (bill: number) => bill * (1 - 0.02 - 0.05) * (1 - 0.00471);
const calculateGP = (nr: number, cost: number) => nr ? ((nr - cost) / nr) * 100 : 0;
const employeeMonthlySalaryUSD = (employee: Employee) => /india|inida/i.test(employee.region)
    ? number(employee.salary) * 100000 / 12 / 86.5
    : number(employee.salary) / 6.8;
const employeeMonthlyCost = (employee: Employee) => {
    const reuseRatio = employee.isShared ? Math.min(100, Math.max(0, number(employee.sharedRatio))) / 100 : 0;
    return employeeMonthlySalaryUSD(employee) * (1 - reuseRatio);
};
const costDetails = (employee: Employee) => {
    const salaryFormula = /india|inida/i.test(employee.region)
        ? `${employee.salary || 0} LPA × 100,000 ÷ 12 ÷ 86.5`
        : `¥${employee.salary || 0} ÷ 6.8`;
    return employee.isShared
        ? `${salaryFormula} × (1 - ${employee.sharedRatio || 0}%)`
        : salaryFormula;
};
const money = (value: number) => value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ProjectProfitPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const projectId = Number(id);
    const [project, setProject] = useState<Project | null>(null);
    const [rows, setRows] = useState<ProfitRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        Promise.all([fetch(`/api/projects/${projectId}`), fetch('/api/employees')])
            .then(async ([projectResponse, employeeResponse]) => {
                if (!projectResponse.ok || !employeeResponse.ok) throw new Error('Failed to load profitability data');
                const projectData: Project = await projectResponse.json();
                const employees: Employee[] = await employeeResponse.json();
                setProject(projectData);
                setRows(employees.filter((employee) => employee.projectId === projectId).map((employee) => {
                    const hourlyRate = number(employee.hourlyRate);
                    const monthlyWorkingHours = number(employee.monthlyWorkingHours);
                    const monthlyBill = employee.monthlyBill === undefined ? hourlyRate * monthlyWorkingHours : number(employee.monthlyBill);
                    const monthlyNR = employee.monthlyNR === undefined ? calculateNR(monthlyBill) : number(employee.monthlyNR);
                    const monthlyCost = employeeMonthlyCost(employee);
                    return {
                        ...employee,
                        hourlyRate,
                        monthlyWorkingHours,
                        monthlyBill,
                        monthlyNR,
                        monthlyCost,
                        gp2: calculateGP(monthlyNR, monthlyCost),
                        comment: employee.comment || '',
                    } as ProfitRow;
                }));
            })
            .catch((error) => setMessage(error instanceof Error ? error.message : 'Failed to load profitability data'))
            .then(() => setLoading(false));
    }, [projectId]);

    const updateNumber = (employeeId: number, field: NumericField, value: number) => {
        setRows((current) => current.map((row) => {
            if (row.id !== employeeId) return row;
            const updated = { ...row, [field]: value };
            if (field === 'hourlyRate' || field === 'monthlyWorkingHours') {
                updated.monthlyBill = updated.hourlyRate * updated.monthlyWorkingHours;
                updated.monthlyNR = calculateNR(updated.monthlyBill);
                updated.gp2 = calculateGP(updated.monthlyNR, updated.monthlyCost);
            } else if (field === 'monthlyBill') {
                updated.monthlyNR = calculateNR(value);
                updated.gp2 = calculateGP(updated.monthlyNR, updated.monthlyCost);
            } else if (field === 'monthlyNR') {
                updated.gp2 = calculateGP(updated.monthlyNR, updated.monthlyCost);
            }
            return updated;
        }));
    };

    const updateText = (employeeId: number, field: 'name' | 'comment', event: ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value;
        setRows((current) => current.map((row) => row.id === employeeId ? { ...row, [field]: value } : row));
    };

    const saveAll = async () => {
        setSaving(true);
        setMessage('');
        try {
            const responses = await Promise.all(rows.map((row) => fetch(`/api/employees/${row.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(row),
                })));
            if (responses.some((response) => !response.ok)) throw new Error('Failed to save all changes');
            const savedRows: ProfitRow[] = await Promise.all(responses.map((response) => response.json()));
            setRows(savedRows);
            setMessage('All project changes have been saved.');
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Failed to save changes');
        } finally {
            setSaving(false);
        }
    };

    const totals = useMemo(() => {
        const monthlyBill = rows.reduce((sum, row) => sum + number(row.monthlyBill), 0);
        const monthlyNR = rows.reduce((sum, row) => sum + number(row.monthlyNR), 0);
        const monthlyCost = rows.reduce((sum, row) => sum + number(row.monthlyCost), 0);
        return { monthlyBill, monthlyNR, monthlyCost, gp2: calculateGP(monthlyNR, monthlyCost) };
    }, [rows]);

    return (
        <main className="employees-page profit-page">
            <header>
                <Link className="brand brand-link" to="/"><span>PM</span> ProjectFlow</Link>
                <nav className="page-nav"><Link className="back-link" to="/projects">← Projects</Link><Link className="back-link" to={`/employees?project=${projectId}`}>Project Employees</Link></nav>
            </header>
            <section className="employees-heading profit-heading">
                <div><p className="eyebrow">PROJECT PROFITABILITY</p><h1>{project?.name || 'Project Profitability'}</h1><p className="subtitle">{project ? `${project.projectCode} · PM ${project.pm}` : 'Loading project...'}</p></div>
                <div className="profit-heading-actions"><div className="formula-note"><strong>All amounts are in USD</strong><span>Monthly NR = Monthly Bill × 93% × 99.529%</span><span>CNY/USD 6.8 · INR/USD 86.5</span></div>{!!rows.length && <button className="primary-button" disabled={saving} onClick={saveAll}>{saving ? 'Saving…' : 'Save All Changes'}</button>}</div>
            </section>
            <section className="profit-content">
                {message && <div className={`notice ${message.includes('saved') ? 'success' : 'error'}`}>{message}</div>}
                {loading ? <div className="empty-state">Loading profitability data…</div> : !rows.length ? (
                    <div className="empty-state"><span>📈</span><h3>No Employees in This Project</h3><p>Add employees before maintaining profitability data.</p><Link className="primary-button empty-action" to={`/employees?project=${projectId}`}>Add Employee</Link></div>
                ) : <div className="table-wrap"><table className="profit-table"><thead><tr><th>Name</th><th>Hourly rate (USD)</th><th>Monthly working hours</th><th>Monthly Bill (USD)</th><th>Monthly NR (USD)</th><th>Monthly Cost (USD)</th><th>GP2%</th><th>Comment</th></tr></thead><tbody>
                    {rows.map((row) => <tr key={row.id}>
                        <td><input className="name-input" value={row.name} onChange={(event) => updateText(row.id, 'name', event)} /></td>
                        {(['hourlyRate', 'monthlyWorkingHours', 'monthlyBill', 'monthlyNR'] as NumericField[]).map((field) => <td key={field}><input type="number" min="0" step="0.01" value={Number(row[field].toFixed(2))} onChange={(event) => updateNumber(row.id, field, number(event.target.value))} /></td>)}
                        <td><div className="linked-cost" title={costDetails(row)}><span>${money(row.monthlyCost)}</span><small>{row.isShared ? `Salary linked · ${row.sharedRatio || 0}% shared` : 'Salary linked · USD'}</small></div></td>
                        <td><input type="number" min="0" step="0.1" value={Number(row.gp2.toFixed(1))} onChange={(event) => updateNumber(row.id, 'gp2', number(event.target.value))} /></td>
                        <td><input className="comment-input" value={row.comment} placeholder="Add a comment" onChange={(event) => updateText(row.id, 'comment', event)} /></td>
                    </tr>)}
                </tbody><tfoot><tr><td>Project Total</td><td>—</td><td>—</td><td>{money(totals.monthlyBill)}</td><td>{money(totals.monthlyNR)}</td><td>{money(totals.monthlyCost)}</td><td>{totals.gp2.toFixed(1)}%</td><td>{rows.length} employee{rows.length === 1 ? '' : 's'}</td></tr></tfoot></table></div>}
            </section>
        </main>
    );
};

export default ProjectProfitPage;
