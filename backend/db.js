const sql = require('mssql');
require('dotenv').config();

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    requestTimeout: 90000,
    connectionTimeout: 30000,
    options: {
        encrypt: false, // para SQL Server 2012 / locales
        trustServerCertificate: true
    }
};

let pool;

async function getConnection() {
    try {
        if (!pool) {
            pool = await sql.connect(config);
            console.log('Connected to SQL Server successfully');
        }
        return pool;
    } catch (error) {
        console.error('Database connection failed!', error);
        throw error;
    }
}

module.exports = {
    getConnection,
    sql
};
