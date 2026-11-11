const { DatabaseSync } = require('node:sqlite');

const [source, destination] = process.argv.slice(2);
if (!source || !destination) {
    throw new Error('Expected source and destination database paths');
}
const database = new DatabaseSync(source, { readOnly: true });
try {
    // VACUUM INTO includes committed WAL records without copying live WAL/SHM files.
    database.exec(`VACUUM INTO '${destination.replace(/'/g, "''")}'`);
} finally {
    database.close();
}
