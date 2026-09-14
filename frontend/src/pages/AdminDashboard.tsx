import { useEffect, useState } from 'react';
import axios from 'axios';
import { Search, KeyRound, Eye, CheckCircle, AlertCircle, Clock, Users, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

interface Stats {
  total_activos: number;
  total_ok: number;
  total_rechazados: number;
  total_pendientes: number;
}

interface Worker {
  rut: string;
  dv: string;
  nombre_completo: string;
  unidad: string;
  tipo_contrato: string;
  estado_validacion: string;
  fecha_reclamo: string;
  ruta_evidencia: string;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [filterRut, setFilterRut] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  
  const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
  const authConfig = { headers: { Authorization: `Bearer ${token}` } };

  useEffect(() => {
    fetchStats();
    fetchWorkers();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await axios.get('/api/admin/stats', authConfig);
      setStats(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchWorkers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterRut) params.append('rut', filterRut);
      if (filterEstado) params.append('estado', filterEstado);
      if (filterTipo) params.append('tipo_contrato', filterTipo);

      const res = await axios.get(`/api/admin/workers?${params.toString()}`, authConfig);
      setWorkers(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (rut: string, dv: string) => {
    if (!window.confirm(`¿Estás seguro de resetear la contraseña del RUT ${rut}-${dv} a "1234"?`)) return;
    
    try {
      await axios.post('/api/admin/reset-password', { rut }, authConfig);
      alert('Contraseña reseteada exitosamente a 1234.');
    } catch (err) {
      alert('Error al resetear la contraseña.');
    }
  };

  const exportToExcel = () => {
    if (workers.length === 0) {
      alert("No hay datos para exportar");
      return;
    }

    const dataToExport = workers.map(w => ({
      'RUT': `${w.rut}-${w.dv}`,
      'Nombre Completo': w.nombre_completo,
      'Unidad / Establecimiento': w.unidad || 'NO REGISTRA',
      'Tipo de Contrato': w.tipo_contrato,
      'Estado Validación': w.estado_validacion || 'PENDIENTE',
      'Fecha Reclamo': w.fecha_reclamo ? new Date(w.fecha_reclamo).toLocaleDateString('es-CL') : 'N/A'
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Funcionarios");
    XLSX.writeFile(workbook, `Reporte_Validacion_SLEP_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const StatCard = ({ title, value, icon, colorClass }: any) => (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
      <div className={`p-4 rounded-lg ${colorClass}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <h3 className="text-2xl font-bold text-slate-800">{value || 0}</h3>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard title="Total Funcionarios Activos" value={stats?.total_activos} icon={<Users size={24} />} colorClass="bg-blue-50 text-blue-600" />
        <StatCard title="Validados (OK)" value={stats?.total_ok} icon={<CheckCircle size={24} />} colorClass="bg-green-50 text-green-600" />
        <StatCard title="Rechazados (Con Reparo)" value={stats?.total_rechazados} icon={<AlertCircle size={24} />} colorClass="bg-amber-50 text-amber-600" />
        <StatCard title="Pendientes" value={stats?.total_pendientes} icon={<Clock size={24} />} colorClass="bg-slate-50 text-slate-600" />
      </div>

      {/* Filters and Grid */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[calc(100vh-250px)] min-h-[600px]">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Buscar por RUT</label>
            <input 
              type="text" 
              placeholder="Ej: 12345678" 
              value={filterRut}
              onChange={(e) => setFilterRut(e.target.value)}
              className="px-3 py-1.5 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none w-40"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Estado Validación</label>
            <select 
              value={filterEstado}
              onChange={(e) => setFilterEstado(e.target.value)}
              className="px-3 py-1.5 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none w-40"
            >
              <option value="">Todos</option>
              <option value="OK">OK</option>
              <option value="RECHAZADO">RECHAZADO</option>
              <option value="PENDIENTE">PENDIENTE</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Tipo Contrato</label>
            <select 
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value)}
              className="px-3 py-1.5 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none w-40"
            >
              <option value="">Todos</option>
              <option value="INDEFINIDO">INDEFINIDO</option>
              <option value="PLAZO FIJO">PLAZO FIJO</option>
            </select>
          </div>
          <button 
            onClick={fetchWorkers}
            className="bg-slate-800 text-white px-4 py-1.5 text-sm rounded hover:bg-slate-700 transition flex items-center gap-2"
          >
            <Search size={16} /> Buscar
          </button>

          <button 
            onClick={exportToExcel}
            className="bg-green-600 text-white px-4 py-1.5 text-sm rounded hover:bg-green-700 transition flex items-center gap-2 ml-auto"
            title="Exportar a Excel"
          >
            <Download size={16} /> Exportar Excel
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-white sticky top-0 border-b border-slate-200 z-10 shadow-sm text-slate-700">
              <tr>
                <th className="px-4 py-3 font-semibold">RUT</th>
                <th className="px-4 py-3 font-semibold">Nombre</th>
                <th className="px-4 py-3 font-semibold">Unidad</th>
                <th className="px-4 py-3 font-semibold">Contrato</th>
                <th className="px-4 py-3 font-semibold text-center">Estado</th>
                <th className="px-4 py-3 font-semibold text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-8">Cargando...</td></tr>
              ) : workers.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-slate-400">No se encontraron trabajadores</td></tr>
              ) : (
                workers.map((w, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="px-4 py-3 whitespace-nowrap">{w.rut}-{w.dv}</td>
                    <td className="px-4 py-3">{w.nombre_completo}</td>
                    <td className="px-4 py-3 text-xs">{w.unidad || '-'}</td>
                    <td className="px-4 py-3 text-xs">{w.tipo_contrato}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-bold tracking-wide ${
                        w.estado_validacion === 'OK' ? 'bg-green-100 text-green-700' :
                        w.estado_validacion === 'RECHAZADO' ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {w.estado_validacion || 'PENDIENTE'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center flex justify-center gap-2">
                      <button 
                        onClick={() => handleResetPassword(w.rut, w.dv)}
                        title="Resetear Contraseña a 1234"
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition"
                      >
                        <KeyRound size={16} />
                      </button>
                      {w.estado_validacion === 'RECHAZADO' && w.ruta_evidencia ? (
                        <a 
                          href={`/uploads/${w.ruta_evidencia}`} 
                          target="_blank" 
                          rel="noreferrer"
                          title="Ver Evidencia"
                          className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition inline-flex"
                        >
                          <Eye size={16} />
                        </a>
                      ) : (
                        <span className="p-1.5 w-[28px] inline-block"></span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
