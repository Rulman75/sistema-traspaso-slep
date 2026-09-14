const express = require('express');
const router = express.Router();
const { getConnection, sql } = require('../db');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Middleware para verificar JWT
const verifyToken = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(403).json({ error: 'No se proveyó un token' });

    try {
        const decoded = jwt.verify(token.split(' ')[1], process.env.JWT_SECRET);
        req.user = decoded; // { rut_empleado, full_rut, nombre }
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Token inválido o expirado' });
    }
};

// Configuración de Multer para subir evidencia
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, '../uploads');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath);
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, req.user.full_rut + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

router.get('/details', verifyToken, async (req, res) => {
    try {
        const pool = await getConnection();
        const query = `
            SELECT
            dbo.PERSONAL.[RUT EMPLEADO],
            dbo.PERSONAL.DV,
            dbo.PERSONAL.NOMBRE,
            dbo.PERSONAL.PATERNO,
            dbo.PERSONAL.MATERNO,
            CASE 
                WHEN dbo.PERSONAL.codigoe = 384 or dbo.PERSONAL.codigoe = 530 then dbo.CARGA_HORARIA_SEP_PIE.DES_UNIDAD_TRAB
                ELSE dbo.PERSONAL.[NOMBRE UNIDAD]
            END as UNIDAD,
            CASE 
                WHEN dbo.PERSONAL.DETALLE = '1' THEN 'INDEFINIDO'
                WHEN dbo.PERSONAL.DETALLE = '2' THEN 'PLAZO FIJO'
                WHEN dbo.PERSONAL.DETALLE = '3' THEN 'INDEFINIDO'
                ELSE 'DESCONOCIDO'
            END as TIPO_CONTRATO,
            dbo.PERSONAL.BIENIOS,
            dbo.PERSONAL.INICIO,
            dbo.PERSONAL.estado_validacion,
            dbo.PERSONAL.fecha_reclamo,
            dbo.PERSONAL.ruta_evidencia
            FROM
            dbo.PERSONAL
            LEFT JOIN dbo.CARGA_HORARIA_SEP_PIE ON dbo.PERSONAL.[RUT EMPLEADO] = dbo.CARGA_HORARIA_SEP_PIE.RUT
            where dbo.PERSONAL.codigo = 1
            and dbo.PERSONAL.[RUT EMPLEADO] = @rut_empleado
        `;

        const result = await pool.request()
            .input('rut_empleado', sql.VarChar, req.user.rut_empleado.toString())
            .query(query);

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Trabajador no encontrado o inactivo' });
        }

        const data = result.recordset[0];
        
        res.json({
            rut_empleado: data['RUT EMPLEADO'],
            dv: data.DV,
            nombre_completo: `${data.NOMBRE} ${data.PATERNO} ${data.MATERNO}`.trim(),
            unidad: data.UNIDAD,
            tipo_contrato: data.TIPO_CONTRATO,
            bienios: data.BIENIOS,
            fecha_inicio_contrato: data.INICIO,
            estado_validacion: data.estado_validacion || 'PENDIENTE',
            fecha_reclamo: data.fecha_reclamo,
            ruta_evidencia: data.ruta_evidencia
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

router.get('/download-pdf', verifyToken, (req, res) => {
    const filename = `${req.user.full_rut}.ANTOFAGASTA.pdf`;
    const repoPath = process.env.PDF_REPO_PATH; 
    const filePath = path.join(repoPath, filename);

    if (fs.existsSync(filePath)) {
        res.download(filePath);
    } else {
        res.status(404).json({ error: 'Archivo no encontrado en el repositorio' });
    }
});

router.post('/validate', verifyToken, upload.single('evidencia'), async (req, res) => {
    const { correcta, fechaReclamo } = req.body;
    const rut_empleado = req.user.rut_empleado;

    try {
        const pool = await getConnection();
        
        if (correcta === 'SI') {
            await pool.request()
                .input('rut', sql.VarChar, rut_empleado.toString())
                .query("UPDATE dbo.PERSONAL SET estado_validacion = 'OK' WHERE [RUT EMPLEADO] = @rut");
        } else if (correcta === 'NO') {
            const evidenciaPath = req.file ? req.file.filename : null;
            await pool.request()
                .input('rut', sql.VarChar, rut_empleado.toString())
                .input('fechaReclamo', sql.Date, fechaReclamo || null)
                .input('evidencia', sql.VarChar, evidenciaPath)
                .query("UPDATE dbo.PERSONAL SET estado_validacion = 'RECHAZADO', fecha_reclamo = @fechaReclamo, ruta_evidencia = @evidencia WHERE [RUT EMPLEADO] = @rut");
        } else {
            return res.status(400).json({ error: 'Valor de validación inválido' });
        }

        res.json({ success: true, message: 'Validación guardada con éxito' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

module.exports = router;
