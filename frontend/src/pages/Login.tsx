import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function Login() {
  const navigate = useNavigate();
  const [rut, setRut] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Estados para cambio de contraseña obligatorio
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post('/api/auth/login', {
        rut,
        password
      });

      if (response.data.mustChangePassword) {
        setMustChangePassword(true);
      } else {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        
        const roles = response.data.user.roles || [];
        if (roles.includes('worker')) {
            navigate('/dashboard');
        } else if (roles.includes('admin')) {
            navigate('/admin/dashboard');
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas nuevas no coinciden');
      return;
    }

    setLoading(true);
    try {
      await axios.post('/api/auth/change-password', {
        rut,
        currentPassword: password,
        newPassword
      });

      // Luego del cambio exitoso, volvemos a hacer login para obtener el token
      const response = await axios.post('/api/auth/login', {
        rut,
        password: newPassword
      });

      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      navigate('/dashboard');

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
        <p className="text-center text-slate-500 mb-8 text-sm">
          {mustChangePassword 
            ? 'Por seguridad, debes cambiar tu contraseña inicial'
            : 'Plataforma de Validación de Antecedentes'}
        </p>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4 border border-red-200">
            {error}
          </div>
        )}

        {!mustChangePassword ? (
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
