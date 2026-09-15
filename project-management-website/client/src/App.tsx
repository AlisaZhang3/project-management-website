import React, { useEffect, useState } from 'react';
import { BrowserRouter, Link, NavLink, Redirect, Route, Switch } from 'react-router-dom';
import EmployeesPage from './pages/EmployeesPage';
import EmployeeDetailPage from './pages/EmployeeDetailPage';
import ProjectProfitPage from './pages/ProjectProfitPage';
import ProjectsPage from './pages/ProjectsPage';
import ClientsPage from './pages/ClientsPage';
import QuotationsPage from './pages/QuotationsPage';
import Reports from './pages/ReportsPage';
import ContractsPage from './pages/ContractsPage';
import './index.css';

const sections = [
    { name: 'Employees', path: '/employees', icon: '👥', description: 'Manage your team and employment records' },
    { name: 'Clients', path: '/clients', icon: '🤝', description: 'Keep client details and contacts organized' },
    { name: 'Projects', path: '/projects', icon: '📋', description: 'Track schedules, budgets, and progress' },
    { name: 'Quotations', path: '/quotations', icon: '📝', description: 'Create and review project quotations' },
    { name: 'Contracts', path: '/contracts', icon: '📄', description: 'Manage project SOWs and purchase orders' },
    { name: 'Reports', path: '/reports', icon: '📊', description: 'Explore operational and financial insights' },
];

const Sidebar: React.FC = () => (
    <aside className="app-sidebar" aria-label="Main navigation">
        <Link className="sidebar-brand" to="/"><span>PM</span><strong>ProjectFlow</strong></Link>
        <nav className="sidebar-nav">
            <p>Workspace</p>
            {sections.map((section) => (
                <NavLink
                    key={section.path}
                    exact={section.path === '/'}
                    to={section.path}
                    activeClassName="active"
                    className="sidebar-link"
                >
                    <span className="sidebar-icon">{section.icon}</span>
                    <span>{section.name}</span>
                </NavLink>
            ))}
        </nav>
        <Link className="sidebar-home-link" to="/">← Home</Link>
    </aside>
);

const Home: React.FC = () => {
    const [apiOnline, setApiOnline] = useState(false);

    useEffect(() => {
        fetch('/api/health')
            .then((response) => setApiOnline(response.ok))
            .catch(() => setApiOnline(false));
    }, []);

    return (
        <main>
            <header>
                <div className={`status ${apiOnline ? 'online' : ''}`}>
                    <i /> {apiOnline ? 'API connected' : 'API unavailable'}
                </div>
            </header>
            <section className="hero">
                <p className="eyebrow">PROJECT MANAGEMENT</p>
                <h1>Everything your team needs,<br /><em>all in one place.</em></h1>
                <p className="subtitle">Plan projects, support clients, and keep your finances moving forward.</p>
            </section>
            <section className="grid">
                {sections.map((section) => (
                    <Link className="card" to={section.path} key={section.name}>
                        <span className="icon">{section.icon}</span>
                        <div><h2>{section.name}</h2><p>{section.description}</p></div>
                        <b>→</b>
                    </Link>
                ))}
            </section>
        </main>
    );
};

const App: React.FC = () => (
    <BrowserRouter>
        <div className="app-shell">
            <Sidebar />
            <div className="app-content">
                <Switch>
                    <Route path="/employees/:id" component={EmployeeDetailPage} />
                    <Route path="/employees" component={EmployeesPage} />
                    <Route path="/clients" component={ClientsPage} />
                    <Route path="/quotations" component={QuotationsPage} />
                    <Route path="/reports" component={Reports} />
                    <Route path="/contracts" component={ContractsPage} />
                    <Redirect from="/invoices" to="/contracts" />
                    <Route path="/projects/:id/profit" component={ProjectProfitPage} />
                    <Route path="/projects" component={ProjectsPage} />
                    <Route path="/" component={Home} />
                </Switch>
            </div>
        </div>
    </BrowserRouter>
);

export default App;