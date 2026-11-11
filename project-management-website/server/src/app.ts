import express from 'express';
import cors from 'cors';
import routes from './routes';
import { databasePath } from './database';

const app = express();
const PORT = Number(process.env.PORT || 5000);
const HOST = process.env.HOST || '0.0.0.0';

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
}

app.use(cors());
app.use('/api/reports', express.json({ limit: '15mb' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', routes);

const server = app.listen(PORT, HOST, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`SQLite database: ${databasePath}`);
});

server.on('error', (error) => {
    console.error('Unable to start the backend:', error);
    process.exit(1);
});

export default app;