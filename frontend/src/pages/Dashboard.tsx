import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import axios from 'axios';
import { Download, Upload, CheckCircle, AlertCircle } from 'lucide-react';

interface WorkerData {
  rut_empleado: number;
  dv: string;
  nombre_completo: string;
  unidad: string;
  tipo_contrato: string;
  bienios: number;
  fecha_inicio_contrato: string;
  estado_validacion: string;
}

export default function Dashboard() {
  const [data, setData] = useState<WorkerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Estados para validación
  const [correcta, setCorrecta] = useState<string>('');
  const [fechaReclamo, setFechaReclamo] = useState('');
  const [evidencia, setEvidencia] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const token = localStorage.getItem('token');
  const authConfig = { headers: { Authorization: `Bearer ${token}` } };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await axios.get('/api/worker/details', authConfig);
      setData(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      const response = await axios.get('/api/worker/download-pdf', {
        ...authConfig,
        responseType: 'blob'
      });
      
      const fullRut = `${data?.rut_empleado}${data?.dv}`;
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${fullRut}.ANTOFAGASTA.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (err: any) {
      alert('Error al descargar el archivo. Es posible que aún no esté digitalizado.');
    }
  };

  const handleSubmitValidation = async (e: FormEvent) => {
    e.preventDefault();
    if (!correcta) {
      alert('Debes seleccionar SI o NO');
      return;
    }
    
    if (correcta === 'NO' && (!fechaReclamo || !evidencia)) {
      alert('Debes ingresar la fecha correcta y subir un archivo de evidencia.');
      return;
    }

    setSubmitting(true);
    setError('');
    
    const formData = new FormData();
    formData.append('correcta', correcta);
    if (correcta === 'NO') {
      formData.append('fechaReclamo', fechaReclamo);
      formData.append('evidencia', evidencia!);
    }

    try {
      await axios.post('/api/worker/validate', formData, {
        headers: {
          ...authConfig.headers,
          'Content-Type': 'multipart/form-data'
        }
      });
      setSuccessMsg('Tu validación ha sido registrada exitosamente.');
      fetchData(); // Refrescar datos
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al enviar validación');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Cargando datos...</div>;
  if (error && !data) return <div className="p-8 text-center text-red-500">{error}</div>;
  if (!data) return null;

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    // Si ya viene como DD-MM-YYYY, se muestra tal cual
    if (/^\d{2}-\d{2}-\d{4}$/.test(dateString.trim())) {
      return dateString.trim();
    }
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('es-CL', { timeZone: 'UTC' });
  };

  const fullRut = `${data.rut_empleado}-${data.dv}`;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Tarjeta de Datos Personales */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-[#016098] border-b border-slate-100 pb-3 mb-4">
          Tus Antecedentes
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-sm text-slate-500 mb-1">Nombre Completo</p>
            <p className="font-medium text-slate-800">{data.nombre_completo}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500 mb-1">RUT</p>
            <p className="font-medium text-slate-800">{fullRut}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500 mb-1">Unidad / Establecimiento</p>
            <p className="font-medium text-slate-800">{data.unidad || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500 mb-1">Tipo de Contrato</p>
            <p className="font-medium text-slate-800">{data.tipo_contrato || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500 mb-1">Bienios</p>
            <p className="font-medium text-slate-800">{data.bienios ?? '-'}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500 mb-1">Fecha Inicio de Contrato Registrada</p>
            <p className="font-medium text-slate-800">{formatDate(data.fecha_inicio_contrato)}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500 mb-1">Estado de Validación</p>
            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
              data.estado_validacion === 'OK' ? 'bg-green-100 text-green-700' :
              data.estado_validacion === 'RECHAZADO' ? 'bg-amber-100 text-amber-700' :
              'bg-slate-100 text-slate-700'
            }`}>
              {data.estado_validacion === 'OK' && <CheckCircle size={14} />}
              {data.estado_validacion === 'RECHAZADO' && <AlertCircle size={14} />}
              {data.estado_validacion}
            </span>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-100">
          <button 
            onClick={handleDownload}
            className="flex items-center gap-2 bg-[#f8fafc] hover:bg-[#f1f5f9] text-[#016098] font-medium py-3 px-6 rounded-lg border border-[#e2e8f0] transition-colors duration-200"
          >
            <Download size={20} />
            Descargar mi Carpeta de Antecedentes (PDF)
          </button>
        </div>
      </div>

      {/* Tarjeta de Validación (Solo si está pendiente) */}
      {data.estado_validacion === 'PENDIENTE' ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-[#016098] mb-4">
            Proceso de Validación
          </h2>
          
          {successMsg ? (
            <div className="bg-green-50 text-green-700 p-4 rounded-lg flex items-start gap-3">
              <CheckCircle className="mt-0.5 shrink-0" />
              <p>{successMsg}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmitValidation} className="space-y-6">
              {error && <div className="text-red-500 text-sm">{error}</div>}
              
              <div>
                <p className="font-medium text-slate-800 mb-3">
                  ¿La fecha de inicio de su contrato es correcta?
                </p>
                <div className="flex gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="correcta" 
                      value="SI" 
                      checked={correcta === 'SI'}
                      onChange={(e) => setCorrecta(e.target.value)}
                      className="w-4 h-4 text-[#016098] focus:ring-[#016098]"
                    />
                    <span>Sí, es correcta</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="correcta" 
                      value="NO" 
                      checked={correcta === 'NO'}
                      onChange={(e) => setCorrecta(e.target.value)}
                      className="w-4 h-4 text-[#016098] focus:ring-[#016098]"
                    />
                    <span>No, hay un error</span>
                  </label>
                </div>
              </div>

              {correcta === 'NO' && (
                <div className="bg-slate-50 p-5 rounded-lg border border-slate-200 space-y-4 animate-in fade-in slide-in-from-top-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Fecha correcta de inicio de contrato
                    </label>
                    <input 
                      type="date" 
                      value={fechaReclamo}
                      onChange={(e) => setFechaReclamo(e.target.value)}
                      className="w-full md:w-1/2 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#016098] focus:border-[#016098] outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Subir Evidencia (PDF, Imagen, etc.)
                    </label>
                    <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-lg bg-white">
                      <div className="space-y-1 text-center">
                        <Upload className="mx-auto h-12 w-12 text-slate-400" />
                        <div className="flex text-sm text-slate-600 justify-center">
                          <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-[#016098] hover:text-[#014f7d] focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-[#016098]">
                            <span>Sube un archivo</span>
                            <input 
                              id="file-upload" 
                              name="file-upload" 
                              type="file" 
                              className="sr-only"
                              onChange={(e) => {
                                if (e.target.files && e.target.files.length > 0) {
                                  setEvidencia(e.target.files[0]);
                                }
                              }}
                              required
                            />
                          </label>
                        </div>
                        <p className="text-xs text-slate-500">
                          {evidencia ? evidencia.name : "PNG, JPG, PDF hasta 10MB"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || (correcta === 'NO' && (!fechaReclamo || !evidencia)) || !correcta}
                className="bg-[#016098] hover:bg-[#014f7d] text-white font-medium py-2.5 px-8 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Enviando...' : 'Guardar Validación'}
              </button>
            </form>
          )}
        </div>
      ) : (
        <div className="bg-green-50 text-green-800 p-6 rounded-xl border border-green-200 flex items-start gap-3">
          <CheckCircle className="mt-1 shrink-0 text-green-600" size={24} />
          <div>
            <h3 className="font-semibold text-lg">Validación Completada</h3>
            <p className="text-green-700 mt-1">
              Ya has completado el proceso de validación de tus antecedentes contractuales. 
              {data.estado_validacion === 'RECHAZADO' && ' Hemos registrado tu reparo y adjuntado tu evidencia para revisión.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
