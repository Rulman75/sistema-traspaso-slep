const express = require('express');
const router = express.Router();
const { getConnection, sql } = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

// Admin Auth Middleware
const verifyAdminToken = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(403).json({ error: 'No token provided' });

    try {
        const decoded = jwt.verify(token.split(' ')[1], process.env.JWT_SECRET);
        if (!decoded.roles || !decoded.roles.includes('admin')) {
            return res.status(403).json({ error: 'Acceso denegado: Se requiere rol de administrador' });
        }
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Token inválido o expirado' });
    }
};

// Login de Administrador
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('user', sql.VarChar, username)
            .query('SELECT * FROM dbo.Administradores WHERE username = @user');

        if (result.recordset.length === 0) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const admin = result.recordset[0];
        const isMatch = await bcrypt.compare(password, admin.password);

        if (!isMatch) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const token = jwt.sign(
            { id: admin.id, username: admin.username, nombre: admin.nombre, role: 'admin' },
            process.env.JWT_SECRET,
            { expiresIn: '12h' }
        );

        res.json({
            token,
            user: {
                nombre: admin.nombre,
                username: admin.username,
                role: 'admin'
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message || 'Error interno del servidor' });
    }
});

// Estadísticas para el Dashboard
router.get('/stats', verifyAdminToken, async (req, res) => {
    try {
        const pool = await getConnection();
        const result = await pool.request().query(`
            SELECT 
                COUNT(*) as total_activos,
                SUM(CASE WHEN estado_validacion = 'APROBADO FUNCIONARIO' THEN 1 ELSE 0 END) as total_aprobado_funcionario,
                SUM(CASE WHEN estado_validacion = 'RECHAZADO FUNCIONARIO' THEN 1 ELSE 0 END) as total_rechazado_funcionario,
                SUM(CASE WHEN estado_validacion = 'APROBADO CMDS' THEN 1 ELSE 0 END) as total_aprobado_cmds,
                SUM(CASE WHEN estado_validacion = 'RECHAZADO CMDS' THEN 1 ELSE 0 END) as total_rechazado_cmds,
                SUM(CASE WHEN estado_validacion = 'PENDIENTE BIENIO' THEN 1 ELSE 0 END) as total_pendiente_bienio,
                SUM(CASE WHEN estado_validacion = 'PENDIENTE' OR estado_validacion IS NULL THEN 1 ELSE 0 END) as total_pendientes
            FROM dbo.PERSONAL
            WHERE codigo = '1'
        `);

        res.json(result.recordset[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message || 'Error interno del servidor' });
    }
});

// Obtener lista de trabajadores (con filtros opcionales y paginación en servidor)
router.get('/workers', verifyAdminToken, async (req, res) => {
    const { rut, unidad, estado, tipo_contrato, page, limit } = req.query;

    try {
        const pool = await getConnection();
        const request = pool.request();

        let whereClause = " WHERE p.CODIGO = '1' ";

        if (rut) {
            const cleanRut = rut.toString().replace(/[.\-\s]/g, '').trim();
            whereClause += " AND (p.[RUT EMPLEADO] LIKE @rut OR CONCAT(p.NOMBRE, ' ', p.PATERNO, ' ', p.MATERNO) LIKE @rut) ";
            request.input('rut', sql.VarChar, `%${cleanRut}%`);
        }
        if (estado) {
            if (estado === 'PENDIENTE') {
                whereClause += " AND (p.estado_validacion = 'PENDIENTE' OR p.estado_validacion IS NULL) ";
            } else {
                whereClause += " AND p.estado_validacion = @estado ";
                request.input('estado', sql.VarChar, estado);
            }
        }
        if (unidad) {
            whereClause += " AND p.[NOMBRE UNIDAD] LIKE @unidad ";
            request.input('unidad', sql.VarChar, `%${unidad}%`);
        }
        if (tipo_contrato) {
            if (tipo_contrato === 'INDEFINIDO') {
                whereClause += " AND p.DETALLE = '1' ";
            } else if (tipo_contrato === 'PLAZO FIJO') {
                whereClause += " AND p.DETALLE = '2' ";
            } else if (tipo_contrato === 'REEMPLAZO') {
                whereClause += " AND p.DETALLE = '3' ";
            }
        }

        const selectColumns = `
            p.[RUT EMPLEADO] as rut,
            p.DV as dv,
            CONCAT(p.NOMBRE, ' ', p.PATERNO, ' ', p.MATERNO) as nombre_completo,
            p.[NOMBRE UNIDAD] as unidad,
            CASE 
                WHEN p.DETALLE = '1' THEN 'INDEFINIDO'
                WHEN p.DETALLE = '2' THEN 'PLAZO FIJO'
                WHEN p.DETALLE = '3' THEN 'REEMPLAZO'
                ELSE 'DESCONOCIDO'
            END as tipo_contrato,
            p.estado_validacion,
            p.fecha_reclamo,
            p.ruta_evidencia,
            p.rechazo_motivo,
            p.observaciones,
            p.email,
            p.celular
        `;

        if (page) {
            const pageNum = Math.max(1, parseInt(page, 10) || 1);
            const pageSize = Math.min(500, Math.max(1, parseInt(limit, 10) || 50));
            const offset = (pageNum - 1) * pageSize;

            request.input('offset', sql.Int, offset);
            request.input('pageSize', sql.Int, pageSize);

            const pagedQuery = `
                SELECT COUNT(1) as total FROM dbo.PERSONAL p ${whereClause};
                SELECT ${selectColumns}
                FROM dbo.PERSONAL p
                ${whereClause}
                ORDER BY p.[RUT EMPLEADO] ASC
                OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY;
            `;

            const result = await request.query(pagedQuery);
            const total = result.recordsets[0][0].total;
            const rows = result.recordsets[1];

            return res.json({
                data: rows,
                total,
                page: pageNum,
                pageSize,
                totalPages: Math.max(1, Math.ceil(total / pageSize))
            });
        }

        const fullQuery = `
            SELECT ${selectColumns}
            FROM dbo.PERSONAL p
            ${whereClause}
            ORDER BY p.[RUT EMPLEADO] ASC
        `;
        const result = await request.query(fullQuery);
        res.json(result.recordset);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message || 'Error interno del servidor' });
    }
});

// Resetear contraseña de un trabajador
router.post('/reset-password', verifyAdminToken, async (req, res) => {
    const { rut } = req.body;
    try {
        const pool = await getConnection();
        const rutStr = rut.toString();
        const newPassword = rutStr.substring(0, 4);
        const hash = await bcrypt.hash(newPassword, 10);
        
        await pool.request()
            .input('rut', sql.VarChar, rutStr)
            .input('hash', sql.VarChar, hash)
            .query("UPDATE dbo.PERSONAL SET password = @hash, password_changed = 0 WHERE [RUT EMPLEADO] = @rut");

        res.json({ success: true, message: `Contraseña reseteada a ${newPassword} exitosamente` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message || 'Error interno del servidor' });
    }
});

const nodemailer = require('nodemailer');

router.post('/resolve-claim', verifyAdminToken, async (req, res) => {
    const { rut, email, nombre, tipoRespuesta, observacionAdmin } = req.body;
    try {
        const pool = await getConnection();
        
        let nuevoEstado = '';
        let asunto = '';
        let htmlMensaje = '';
        const nombreLimpio = nombre ? nombre.replace(/\s+/g, ' ').trim() : '';

        const baseTemplate = (content) => `
            <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eaeaea; padding: 20px; border-radius: 8px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <img src="cid:logocmds" alt="CMDS Logo" style="height: 80px;" />
                </div>
                <p><b>Estimado(a) Funcionario(a) ${nombreLimpio}:</b></p>
                ${content}
                <br>
                <p>Atentamente.</p>
                <p><b>Dirección de Recursos Humanos<br>Corporación Municipal de Desarrollo Social de Antofagasta</b></p>
            </div>
        `;

        if (tipoRespuesta === '1') {
            nuevoEstado = 'APROBADO CMDS';
            asunto = 'Resolución de Validación CMDS: Solicitud Aprobada';
            let obsHtml = observacionAdmin ? `<p><b>Observación adicional:</b><br>${observacionAdmin}</p>` : '';
            htmlMensaje = baseTemplate(`
                <p>Junto con saludar le informamos que respecto a su solicitud de validación de Fecha de Inicio de Contrato y/o Bienios ha sido aceptada y corregida.</p>
                ${obsHtml}
            `);
        } else if (tipoRespuesta === '2') {
            nuevoEstado = 'RECHAZADO CMDS';
            asunto = 'Resolución de Validación CMDS: Solicitud Rechazada';
            let obsHtml = observacionAdmin ? `<p><b>Observación adicional:</b><br>${observacionAdmin}</p>` : '';
            htmlMensaje = baseTemplate(`
                <p>Junto con saludar le informamos que respecto a su solicitud de validación de Fecha de Inicio de Contrato y/o Bienios ha sido rechazada dado que los antecedentes proporcionados no permiten validar la información.</p>
                ${obsHtml}
            `);
        } else if (tipoRespuesta === '3') {
            nuevoEstado = 'PENDIENTE BIENIO';
            asunto = 'Resolución de Validación CMDS: Solicitud Antecedentes Bienios';
            htmlMensaje = baseTemplate(`
                <p>Junto con saludar y esperando se encuentren muy bien, por intermedio del presente, se informa que para corregir información de bienios, se solicita lo siguiente:</p>
                <ul>
                    <li>Docentes que solo hayan trabajado con este sostenedor y debe regularizar sus bienios, enviar a don Guillermo Cuevas (gcuevas@cmds.cl) su cartola histórica de la AFP.</li>
                    <li>Docentes que hayan trabajados en otro sostenedor (cumpliendo función docente), enviar a don Guillermo Cuevas (gcuevas@cmds.cl) un certificado de antigüedad del ex empleador o su finiquito más la cartola histórica de la AFP.</li>
                </ul>
                <p>Muchas gracias por su colaboración.</p>
            `);
        } else {
            return res.status(400).json({ error: 'Tipo de respuesta inválida' });
        }

        // Actualizar el estado en la BD
        await pool.request()
            .input('rut', sql.VarChar, rut.toString())
            .input('estado', sql.VarChar, nuevoEstado)
            .input('obs_cmds', sql.VarChar, observacionAdmin || null)
            .query("UPDATE dbo.PERSONAL SET estado_validacion = @estado, observacion_cmds = @obs_cmds WHERE [RUT EMPLEADO] = @rut AND codigo = 1");

        // Enviar correo si hay email
        if (email) {
            let transporter = nodemailer.createTransport({
                host: "smtp.office365.com",
                port: 587,
                secure: false, 
                auth: {
                    user: "verificacion.slep@cmds.cl", 
                    pass: "Slep#Cmds.#", 
                },
                tls: {
                    minVersion: 'TLSv1.2'
                }
            });

            const logoPath = path.join(__dirname, '../../frontend/public/logo.png');
            let attachments = [];
            if (fs.existsSync(logoPath)) {
                attachments.push({
                    filename: 'logo.png',
                    path: logoPath,
                    cid: 'logocmds' 
                });
            }

            await transporter.sendMail({
                from: '"Validación CMDS" <verificacion.slep@cmds.cl>',
                to: email,
                subject: asunto,
                html: htmlMensaje,
                attachments: attachments
            }).catch(console.error);
        }

        res.json({ success: true, message: 'Resolución enviada y estado actualizado' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message || 'Error interno del servidor' });
    }
});

// --- MANTENEDOR DE ADMINISTRADORES ---

router.get('/admins', verifyAdminToken, async (req, res) => {
    try {
        const pool = await getConnection();
        const result = await pool.request().query("SELECT id, username, nombre FROM dbo.Administradores");
        res.json(result.recordset);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message || 'Error interno del servidor' });
    }
});

router.post('/admins', verifyAdminToken, async (req, res) => {
    const { username, nombre, password } = req.body;
    try {
        const pool = await getConnection();
        
        // Verificar si existe
        const exists = await pool.request()
            .input('username', sql.VarChar, username)
            .query("SELECT id FROM dbo.Administradores WHERE username = @username");
            
        if (exists.recordset.length > 0) {
            return res.status(400).json({ error: 'El nombre de usuario ya existe' });
        }

        const newPassword = username.substring(0, 4);
        const hash = await bcrypt.hash(newPassword, 10);
        
        await pool.request()
            .input('username', sql.VarChar, username)
            .input('password', sql.VarChar, hash)
            .input('nombre', sql.VarChar, nombre)
            .query("INSERT INTO dbo.Administradores (username, password, nombre, password_changed) VALUES (@username, @password, @nombre, 0)");
            
        res.json({ success: true, message: 'Administrador creado exitosamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message || 'Error interno del servidor' });
    }
});

router.put('/admins/:id', verifyAdminToken, async (req, res) => {
    const { id } = req.params;
    const { username, nombre, password } = req.body;
    try {
        const pool = await getConnection();
        
        if (password) {
            const hash = await bcrypt.hash(password, 10);
            await pool.request()
                .input('id', sql.Int, id)
                .input('username', sql.VarChar, username)
                .input('nombre', sql.VarChar, nombre)
                .input('password', sql.VarChar, hash)
                .query("UPDATE dbo.Administradores SET username = @username, nombre = @nombre, password = @password WHERE id = @id");
        } else {
            await pool.request()
                .input('id', sql.Int, id)
                .input('username', sql.VarChar, username)
                .input('nombre', sql.VarChar, nombre)
                .query("UPDATE dbo.Administradores SET username = @username, nombre = @nombre WHERE id = @id");
        }
            
        res.json({ success: true, message: 'Administrador actualizado exitosamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message || 'Error interno del servidor' });
    }
});

router.delete('/admins/:id', verifyAdminToken, async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await getConnection();
        // Prevent deleting the last admin or yourself
        const currentCount = await pool.request().query("SELECT COUNT(*) as count FROM dbo.Administradores");
        if (currentCount.recordset[0].count <= 1) {
            return res.status(400).json({ error: 'No puedes eliminar al único administrador del sistema' });
        }

        await pool.request()
            .input('id', sql.Int, id)
            .query("DELETE FROM dbo.Administradores WHERE id = @id");
            
        res.json({ success: true, message: 'Administrador eliminado exitosamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message || 'Error interno del servidor' });
    }
});

router.post('/admins/:id/reset-password', verifyAdminToken, async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await getConnection();
        
        const user = await pool.request()
            .input('id', sql.Int, id)
            .query("SELECT username FROM dbo.Administradores WHERE id = @id");
            
        if (user.recordset.length === 0) return res.status(404).json({ error: 'Admin no encontrado' });
        
        const username = user.recordset[0].username;
        const newPassword = username.substring(0, 4);
        const hash = await bcrypt.hash(newPassword, 10);
        
        await pool.request()
            .input('id', sql.Int, id)
            .input('password', sql.VarChar, hash)
            .query("UPDATE dbo.Administradores SET password = @password, password_changed = 0 WHERE id = @id");
            
        res.json({ success: true, message: 'Contraseña reseteada exitosamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message || 'Error interno del servidor' });
    }
});

router.post('/impersonate/:rut', verifyAdminToken, async (req, res) => {
    const { rut } = req.params;
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('rut', sql.VarChar, rut)
            .query("SELECT [RUT EMPLEADO] as rut_empleado, DV as dv, PATERNO, MATERNO, NOMBRE FROM dbo.PERSONAL WHERE [RUT EMPLEADO] = @rut");
            
        if (result.recordset.length === 0) return res.status(404).json({ error: 'Trabajador no encontrado' });
        
        const user = result.recordset[0];
        const fullRut = `${user.rut_empleado}${user.dv}`;
        const nombreCompleto = `${user.NOMBRE} ${user.PATERNO} ${user.MATERNO}`.trim();
        
        const token = jwt.sign(
            { 
                rut_empleado: user.rut_empleado, 
                full_rut: fullRut, 
                nombre: nombreCompleto,
                roles: ['worker', 'admin']
            },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );
        
        res.json({ token });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message || 'Error interno del servidor' });
    }
});

router.post('/workers/:rut/reset', verifyAdminToken, async (req, res) => {
    const { rut } = req.params;
    try {
        const pool = await getConnection();
        
        // Primero, obtener la evidencia para borrar el archivo físico
        const result = await pool.request()
            .input('rut', sql.VarChar, rut)
            .query("SELECT ruta_evidencia FROM dbo.PERSONAL WHERE [RUT EMPLEADO] = @rut");
            
        if (result.recordset.length > 0 && result.recordset[0].ruta_evidencia) {
            const fileName = result.recordset[0].ruta_evidencia;
            const filePath = path.join(__dirname, '../uploads', fileName);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
        
        await pool.request()
            .input('rut', sql.VarChar, rut)
            .query(`
                UPDATE dbo.PERSONAL 
                SET estado_validacion = NULL, 
                    fecha_reclamo = NULL, 
                    ruta_evidencia = NULL, 
                    rechazo_motivo = NULL, 
                    observaciones = NULL, 
                    email = NULL, 
                    celular = NULL,
                    observacion_cmds = NULL
                WHERE [RUT EMPLEADO] = @rut
            `);
            
        res.json({ success: true, message: 'Validación deshecha correctamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al deshacer validación' });
    }
});

module.exports = router;
