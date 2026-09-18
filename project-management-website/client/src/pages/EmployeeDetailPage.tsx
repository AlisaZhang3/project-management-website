import React, { useEffect, useMemo, useState } from 'react';
import { Link, useHistory, useLocation, useParams } from 'react-router-dom';
import { Employee, getSalaryCurrency } from './EmployeesPage';
import { Project } from './ProjectsPage';

type EmployeeEditForm = Omit<Employee, 'id' | 'c2cContractName' | 'c2cContractUploadedAt' | 'hourlyRate' | 'monthlyBill' | 'monthlyNR' | 'monthlyCost' | 'gp2' | 'comment'> & {
    monthlyWorkingHours: number;
};

const salaryText = (employee: Employee) => {
    const value = (employee.salary || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
    const currency = getSalaryCurrency(employee.region);
    if (currency === 'LPA') return `${value} LPA/year`;
    if (currency === 'CNY') return `¥${value}/month`;
    if (currency === 'PHP') return `₱${value}/month`;
    return `$${value}/month`;
};

const buildEditForm = (employee: Employee): EmployeeEditForm => ({
    employeeNumber: employee.employeeNumber,
    name: employee.name,
    region: employee.region,
    salary: employee.salary || 0,
    projectId: employee.projectId,
    joinDate: employee.joinDate,
    leaveDate: employee.leaveDate || '',
    isShared: employee.isShared,
    sharedProject: employee.sharedProject || '',
    sharedRatio: employee.sharedRatio || 0,
    isContractor: employee.isContractor,
    maximumEndDate: employee.maximumEndDate || '',
    hasC2C: employee.hasC2C,
    monthlyWorkingHours: (employee as any).monthlyWorkingHours ?? 168,
});

const EmployeeDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const history = useHistory();
    const location = useLocation<{ returnTo?: string }>();
    const [employee, setEmployee] = useState<Employee | null>(null);
    const [projects, setProjects] = useState<Project[]>([]);
    const [project, setProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState<EmployeeEditForm | null>(null);
    const [c2cContract, setC2CContract] = useState<File | null>(null);
    const [saving, setSaving] = useState(false);
    const returnTo = location.state?.returnTo || `/employees?project=${employee?.projectId ?? ''}`;

    const handleReturn = () => {
        const target = location.state?.returnTo || (employee ? `/employees?project=${employee.projectId}` : '/employees');
        history.push(target);
    };

    const loadEmployee = async () => {
        try {
            const [employeeResponse, projectResponse] = await Promise.all([fetch(`/api/employees/${id}`), fetch('/api/projects')]);
            if (!employeeResponse.ok) throw new Error('Employee not found');
            if (!projectResponse.ok) throw new Error('Failed to load project information');
            const employeeData: Employee = await employeeResponse.json();
            const projectData: Project[] = await projectResponse.json();
            setEmployee(employeeData);
            setProjects(projectData);
            setProject(projectData.find(({ id: projectId }) => projectId === employeeData.projectId) || null);
            setForm(buildEditForm(employeeData));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load employee');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadEmployee();
    }, [id]);

    const updateField = (field: keyof EmployeeEditForm, value: string | boolean | number) => {
        setForm((current) => (current ? { ...current, [field]: value } : current));
    };

    const startEditing = () => {
        if (!employee) return;
        setForm(buildEditForm(employee));
        setC2CContract(null);
        setEditing(true);
    };

    const cancelEditing = () => {
        setEditing(false);
        setC2CContract(null);
        setForm(employee ? buildEditForm(employee) : null);
    };

    const submitEmployee = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!employee || !form) return;
        setError('');
        if (form.hasC2C && !c2cContract && !employee.c2cContractName) {
            setError('Please select a signed C2C contract PDF to continue.');
            return;
        }
        if (c2cContract && (c2cContract.type !== 'application/pdf' || !c2cContract.name.toLowerCase().endsWith('.pdf'))) {
            setError('The C2C contract must be a PDF file.');
            return;
        }

        setSaving(true);
        try {
            const response = await fetch(`/api/employees/${employee.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...form,
                    projectId: Number(form.projectId),
                    salary: Number(form.salary) || 0,
                    monthlyWorkingHours: Number((form as any).monthlyWorkingHours) || 168,
                    sharedProject: form.isShared ? form.sharedProject.trim() : '',
                    sharedRatio: form.isShared ? form.sharedRatio : 0,
                    maximumEndDate: form.isContractor ? form.maximumEndDate : '',
                    hasC2C: form.hasC2C,
                }),
            });
            if (!response.ok) throw new Error('Failed to update employee');
            let updatedEmployee: Employee = await response.json();

            if (form.hasC2C && c2cContract) {
                const contractResponse = await fetch(`/api/employees/${updatedEmployee.id}/c2c-contract`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/pdf', 'X-File-Name': encodeURIComponent(c2cContract.name) },
                    body: c2cContract,
                });
                if (!contractResponse.ok) throw new Error('Employee was updated, but the C2C contract upload failed');
                updatedEmployee = await contractResponse.json();
            } else if (!form.hasC2C && employee.c2cContractName) {
                const contractResponse = await fetch(`/api/employees/${updatedEmployee.id}/c2c-contract`, { method: 'DELETE' });
                if (!contractResponse.ok) throw new Error('Employee was updated, but the C2C contract could not be removed');
                updatedEmployee = await contractResponse.json();
            }

            setEmployee(updatedEmployee);
            setForm(buildEditForm(updatedEmployee));
            setProject(projects.find(({ id: projectId }) => projectId === updatedEmployee.projectId) || null);
            setEditing(false);
            setC2CContract(null);
            history.push(location.state?.returnTo || `/employees?project=${updatedEmployee.projectId}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update employee');
        } finally {
            setSaving(false);
        }
    };

    const employeeSalary = useMemo(() => employee ? salaryText(employee) : '', [employee]);

    return (
        <main className="employees-page">
            <header>
                <nav className="page-nav"><button className="back-link" type="button" onClick={handleReturn}>← {location.state?.returnTo ? 'Back to Project' : 'Employees'}</button><Link className="back-link" to="/">Home</Link></nav>
            </header>
            <section className="employees-heading detail-heading">
                <div><p className="eyebrow">EMPLOYEE INFORMATION</p><h1>{employee?.name || 'Employee Details'}</h1><p className="subtitle">Employment, assignment, and C2C contract information.</p></div>
                {!editing && employee && (
                    <button className="primary-button" type="button" onClick={startEditing}>Edit Employee</button>
                )}
            </section>
            <section className="employee-detail-card">
                {loading ? <div className="empty-state">Loading employee…</div> : error || !employee ? <div className="notice error">{error || 'Employee not found'}</div> : editing && form ? (
                    <form className="employee-form" onSubmit={submitEmployee}>
                        <div className="form-title"><h2>Edit Employee</h2><p>Update the details and save your changes.</p></div>
                        <label>Project<select required value={form.projectId || ''} onChange={(e) => updateField('projectId', Number(e.target.value))}><option value="" disabled>Select a project</option>{projects.map((projectItem) => <option key={projectItem.id} value={projectItem.id}>{projectItem.projectCode} · {projectItem.name}</option>)}</select></label>
                        <label>Employee ID<input required value={form.employeeNumber} onChange={(e) => updateField('employeeNumber', e.target.value)} /></label>
                        <label>Name<input required value={form.name} onChange={(e) => updateField('name', e.target.value)} /></label>
                        <label>Country / Region<input required value={form.region} onChange={(e) => updateField('region', e.target.value)} placeholder="e.g. China, India, Philippines, USA" /></label>
                        <label>{getSalaryCurrency(form.region) === 'LPA' ? 'Annual Salary (LPA)' : `Monthly Salary (${getSalaryCurrency(form.region)})`}<input required type="number" min="0" step="0.01" value={form.salary || ''} onChange={(e) => updateField('salary', Number(e.target.value))} /></label>
                        <label>Join Date<input required type="date" value={form.joinDate} onChange={(e) => updateField('joinDate', e.target.value)} /></label>
                        <label>Leave Date<input type="date" min={form.joinDate} value={form.leaveDate} onChange={(e) => updateField('leaveDate', e.target.value)} /></label>
                        <label className="check-field"><input type="checkbox" checked={form.isShared} onChange={(e) => updateField('isShared', e.target.checked)} /><span>Shared Resource</span></label>
                        {form.isShared && <label>Shared Project<input value={form.sharedProject} onChange={(e) => updateField('sharedProject', e.target.value)} placeholder="Enter shared project name" /></label>}
                        {form.isShared && <label>Shared Ratio (%)<input type="number" min="1" max="100" value={form.sharedRatio || ''} onChange={(e) => updateField('sharedRatio', Number(e.target.value))} /></label>}
                        <label className="check-field"><input type="checkbox" checked={form.isContractor} onChange={(e) => updateField('isContractor', e.target.checked)} /><span>Contractor</span></label>
                        {form.isContractor && <label>Maximum End Date<input required type="date" min={form.joinDate} value={form.maximumEndDate} onChange={(e) => updateField('maximumEndDate', e.target.value)} /></label>}
                        <label className="check-field"><input type="checkbox" checked={form.hasC2C} onChange={(e) => { updateField('hasC2C', e.target.checked); if (!e.target.checked) setC2CContract(null); }} /><span>C2C Agreement Signed</span></label>
                        {form.hasC2C && <label className="contract-upload">C2C Contract (PDF)<input type="file" accept="application/pdf,.pdf" onChange={(e) => setC2CContract(e.target.files?.[0] || null)} />{employee.c2cContractName && !c2cContract && <small>Current: {employee.c2cContractName}. Select a PDF to replace it.</small>}</label>}
                        <div className="form-actions"><button type="submit" className="primary-button" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button><button type="button" className="secondary-button" onClick={cancelEditing}>Cancel</button></div>
                    </form>
                ) : (
                    <>
                        <div className="detail-summary"><div className="employee-avatar">{employee.name.trim().charAt(0).toUpperCase()}</div><div><span>Employee ID</span><strong>{employee.employeeNumber}</strong></div><span className={`reuse-badge ${employee.hasC2C ? 'yes' : ''}`}>C2C: {employee.hasC2C ? 'Yes' : 'No'}</span></div>
                        <div className="detail-grid">
                            <div><span>Name</span><strong>{employee.name}</strong></div>
                            <div><span>Country / Region</span><strong>{employee.region}</strong></div>
                            <div><span>Salary</span><strong>{employeeSalary}</strong></div>
                            <div><span>Project</span><strong>{project?.name || 'Unknown Project'}</strong></div>
                            <div><span>Join Date</span><strong>{employee.joinDate || '—'}</strong></div>
                            <div><span>Leave Date</span><strong>{employee.leaveDate || '—'}</strong></div>
                            <div><span>Shared Resource</span><strong>{employee.isShared ? 'Yes' : 'No'}</strong></div>
                            <div><span>Shared Project / Ratio</span><strong>{employee.isShared ? `${employee.sharedProject || '—'} · ${employee.sharedRatio || 0}%` : '—'}</strong></div>
                            <div><span>Contractor</span><strong>{employee.isContractor ? 'Yes' : 'No'}</strong></div>
                            <div><span>Maximum End Date</span><strong>{employee.isContractor ? employee.maximumEndDate || '—' : '—'}</strong></div>
                        </div>
                        <div className="contract-panel">
                            <div><span>C2C Agreement</span><strong>{employee.hasC2C ? 'Signed' : 'Not signed'}</strong>{employee.hasC2C && employee.c2cContractName && <small>{employee.c2cContractName}</small>}</div>
                            {employee.hasC2C && employee.c2cContractName ? <a className="primary-button" href={`/api/employees/${employee.id}/c2c-contract`} target="_blank" rel="noreferrer">View PDF Contract</a> : <span className="contract-empty">No C2C contract on file.</span>}
                        </div>
                    </>
                )}
            </section>
        </main>
    );
};

export default EmployeeDetailPage;
