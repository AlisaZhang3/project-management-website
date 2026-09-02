import React, { FormEvent, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Project } from './ProjectsPage';

export interface Employee {
    id: number;
    employeeNumber: string;
    name: string;
    region: string;
    salary: number;
    projectId: number;
    joinDate: string;
    leaveDate: string;
    isShared: boolean;
    sharedProject: string;
    sharedRatio: number;
    isContractor: boolean;
    maximumEndDate: string;
    hourlyRate?: number;
    monthlyWorkingHours?: number;
    monthlyBill?: number;
    monthlyNR?: number;
    monthlyCost?: number;
    gp2?: number;
    comment?: string;
}

type EmployeeForm = Omit<Employee, 'id' | 'hourlyRate' | 'monthlyWorkingHours' | 'monthlyBill' | 'monthlyNR' | 'monthlyCost' | 'gp2' | 'comment'>;

const emptyForm: EmployeeForm = {
    employeeNumber: '',
    name: '',
    region: '',
    salary: 0,
    projectId: 0,
    joinDate: '',
    leaveDate: '',
    isShared: false,
    sharedProject: '',
    sharedRatio: 0,
    isContractor: false,
    maximumEndDate: '',
};

const EmployeesPage: React.FC = () => {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [form, setForm] = useState<EmployeeForm>(emptyForm);
    const [selectedProject, setSelectedProject] = useState('all');
    const [projectsExpanded, setProjectsExpanded] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const location = useLocation();

    const loadData = async () => {
        try {
            const [employeeResponse, projectResponse] = await Promise.all([
                fetch('/api/employees'),
                fetch('/api/projects'),
            ]);
            if (!employeeResponse.ok || !projectResponse.ok) throw new Error('Failed to load data');
            const [employeeData, projectData]: [Employee[], Project[]] = await Promise.all([
                employeeResponse.json(),
                projectResponse.json(),
            ]);
            setEmployees(employeeData);
            setProjects(projectData);
            const requestedProject = Number(new URLSearchParams(location.search).get('project'));
            if (requestedProject && projectData.some(({ id }) => id === requestedProject)) {
                setSelectedProject(String(requestedProject));
                setProjectsExpanded(true);
            }
            setError('');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load employees');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    const visibleEmployees = selectedProject === 'all'
        ? employees
        : employees.filter(({ projectId }) => projectId === Number(selectedProject));
    const getProject = (projectId: number) => projects.find(({ id }) => id === projectId);

    const updateField = (field: keyof EmployeeForm, value: string | boolean | number) => {
        setForm((current) => ({ ...current, [field]: value }));
    };

    const toggleForm = () => {
        if (showForm) {
            setShowForm(false);
            setEditingId(null);
            setForm(emptyForm);
            return;
        }
        if (!showForm && selectedProject !== 'all') {
            setForm((current) => ({ ...current, projectId: Number(selectedProject) }));
        }
        setEditingId(null);
        setShowForm(true);
    };

    const editEmployee = (employee: Employee) => {
        setForm({
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
            isContractor: employee.isContractor || false,
            maximumEndDate: employee.maximumEndDate || '',
        });
        setEditingId(employee.id);
        setShowForm(true);
        setError('');
        window.scrollTo({ top: 160, behavior: 'smooth' });
    };

    const submitEmployee = async (event: FormEvent) => {
        event.preventDefault();
        setError('');
        try {
            const response = await fetch(editingId ? `/api/employees/${editingId}` : '/api/employees', {
                method: editingId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...form,
                    sharedProject: form.isShared ? form.sharedProject.trim() : '',
                    sharedRatio: form.isShared ? form.sharedRatio : 0,
                    maximumEndDate: form.isContractor ? form.maximumEndDate : '',
                }),
            });
            if (!response.ok) throw new Error(editingId ? 'Failed to update employee' : 'Failed to add employee');
            const employee: Employee = await response.json();
            setEmployees((current) => editingId
                ? current.map((item) => item.id === employee.id ? employee : item)
                : [...current, employee]
            );
            setSelectedProject(String(employee.projectId));
            setForm(emptyForm);
            setEditingId(null);
            setShowForm(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : editingId ? 'Failed to update employee' : 'Failed to add employee');
        }
    };

    const contractorStatus = (employee: Employee) => {
        if (!employee.isContractor || !employee.maximumEndDate) return null;
        const days = Math.ceil((new Date(`${employee.maximumEndDate}T23:59:59`).getTime() - Date.now()) / 86400000);
        if (days < 0) return { urgent: true, text: `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago` };
        if (days <= 31) return { urgent: true, text: days === 0 ? 'Expires today' : `Expires in ${days} day${days === 1 ? '' : 's'}` };
        return null;
    };

    const expiringContractors = employees.filter((employee) => contractorStatus(employee)?.urgent);

    return (
        <main className="employees-page">
            <header>
                <Link className="brand brand-link" to="/"><span>PM</span> ProjectFlow</Link>
                <nav className="page-nav"><Link className="back-link" to="/projects">Projects</Link><Link className="back-link" to="/">← Home</Link></nav>
            </header>

            <section className="employees-heading">
                <div>
                    <p className="eyebrow">EMPLOYEE MANAGEMENT</p>
                    <h1>Employees</h1>
                    <p className="subtitle">View and maintain employee assignments by project.</p>
                </div>
                <button className="primary-button" disabled={!projects.length} title={!projects.length ? 'Create a project first' : ''} onClick={toggleForm}>
                    {showForm ? 'Cancel' : '＋ Add Employee'}
                </button>
            </section>

            {showForm && (
                <form className="employee-form" onSubmit={submitEmployee}>
                    <div className="form-title"><h2>{editingId ? 'Edit Employee' : 'Add Employee'}</h2><p>{editingId ? 'Update the details and save your changes.' : 'Enter the employee and project details.'}</p></div>
                    <label>Project<select required value={form.projectId || ''} onChange={(e) => updateField('projectId', Number(e.target.value))}><option value="" disabled>Select a project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.projectCode} · {project.name}</option>)}</select></label>
                    <label>Employee ID<input required value={form.employeeNumber} onChange={(e) => updateField('employeeNumber', e.target.value)} placeholder="e.g. E001" /></label>
                    <label>Name<input required value={form.name} onChange={(e) => updateField('name', e.target.value)} placeholder="Employee name" /></label>
                    <label>Region<input required value={form.region} onChange={(e) => updateField('region', e.target.value)} placeholder="e.g. China or India" /></label>
                    <label>{/india|inida/i.test(form.region) ? 'Annual Salary (LPA)' : 'Monthly Salary (CNY)'}<input required type="number" min="0" step="0.01" value={form.salary || ''} onChange={(e) => updateField('salary', Number(e.target.value))} placeholder={/india|inida/i.test(form.region) ? 'e.g. 12 LPA' : 'e.g. 20000'} /></label>
                    <label>Join Date<input required type="date" value={form.joinDate} onChange={(e) => updateField('joinDate', e.target.value)} /></label>
                    <label>Leave Date<input type="date" min={form.joinDate} value={form.leaveDate} onChange={(e) => updateField('leaveDate', e.target.value)} /></label>
                    <label className="check-field"><input type="checkbox" checked={form.isShared} onChange={(e) => updateField('isShared', e.target.checked)} /><span>Shared Resource</span></label>
                    {form.isShared && <label>Shared Project<input required value={form.sharedProject} onChange={(e) => updateField('sharedProject', e.target.value)} placeholder="Enter shared project name" /></label>}
                    {form.isShared && <label>Shared Ratio (%)<input required type="number" min="1" max="100" value={form.sharedRatio || ''} onChange={(e) => updateField('sharedRatio', Number(e.target.value))} /></label>}
                    <label className="check-field"><input type="checkbox" checked={form.isContractor} onChange={(e) => updateField('isContractor', e.target.checked)} /><span>Contractor</span></label>
                    {form.isContractor && <label>Maximum End Date<input required type="date" min={form.joinDate} value={form.maximumEndDate} onChange={(e) => updateField('maximumEndDate', e.target.value)} /></label>}
                    <div className="form-actions"><button type="submit" className="primary-button">{editingId ? 'Save Changes' : 'Save Employee'}</button></div>
                </form>
            )}

            {!!expiringContractors.length && (
                <section className="contractor-alert"><strong>⚠ Contractor Expiry Alert</strong><span>{expiringContractors.length} contractor{expiringContractors.length === 1 ? '' : 's'} will reach or have passed the Maximum End Date within one month: {expiringContractors.map(({ name }) => name).join(', ')}.</span></section>
            )}

            <section className="employee-content">
                <aside className="project-filter">
                    <h3>Projects</h3>
                    <button className={selectedProject === 'all' ? 'active all-projects-button' : 'all-projects-button'} onClick={() => { setSelectedProject('all'); setProjectsExpanded((value) => !value); }}><span><i className={projectsExpanded ? 'expanded' : ''}>›</i> All Projects</span><b>{employees.length}</b></button>
                    {projectsExpanded && projects.map((project) => (
                        <button className={selectedProject === String(project.id) ? 'active' : ''} key={project.id} onClick={() => setSelectedProject(String(project.id))}>
                            <span className="nested-project">{project.name}</span><b>{employees.filter((item) => item.projectId === project.id).length}</b>
                        </button>
                    ))}
                    {!projects.length && <p>Create a project in Project Management first.</p>}
                </aside>

                <div className="employee-list">
                    <div className="list-header"><div><h2>{selectedProject === 'all' ? 'All Projects' : getProject(Number(selectedProject))?.name}</h2><p>{visibleEmployees.length} employee{visibleEmployees.length === 1 ? '' : 's'}</p></div></div>
                    {error && <div className="notice error">{error}</div>}
                    {!projects.length && !loading && <div className="project-required"><strong>Create a Project First</strong><span>A project is required before employees can be added.</span><Link className="primary-button" to="/projects">Create Project</Link></div>}
                    {loading ? <div className="empty-state">Loading employees…</div> : !projects.length ? null : visibleEmployees.length === 0 ? (
                        <div className="empty-state"><span>👥</span><h3>No Employees Yet</h3><p>Click “Add Employee” to add the first employee to this project.</p></div>
                    ) : (
                        <div className="table-wrap"><table className="employee-table"><thead><tr><th>Employee ID</th><th>Name</th><th>Region</th><th>Salary</th><th>Join Date</th><th>Leave Date</th><th>Project</th><th>Shared</th><th>Shared Project</th><th>Shared Ratio</th><th>Contractor</th><th>Maximum End Date</th><th>Action</th></tr></thead><tbody>
                            {visibleEmployees.map((employee) => <tr className={contractorStatus(employee)?.urgent ? 'contractor-expiring' : ''} key={employee.id}>
                                <td><strong>{employee.employeeNumber}</strong></td><td>{employee.name}</td><td>{employee.region}</td><td>{/india|inida/i.test(employee.region) ? `${employee.salary || 0} LPA` : `¥${(employee.salary || 0).toLocaleString()}/month`}</td><td>{employee.joinDate}</td><td>{employee.leaveDate || '—'}</td><td><span className="project-tag">{getProject(employee.projectId)?.name || 'Unknown Project'}</span></td><td><span className={`reuse-badge ${employee.isShared ? 'yes' : ''}`}>{employee.isShared ? 'Yes' : 'No'}</span></td><td>{employee.isShared ? employee.sharedProject || '—' : '—'}</td><td>{employee.isShared ? `${employee.sharedRatio}%` : '—'}</td><td><span className={`reuse-badge ${employee.isContractor ? 'contractor' : ''}`}>{employee.isContractor ? 'Yes' : 'No'}</span></td><td>{employee.isContractor ? <span className={contractorStatus(employee)?.urgent ? 'expiry-date' : ''}>{employee.maximumEndDate || '—'}{contractorStatus(employee) && <small>{contractorStatus(employee)?.text}</small>}</span> : '—'}</td><td><button className="edit-button" onClick={() => editEmployee(employee)}>Edit</button></td>
                            </tr>)}
                        </tbody></table></div>
                    )}
                </div>
            </section>
        </main>
    );
};

export default EmployeesPage;
