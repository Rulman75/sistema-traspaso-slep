const sql = require('mssql');
require('dotenv').config();

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    options: { encrypt: false, trustServerCertificate: true },
};

async function addColumn() {
    try {
        let pool = await sql.connect(config);
        console.log('Connected to DB');
        
        // Add the column if it doesn't exist
        await pool.request().query(`
            IF NOT EXISTS (
                SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_NAME = 'PERSONAL' AND COLUMN_NAME = 'observacion_cmds'
            )
            BEGIN
                ALTER TABLE dbo.PERSONAL ADD observacion_cmds VARCHAR(MAX);
            END
        `);
        console.log('Column observacion_cmds added successfully or already exists.');
        
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

addColumn();
