import { useEffect, useState } from 'react';
import axios from 'axios';
import { Search, KeyRound, Eye, CheckCircle, AlertCircle, Clock, Users, Download, ClipboardCheck, Undo2, MonitorPlay } from 'lucide-react';
import * as XLSX from 'xlsx';

interface Stats {
  total_activos: number;
  total_aprobado_funcionario: number;
  total_rechazado_funcionario: number;
  total_aprobado_cmds: number;
  total_rechazado_cmds: number;
  total_pendiente_bienio: number;
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
  rechazo_motivo: string;
  observaciones: string;
  email: string;
  celular: string;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal Evaluation
  const [evaluatingWorker, setEvaluatingWorker] = useState<Worker | null>(null);
  const [resolutionAction, setResolutionAction] = useState<string>('');
  const [submittingResolution, setSubmittingResolution] = useState(false);

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
    if (!window.confirm(`¿Estás seguro de resetear la contraseña del RUT ${rut}-${dv}?`)) return;
    
    try {
      await axios.post('/api/admin/reset-password', { rut }, authConfig);
      alert('Contraseña reseteada exitosamente a los primeros 4 dígitos del RUT.');
    } catch (err) {
      alert('Error al resetear la contraseña.');
    }
  };

  const [observacionAdmin, setObservacionAdmin] = useState('');

  const handleResolveClaim = async () => {
    if (!evaluatingWorker || !resolutionAction) return;
    
    setSubmittingResolution(true);
    try {
      await axios.post('/api/admin/resolve-claim', {
        rut: evaluatingWorker.rut,
        email: evaluatingWorker.email,
        nombre: evaluatingWorker.nombre_completo,
        tipoRespuesta: resolutionAction,
        observacionAdmin: (resolutionAction === '1' || resolutionAction === '2') ? observacionAdmin : ''
      }, authConfig);
      
      alert('Resolución enviada y estado actualizado correctamente.');
      setEvaluatingWorker(null);
      setResolutionAction('');
      setObservacionAdmin('');
      fetchWorkers();
      fetchStats();
    } catch (err) {
      alert('Error al enviar la resolución.');
    } finally {
      setSubmittingResolution(false);
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
      'Fecha Transacción': w.fecha_reclamo ? new Date(w.fecha_reclamo).toLocaleDateString('es-CL') : 'N/A',
      'Motivo Rechazo': w.rechazo_motivo || '',
      'Observaciones': w.observaciones || '',
      'Correo': w.email || '',
      'Teléfono': w.celular || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Funcionarios");
    XLSX.writeFile(workbook, `Reporte_Validacion_SLEP_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const handleUndoValidation = async (rut: string, nombre: string) => {
    if (!window.confirm(`¿Está seguro de deshacer la validación de ${nombre}?\n\nEsto devolverá el estado a PENDIENTE, borrará su respuesta y eliminará los archivos de evidencia subidos para que pueda volver a validar desde cero.`)) return;
    try {
      await axios.post(`/api/admin/workers/${rut}/reset`, {}, authConfig);
      alert('Validación deshecha correctamente.');
      fetchWorkers();
      fetchStats();
    } catch (err) {
      alert('Error al deshacer validación.');
    }
  };

  const handleImpersonate = async (rut: string) => {
    try {
      const res = await axios.post(`/api/admin/impersonate/${rut}`, {}, authConfig);
      const { token } = res.data;
      // Abrir en nueva pestaña con el token
      window.open(`/dashboard?token=${token}`, '_blank');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al simular sesión del trabajador.');
    }
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
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <StatCard title="Total Funcionarios" value={stats?.total_activos} icon={<Users size={20} />} colorClass="bg-slate-100 text-slate-700" />
        <StatCard title="Pendiente Inicial" value={stats?.total_pendientes} icon={<Clock size={20} />} colorClass="bg-slate-100 text-slate-600" />
        <StatCard title="Aprobado Funcionario" value={stats?.total_aprobado_funcionario} icon={<CheckCircle size={20} />} colorClass="bg-green-50 text-green-600" />
        <StatCard title="Rechazado Funcionario" value={stats?.total_rechazado_funcionario} icon={<AlertCircle size={20} />} colorClass="bg-amber-50 text-amber-600" />
        <StatCard title="Aprobado CMDS" value={stats?.total_aprobado_cmds} icon={<CheckCircle size={20} />} colorClass="bg-blue-50 text-blue-600" />
        <StatCard title="Rechazado CMDS" value={stats?.total_rechazado_cmds} icon={<AlertCircle size={20} />} colorClass="bg-red-50 text-red-600" />
        <StatCard title="Pendiente Bienio" value={stats?.total_pendiente_bienio} icon={<Clock size={20} />} colorClass="bg-purple-50 text-purple-600" />
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
              <option value="PENDIENTE">PENDIENTE</option>
              <option value="APROBADO FUNCIONARIO">APROBADO FUNCIONARIO</option>
              <option value="RECHAZADO FUNCIONARIO">RECHAZADO FUNCIONARIO</option>
              <option value="APROBADO CMDS">APROBADO CMDS</option>
              <option value="RECHAZADO CMDS">RECHAZADO CMDS</option>
              <option value="PENDIENTE BIENIO">PENDIENTE BIENIO</option>
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
              <option value="REEMPLAZO">REEMPLAZO</option>
            </select>
          </div>
          <button 
            onClick={fetchWorkers}
            disabled={loading}
            className={`bg-slate-800 text-white px-4 py-1.5 text-sm rounded hover:bg-slate-700 transition flex items-center gap-2 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Procesando...
              </>
            ) : (
              <>
                <Search size={16} /> Buscar
              </>
            )}
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
                        w.estado_validacion === 'APROBADO FUNCIONARIO' ? 'bg-green-100 text-green-700' :
                        w.estado_validacion === 'RECHAZADO FUNCIONARIO' ? 'bg-amber-100 text-amber-700' :
                        w.estado_validacion === 'APROBADO CMDS' ? 'bg-blue-100 text-blue-700' :
                        w.estado_validacion === 'RECHAZADO CMDS' ? 'bg-red-100 text-red-700' :
                        w.estado_validacion === 'PENDIENTE BIENIO' ? 'bg-purple-100 text-purple-700' :
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
                      <button 
                        onClick={() => handleImpersonate(w.rut)}
                        title="Ver pantalla como el funcionario"
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition"
                      >
                        <MonitorPlay size={16} />
                      </button>
                      {w.estado_validacion && (
                        <button 
                          onClick={() => handleUndoValidation(w.rut, w.nombre_completo)}
                          title="Deshacer validación (Borrar evidencia y volver a PENDIENTE)"
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                        >
                          <Undo2 size={16} />
                        </button>
                      )}
                      {(w.estado_validacion === 'RECHAZADO FUNCIONARIO' || w.estado_validacion === 'RECHAZADO' || w.estado_validacion === 'RECHAZADO CMDS' || w.estado_validacion === 'APROBADO CMDS' || w.estado_validacion === 'PENDIENTE BIENIO') && w.ruta_evidencia && (
                        <a 
                          href={`/uploads/${w.ruta_evidencia}`} 
                          target="_blank" 
                          rel="noreferrer"
                          title="Ver Evidencia"
                          className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition inline-flex"
                        >
                          <Eye size={16} />
                        </a>
                      )}
                      
                      {w.estado_validacion === 'RECHAZADO FUNCIONARIO' && (
                        <button
                          onClick={() => setEvaluatingWorker(w)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold bg-[#016098] text-white rounded shadow-sm hover:bg-[#014f7d] transition"
                        >
                          <ClipboardCheck size={16} /> Evaluar
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {evaluatingWorker && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-800">Evaluar Reclamo de Funcionario</h3>
              <button onClick={() => setEvaluatingWorker(null)} className="text-slate-400 hover:text-slate-600 font-bold text-xl">&times;</button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div><span className="font-semibold text-slate-600">Nombre:</span> {evaluatingWorker.nombre_completo}</div>
                <div><span className="font-semibold text-slate-600">RUT:</span> {evaluatingWorker.rut}-{evaluatingWorker.dv}</div>
                <div><span className="font-semibold text-slate-600">Teléfono:</span> {evaluatingWorker.celular || 'No ingresado'}</div>
                <div><span className="font-semibold text-slate-600">Correo:</span> {evaluatingWorker.email || 'No ingresado'}</div>
                <div className="col-span-2 border-t border-slate-200 pt-3 mt-1">
                  <span className="font-semibold text-slate-600">Información Reclamada:</span> <span className="font-bold text-red-600">{evaluatingWorker.rechazo_motivo || 'No especificado'}</span>
                </div>
                <div className="col-span-2">
                  <span className="font-semibold text-slate-600">Observaciones del Funcionario:</span>
                  <p className="mt-1 p-3 bg-white border border-slate-200 rounded italic text-slate-700">{evaluatingWorker.observaciones || 'Sin observaciones.'}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Resolución CMDS (Se enviará por correo automáticamente):</label>
                <select 
                  className="w-full border border-slate-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500"
                  value={resolutionAction}
                  onChange={(e) => setResolutionAction(e.target.value)}
                >
                  <option value="">-- Seleccione una Resolución --</option>
                  <option value="1">APROBAR - "Información modificada según lo solicitado"</option>
                  <option value="2">RECHAZAR - "Documentos no respaldan lo indicado"</option>
                  <option value="3">RECHAZAR - "Faltan Documentos para Bienio"</option>
                </select>
              </div>
              
              {(resolutionAction === '1' || resolutionAction === '2') && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Observación Adicional (Opcional):</label>
                  <textarea 
                    className="w-full border border-slate-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
                    placeholder={resolutionAction === '1' ? "Escriba aquí los detalles de la aprobación que se incluirán en el correo..." : "Escriba aquí los detalles del rechazo que se incluirán en el correo..."}
                    value={observacionAdmin}
                    onChange={(e) => setObservacionAdmin(e.target.value)}
                  />
                  <p className="text-xs text-slate-500 mt-1">Este texto se añadirá como un párrafo en el correo de respuesta y será visible por el funcionario.</p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
              <button 
                onClick={() => setEvaluatingWorker(null)}
                className="px-4 py-2 border border-slate-300 rounded text-slate-600 hover:bg-slate-100 font-medium"
              >
                Cancelar
              </button>
              <button 
                onClick={handleResolveClaim}
                disabled={!resolutionAction || submittingResolution}
                className="px-6 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submittingResolution ? 'Enviando...' : 'Guardar y Enviar Correo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
