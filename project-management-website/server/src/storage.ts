import path from 'path';

export const dataDirectory = process.env.DATA_DIRECTORY
    ? path.resolve(process.env.DATA_DIRECTORY)
    : path.resolve(__dirname, '../data');
