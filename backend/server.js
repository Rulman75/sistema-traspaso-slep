require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const workerRoutes = require('./routes/worker');
const adminRoutes = require('./routes/admin');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sirviendo archivos estáticos (Evidencias subidas)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rutas API
app.use('/api/auth', authRoutes);
app.use('/api/worker', workerRoutes);
app.use('/api/admin', adminRoutes);

// Servir el frontend compilado (React)
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// Redirigir todas las demás peticiones al index.html de React (para React Router)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist', 'index.html'));
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, '127.0.0.1', () => {
    console.log(`Server running internally on 127.0.0.1:${PORT}`);
});
