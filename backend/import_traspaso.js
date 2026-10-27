const xlsx = require('xlsx');
const sql = require('mssql');
require('dotenv').config();

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    options: { encrypt: false, trustServerCertificate: true },
};

async function importExcel() {
    console.log('Conectando a BD...');
    let pool = await sql.connect(config);

    console.log('Leyendo Excel...');
    const workbook = xlsx.readFile('C:\\Users\\rhormazabal\\Desktop\\TRASPASOPERSONAL.ANTOFAGASTA_CORRECCION_TRABAJADA.xlsx');
    const sheet_name = 'Funcionarios';
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheet_name], { raw: true, defval: null });
    
    console.log(`Se encontraron ${data.length} filas en el Excel (Hoja: ${sheet_name}).`);

    if (data.length === 0) {
        console.log('El archivo está vacío.');
        process.exit();
    }

    console.log('Borrando datos antiguos...');
    await pool.request().query('DELETE FROM dbo.TRASPASO_FUNCIONARIOS');

    console.log('Insertando nuevos datos...');
    
    const table = new sql.Table('dbo.TRASPASO_FUNCIONARIOS');
    table.create = false;

    table.columns.add('Comuna', sql.VarChar(100), { nullable: true });
    table.columns.add('Nom. Estab.', sql.VarChar(255), { nullable: true });
    table.columns.add('RBD Estab.', sql.Int, { nullable: true });
    table.columns.add('DV RBD', sql.VarChar(10), { nullable: true });
    table.columns.add('RUN', sql.VarChar(50), { nullable: true });
    table.columns.add('DV', sql.VarChar(10), { nullable: true });
    table.columns.add('Primer Apellido', sql.VarChar(100), { nullable: true });
    table.columns.add('Segundo Apellido', sql.VarChar(100), { nullable: true });
    table.columns.add('Nombres', sql.VarChar(100), { nullable: true });
    table.columns.add('Fecha Nac.', sql.Date, { nullable: true });
    table.columns.add('Sexo', sql.VarChar(50), { nullable: true });
    table.columns.add('Nacionalidad', sql.VarChar(50), { nullable: true });
    table.columns.add('Afiliación Previsional', sql.VarChar(100), { nullable: true });
    table.columns.add('Inst. Previsional', sql.VarChar(100), { nullable: true });
    table.columns.add('Inst. Salud', sql.VarChar(100), { nullable: true });
    table.columns.add('Régimen legal', sql.VarChar(100), { nullable: true });
    table.columns.add('Función', sql.VarChar(200), { nullable: true });
    table.columns.add('Calidad Jurídica', sql.VarChar(100), { nullable: true });
    table.columns.add('Bienios Reconocidos CPEIP (Antigüedad)', sql.VarChar(50), { nullable: true });
    table.columns.add('Fecha ingreso DAEM/CORPO', sql.Date, { nullable: true });
    table.columns.add('Fecha término', sql.Date, { nullable: true });
    table.columns.add('Tramo', sql.VarChar(50), { nullable: true });
    table.columns.add('N° horas', sql.Float, { nullable: true });
    table.columns.add('Financiamiento', sql.VarChar(100), { nullable: true });

    const parseExcelDate = (excelDate) => {
        if (!excelDate) return null;
        if (typeof excelDate === 'number') {
            // Excel dates are days since 1900-01-01
            const date = new Date(Math.round((excelDate - 25569) * 86400 * 1000));
            return date;
        }
        // If it's already a string, try to parse or return null if "Titular"
        if (typeof excelDate === 'string' && isNaN(Date.parse(excelDate))) {
            return null; // Like "Titular" in Date fields
        }
        return new Date(excelDate);
    };

    let count = 0;
    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        
        let fechaNac = parseExcelDate(row['Fecha Nac.']);
        let fechaIngreso = parseExcelDate(row['Fecha ingreso DAEM/CORPO']);
        let fechaTermino = parseExcelDate(row['Fecha término']);

        table.rows.add(
            row['Comuna'] ? row['Comuna'].toString() : null,
            row['Nom. Estab.'] ? row['Nom. Estab.'].toString() : null,
            row['RBD Estab.'] ? parseInt(row['RBD Estab.']) : null,
            row['DV RBD'] ? row['DV RBD'].toString() : null,
            row['RUN'] ? row['RUN'].toString() : null,
            row['DV'] ? row['DV'].toString() : null,
            row['Primer Apellido'] ? row['Primer Apellido'].toString() : null,
            row['Segundo Apellido'] ? row['Segundo Apellido'].toString() : null,
            row['Nombres'] ? row['Nombres'].toString() : null,
            fechaNac,
            row['Sexo'] ? row['Sexo'].toString() : null,
            row['Nacionalidad'] ? row['Nacionalidad'].toString() : null,
            row['Afiliación Previsional'] ? row['Afiliación Previsional'].toString() : null,
            row['Inst. Previsional'] ? row['Inst. Previsional'].toString() : null,
            row['Inst. Salud'] ? row['Inst. Salud'].toString() : null,
            row['Régimen legal'] ? row['Régimen legal'].toString() : null,
            row['Función'] ? row['Función'].toString() : null,
            row['Calidad Jurídica'] ? row['Calidad Jurídica'].toString() : null,
            row['Bienios Reconocidos CPEIP (Antigüedad)'] ? row['Bienios Reconocidos CPEIP (Antigüedad)'].toString() : null,
            fechaIngreso,
            fechaTermino,
            row['Tramo'] ? row['Tramo'].toString() : null,
            row['N° horas'] ? parseFloat(row['N° horas']) : null,
            row['Financiamiento'] ? row['Financiamiento'].toString() : null
        );
        count++;
    }

    const request = new sql.Request(pool);
    await request.bulk(table);

    console.log(`¡Carga masiva completada! ${count} registros insertados.`);
    process.exit(0);
}

importExcel().catch(err => {
    console.error(err);
    process.exit(1);
});
