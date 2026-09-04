import React, { useEffect, useState } from 'react';
import { BrowserRouter, Link, Route, Switch } from 'react-router-dom';
import EmployeesPage from './pages/EmployeesPage';
import EmployeeDetailPage from './pages/EmployeeDetailPage';
import ProjectProfitPage from './pages/ProjectProfitPage';
import ProjectsPage from './pages/ProjectsPage';
import './index.css';

const sections = [
    { name: 'Employees', path: '/employees', icon: '👥', description: 'Manage your team and employment records' },
    { name: 'Clients', path: '/clients', icon: '🤝', description: 'Keep client details and contacts organized' },
    { name: 'Projects', path: '/projects', icon: '📋', description: 'Track schedules, budgets, and progress' },
    { name: 'Quotations', path: '/quotations', icon: '📝', description: 'Create and review project quotations' },
    { name: 'Invoices', path: '/invoices', icon: '🧾', description: 'Monitor invoices and payment status' },
    { name: 'Reports', path: '/reports', icon: '📊', description: 'Explore operational and financial insights' },
];

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
                <div className="brand"><span>PM</span> ProjectFlow</div>
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
        <Switch>
            <Route path="/employees/:id" component={EmployeeDetailPage} />
            <Route path="/employees" component={EmployeesPage} />
            <Route path="/projects/:id/profit" component={ProjectProfitPage} />
            <Route path="/projects" component={ProjectsPage} />
            <Route path="/" component={Home} />
        </Switch>
    </BrowserRouter>
);

export default App;