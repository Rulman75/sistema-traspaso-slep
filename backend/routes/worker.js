const express = require('express');
const router = express.Router();
const { getConnection, sql } = require('../db');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Middleware para verificar JWT
const verifyToken = (req, res, next) => {
    // Buscar el token en los headers (Authorization: Bearer <token>) o en la query string (?token=<token>)
    let token = null;
    if (req.headers['authorization']) {
        token = req.headers['authorization'].split(' ')[1];
    } else if (req.query.token) {
        token = req.query.token;
    }

    if (!token) return res.status(403).json({ error: 'No se proveyó un token' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
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
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|pdf|doc|docx|xls|xlsx|rar|zip/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('FORMATO_INVALIDO'));
        }
    }
});

router.get('/details', verifyToken, async (req, res) => {
    try {
        const pool = await getConnection();
        const query = `
            WITH RankedFunc AS (
                SELECT *,
                       ROW_NUMBER() OVER(
                           PARTITION BY RUN 
                           ORDER BY 
                               CAST(ISNULL(NULLIF([Bienios Reconocidos CPEIP (Antigüedad)], ''), '0') AS INT) DESC, 
                               [Fecha ingreso DAEM/CORPO] ASC
                       ) as rn
                FROM dbo.TRASPASO_FUNCIONARIOS
                WHERE RUN = @rut_empleado
            )
            SELECT 
                f.RUN as rut_empleado,
                f.DV as dv,
                f.Nombres,
                f.[Primer Apellido] as PATERNO,
                f.[Segundo Apellido] as MATERNO,
                f.[Nom. Estab.] as UNIDAD,
                f.[RBD Estab.] as rbd,
                f.[Régimen legal] as regimen_legal,
                f.Función as funcion,
                f.[Calidad Jurídica] as calidad_juridica,
                f.[Fecha Nac.] as fecha_nac,
                f.[Bienios Reconocidos CPEIP (Antigüedad)] as BIENIOS,
                f.[Fecha ingreso DAEM/CORPO] as INICIO,
                p.estado_validacion,
                p.fecha_reclamo,
                p.ruta_evidencia,
                p.rechazo_motivo,
                p.observaciones,
                p.observacion_cmds,
                p.email,
                p.celular
            FROM RankedFunc f
            INNER JOIN dbo.PERSONAL p ON p.[RUT EMPLEADO] = f.RUN
            WHERE f.rn = 1 AND p.codigo = '1'
        `;

        const result = await pool.request()
            .input('rut_empleado', sql.VarChar, req.user.rut_empleado.toString())
            .query(query);

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Trabajador no encontrado en la nómina de traspaso' });
        }

        const data = result.recordset[0];
        
        res.json({
            rut_empleado: data.rut_empleado,
            dv: data.dv,
            nombre_completo: `${data.Nombres} ${data.PATERNO} ${data.MATERNO}`.trim(),
            unidad: data.UNIDAD,
            rbd: data.rbd,
            regimen_legal: data.regimen_legal,
            funcion: data.funcion,
            calidad_juridica: data.calidad_juridica,
            fecha_nac: data.fecha_nac,
            bienios: data.BIENIOS,
            fecha_inicio_contrato: data.INICIO,
            estado_validacion: data.estado_validacion || 'PENDIENTE',
            fecha_reclamo: data.fecha_reclamo,
            ruta_evidencia: data.ruta_evidencia,
            rechazo_motivo: data.rechazo_motivo,
            observaciones: data.observaciones,
            observacion_cmds: data.observacion_cmds,
            email: data.email,
            celular: data.celular
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

router.get('/download-pdf', verifyToken, (req, res) => {
    // Eliminar cualquier espacio en blanco invisible y generar opciones
    const rutClean = req.user.full_rut.trim();
    const rutUpper = rutClean.toUpperCase();
    const rutLower = rutClean.toLowerCase();
    
    const filenameUpper = `${rutUpper}.ANTOFAGASTA.pdf`;
    const filenameLower = `${rutLower}.ANTOFAGASTA.pdf`;
    
    const repoPath = (process.env.PDF_REPO_PATH || '').trim(); 
    
    const filePathUpper = path.join(repoPath, filenameUpper);
    const filePathLower = path.join(repoPath, filenameLower);

    console.log('--- INTENTO DE DESCARGA PDF ---');
    
    let targetFilePath = null;
    let targetFilename = null;

    if (fs.existsSync(filePathUpper)) {
        targetFilePath = filePathUpper;
        targetFilename = filenameUpper;
        console.log('Archivo encontrado (Mayúscula):', targetFilePath);
    } else if (fs.existsSync(filePathLower)) {
        targetFilePath = filePathLower;
        targetFilename = filenameLower;
        console.log('Archivo encontrado (Minúscula):', targetFilePath);
    } else {
        console.log('Archivo NO encontrado en las rutas:', filePathUpper, 'ni', filePathLower);
    }

    if (targetFilePath) {
        res.download(targetFilePath, targetFilename, (err) => {
            if (err) {
                console.error('Error al enviar el archivo PDF:', err);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Error interno al leer el archivo PDF' });
                }
            } else {
                console.log('PDF enviado exitosamente:', targetFilename);
            }
        });
    } else {
        res.status(404).json({ error: 'Archivo no encontrado en el repositorio' });
    }
});

router.post('/validate', verifyToken, (req, res) => {
    upload.single('evidencia')(req, res, async function (err) {
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: 'El archivo excede el tamaño máximo de 10MB.' });
            }
            return res.status(400).json({ error: err.message });
        } else if (err) {
            if (err.message === 'FORMATO_INVALIDO') {
                return res.status(400).json({ error: 'Formato de archivo no permitido. Solo se aceptan imágenes, PDF, Word, Excel, ZIP y RAR.' });
            }
            return res.status(400).json({ error: err.message });
        }

        const { correcta, rechazoMotivo, observaciones, email, celular } = req.body;
        const rut_empleado = req.user.rut_empleado;

    try {
        const pool = await getConnection();
        const fechaReclamo = new Date();
        
        if (correcta === 'SI') {
            await pool.request()
                .input('rut', sql.VarChar, rut_empleado.toString())
                .input('fechaReclamo', sql.DateTime, fechaReclamo)
                .query("UPDATE dbo.PERSONAL SET estado_validacion = 'APROBADO FUNCIONARIO', fecha_reclamo = @fechaReclamo WHERE [RUT EMPLEADO] = @rut");
        } else if (correcta === 'NO') {
            const evidenciaPath = req.file ? req.file.filename : null;
            await pool.request()
                .input('rut', sql.VarChar, rut_empleado.toString())
                .input('fechaReclamo', sql.DateTime, fechaReclamo)
                .input('evidencia', sql.VarChar, evidenciaPath)
                .input('motivo', sql.VarChar, rechazoMotivo || null)
                .input('obs', sql.VarChar, observaciones || null)
                .input('email', sql.VarChar, email || null)
                .input('celular', sql.VarChar, celular || null)
                .query(`
                    UPDATE dbo.PERSONAL 
                    SET estado_validacion = 'RECHAZADO FUNCIONARIO', 
                        fecha_reclamo = @fechaReclamo, 
                        ruta_evidencia = @evidencia,
                        rechazo_motivo = @motivo,
                        observaciones = @obs,
                        email = @email,
                        celular = @celular
                    WHERE [RUT EMPLEADO] = @rut
                `);
        } else {
            return res.status(400).json({ error: 'Valor de validación inválido' });
        }

        res.json({ success: true, message: 'Validación guardada con éxito' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
    });
});

module.exports = router;
