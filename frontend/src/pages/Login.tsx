import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Lock } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [rut, setRut] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Estado de bloqueo del proceso de validación
  const [procesoCerrado, setProcesoCerrado] = useState(false);
  const [fechaCierre, setFechaCierre] = useState('');
  const [mensajeAdicional, setMensajeAdicional] = useState('');
  const [showAdminLogin, setShowAdminLogin] = useState(false);

  useEffect(() => {
    axios.get('/api/auth/system-status')
      .then((res) => {
        if (res.data) {
          setProcesoCerrado(Boolean(res.data.proceso_cerrado));
          setFechaCierre(res.data.fecha_cierre || '');
          setMensajeAdicional(res.data.mensaje_adicional || '');
        }
      })
      .catch(() => {});
  }, []);

  // Estados para cambio de contraseña obligatorio
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const cleanRut = rut.replace(/[.\-\s]/g, '').trim();
    const cleanPassword = password.trim();

    try {
      const response = await axios.post('/api/auth/login', {
        rut: cleanRut,
        password: cleanPassword
      });

      if (!response.data || typeof response.data !== 'object') {
        throw new Error('RESPUESTA_INVALIDA');
      }

      if (response.data.mustChangePassword) {
        setRut(cleanRut);
        setPassword(cleanPassword);
        setMustChangePassword(true);
      } else {
        try {
          localStorage.setItem('token', response.data.token);
          localStorage.setItem('user', JSON.stringify(response.data.user));
        } catch {
          localStorage.clear();
          localStorage.setItem('token', response.data.token);
          localStorage.setItem('user', JSON.stringify(response.data.user));
        }
        
        const roles = response.data.user?.roles || [];
        if (roles.includes('worker')) {
            navigate(`/dashboard?token=${response.data.token}`);
        } else if (roles.includes('admin')) {
            navigate('/admin/dashboard');
        }
      }
    } catch (err: any) {
      if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else if (err.response?.status === 400 || err.response?.status === 431) {
        setError('Error al iniciar sesión: Cookies saturadas en este navegador. Abra una ventana de Incógnito o presione Ctrl+F5.');
      } else if (err.response?.status) {
        setError(`Error al iniciar sesión (Servidor retornó código ${err.response.status}). Intente con Ctrl+F5.`);
      } else {
        setError('Error de conexión al iniciar sesión. Verifique su conexión a internet o intente en una ventana de Incógnito.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.trim() !== confirmPassword.trim()) {
      setError('Las contraseñas nuevas no coinciden');
      return;
    }

    const cleanRut = rut.replace(/[.\-\s]/g, '').trim();

    setLoading(true);
    try {
      await axios.post('/api/auth/change-password', {
        rut: cleanRut,
        currentPassword: password.trim(),
        newPassword: newPassword.trim()
      });

      // Luego del cambio exitoso, volvemos a hacer login para obtener el token
      const response = await axios.post('/api/auth/login', {
        rut: cleanRut,
        password: newPassword.trim()
      });

      try {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
      } catch {
        localStorage.clear();
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
      }
      const roles = response.data.user?.roles || [];
      if (roles.includes('worker')) {
        navigate(`/dashboard?token=${response.data.token}`);
      } else if (roles.includes('admin')) {
        navigate('/admin/dashboard');
      }

    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cambiar la contraseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f7f6]">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md border border-slate-200">
        <div className="flex justify-center mb-6">
          <img src="/logo.png" alt="CMDS Logo" className="h-32 object-contain" />
        </div>
        
        <h2 className="text-2xl font-bold text-center text-[#016098] mb-2">
          {mustChangePassword ? 'Cambio de Contraseña' : 'Traspaso SLEP'}
        </h2>
        <p className="text-center text-slate-500 mb-6 text-sm">
          {mustChangePassword 
            ? 'Por seguridad, debes cambiar tu contraseña inicial'
            : 'Plataforma de Validación de Antecedentes'}
        </p>

        {procesoCerrado && !mustChangePassword && (
          <div className="bg-amber-50 border border-amber-300 text-amber-900 p-4 rounded-xl mb-6 shadow-sm">
            <div className="flex items-center gap-2 font-bold text-amber-800 mb-2">
              <Lock size={18} className="shrink-0" />
              <span>Proceso de Validación Finalizado</span>
            </div>
            <p className="text-sm leading-relaxed">
              El proceso de validación de antecedentes ha finalizado
              {fechaCierre ? <> con fecha <strong>{fechaCierre}</strong></> : ''}.
            </p>
            {mensajeAdicional && (
              <p className="text-sm leading-relaxed mt-3 pt-3 border-t border-amber-200 whitespace-pre-line font-medium">
                {mensajeAdicional}
              </p>
            )}
          </div>
        )}

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4 border border-red-200 whitespace-pre-line">
            {error}
          </div>
        )}

        {procesoCerrado && !mustChangePassword && !showAdminLogin ? (
          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => setShowAdminLogin(true)}
              className="text-xs text-slate-400 hover:text-[#016098] underline transition"
            >
              Acceso exclusivo Administradores
            </button>
          </div>
        ) : !mustChangePassword ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">RUT (sin puntos ni guion)</label>
              <input
                type="text"
                value={rut}
                onChange={(e) => setRut(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#016098] focus:border-[#016098] outline-none"
                placeholder="123456789"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#016098] focus:border-[#016098] outline-none"
                placeholder="••••••••"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#016098] hover:bg-[#014f7d] text-white font-medium py-2.5 rounded-lg transition-colors duration-200 disabled:opacity-70"
            >
              {loading ? 'Ingresando...' : 'Iniciar Sesión'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nueva Contraseña</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#016098] focus:border-[#016098] outline-none"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Confirmar Nueva Contraseña</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#016098] focus:border-[#016098] outline-none"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#016098] hover:bg-[#014f7d] text-white font-medium py-2.5 rounded-lg transition-colors duration-200 disabled:opacity-70"
            >
              {loading ? 'Guardando...' : 'Guardar y Continuar'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
