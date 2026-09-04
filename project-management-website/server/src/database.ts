import fs from 'fs';
import path from 'path';

interface Statement {
    all: (...params: unknown[]) => unknown[];
    get: (...params: unknown[]) => unknown;
    run: (...params: unknown[]) => { lastInsertRowid: number | bigint; changes: number };
}

interface SQLiteDatabase {
    exec: (sql: string) => void;
    prepare: (sql: string) => Statement;
}

interface StoredEntity {
    id: number;
    [key: string]: unknown;
}

type Resource = 'employees' | 'projects' | 'clients' | 'quotations' | 'invoices';

// Node 24 includes a native SQLite driver, so no external database service is required.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { DatabaseSync } = require('node:sqlite') as {
    DatabaseSync: new (filename: string) => SQLiteDatabase;
};

const dataDirectory = path.resolve(__dirname, '../data');
fs.mkdirSync(dataDirectory, { recursive: true });

export const databasePath = path.join(dataDirectory, 'project-management.db');
const database = new DatabaseSync(databasePath);

database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS entities (
        resource TEXT NOT NULL,
        id INTEGER NOT NULL,
        data TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (resource, id)
    );
    CREATE INDEX IF NOT EXISTS idx_entities_resource ON entities(resource);
`);

const decode = (row: unknown): StoredEntity | undefined => {
    if (!row) return undefined;
    const record = row as { id: number; data: string };
    return { ...JSON.parse(record.data), id: record.id } as StoredEntity;
};

export const entityStore = {
    list(resource: Resource): StoredEntity[] {
        return database.prepare('SELECT id, data FROM entities WHERE resource = ? ORDER BY id')
            .all(resource)
            .map(decode)
            .filter((entity): entity is StoredEntity => Boolean(entity));
    },

    get(resource: Resource, id: number): StoredEntity | undefined {
        return decode(database.prepare('SELECT id, data FROM entities WHERE resource = ? AND id = ?').get(resource, id));
    },

    create(resource: Resource, values: Record<string, unknown>): StoredEntity {
        const next = database.prepare('SELECT COALESCE(MAX(id), 0) + 1 AS id FROM entities WHERE resource = ?')
            .get(resource) as { id: number };
        const entity = { ...values, id: next.id };
        database.prepare('INSERT INTO entities (resource, id, data) VALUES (?, ?, ?)')
            .run(resource, next.id, JSON.stringify(entity));
        return entity;
    },

    update(resource: Resource, id: number, values: Record<string, unknown>): StoredEntity | undefined {
        const current = this.get(resource, id);
        if (!current) return undefined;
        const entity = { ...current, ...values, id };
        database.prepare("UPDATE entities SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE resource = ? AND id = ?")
            .run(JSON.stringify(entity), resource, id);
        return entity;
    },

    remove(resource: Resource, id: number): boolean {
        return database.prepare('DELETE FROM entities WHERE resource = ? AND id = ?').run(resource, id).changes > 0;
    },
};

const existingCount = database.prepare('SELECT COUNT(*) AS count FROM entities').get() as { count: number };

// One-time migration of records that existed in the in-memory version before SQLite was enabled.
if (existingCount.count === 0) {
    const initialData: Partial<Record<Resource, Record<string, unknown>[]>> = {
        projects: [
            { projectCode: '123', name: 'Test', pm: 'Alisa' },
            { projectCode: '1234', name: 'Test2', pm: 'Joyce' },
        ],
        employees: [
            { employeeNumber: '1234', name: 'Alisa', region: 'india', salary: 45, projectId: 1, joinDate: '2026-06-01', leaveDate: '', isShared: false, sharedProject: '', sharedRatio: 0, hourlyRate: 35, monthlyWorkingHours: 168, monthlyBill: 5880, monthlyNR: 5442.643835999999, comment: '' },
            { employeeNumber: '123456', name: 'Jack Yu', region: 'india', salary: 47, projectId: 1, joinDate: '2026-06-02', leaveDate: '', isShared: true, sharedProject: '60', sharedRatio: 20, hourlyRate: 30, monthlyWorkingHours: 168, monthlyBill: 5040, monthlyNR: 4665.123288, comment: '' },
            { employeeNumber: '123466', name: 'Srikanth', region: 'Inida', salary: 0, projectId: 2, joinDate: '2026-06-02', leaveDate: '2026-10-28', isShared: true, sharedProject: '其他', sharedRatio: 40 },
        ],
    };

    for (const [resource, entities] of Object.entries(initialData)) {
        for (const entity of entities || []) entityStore.create(resource as Resource, entity);
    }
}

// Existing employee records predate C2C tracking and are explicitly treated as not signed.
for (const employee of entityStore.list('employees')) {
    if (typeof employee.hasC2C !== 'boolean') {
        entityStore.update('employees', employee.id, { hasC2C: false });
    }
}