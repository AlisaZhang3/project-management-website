import React, { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { Eye, EyeOff } from 'lucide-react';
import { EmployeeImportRow, parseEmployeeImportRows } from '../utils/employeeImport';
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
    hasC2C: boolean;
    c2cContractName?: string | null;
    c2cContractUploadedAt?: string | null;
    hourlyRate?: number;
    monthlyWorkingHours?: number;
    monthlyBill?: number;
    monthlyNR?: number;
    monthlyCost?: number;
    gp2?: number;
    comment?: string;
}

type EmployeeForm = Omit<Employee, 'id' | 'c2cContractName' | 'c2cContractUploadedAt' | 'hourlyRate' | 'monthlyBill' | 'monthlyNR' | 'monthlyCost' | 'gp2' | 'comment'> & {
    monthlyWorkingHours: number;
};

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
    hasC2C: false,
    monthlyWorkingHours: 168,
};

export type SalaryCurrency = 'CNY' | 'LPA' | 'PHP' | 'USD';

export const getSalaryCurrency = (region: string): SalaryCurrency => {
    const value = region.trim().toLowerCase();
    if (/india|inida|印度/.test(value)) return 'LPA';
    if (/philippines|philippine|pilipinas|菲律宾/.test(value)) return 'PHP';
    if (/china|chinese|中国|中国大陆|mainland|beijing|北京|shanghai|上海|chengdu|成都|xian|xi'an|西安|shenzhen|深圳|guangzhou|广州|hangzhou|杭州|nanjing|南京|wuhan|武汉|suzhou|苏州|tianjin|天津|chongqing|重庆/.test(value)) return 'CNY';
    return 'USD';
};

export const matchesEmployeeSearch = (employee: Pick<Employee, 'employeeNumber' | 'name'>, query: string) => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return true;
    return employee.employeeNumber.toLowerCase().includes(normalizedQuery)
        || employee.name.toLowerCase().includes(normalizedQuery);
};

const salaryLabel = (region: string) => {
    const currency = getSalaryCurrency(region);
    if (currency === 'LPA') return 'Annual Salary (LPA)';
    return `Monthly Salary (${currency})`;
};

const salaryPlaceholder = (region: string) => {
    const currency = getSalaryCurrency(region);
    if (currency === 'LPA') return 'e.g. 12 LPA';
    if (currency === 'PHP') return 'e.g. 60000 PHP';
    if (currency === 'USD') return 'e.g. 3000 USD';
    return 'e.g. 20000 CNY';
};

const displaySalary = (employee: Employee) => {
    const salary = (employee.salary || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
    const currency = getSalaryCurrency(employee.region);
    if (currency === 'LPA') return `${salary} LPA/year`;
    if (currency === 'CNY') return `¥${salary}/month`;
    if (currency === 'PHP') return `₱${salary}/month`;
    return `$${salary}/month`;
};

const EmployeesPage: React.FC = () => {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [form, setForm] = useState<EmployeeForm>(emptyForm);
    const [selectedProject, setSelectedProject] = useState('all');
    const [projectsExpanded, setProjectsExpanded] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [c2cContract, setC2CContract] = useState<File | null>(null);
    const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>([]);
    const [salaryVisibility, setSalaryVisibility] = useState<{ project: string; ids: number[] }>({ project: '', ids: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const importInputRef = useRef<HTMLInputElement | null>(null);
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

    const hasActiveProject = selectedProject !== '' && selectedProject !== 'all';
    const projectEmployees = hasActiveProject
        ? employees.filter(({ projectId }) => projectId === Number(selectedProject))
        : employees;
    const filteredEmployees = projectEmployees.filter((employee) => matchesEmployeeSearch(employee, searchTerm));
    const revealedSalaryIds = salaryVisibility.project === selectedProject ? salaryVisibility.ids : [];
    const allSalariesVisible = projectEmployees.length > 0 && projectEmployees.every(({ id }) => revealedSalaryIds.indexOf(id) >= 0);
    useEffect(() => { setSalaryVisibility({ project: selectedProject, ids: [] }); }, [selectedProject]);
    const toggleSalary = (employeeId: number) => {
        setSalaryVisibility((current) => {
            const ids = current.project === selectedProject ? current.ids : [];
            return { project: selectedProject, ids: ids.indexOf(employeeId) >= 0 ? ids.filter((id) => id !== employeeId) : [...ids, employeeId] };
        });
    };
    const renderSalary = (employee: Employee) => {
        const visible = revealedSalaryIds.indexOf(employee.id) >= 0;
        const label = `${visible ? 'Hide' : 'Show'} salary for ${employee.name}`;
        return <div className="employee-salary-cell"><span>{visible ? displaySalary(employee) : '******'}</span><button className="salary-toggle" type="button" title={label} aria-label={label} aria-pressed={visible} onClick={() => toggleSalary(employee.id)}>{visible ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}</button></div>;
    };
    const getProject = (projectId: number) => projects.find(({ id }) => id === projectId);
    const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / 15));
    const pagedEmployees = filteredEmployees.slice((page - 1) * 15, page * 15);
    const visibleEmployees = pagedEmployees;
    useEffect(() => { setPage(1); }, [selectedProject, searchTerm]);
    const projectCodeMap = projects.reduce<Record<string, number>>((map, { projectCode, id }) => {
        map[projectCode.trim()] = id;
        return map;
    }, {});
    const toggleEmployeeSelection = (employeeId: number) => {
        setSelectedEmployeeIds((current) => current.indexOf(employeeId) >= 0
            ? current.filter((id) => id !== employeeId)
            : [...current, employeeId]);
    };

    const exportRowsToExcel = (rows: Employee[], fileName: string) => {
        if (!rows.length) {
            setError('No employees available to export.');
            return;
        }

        const sheetRows = rows.map((employee) => ({
            employeeNumber: employee.employeeNumber,
            name: employee.name,
            region: employee.region,
            salary: employee.salary,
            projectCode: getProject(employee.projectId)?.projectCode || '',
            projectName: getProject(employee.projectId)?.name || '',
            joinDate: employee.joinDate,
            leaveDate: employee.leaveDate || '',
            monthlyWorkingHours: employee.monthlyWorkingHours || 168,
            isShared: employee.isShared ? 'Yes' : 'No',
            sharedProject: employee.sharedProject || '',
            sharedRatio: employee.sharedRatio || 0,
            isContractor: employee.isContractor ? 'Yes' : 'No',
            maximumEndDate: employee.maximumEndDate || '',
            hasC2C: employee.hasC2C ? 'Yes' : 'No',
        }));

        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(sheetRows);
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Employees');
        XLSX.writeFile(workbook, fileName);
    };

    const downloadTemplate = () => {
        const workbook = XLSX.utils.book_new();
        const templateRows = [{
            employeeNumber: 'E-001',
            name: 'Alice Chen',
            region: 'China',
            salary: 25000,
            projectCode: 'PRJ-001',
            joinDate: '2026-01-01',
            leaveDate: '',
            monthlyWorkingHours: 168,
            isShared: 'No',
            sharedProject: '',
            sharedRatio: '0',
            isContractor: 'No',
            maximumEndDate: '',
            hasC2C: 'No',
        }];
        const worksheet = XLSX.utils.json_to_sheet(templateRows);
        XLSX.utils.book_append_sheet(workbook, worksheet, 'EmployeeTemplate');
        XLSX.writeFile(workbook, 'employee-import-template.xlsx');
    };

    const handleImportEmployees = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setError('');
        setSuccess('');

        try {
            const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const rows: Record<string, string | number>[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

            const normalizedRows = rows.map((row) => ({
                employeeNumber: row.employeeNumber ?? row['Employee ID'] ?? row['Employee Number'] ?? '',
                name: row.name ?? row.Name ?? '',
                region: row.region ?? row.Region ?? '',
                salary: row.salary ?? row.Salary ?? '',
                projectCode: row.projectCode ?? row['Project Code'] ?? '',
                joinDate: row.joinDate ?? row['Join Date'] ?? '',
                leaveDate: row.leaveDate ?? row['Leave Date'] ?? '',
                monthlyWorkingHours: row.monthlyWorkingHours ?? row['Monthly Working Hours'] ?? 168,
                isShared: row.isShared ?? row['Is Shared'] ?? '',
                sharedProject: row.sharedProject ?? row['Shared Project'] ?? '',
                sharedRatio: row.sharedRatio ?? row['Shared Ratio'] ?? '',
                isContractor: row.isContractor ?? row['Is Contractor'] ?? '',
                maximumEndDate: row.maximumEndDate ?? row['Maximum End Date'] ?? '',
                hasC2C: row.hasC2C ?? row['Has C2C'] ?? '',
            }));

            const { records, errors } = parseEmployeeImportRows(normalizedRows as EmployeeImportRow[], projectCodeMap);
            if (errors.length > 0) {
                setError(errors.slice(0, 5).join(' • '));
                return;
            }

            const createdEmployees: Employee[] = [];
            for (const record of records) {
                const response = await fetch('/api/employees', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(record),
                });

                if (!response.ok) {
                    const message = await response.text();
                    throw new Error(message || 'Failed to import employee');
                }

                const employee: Employee = await response.json();
                createdEmployees.push(employee);
            }

            setEmployees((current) => [...current, ...createdEmployees]);
            setSelectedEmployeeIds([]);
            setSuccess(`Imported ${createdEmployees.length} employee${createdEmployees.length === 1 ? '' : 's'} successfully.`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to import employees from Excel.');
        } finally {
            event.target.value = '';
        }
    };

    const selectAllVisibleEmployees = () => {
        const ids = visibleEmployees.map(({ id }) => id);
        const allSelected = ids.length > 0 && ids.every((id) => selectedEmployeeIds.indexOf(id) >= 0);
        setSelectedEmployeeIds((current) => allSelected
            ? current.filter((id) => ids.indexOf(id) < 0)
            : Array.from(new Set([...current, ...ids])));
    };

    const exportSelectedEmployees = () => {
        const rowsToExport = selectedEmployeeIds.length > 0
            ? employees.filter(({ id }) => selectedEmployeeIds.indexOf(id) >= 0)
            : projectEmployees;
        exportRowsToExcel(rowsToExport, `${getProject(Number(selectedProject))?.projectCode || 'project'}-employees.xlsx`);
        setSuccess('Exported employee file successfully.');
    };

    const updateField = (field: keyof EmployeeForm, value: string | boolean | number) => {
        setForm((current) => ({ ...current, [field]: value }));
    };

    const toggleForm = () => {
        if (showForm) {
            setShowForm(false);
            setEditingId(null);
            setForm(emptyForm);
            setC2CContract(null);
            return;
        }
        if (!showForm && selectedProject !== 'all') {
            setForm((current) => ({ ...current, projectId: Number(selectedProject) }));
        }
        setEditingId(null);
        setC2CContract(null);
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
            hasC2C: employee.hasC2C || false,
            monthlyWorkingHours: employee.monthlyWorkingHours || 168,
        });
        setC2CContract(null);
        setEditingId(employee.id);
        setShowForm(true);
        setError('');
        window.scrollTo({ top: 160, behavior: 'smooth' });
    };

    const submitEmployee = async (event: FormEvent) => {
        event.preventDefault();
        setError('');
        const existingEmployee = editingId ? employees.find(({ id }) => id === editingId) : undefined;
        if (form.hasC2C && !c2cContract && !existingEmployee?.c2cContractName) {
            setError('Please select the signed C2C contract in PDF format.');
            return;
        }
        if (c2cContract && (c2cContract.type !== 'application/pdf' || !c2cContract.name.toLowerCase().endsWith('.pdf'))) {
            setError('The C2C contract must be a PDF file.');
            return;
        }
        try {
            const response = await fetch(editingId ? `/api/employees/${editingId}` : '/api/employees', {
                method: editingId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...form,
                    monthlyWorkingHours: Number(form.monthlyWorkingHours) || 168,
                    sharedProject: form.isShared ? form.sharedProject.trim() : '',
                    sharedRatio: form.isShared ? form.sharedRatio : 0,
                    maximumEndDate: form.isContractor ? form.maximumEndDate : '',
                    hasC2C: c2cContract ? Boolean(existingEmployee?.c2cContractName) : form.hasC2C,
                }),
            });
            if (!response.ok) throw new Error(editingId ? 'Failed to update employee' : 'Failed to add employee');
            let employee: Employee = await response.json();

            if (form.hasC2C && c2cContract) {
                const contractResponse = await fetch(`/api/employees/${employee.id}/c2c-contract`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/pdf', 'X-File-Name': encodeURIComponent(c2cContract.name) },
                    body: c2cContract,
                });
                if (!contractResponse.ok) throw new Error('Employee was saved, but the C2C contract upload failed');
                employee = await contractResponse.json();
            } else if (!form.hasC2C && existingEmployee?.c2cContractName) {
                const contractResponse = await fetch(`/api/employees/${employee.id}/c2c-contract`, { method: 'DELETE' });
                if (!contractResponse.ok) throw new Error('Employee was saved, but the C2C contract could not be removed');
                employee = await contractResponse.json();
            }

            setEmployees((current) => editingId
                ? current.map((item) => item.id === employee.id ? employee : item)
                : [...current, employee]
            );
            setSelectedProject(String(employee.projectId));
            setSearchTerm('');
            setForm(emptyForm);
            setC2CContract(null);
            setEditingId(null);
            setShowForm(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : editingId ? 'Failed to update employee' : 'Failed to add employee');
        }
    };

    const deleteEmployee = async (employee: Employee) => {
        if (!window.confirm(`Delete employee “${employee.name}” (${employee.employeeNumber})? This action cannot be undone.`)) return;
        setError('');
        try {
            const response = await fetch(`/api/employees/${employee.id}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Failed to delete employee');
            setEmployees((current) => current.filter(({ id }) => id !== employee.id));
            if (editingId === employee.id) {
                setEditingId(null);
                setShowForm(false);
                setForm(emptyForm);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete employee');
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
                <nav className="page-nav"><Link className="back-link" to="/projects">Projects</Link><Link className="back-link" to="/">← Home</Link></nav>
            </header>

            <section className="employees-heading">
                <div>
                    <p className="eyebrow">EMPLOYEE MANAGEMENT</p>
                    <h1>Employees</h1>
                    <p className="subtitle">View and maintain employee assignments by project.</p>
                </div>
                <div className="bulk-actions">
                    <button className="secondary-button" type="button" onClick={downloadTemplate}>Download Template</button>
                    <button className="secondary-button" type="button" onClick={() => importInputRef.current?.click()}>Import Excel</button>
                    <button className="secondary-button" type="button" onClick={exportSelectedEmployees}>Export Selected</button>
                    <button className="primary-button" disabled={!projects.length} title={!projects.length ? 'Create a project first' : ''} onClick={toggleForm}>
                        {showForm ? 'Cancel' : '＋ Add Employee'}
                    </button>
                </div>
            </section>

            <input ref={importInputRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={handleImportEmployees} />

            {showForm && (
                <form className="employee-form" onSubmit={submitEmployee}>
                    <div className="form-title"><h2>{editingId ? 'Edit Employee' : 'Add Employee'}</h2><p>{editingId ? 'Update the details and save your changes.' : 'Enter the employee and project details.'}</p></div>
                    <label>Project<select required value={form.projectId || ''} onChange={(e) => updateField('projectId', Number(e.target.value))}><option value="" disabled>Select a project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.projectCode} · {project.name}</option>)}</select></label>
                    <label>Employee ID<input required value={form.employeeNumber} onChange={(e) => updateField('employeeNumber', e.target.value)} placeholder="e.g. E001" /></label>
                    <label>Name<input required value={form.name} onChange={(e) => updateField('name', e.target.value)} placeholder="Employee name" /></label>
                    <label>Country / Region<input required list="employee-regions" value={form.region} onChange={(e) => updateField('region', e.target.value)} placeholder="e.g. China, India, Philippines, USA" /><datalist id="employee-regions"><option value="China" /><option value="India" /><option value="Philippines" /><option value="USA" /></datalist></label>
                    <label>{salaryLabel(form.region)}<input required type="number" min="0" step="0.01" value={form.salary || ''} onChange={(e) => updateField('salary', Number(e.target.value))} placeholder={salaryPlaceholder(form.region)} /></label>
                    <label>Monthly Working Hours<input required type="number" min="1" step="1" value={form.monthlyWorkingHours || 168} onChange={(e) => updateField('monthlyWorkingHours', Number(e.target.value) || 168)} /></label>
                    <label>Join Date<input required type="date" value={form.joinDate} onChange={(e) => updateField('joinDate', e.target.value)} /></label>
                    <label>Leave Date<input type="date" min={form.joinDate} value={form.leaveDate} onChange={(e) => updateField('leaveDate', e.target.value)} /></label>
                    <label className="check-field"><input type="checkbox" checked={form.isShared} onChange={(e) => updateField('isShared', e.target.checked)} /><span>Shared Resource</span></label>
                    {form.isShared && <label>Shared Project<input required value={form.sharedProject} onChange={(e) => updateField('sharedProject', e.target.value)} placeholder="Enter shared project name" /></label>}
                    {form.isShared && <label>Shared Ratio (%)<input required type="number" min="1" max="100" value={form.sharedRatio || ''} onChange={(e) => updateField('sharedRatio', Number(e.target.value))} /></label>}
                    <label className="check-field"><input type="checkbox" checked={form.isContractor} onChange={(e) => updateField('isContractor', e.target.checked)} /><span>Contractor</span></label>
                    {form.isContractor && <label>Maximum End Date<input required type="date" min={form.joinDate} value={form.maximumEndDate} onChange={(e) => updateField('maximumEndDate', e.target.value)} /></label>}
                    <label className="check-field"><input type="checkbox" checked={form.hasC2C} onChange={(e) => { updateField('hasC2C', e.target.checked); if (!e.target.checked) setC2CContract(null); }} /><span>C2C Agreement Signed</span></label>
                    {form.hasC2C && <label className="contract-upload">C2C Contract (PDF)<input required={!editingId || !employees.find(({ id }) => id === editingId)?.c2cContractName} type="file" accept="application/pdf,.pdf" onChange={(e) => setC2CContract(e.target.files?.[0] || null)} />{editingId && employees.find(({ id }) => id === editingId)?.c2cContractName && !c2cContract && <small>Current: {employees.find(({ id }) => id === editingId)?.c2cContractName}. Select a PDF to replace it.</small>}</label>}
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
                        <button className={selectedProject === String(project.id) ? 'active' : ''} key={project.id} onClick={() => { setSelectedProject(String(project.id)); setSelectedEmployeeIds([]); }}>
                            <span className="nested-project">{project.name}</span><b>{employees.filter((item) => item.projectId === project.id).length}</b>
                        </button>
                    ))}
                    {!projects.length && <p>Create a project in Project Management first.</p>}
                </aside>

                <div className="employee-list">
                    <div className="list-header"><div><h2>{hasActiveProject ? getProject(Number(selectedProject))?.name || 'Project Employees' : 'All Employees'}</h2><p>{`${filteredEmployees.length} employee${filteredEmployees.length === 1 ? '' : 's'}`}</p></div>
                        <div className="header-actions">
                            {hasActiveProject && (
                                <button className="secondary-button salary-project-toggle" type="button" disabled={!projectEmployees.length} aria-pressed={allSalariesVisible} title="Toggle salaries for every employee in this project, across all pages" onClick={() => setSalaryVisibility({ project: selectedProject, ids: allSalariesVisible ? [] : projectEmployees.map(({ id }) => id) })}>
                                    {allSalariesVisible ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                                    {allSalariesVisible ? 'Hide All Salaries' : 'Show All Salaries'}
                                </button>
                            )}
                            <input type="search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search by employee ID or name" aria-label="Search by employee ID or name" className="employee-search" />
                            {filteredEmployees.length > 0 && (
                                <button className="secondary-button" type="button" onClick={selectAllVisibleEmployees}>
                                    {pagedEmployees.every(({ id }) => selectedEmployeeIds.indexOf(id) >= 0) ? 'Clear Selection' : 'Select All'}
                                </button>
                            )}
                            {hasActiveProject && (
                                <button className="secondary-button" type="button" onClick={() => exportRowsToExcel(filteredEmployees, `${getProject(Number(selectedProject))?.projectCode || 'project'}-employees.xlsx`)}>Export Project</button>
                            )}
                        </div>
                    </div>
                    {error && <div className="notice error">{error}</div>}
                    {success && <div className="notice success">{success}</div>}
                    {!projects.length && !loading && <div className="project-required"><strong>Create a Project First</strong><span>A project is required before employees can be added.</span><Link className="primary-button" to="/projects">Create Project</Link></div>}
                    {loading ? <div className="empty-state">Loading employees…</div> : !projects.length ? null : filteredEmployees.length === 0 ? (
                        <div className="empty-state"><span>👥</span><h3>No Matching Employees</h3><p>Try a different employee name or choose another project.</p></div>
                    ) : (
                        <div className="table-panel">
                            <div className="table-wrap"><table className="employee-table"><thead><tr><th><input type="checkbox" checked={pagedEmployees.length > 0 && pagedEmployees.every(({ id }) => selectedEmployeeIds.indexOf(id) >= 0)} onChange={selectAllVisibleEmployees} aria-label="Select all visible employees" /></th><th>Employee ID</th><th>Name</th><th>Region</th><th>Salary</th><th>Join Date</th><th>Leave Date</th><th>Project</th><th>Shared</th><th>Shared Project</th><th>Shared Ratio</th><th>Contractor</th><th>Maximum End Date</th><th>C2C</th><th>Action</th></tr></thead><tbody>
                                {pagedEmployees.map((employee) => {
                                    const returnTo = selectedProject && selectedProject !== 'all' ? `/employees?project=${selectedProject}` : '/employees';
                                    return <tr className={contractorStatus(employee)?.urgent ? 'contractor-expiring' : ''} key={employee.id}>
                                        <td><input type="checkbox" checked={selectedEmployeeIds.indexOf(employee.id) >= 0} onChange={() => toggleEmployeeSelection(employee.id)} aria-label={`Select ${employee.name}`} /></td>
                                        <td><Link className="employee-detail-link" to={{ pathname: `/employees/${employee.id}`, state: { returnTo } }}><strong>{employee.employeeNumber}</strong></Link></td>
                                        <td><Link className="employee-detail-link" to={{ pathname: `/employees/${employee.id}`, state: { returnTo } }}>{employee.name}</Link></td>
                                        <td>{employee.region}</td><td>{renderSalary(employee)}</td><td>{employee.joinDate}</td><td>{employee.leaveDate || '—'}</td><td><span className="project-tag">{getProject(employee.projectId)?.name || 'Unknown Project'}</span></td><td><span className={`reuse-badge ${employee.isShared ? 'yes' : ''}`}>{employee.isShared ? 'Yes' : 'No'}</span></td><td>{employee.isShared ? employee.sharedProject || '—' : '—'}</td><td>{employee.isShared ? `${employee.sharedRatio}%` : '—'}</td><td><span className={`reuse-badge ${employee.isContractor ? 'contractor' : ''}`}>{employee.isContractor ? 'Yes' : 'No'}</span></td><td>{employee.isContractor ? <span className={contractorStatus(employee)?.urgent ? 'expiry-date' : ''}>{employee.maximumEndDate || '—'}{contractorStatus(employee) && <small>{contractorStatus(employee)?.text}</small>}</span> : '—'}</td><td><span className={`reuse-badge ${employee.hasC2C ? 'yes' : ''}`}>{employee.hasC2C ? 'Yes' : 'No'}</span></td><td><div className="row-actions"><button className="edit-button" onClick={() => editEmployee(employee)}>Edit</button><button className="delete-button" onClick={() => deleteEmployee(employee)}>Delete</button></div></td>
                                    </tr>;
                                })}
                            </tbody></table></div>
                            <div className="pagination-row">
                                <button className="secondary-button" type="button" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button>
                                <span>Page {page} / {totalPages}</span>
                                <button className="secondary-button" type="button" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Next</button>
                            </div>
                        </div>
                    )}
                </div>
            </section>
        </main>
    );
};

export default EmployeesPage;
