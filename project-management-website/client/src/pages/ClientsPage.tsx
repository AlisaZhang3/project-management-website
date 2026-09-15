import React, { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Project } from './ProjectsPage';

export interface Client {
    id: number;
    projectId: number;
    name: string;
    title: string;
    managerLevel: string;
    region: string;
    notes?: string;
    email?: string;
    phone?: string;
}

interface ClientForm {
    projectId: number | '';
    name: string;
    title: string;
    managerLevel: string;
    region: string;
    notes: string;
}

const emptyForm: ClientForm = {
    projectId: '',
    name: '',
    title: '',
    managerLevel: 'VP',
    region: 'USA',
    notes: '',
};

const COMMON_MANAGER_LEVELS = ['CVP', 'VP', 'GM', 'Director', 'Partner Director', 'Senior Director'];
const COMMON_REGIONS = ['USA', 'China', 'India', 'Singapore', 'UK', 'Japan', 'Europe'];

const ClientsPage: React.FC = () => {
    const [clients, setClients] = useState<Client[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [form, setForm] = useState<ClientForm>(emptyForm);
    const [selectedProject, setSelectedProject] = useState<string>('all');
    const [projectsExpanded, setProjectsExpanded] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [orgChartExpanded, setOrgChartExpanded] = useState(true);
    const [uploadingChart, setUploadingChart] = useState(false);
    const [previewModalImg, setPreviewModalImg] = useState<{ src: string; title: string } | null>(null);
    const [modalZoom, setModalZoom] = useState(1);
    const [isDragOver, setIsDragOver] = useState(false);

    const orgChartInputRef = useRef<HTMLInputElement | null>(null);
    const targetUploadProjectIdRef = useRef<number | null>(null);
    const location = useLocation();

    const loadData = async () => {
        try {
            const [clientResponse, projectResponse] = await Promise.all([
                fetch('/api/clients'),
                fetch('/api/projects'),
            ]);

            if (!clientResponse.ok || !projectResponse.ok) throw new Error('Failed to load clients and projects');
            const [clientData, projectData]: [Client[], Project[]] = await Promise.all([
                clientResponse.json(),
                projectResponse.json(),
            ]);

            setClients(clientData);
            setProjects(projectData);

            const requestedProject = Number(new URLSearchParams(location.search).get('project'));
            if (requestedProject && projectData.some(({ id }) => id === requestedProject)) {
                setSelectedProject(String(requestedProject));
            }
            setError('');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load client data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const getProject = (projectId: number) => projects.find(({ id }) => id === projectId);

    const activeProject = useMemo(() => {
        if (selectedProject === 'all') return null;
        return getProject(Number(selectedProject)) || null;
    }, [selectedProject, projects]);

    const filteredClients = useMemo(() => {
        return clients.filter((client) => {
            if (selectedProject !== 'all' && client.projectId !== Number(selectedProject)) {
                return false;
            }

            if (searchTerm.trim()) {
                const term = searchTerm.trim().toLowerCase();
                const projectName = getProject(client.projectId)?.name.toLowerCase() || '';
                const projectCode = getProject(client.projectId)?.projectCode.toLowerCase() || '';
                const matchName = (client.name || '').toLowerCase().includes(term);
                const matchTitle = (client.title || '').toLowerCase().includes(term);
                const matchManager = (client.managerLevel || '').toLowerCase().includes(term);
                const matchRegion = (client.region || '').toLowerCase().includes(term);
                const matchNotes = (client.notes || '').toLowerCase().includes(term);
                return matchName || matchTitle || matchManager || matchRegion || matchNotes || projectName.includes(term) || projectCode.includes(term);
            }

            return true;
        });
    }, [clients, selectedProject, searchTerm, projects]);

    const handleOrgChartUpload = async (file: File, projectId?: number) => {
        const targetId = projectId || (activeProject ? activeProject.id : projects[0]?.id);
        if (!targetId) {
            setError('Please select or create a project before uploading an org chart screenshot.');
            return;
        }

        if (!file.type.startsWith('image/') && !file.name.match(/\.(png|jpe?g|webp|gif|svg)$/i)) {
            setError('Please upload a valid image file (PNG, JPG, WEBP, GIF, SVG).');
            return;
        }

        setUploadingChart(true);
        setError('');
        setSuccess('');

        try {
            const fileName = file.name || 'org-chart-screenshot.png';
            const response = await fetch(`/api/projects/${targetId}/client-org-chart`, {
                method: 'PUT',
                headers: {
                    'Content-Type': file.type || 'image/png',
                    'X-File-Name': encodeURIComponent(fileName),
                },
                body: file,
            });

            if (!response.ok) {
                const msg = await response.text();
                throw new Error(msg || 'Failed to upload organization chart image');
            }

            const updatedProject: Project = await response.json();
            setProjects((current) => current.map((p) => (p.id === updatedProject.id ? updatedProject : p)));
            setSuccess(`Uploaded organization chart for “${updatedProject.name}” successfully.`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to upload organization chart screenshot');
        } finally {
            setUploadingChart(false);
            if (orgChartInputRef.current) {
                orgChartInputRef.current.value = '';
            }
        }
    };

    const handleDeleteOrgChart = async (projectId: number) => {
        const project = getProject(projectId);
        if (!window.confirm(`Delete the organization chart screenshot for “${project?.name || 'this project'}”?`)) return;

        setError('');
        setSuccess('');
        try {
            const response = await fetch(`/api/projects/${projectId}/client-org-chart`, {
                method: 'DELETE',
            });
            if (!response.ok) throw new Error('Failed to delete organization chart');

            const updatedProject: Project = await response.json();
            setProjects((current) => current.map((p) => (p.id === updatedProject.id ? updatedProject : p)));
            setSuccess(`Deleted organization chart for “${updatedProject.name}”.`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete organization chart');
        }
    };

    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            const items = e.clipboardData?.items;
            if (!items) return;

            for (let i = 0; i < items.length; i++) {
                if (items[i].type.startsWith('image/')) {
                    const file = items[i].getAsFile();
                    if (file) {
                        e.preventDefault();
                        const targetId = activeProject ? activeProject.id : projects[0]?.id;
                        if (targetId) {
                            handleOrgChartUpload(file, targetId);
                        } else {
                            setError('Please select a project before pasting the org chart screenshot.');
                        }
                        break;
                    }
                }
            }
        };

        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [activeProject, projects]);

    const openCreateForm = () => {
        setForm({
            ...emptyForm,
            projectId: selectedProject !== 'all' ? Number(selectedProject) : (projects[0]?.id || ''),
        });
        setEditingId(null);
        setError('');
        setSuccess('');
        setShowForm(true);
    };

    const openEditForm = (client: Client) => {
        setForm({
            projectId: client.projectId,
            name: client.name || '',
            title: client.title || '',
            managerLevel: client.managerLevel || '',
            region: client.region || '',
            notes: client.notes || '',
        });
        setEditingId(client.id);
        setError('');
        setSuccess('');
        setShowForm(true);
        window.scrollTo({ top: 140, behavior: 'smooth' });
    };

    const submitClient = async (event: FormEvent) => {
        event.preventDefault();
        setError('');
        setSuccess('');

        if (!form.projectId) {
            setError('Please select a project for this client.');
            return;
        }

        const payload = {
            projectId: Number(form.projectId),
            name: form.name.trim(),
            title: form.title.trim(),
            managerLevel: form.managerLevel.trim(),
            region: form.region.trim(),
            notes: form.notes.trim(),
        };

        try {
            const response = await fetch(editingId ? `/api/clients/${editingId}` : '/api/clients', {
                method: editingId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) throw new Error(editingId ? 'Failed to update client' : 'Failed to create client');
            const savedClient: Client = await response.json();

            setClients((current) => editingId
                ? current.map((item) => (item.id === savedClient.id ? savedClient : item))
                : [...current, savedClient]
            );

            setSuccess(editingId ? `Updated client “${savedClient.name}” successfully.` : `Added client “${savedClient.name}” successfully.`);
            setForm(emptyForm);
            setEditingId(null);
            setShowForm(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : editingId ? 'Failed to update client' : 'Failed to create client');
        }
    };

    const deleteClient = async (client: Client) => {
        if (!window.confirm(`Delete client “${client.name}”? This action cannot be undone.`)) return;
        setError('');
        setSuccess('');

        try {
            const response = await fetch(`/api/clients/${client.id}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Failed to delete client');

            setClients((current) => current.filter(({ id }) => id !== client.id));
            setSuccess(`Deleted client “${client.name}”.`);
            if (editingId === client.id) {
                setEditingId(null);
                setShowForm(false);
                setForm(emptyForm);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete client');
        }
    };

    const managerBadgeClass = (level: string) => {
        const normalized = (level || '').trim().toUpperCase();
        if (normalized.includes('CVP')) return 'manager-badge badge-cvp';
        if (normalized.includes('VP')) return 'manager-badge badge-vp';
        if (normalized.includes('GM')) return 'manager-badge badge-gm';
        if (normalized.includes('DIRECTOR')) return 'manager-badge badge-director';
        return 'manager-badge badge-other';
    };

    const triggerFileInput = (projectId?: number) => {
        targetUploadProjectIdRef.current = projectId || null;
        orgChartInputRef.current?.click();
    };

    return (
        <main className="employees-page clients-page">
            <header>
                <nav className="page-nav">
                    <Link className="back-link" to="/projects">Projects</Link>
                    <Link className="back-link" to="/employees">Employees</Link>
                    <Link className="back-link" to="/">← Home</Link>
                </nav>
            </header>

            <section className="employees-heading">
                <div>
                    <p className="eyebrow">CLIENT MANAGEMENT</p>
                    <h1>Clients</h1>
                    <p className="subtitle">Maintain client contacts, executive managers (CVP/VP/GM), regions, and notes by project.</p>
                </div>
                <div className="header-actions">
                    <button
                        className="primary-button"
                        disabled={!projects.length}
                        title={!projects.length ? 'Create a project first' : ''}
                        onClick={() => {
                            if (showForm) {
                                setShowForm(false);
                                setEditingId(null);
                            } else {
                                openCreateForm();
                            }
                        }}
                    >
                        {showForm ? 'Cancel' : '＋ Add Client'}
                    </button>
                </div>
            </section>

            <input
                ref={orgChartInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                        handleOrgChartUpload(file, targetUploadProjectIdRef.current || undefined);
                    }
                }}
            />

            {showForm && (
                <form className="employee-form client-form" onSubmit={submitClient}>
                    <div className="form-title">
                        <h2>{editingId ? 'Edit Client Info' : 'Add Client Info'}</h2>
                        <p>{editingId ? 'Update the client contact, reporting manager, region, and notes.' : 'Enter the client contact details and associated project.'}</p>
                    </div>

                    <label>
                        Project
                        <select
                            required
                            value={form.projectId}
                            onChange={(e) => setForm({ ...form, projectId: Number(e.target.value) })}
                        >
                            <option value="" disabled>Select a project</option>
                            {projects.map((project) => (
                                <option key={project.id} value={project.id}>
                                    {project.projectCode} · {project.name}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label>
                        Client Name
                        <input
                            required
                            maxLength={80}
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            placeholder="e.g. Sarah Jenkins"
                        />
                    </label>

                    <label>
                        Position / Title
                        <input
                            required
                            maxLength={100}
                            value={form.title}
                            onChange={(e) => setForm({ ...form, title: e.target.value })}
                            placeholder="e.g. Principal PM / Engineering Lead"
                        />
                    </label>

                    <label>
                        Reporting Manager (e.g. CVP, VP, GM)
                        <input
                            required
                            list="client-manager-levels"
                            maxLength={60}
                            value={form.managerLevel}
                            onChange={(e) => setForm({ ...form, managerLevel: e.target.value })}
                            placeholder="e.g. CVP, VP, GM, Director"
                        />
                        <datalist id="client-manager-levels">
                            {COMMON_MANAGER_LEVELS.map((lvl) => (
                                <option key={lvl} value={lvl} />
                            ))}
                        </datalist>
                    </label>

                    <label>
                        Country / Region
                        <input
                            required
                            list="client-regions"
                            maxLength={60}
                            value={form.region}
                            onChange={(e) => setForm({ ...form, region: e.target.value })}
                            placeholder="e.g. USA, China, India"
                        />
                        <datalist id="client-regions">
                            {COMMON_REGIONS.map((reg) => (
                                <option key={reg} value={reg} />
                            ))}
                        </datalist>
                    </label>

                    <label className="client-notes-field">
                        Client Remarks / Notes
                        <textarea
                            rows={3}
                            value={form.notes}
                            onChange={(e) => setForm({ ...form, notes: e.target.value })}
                            placeholder="Add specific notes, project expectations, communication preferences, or background info for this client..."
                        />
                    </label>

                    <div className="form-actions">
                        <button className="primary-button" type="submit">
                            {editingId ? 'Save Changes' : 'Save Client'}
                        </button>
                    </div>
                </form>
            )}

            <section className="employee-content">
                <aside className="project-filter">
                    <h3>Projects</h3>
                    <button
                        className={selectedProject === 'all' ? 'active all-projects-button' : 'all-projects-button'}
                        onClick={() => {
                            setSelectedProject('all');
                            setProjectsExpanded((value) => !value);
                        }}
                    >
                        <span>
                            <i className={projectsExpanded ? 'expanded' : ''}>›</i> All Projects
                        </span>
                        <b>{clients.length}</b>
                    </button>

                    {projectsExpanded && projects.map((project) => {
                        const projectClientsCount = clients.filter((c) => c.projectId === project.id).length;
                        return (
                            <button
                                className={selectedProject === String(project.id) ? 'active' : ''}
                                key={project.id}
                                onClick={() => setSelectedProject(String(project.id))}
                            >
                                <span className="nested-project">{project.name}</span>
                                <b>{projectClientsCount}</b>
                            </button>
                        );
                    })}

                    {!projects.length && <p>Create a project in Project Management first.</p>}
                </aside>

                <div className="employee-list client-list-container">
                    {/* Organization Structure Screenshot Section */}
                    <div className="client-org-chart-section">
                        <div className="org-chart-header">
                            <div className="org-chart-title-wrap">
                                <span className="org-chart-icon">🏛️</span>
                                <div>
                                    <h3>
                                        {activeProject
                                            ? `Client Organization Structure · ${activeProject.name}`
                                            : 'Client Organization Structure (客户组织结构图)'}
                                    </h3>
                                    <p>
                                        {activeProject
                                            ? `Screenshot & hierarchy for project ${activeProject.projectCode} (支持直接截图按 Ctrl+V 粘贴导入)`
                                            : 'Select a project to view or import its client reporting hierarchy screenshot.'}
                                    </p>
                                </div>
                            </div>
                            <div className="org-chart-header-actions">
                                {activeProject && (
                                    <button
                                        type="button"
                                        className="secondary-button btn-sm"
                                        onClick={() => triggerFileInput(activeProject.id)}
                                        disabled={uploadingChart}
                                    >
                                        {uploadingChart
                                            ? 'Uploading…'
                                            : activeProject.clientOrgChartName
                                                ? '🔄 Replace Screenshot'
                                                : '📷 Import Screenshot'}
                                    </button>
                                )}
                                <button
                                    type="button"
                                    className="toggle-collapse-btn"
                                    onClick={() => setOrgChartExpanded((val) => !val)}
                                    title={orgChartExpanded ? 'Collapse Org Structure' : 'Expand Org Structure'}
                                >
                                    {orgChartExpanded ? '▲' : '▼'}
                                </button>
                            </div>
                        </div>

                        {orgChartExpanded && (
                            <div className="org-chart-body">
                                {activeProject ? (
                                    activeProject.clientOrgChartName ? (
                                        <div className="org-chart-card">
                                            <div className="org-chart-preview-wrap">
                                                <img
                                                    src={`/api/projects/${activeProject.id}/client-org-chart?t=${activeProject.clientOrgChartUploadedAt || Date.now()}`}
                                                    alt={`Client Org Structure - ${activeProject.name}`}
                                                    className="org-chart-preview-img"
                                                    onClick={() => {
                                                        setModalZoom(1);
                                                        setPreviewModalImg({
                                                            src: `/api/projects/${activeProject.id}/client-org-chart`,
                                                            title: `${activeProject.projectCode} · ${activeProject.name} - Client Org Structure`,
                                                        });
                                                    }}
                                                />
                                                <div className="org-chart-floating-bar">
                                                    <button
                                                        type="button"
                                                        className="chart-action-btn"
                                                        onClick={() => {
                                                            setModalZoom(1);
                                                            setPreviewModalImg({
                                                                src: `/api/projects/${activeProject.id}/client-org-chart`,
                                                                title: `${activeProject.projectCode} · ${activeProject.name} - Client Org Structure`,
                                                            });
                                                        }}
                                                    >
                                                        🔍 Full Size / 放大查看
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="chart-action-btn"
                                                        onClick={() => triggerFileInput(activeProject.id)}
                                                    >
                                                        🔄 Replace
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="chart-action-btn btn-danger"
                                                        onClick={() => handleDeleteOrgChart(activeProject.id)}
                                                    >
                                                        🗑 Remove
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="org-chart-meta">
                                                <span>
                                                    <strong>File:</strong> {activeProject.clientOrgChartName}
                                                </span>
                                                {activeProject.clientOrgChartUploadedAt && (
                                                    <span>
                                                        <strong>Uploaded:</strong>{' '}
                                                        {new Date(activeProject.clientOrgChartUploadedAt).toLocaleString()}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div
                                            className={`org-chart-dropzone ${isDragOver ? 'drag-over' : ''}`}
                                            onDragOver={(e) => {
                                                e.preventDefault();
                                                setIsDragOver(true);
                                            }}
                                            onDragLeave={() => setIsDragOver(false)}
                                            onDrop={(e) => {
                                                e.preventDefault();
                                                setIsDragOver(false);
                                                const file = e.dataTransfer.files?.[0];
                                                if (file) handleOrgChartUpload(file, activeProject.id);
                                            }}
                                            onClick={() => triggerFileInput(activeProject.id)}
                                        >
                                            <div className="dropzone-content">
                                                <span className="dropzone-icon">🖼️</span>
                                                <h4>Import Client Organization Structure Screenshot</h4>
                                                <p>
                                                    Click to browse, drag & drop an image screenshot here, or press{' '}
                                                    <kbd>Ctrl+V</kbd> to paste directly from clipboard.
                                                </p>
                                                <button
                                                    type="button"
                                                    className="primary-button btn-sm"
                                                    disabled={uploadingChart}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        triggerFileInput(activeProject.id);
                                                    }}
                                                >
                                                    {uploadingChart ? 'Uploading…' : '＋ Select Screenshot Image'}
                                                </button>
                                            </div>
                                        </div>
                                    )
                                ) : (
                                    /* All Projects View */
                                    <div className="org-chart-all-projects-overview">
                                        <div className="overview-projects-list">
                                            {projects.map((proj) => (
                                                <div
                                                    key={proj.id}
                                                    className={`project-chart-mini-card ${proj.clientOrgChartName ? 'has-chart' : ''}`}
                                                    onClick={() => setSelectedProject(String(proj.id))}
                                                >
                                                    <div className="mini-card-head">
                                                        <span className="project-code">{proj.projectCode}</span>
                                                        <strong>{proj.name}</strong>
                                                    </div>
                                                    {proj.clientOrgChartName ? (
                                                        <div className="mini-chart-thumb-wrap">
                                                            <img
                                                                src={`/api/projects/${proj.id}/client-org-chart?t=${proj.clientOrgChartUploadedAt || Date.now()}`}
                                                                alt={proj.name}
                                                                className="mini-chart-thumb"
                                                            />
                                                            <span className="view-badge">View Org Chart →</span>
                                                        </div>
                                                    ) : (
                                                        <div className="mini-chart-empty">
                                                            <span>No org screenshot yet</span>
                                                            <button
                                                                type="button"
                                                                className="secondary-button btn-xs"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    triggerFileInput(proj.id);
                                                                }}
                                                            >
                                                                ＋ Upload
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="list-header">
                        <div>
                            <h2>
                                {selectedProject === 'all'
                                    ? 'All Clients'
                                    : `${getProject(Number(selectedProject))?.name || 'Project'} Clients`}
                            </h2>
                            <p>
                                {filteredClients.length} client {filteredClients.length === 1 ? 'contact' : 'contacts'}
                                {selectedProject !== 'all' ? ` in ${getProject(Number(selectedProject))?.projectCode}` : ''}
                            </p>
                        </div>
                        <div className="header-actions">
                            <input
                                type="search"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search client, title, manager, region, notes..."
                                aria-label="Search clients"
                                className="employee-search client-search-box"
                            />
                        </div>
                    </div>

                    {error && <div className="notice error">{error}</div>}
                    {success && <div className="notice success">{success}</div>}

                    {!projects.length && !loading && (
                        <div className="project-required">
                            <strong>Create a Project First</strong>
                            <span>A project is required before clients can be added.</span>
                            <Link className="primary-button" to="/projects">Create Project</Link>
                        </div>
                    )}

                    {loading ? (
                        <div className="empty-state">Loading client information…</div>
                    ) : filteredClients.length === 0 ? (
                        <div className="empty-state">
                            <span>🤝</span>
                            <h3>No Clients Found</h3>
                            <p>
                                {searchTerm
                                    ? 'Try clearing the search query.'
                                    : 'Click “Add Client” to record client stakeholders for this project.'}
                            </p>
                            {searchTerm && (
                                <button
                                    className="secondary-button empty-action"
                                    type="button"
                                    onClick={() => setSearchTerm('')}
                                >
                                    Clear Search
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="table-panel">
                            <div className="table-wrap">
                                <table className="employee-table client-table">
                                    <thead>
                                        <tr>
                                            <th>Client Name</th>
                                            <th>Project</th>
                                            <th>Position / Title</th>
                                            <th>Reporting Manager</th>
                                            <th>Region</th>
                                            <th>Notes / Remarks</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredClients.map((client) => {
                                            const project = getProject(client.projectId);
                                            return (
                                                <tr key={client.id}>
                                                    <td>
                                                        <div className="client-name-cell">
                                                            <div className="client-avatar">
                                                                {(client.name || 'C').slice(0, 1).toUpperCase()}
                                                            </div>
                                                            <strong className="client-name-text">{client.name}</strong>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span className="project-tag" title={project?.name}>
                                                            {project?.projectCode || '—'} · {project?.name || 'Unknown'}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span className="client-title-text">{client.title || '—'}</span>
                                                    </td>
                                                    <td>
                                                        <span className={managerBadgeClass(client.managerLevel)}>
                                                            {client.managerLevel || '—'}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span className="client-region-tag">{client.region || '—'}</span>
                                                    </td>
                                                    <td>
                                                        <div className="client-notes-cell" title={client.notes}>
                                                            {client.notes ? (
                                                                <span className="client-note-bubble">{client.notes}</span>
                                                            ) : (
                                                                <span className="text-muted">—</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="row-actions">
                                                            <button
                                                                className="edit-button"
                                                                type="button"
                                                                onClick={() => openEditForm(client)}
                                                            >
                                                                Edit
                                                            </button>
                                                            <button
                                                                className="delete-button"
                                                                type="button"
                                                                onClick={() => deleteClient(client)}
                                                            >
                                                                Delete
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </section>

            {/* High-Resolution Modal for Full-Size Org Chart Preview */}
            {previewModalImg && (
                <div className="org-chart-modal-backdrop" onClick={() => setPreviewModalImg(null)}>
                    <div className="org-chart-modal-window" onClick={(e) => e.stopPropagation()}>
                        <div className="org-chart-modal-header">
                            <h4>{previewModalImg.title}</h4>
                            <div className="modal-zoom-controls">
                                <button
                                    type="button"
                                    className="secondary-button btn-xs"
                                    onClick={() => setModalZoom((z) => Math.max(0.4, z - 0.2))}
                                >
                                    － Zoom Out
                                </button>
                                <span className="zoom-level-text">{Math.round(modalZoom * 100)}%</span>
                                <button
                                    type="button"
                                    className="secondary-button btn-xs"
                                    onClick={() => setModalZoom((z) => Math.min(3, z + 0.2))}
                                >
                                    ＋ Zoom In
                                </button>
                                <button
                                    type="button"
                                    className="secondary-button btn-xs"
                                    onClick={() => setModalZoom(1)}
                                >
                                    Reset
                                </button>
                                <button
                                    type="button"
                                    className="modal-close-btn"
                                    onClick={() => setPreviewModalImg(null)}
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                        <div className="org-chart-modal-img-container">
                            <img
                                src={previewModalImg.src}
                                alt="Full Size Client Organization Structure"
                                style={{ transform: `scale(${modalZoom})`, transformOrigin: 'top center' }}
                                className="org-chart-modal-image"
                            />
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
};

export default ClientsPage;
