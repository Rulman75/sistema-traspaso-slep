require('dotenv').config();
const sql = require('mssql');
const bcrypt = require('bcrypt');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    options: { encrypt: false, trustServerCertificate: true }
};

console.log("=== CREADOR DE ADMINISTRADORES ===\n");

rl.question("Ingresa el RUT (sin puntos ni guion, ej: 123456789): ", (rut) => {
    rl.question("Ingresa el Nombre Completo: ", (nombre) => {
        rl.question("Ingresa la Contraseña deseada: ", async (password) => {
            
            try {
                let pool = await sql.connect(config);
                const hash = await bcrypt.hash(password, 10);
                
                // Verificar si ya existe
                const check = await pool.request()
                    .input('rut', sql.VarChar, rut)
                    .query("SELECT * FROM dbo.Administradores WHERE username = @rut");
                
                if (check.recordset.length > 0) {
                    // Actualizar
                    await pool.request()
                        .input('rut', sql.VarChar, rut)
                        .input('nombre', sql.VarChar, nombre)
                        .input('hash', sql.VarChar, hash)
                        .query("UPDATE dbo.Administradores SET password = @hash, nombre = @nombre WHERE username = @rut");
                    console.log(`\n¡Listo! Se ha ACTUALIZADO el administrador con RUT ${rut}`);
                } else {
                    // Insertar
                    await pool.request()
                        .input('rut', sql.VarChar, rut)
                        .input('nombre', sql.VarChar, nombre)
                        .input('hash', sql.VarChar, hash)
                        .query("INSERT INTO dbo.Administradores (username, password, nombre) VALUES (@rut, @hash, @nombre)");
                    console.log(`\n¡Listo! Se ha CREADO el nuevo administrador con RUT ${rut}`);
                }
                
            } catch (err) {
                console.error("\nError en la base de datos:", err);
            } finally {
                rl.close();
                process.exit(0);
            }
        });
    });
});
