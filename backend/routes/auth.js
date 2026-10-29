const express = require('express');
const router = express.Router();
const { getConnection, sql } = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

router.post('/login', async (req, res) => {
    const { rut, password } = req.body;

    if (!rut || !password) {
        return res.status(400).json({ error: 'RUT y contraseña son requeridos' });
    }

    const cleanRut = rut.toString().replace(/[.\-\s]/g, '').trim();
    const cleanPass = password.toString().trim();

    let rutNum = cleanRut.slice(0, -1);
    let dv = cleanRut.slice(-1).toUpperCase();

    try {
        const pool = await getConnection();
        
        // 1. Buscar en PERSONAL (Worker)
        const workerResult = await pool.request()
            .input('rut', sql.VarChar, rutNum)
            .input('dv', sql.VarChar, dv)
            .query('SELECT [RUT EMPLEADO] as rut_empleado, DV as dv, NOMBRE, PATERNO, MATERNO, password, password_changed FROM dbo.PERSONAL WHERE [RUT EMPLEADO] = @rut AND (LTRIM(RTRIM(DV)) = @dv OR LOWER(LTRIM(RTRIM(DV))) = LOWER(@dv)) AND codigo = \'1\'');
        
        // 2. Buscar en Administradores
        const adminResult = await pool.request()
            .input('username', sql.VarChar, cleanRut)
            .query('SELECT * FROM dbo.Administradores WHERE username = @username');

        let isWorker = workerResult.recordset.length > 0;
        let isAdmin = adminResult.recordset.length > 0;
        
        let userRecord = isWorker ? workerResult.recordset[0] : null;
        let adminRecord = isAdmin ? adminResult.recordset[0] : null;

        if (!isWorker && !isAdmin) {
            return res.status(401).json({ error: 'Credenciales inválidas o usuario no encontrado' });
        }

        // Si es worker, validamos si tiene clave seteada
        if (isWorker && !userRecord.password) {
             return res.status(401).json({ error: 'Usuario no tiene contraseña configurada.' });
        }

        let matchWorker = false;
        let matchAdmin = false;

        if (isWorker) {
            matchWorker = await bcrypt.compare(password, userRecord.password) || (cleanPass !== password && await bcrypt.compare(cleanPass, userRecord.password));
        }
        
        if (isAdmin) {
            matchAdmin = await bcrypt.compare(password, adminRecord.password) || (cleanPass !== password && await bcrypt.compare(cleanPass, adminRecord.password));
        }

        if (!matchWorker && !matchAdmin) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        // Verificar si el trabajador está en TRASPASO_FUNCIONARIOS
        if (isWorker && matchWorker) {
            const traspasoCheck = await pool.request()
                .input('run', sql.VarChar, userRecord.rut_empleado)
                .query('SELECT TOP 1 RUN FROM dbo.TRASPASO_FUNCIONARIOS WHERE RUN = @run');
            
            if (traspasoCheck.recordset.length === 0) {
                // Si también es admin con clave correcta, le dejamos entrar solo como admin
                if (isAdmin && matchAdmin) {
                    isWorker = false; 
                } else {
                    return res.status(403).json({ error: 'USTED NO ESTÁ CONSIDERADO EN LA NÓMINA DE TRASPASO AL SLEP. Para mayor información comunicarse mediante mail RRHHResponde@cmds.cl' });
                }
            }
        }

        let roles = [];
        if (isWorker && matchWorker) roles.push('worker');
        if (isAdmin && matchAdmin) roles.push('admin');

        const fullRut = isWorker ? `${userRecord.rut_empleado}${userRecord.dv}` : adminRecord.username;
        const nombreCompleto = isWorker ? `${userRecord.NOMBRE} ${userRecord.PATERNO} ${userRecord.MATERNO}`.trim() : adminRecord.nombre;
        const mustChange = isWorker ? !userRecord.password_changed : !adminRecord.password_changed;

        const token = jwt.sign(
            { 
                rut_empleado: isWorker ? userRecord.rut_empleado : null, 
                full_rut: fullRut, 
                nombre: nombreCompleto,
                roles: roles
            },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.json({
            token,
            mustChangePassword: mustChange,
            user: {
                nombre_completo: nombreCompleto,
                rut: fullRut,
                roles: roles
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

router.post('/change-password', async (req, res) => {
    const { rut, currentPassword, newPassword } = req.body;
    const cleanRut = (rut || '').toString().replace(/[.\-\s]/g, '').trim();
    const cleanCurrent = (currentPassword || '').toString().trim();
    const cleanNew = (newPassword || '').toString().trim();

    let rutNum = cleanRut.slice(0, -1);
    let dv = cleanRut.slice(-1).toUpperCase();

    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('rut', sql.VarChar, rutNum)
            .input('dv', sql.VarChar, dv)
            .query('SELECT [RUT EMPLEADO] as rut_empleado, password FROM dbo.PERSONAL WHERE [RUT EMPLEADO] = @rut AND (LTRIM(RTRIM(DV)) = @dv OR LOWER(LTRIM(RTRIM(DV))) = LOWER(@dv))');

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const user = result.recordset[0];
        let isMatch = await bcrypt.compare(currentPassword, user.password) || (cleanCurrent !== currentPassword && await bcrypt.compare(cleanCurrent, user.password));

        // Si no coincide, buscar si tiene cuenta de Admin y comparar ahí
        if (!isMatch) {
            const adminResult = await pool.request()
                .input('rutFull', sql.VarChar, cleanRut)
                .query('SELECT password FROM dbo.Administradores WHERE username = @rutFull');
            
            if (adminResult.recordset.length > 0) {
                isMatch = await bcrypt.compare(currentPassword, adminResult.recordset[0].password) || (cleanCurrent !== currentPassword && await bcrypt.compare(cleanCurrent, adminResult.recordset[0].password));
            }
        }

        if (!isMatch) {
            return res.status(401).json({ error: 'Contraseña actual incorrecta' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(cleanNew, salt);

        // Actualizar en PERSONAL
        await pool.request()
            .input('rut', sql.VarChar, rutNum)
            .input('password', sql.VarChar, hashedPassword)
            .query('UPDATE dbo.PERSONAL SET password = @password, password_changed = 1 WHERE [RUT EMPLEADO] = @rut');
        // Opcional: Actualizar también en Administradores si existe
        await pool.request()
            .input('rutFull', sql.VarChar, cleanRut)
            .input('password', sql.VarChar, hashedPassword)
            .query('UPDATE dbo.Administradores SET password = @password, password_changed = 1 WHERE username = @rutFull');

        res.json({ success: true, message: 'Contraseña cambiada exitosamente' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message || 'Error interno del servidor' });
    }
});

module.exports = router;
