const express = require('express');
const router = express.Router();
const { getConnection, sql } = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

router.get('/system-status', async (req, res) => {
    try {
        const pool = await getConnection();
        const result = await pool.request().query('SELECT TOP 1 proceso_cerrado, fecha_cierre, mensaje_adicional FROM dbo.ConfiguracionSistema WHERE id = 1');
        if (result.recordset.length === 0) {
            return res.json({ proceso_cerrado: false, fecha_cierre: '', mensaje_adicional: '' });
        }
        const cfg = result.recordset[0];
        res.json({
            proceso_cerrado: Boolean(cfg.proceso_cerrado),
            fecha_cierre: cfg.fecha_cierre || '',
            mensaje_adicional: cfg.mensaje_adicional || ''
        });
    } catch (error) {
        res.json({ proceso_cerrado: false, fecha_cierre: '', mensaje_adicional: '' });
    }
});

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

        // Verificar si el proceso de validación está bloqueado para funcionarios (los administradores sí pueden entrar)
        if (!(isAdmin && matchAdmin)) {
            const cfgRes = await pool.request().query('SELECT TOP 1 proceso_cerrado, fecha_cierre, mensaje_adicional FROM dbo.ConfiguracionSistema WHERE id = 1');
            if (cfgRes.recordset.length > 0 && cfgRes.recordset[0].proceso_cerrado) {
                const cfg = cfgRes.recordset[0];
                const fechaTxt = cfg.fecha_cierre ? ` con fecha ${cfg.fecha_cierre}` : '';
                const extraTxt = cfg.mensaje_adicional ? `\n\n${cfg.mensaje_adicional}` : '';
                return res.status(403).json({
                    error: `El proceso de validación de antecedentes ha sido finalizado${fechaTxt}.${extraTxt}`
                });
            }
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

        // 1. Buscar en PERSONAL
        const workerResult = await pool.request()
            .input('rut', sql.VarChar, rutNum)
            .input('dv', sql.VarChar, dv)
            .query('SELECT [RUT EMPLEADO] as rut_empleado, password FROM dbo.PERSONAL WHERE [RUT EMPLEADO] = @rut AND (LTRIM(RTRIM(DV)) = @dv OR LOWER(LTRIM(RTRIM(DV))) = LOWER(@dv))');

        // 2. Buscar en Administradores (por username exacto o limpio)
        const adminResult = await pool.request()
            .input('rutFull', sql.VarChar, cleanRut)
            .input('rutRaw', sql.VarChar, (rut || '').toString().trim())
            .query('SELECT id, username, password FROM dbo.Administradores WHERE username = @rutFull OR username = @rutRaw');

        const hasWorker = workerResult.recordset.length > 0;
        const hasAdmin = adminResult.recordset.length > 0;

        if (!hasWorker && !hasAdmin) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        let isMatch = false;

        if (hasWorker && workerResult.recordset[0].password) {
            const wPass = workerResult.recordset[0].password;
            isMatch = await bcrypt.compare(currentPassword, wPass) || (cleanCurrent !== currentPassword && await bcrypt.compare(cleanCurrent, wPass));
        }

        if (!isMatch && hasAdmin && adminResult.recordset[0].password) {
            const aPass = adminResult.recordset[0].password;
            isMatch = await bcrypt.compare(currentPassword, aPass) || (cleanCurrent !== currentPassword && await bcrypt.compare(cleanCurrent, aPass));
        }

        if (!isMatch) {
            return res.status(401).json({ error: 'Contraseña actual incorrecta' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(cleanNew, salt);

        if (hasWorker) {
            await pool.request()
                .input('rut', sql.VarChar, rutNum)
                .input('password', sql.VarChar, hashedPassword)
                .query('UPDATE dbo.PERSONAL SET password = @password, password_changed = 1 WHERE [RUT EMPLEADO] = @rut');
        }

        if (hasAdmin) {
            await pool.request()
                .input('id', sql.Int, adminResult.recordset[0].id)
                .input('password', sql.VarChar, hashedPassword)
                .query('UPDATE dbo.Administradores SET password = @password, password_changed = 1 WHERE id = @id');
        }

        res.json({ success: true, message: 'Contraseña cambiada exitosamente' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message || 'Error interno del servidor' });
    }
});

module.exports = router;
