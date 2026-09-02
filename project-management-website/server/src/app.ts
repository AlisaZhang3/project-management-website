import express from 'express';
import cors from 'cors';
import routes from './routes';
import { databasePath } from './database';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', routes);

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`SQLite database: ${databasePath}`);
});

export default app;