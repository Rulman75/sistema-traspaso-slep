const express = require('express');
const router = express.Router();
const { getConnection, sql } = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

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
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Estadísticas para el Dashboard
router.get('/stats', verifyAdminToken, async (req, res) => {
    try {
        const pool = await getConnection();
        const result = await pool.request().query(`
            SELECT 
                COUNT(*) as total_activos,
                SUM(CASE WHEN estado_validacion = 'OK' THEN 1 ELSE 0 END) as total_ok,
                SUM(CASE WHEN estado_validacion = 'RECHAZADO' THEN 1 ELSE 0 END) as total_rechazados,
                SUM(CASE WHEN estado_validacion = 'PENDIENTE' OR estado_validacion IS NULL THEN 1 ELSE 0 END) as total_pendientes
            FROM dbo.PERSONAL
            WHERE codigo = '1'
        `);

        res.json(result.recordset[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Obtener lista de trabajadores (con filtros opcionales)
router.get('/workers', verifyAdminToken, async (req, res) => {
    const { rut, unidad, estado, tipo_contrato } = req.query;

    try {
        const pool = await getConnection();
        let query = `
            SELECT
                dbo.PERSONAL.[RUT EMPLEADO] as rut,
                dbo.PERSONAL.DV as dv,
                CONCAT(dbo.PERSONAL.NOMBRE, ' ', dbo.PERSONAL.PATERNO, ' ', dbo.PERSONAL.MATERNO) as nombre_completo,
                CASE 
                    WHEN dbo.PERSONAL.codigoe = 384 or dbo.PERSONAL.codigoe = 530 then dbo.CARGA_HORARIA_SEP_PIE.DES_UNIDAD_TRAB
                    ELSE dbo.PERSONAL.[NOMBRE UNIDAD]
                END as unidad,
                CASE 
                    WHEN LTRIM(RTRIM(dbo.PERSONAL.DETALLE)) = '1' THEN 'INDEFINIDO'
                    WHEN LTRIM(RTRIM(dbo.PERSONAL.DETALLE)) = '2' THEN 'PLAZO FIJO'
                    WHEN LTRIM(RTRIM(dbo.PERSONAL.DETALLE)) = '3' THEN 'INDEFINIDO'
                    ELSE 'DESCONOCIDO'
                END as tipo_contrato,
                dbo.PERSONAL.estado_validacion,
                dbo.PERSONAL.fecha_reclamo,
                dbo.PERSONAL.ruta_evidencia
            FROM dbo.PERSONAL
            LEFT JOIN dbo.CARGA_HORARIA_SEP_PIE ON dbo.PERSONAL.[RUT EMPLEADO] = dbo.CARGA_HORARIA_SEP_PIE.RUT
            WHERE dbo.PERSONAL.codigo = '1'
        `;

        const request = pool.request();

        if (rut) {
            query += " AND dbo.PERSONAL.[RUT EMPLEADO] LIKE @rut ";
            request.input('rut', sql.VarChar, `%${rut}%`);
        }
        if (estado) {
            query += " AND dbo.PERSONAL.estado_validacion = @estado ";
            request.input('estado', sql.VarChar, estado);
        }

        const result = await request.query(query);

        let workers = result.recordset;

        // Filtros post-query para campos calculados (UNIDAD, TIPO_CONTRATO)
        if (unidad) {
            workers = workers.filter(w => w.unidad && w.unidad.toLowerCase().includes(unidad.toLowerCase()));
        }
        if (tipo_contrato) {
            workers = workers.filter(w => w.tipo_contrato === tipo_contrato);
        }

        res.json(workers);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Resetear contraseña de un trabajador
router.post('/reset-password', verifyAdminToken, async (req, res) => {
    const { rut } = req.body;
    try {
        const pool = await getConnection();
        // Generar hash para '1234'
        const hash = await bcrypt.hash('1234', 10);
        await pool.request()
            .input('rut', sql.VarChar, rut.toString())
            .input('hash', sql.VarChar, hash)
            .query("UPDATE dbo.PERSONAL SET password = @hash, password_changed = 0 WHERE [RUT EMPLEADO] = @rut");

        res.json({ success: true, message: 'Contraseña reseteada a 1234 exitosamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

module.exports = router;
