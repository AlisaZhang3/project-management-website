import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Employee, getSalaryCurrency } from './EmployeesPage';
import { Project } from './ProjectsPage';

const salaryText = (employee: Employee) => {
    const value = (employee.salary || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
    const currency = getSalaryCurrency(employee.region);
    if (currency === 'LPA') return `${value} LPA/year`;
    if (currency === 'CNY') return `¥${value}/month`;
    if (currency === 'PHP') return `₱${value}/month`;
    return `$${value}/month`;
};

const EmployeeDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [employee, setEmployee] = useState<Employee | null>(null);
    const [project, setProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        Promise.all([fetch(`/api/employees/${id}`), fetch('/api/projects')])
            .then(async ([employeeResponse, projectResponse]) => {
                if (!employeeResponse.ok) throw new Error('Employee not found');
                if (!projectResponse.ok) throw new Error('Failed to load project information');
                const employeeData: Employee = await employeeResponse.json();
                const projects: Project[] = await projectResponse.json();
                setEmployee(employeeData);
                setProject(projects.find(({ id: projectId }) => projectId === employeeData.projectId) || null);
            })
            .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load employee'))
            .then(() => setLoading(false));
    }, [id]);

    return (
        <main className="employees-page">
            <header>
                <Link className="brand brand-link" to="/"><span>PM</span> ProjectFlow</Link>
                <nav className="page-nav"><Link className="back-link" to="/employees">← Employees</Link><Link className="back-link" to="/">Home</Link></nav>
            </header>
            <section className="employees-heading detail-heading">
                <div><p className="eyebrow">EMPLOYEE INFORMATION</p><h1>{employee?.name || 'Employee Details'}</h1><p className="subtitle">Employment, assignment, and C2C contract information.</p></div>
            </section>
            <section className="employee-detail-card">
                {loading ? <div className="empty-state">Loading employee…</div> : error || !employee ? <div className="notice error">{error || 'Employee not found'}</div> : (
                    <>
                        <div className="detail-summary"><div className="employee-avatar">{employee.name.trim().charAt(0).toUpperCase()}</div><div><span>Employee ID</span><strong>{employee.employeeNumber}</strong></div><span className={`reuse-badge ${employee.hasC2C ? 'yes' : ''}`}>C2C: {employee.hasC2C ? 'Yes' : 'No'}</span></div>
                        <div className="detail-grid">
                            <div><span>Name</span><strong>{employee.name}</strong></div>
                            <div><span>Country / Region</span><strong>{employee.region}</strong></div>
                            <div><span>Salary</span><strong>{salaryText(employee)}</strong></div>
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
