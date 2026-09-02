import React, { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

export interface Project {
    id: number;
    projectCode: string;
    name: string;
    pm: string;
}

const ProjectsPage: React.FC = () => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [form, setForm] = useState({ projectCode: '', name: '', pm: '' });
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const openCreateForm = () => {
        setForm({ projectCode: '', name: '', pm: '' });
        setEditingId(null);
        setError('');
        setShowForm(true);
    };

    const openEditForm = (project: Project) => {
        setForm({ projectCode: project.projectCode, name: project.name, pm: project.pm });
        setEditingId(project.id);
        setError('');
        setShowForm(true);
        window.scrollTo({ top: 140, behavior: 'smooth' });
    };

    useEffect(() => {
        fetch('/api/projects')
            .then((response) => {
                if (!response.ok) throw new Error('Failed to load projects');
                return response.json();
            })
            .then(setProjects)
            .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load projects'))
            .then(() => setLoading(false));
    }, []);

    const submitProject = async (event: FormEvent) => {
        event.preventDefault();
        setError('');
        if (projects.some(({ id, projectCode }) => id !== editingId && projectCode.toLowerCase() === form.projectCode.trim().toLowerCase())) {
            setError('This project code already exists. Please use a different code.');
            return;
        }

        try {
            const response = await fetch(editingId ? `/api/projects/${editingId}` : '/api/projects', {
                method: editingId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectCode: form.projectCode.trim(),
                    name: form.name.trim(),
                    pm: form.pm.trim(),
                }),
            });
            if (!response.ok) throw new Error(editingId ? 'Failed to update project' : 'Failed to create project');
            const project: Project = await response.json();
            setProjects((current) => editingId
                ? current.map((item) => item.id === project.id ? project : item)
                : [...current, project]
            );
            setForm({ projectCode: '', name: '', pm: '' });
            setEditingId(null);
            setShowForm(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : editingId ? 'Failed to update project' : 'Failed to create project');
        }
    };

    const deleteProject = async (project: Project) => {
        setError('');
        try {
            const employeesResponse = await fetch('/api/employees');
            if (!employeesResponse.ok) throw new Error('Unable to check project employees');
            const employees: { projectId: number }[] = await employeesResponse.json();
            const employeeCount = employees.filter(({ projectId }) => projectId === project.id).length;
            if (employeeCount > 0) {
                setError(`“${project.name}” has ${employeeCount} employee${employeeCount === 1 ? '' : 's'}. Move them to another project before deleting it.`);
                return;
            }
            if (!window.confirm(`Delete “${project.name}”? This action cannot be undone.`)) return;
            const response = await fetch(`/api/projects/${project.id}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Failed to delete project');
            setProjects((current) => current.filter(({ id }) => id !== project.id));
            if (editingId === project.id) {
                setEditingId(null);
                setShowForm(false);
                setForm({ projectCode: '', name: '', pm: '' });
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete project');
        }
    };

    return (
        <main className="employees-page">
            <header>
                <Link className="brand brand-link" to="/"><span>PM</span> ProjectFlow</Link>
                <Link className="back-link" to="/">← Home</Link>
            </header>
            <section className="employees-heading">
                <div>
                    <p className="eyebrow">PROJECT MANAGEMENT</p>
                    <h1>Projects</h1>
                    <p className="subtitle">Create projects, assign employees, and monitor profitability.</p>
                </div>
                <button className="primary-button" onClick={() => { if (showForm) { setShowForm(false); setEditingId(null); } else openCreateForm(); }}>
                    {showForm ? 'Cancel' : '＋ Create Project'}
                </button>
            </section>

            {showForm && (
                <form className="employee-form project-form" onSubmit={submitProject}>
                    <div className="form-title"><h2>{editingId ? 'Edit Project' : 'Create Project'}</h2><p>The project code must be unique.</p></div>
                    <label>Project Code<input required maxLength={30} value={form.projectCode} onChange={(e) => setForm({ ...form, projectCode: e.target.value })} placeholder="e.g. PRJ-001" /></label>
                    <label>Project Name<input required maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Smart Operations Platform" /></label>
                    <label>Project PM<input required maxLength={50} value={form.pm} onChange={(e) => setForm({ ...form, pm: e.target.value })} placeholder="PM name" /></label>
                    <div className="form-actions"><button className="primary-button" type="submit">{editingId ? 'Save Changes' : 'Save Project'}</button></div>
                </form>
            )}

            <section className="projects-content">
                <div className="list-header project-list-header">
                    <div><h2>All Projects</h2><p>{projects.length} project{projects.length === 1 ? '' : 's'}</p></div>
                    <div className="header-actions">
                        {!!projects.length && <button className="secondary-button" onClick={openCreateForm}>＋ Create Another</button>}
                        {!!projects.length && <Link className="secondary-button" to="/employees">Add Employee →</Link>}
                    </div>
                </div>
                {error && <div className="notice error">{error}</div>}
                {loading ? <div className="empty-state">Loading projects…</div> : projects.length === 0 ? (
                    <div className="empty-state"><span>📋</span><h3>No Projects Yet</h3><p>Click “Create Project” to add a code, name, and PM.</p></div>
                ) : (
                    <div className="project-cards">
                        {projects.map((project) => (
                            <article className="project-item" key={project.id}>
                                <div className="project-code">{project.projectCode}</div>
                                <h2>{project.name}</h2>
                                <div className="pm-row"><span>{project.pm.slice(0, 1).toUpperCase()}</span><div><small>PROJECT MANAGER</small><strong>{project.pm}</strong></div></div>
                                <div className="project-links"><Link to={`/projects/${project.id}/profit`}>View Profitability <b>→</b></Link><Link to={`/employees?project=${project.id}`}>View Employees <b>→</b></Link></div>
                                <div className="project-actions"><button className="edit-button" onClick={() => openEditForm(project)}>Edit</button><button className="delete-button" onClick={() => deleteProject(project)}>Delete</button></div>
                            </article>
                        ))}
                    </div>
                )}
            </section>
        </main>
    );
};

export default ProjectsPage;
