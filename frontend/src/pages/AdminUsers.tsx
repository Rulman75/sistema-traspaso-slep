import { useEffect, useState } from 'react';
import axios from 'axios';
import { Pencil, Trash2, Plus, X, KeyRound } from 'lucide-react';

interface AdminUser {
  id: number;
  username: string;
  nombre: string;
}

export default function AdminUsers() {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null);
  const [formData, setFormData] = useState({ username: '', nombre: '', password: '' });

  const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
  const authConfig = { headers: { Authorization: `Bearer ${token}` } };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    try {
      const res = await axios.get('/api/admin/admins', authConfig);
      setAdmins(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenModal = (admin?: AdminUser) => {
    if (admin) {
      setEditingAdmin(admin);
      setFormData({ username: admin.username, nombre: admin.nombre, password: '' });
    } else {
      setEditingAdmin(null);
      setFormData({ username: '', nombre: '', password: '' });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingAdmin(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingAdmin) {
        await axios.put(`/api/admin/admins/${editingAdmin.id}`, formData, authConfig);
      } else {
        await axios.post('/api/admin/admins', formData, authConfig);
      }
      fetchAdmins();
      handleCloseModal();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al guardar el administrador');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('¿Estás seguro de eliminar este administrador?')) return;
    try {
      await axios.delete(`/api/admin/admins/${id}`, authConfig);
      fetchAdmins();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al eliminar el administrador');
    }
  };

  const handleResetPassword = async (id: number, username: string) => {
    if (!window.confirm(`¿Estás seguro de resetear la contraseña del administrador ${username} a los primeros 4 dígitos de su usuario?`)) return;
    try {
      await axios.post(`/api/admin/admins/${id}/reset-password`, {}, authConfig);
      alert('Contraseña reseteada exitosamente. El usuario deberá cambiarla al iniciar sesión.');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al resetear la contraseña');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">Mantenedor de Administradores</h2>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-[#016098] hover:bg-[#014f7d] text-white px-4 py-2 rounded flex items-center gap-2"
        >
          <Plus size={20} /> Nuevo Administrador
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
            <tr>
              <th className="px-6 py-4">Usuario (RUT/Email)</th>
              <th className="px-6 py-4">Nombre Completo</th>
              <th className="px-6 py-4 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {admins.map(admin => (
              <tr key={admin.id} className="hover:bg-slate-50">
                <td className="px-6 py-4">{admin.username}</td>
                <td className="px-6 py-4">{admin.nombre}</td>
                <td className="px-6 py-4 text-center flex justify-center gap-3">
                  <button onClick={() => handleResetPassword(admin.id, admin.username)} className="text-slate-400 hover:text-blue-600" title="Resetear Contraseña a por defecto">
                    <KeyRound size={18} />
                  </button>
                  <button onClick={() => handleOpenModal(admin)} className="text-blue-600 hover:text-blue-800" title="Editar">
                    <Pencil size={18} />
                  </button>
                  <button onClick={() => handleDelete(admin.id)} className="text-red-600 hover:text-red-800" title="Eliminar">
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
            {admins.length === 0 && (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-slate-500">No hay administradores registrados</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg text-slate-800">
                {editingAdmin ? 'Editar Administrador' : 'Nuevo Administrador'}
              </h3>
              <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre de Usuario (Ej: RUT)</label>
                <input 
                  type="text" 
                  required
                  value={formData.username}
                  onChange={e => setFormData({...formData, username: e.target.value})}
                  className="w-full border border-slate-300 rounded px-3 py-2 focus:ring-1 focus:ring-[#016098] outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre Completo</label>
                <input 
                  type="text" 
                  required
                  value={formData.nombre}
                  onChange={e => setFormData({...formData, nombre: e.target.value})}
                  className="w-full border border-slate-300 rounded px-3 py-2 focus:ring-1 focus:ring-[#016098] outline-none"
                />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={handleCloseModal} className="px-4 py-2 border border-slate-300 rounded text-slate-700 hover:bg-slate-50">
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 bg-[#016098] hover:bg-[#014f7d] text-white rounded">
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
