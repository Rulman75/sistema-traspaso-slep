import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import axios from 'axios';
import { Download, Upload, CheckCircle, AlertCircle, Info } from 'lucide-react';

interface WorkerData {
  rut_empleado: number;
  dv: string;
  nombre_completo: string;
  unidad: string;
  rbd: number;
  regimen_legal: string;
  funcion: string;
  calidad_juridica: string;
  fecha_nac: string;
  bienios: string;
  fecha_inicio_contrato: string;
  estado_validacion: string;
  ruta_evidencia?: string;
  rechazo_motivo?: string;
  observaciones?: string;
  observacion_cmds?: string;
  email?: string;
  celular?: string;
}

export default function Dashboard() {
  const [data, setData] = useState<WorkerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Estados para validación
  const [correcta, setCorrecta] = useState<string>('');
  const [rechazoMotivo, setRechazoMotivo] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [email, setEmail] = useState('');
  const [celular, setCelular] = useState('');
  
  const [evidencia, setEvidencia] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token') || localStorage.getItem('token');
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

  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<string>('');

  const handleDownload = async () => {
    setDownloading(true);
    setDownloadProgress('Iniciando...');
    try {
      const response = await axios.get('/api/worker/download-pdf', {
        ...authConfig,
        responseType: 'blob',
        onDownloadProgress: (progressEvent) => {
          if (progressEvent.loaded) {
            const mb = (progressEvent.loaded / (1024 * 1024)).toFixed(1);
            if (progressEvent.total) {
              const totalMb = (progressEvent.total / (1024 * 1024)).toFixed(1);
              setDownloadProgress(`Descargando: ${mb} MB de ${totalMb} MB...`);
            } else {
              setDownloadProgress(`Descargando: ${mb} MB...`);
            }
          }
        }
      });
      
      setDownloadProgress('Abriendo archivo...');
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
    } finally {
      setDownloading(false);
      setDownloadProgress('');
    }
  };

  const handleSubmitValidation = async (e: FormEvent) => {
    e.preventDefault();
    if (!correcta) {
      alert('Debes seleccionar SI o NO');
      return;
    }
    
    if (correcta === 'NO') {
      if (!rechazoMotivo) {
        alert('Debes seleccionar qué información es incorrecta.');
        return;
      }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        alert('Debes ingresar un correo electrónico válido.');
        return;
      }
      if (!celular || celular.length < 8) {
        alert('Debes ingresar un número de celular válido.');
        return;
      }
    }

    setSubmitting(true);
    setError('');
    
    const formData = new FormData();
    formData.append('correcta', correcta);
    if (correcta === 'NO') {
      formData.append('rechazoMotivo', rechazoMotivo);
      formData.append('observaciones', observaciones);
      formData.append('email', email);
      formData.append('celular', celular);
      if (evidencia) {
        formData.append('evidencia', evidencia);
      }
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
    if (/^\d{2}-\d{2}-\d{4}$/.test(dateString.trim())) {
      return dateString.trim();
    }
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${day}-${month}-${year}`;
  };

  const fullRut = `${data.rut_empleado}-${data.dv}`;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Tarjeta de Datos Personales */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-[#016098] border-b border-slate-100 pb-3 mb-4">
          Tus Antecedentes
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 uppercase">
          <div>
            <p className="text-sm text-slate-500 mb-1 normal-case">Nombre Completo</p>
            <p className="font-medium text-slate-800">{data.nombre_completo}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500 mb-1 normal-case">RUT</p>
            <p className="font-medium text-slate-800">{fullRut}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500 mb-1 normal-case">Fecha Nac.</p>
            <p className="font-medium text-slate-800">{formatDate(data.fecha_nac) || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500 mb-1 normal-case">Nombre Establecimiento</p>
            <p className="font-medium text-slate-800">{data.unidad || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500 mb-1 normal-case">RBD Estab.</p>
            <p className="font-medium text-slate-800">{data.rbd || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500 mb-1 normal-case">Régimen Legal</p>
            <p className="font-medium text-slate-800">{data.regimen_legal || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500 mb-1 normal-case">Calidad Jurídica</p>
            <p className="font-medium text-slate-800">{data.calidad_juridica || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500 mb-1 normal-case">
              {data.regimen_legal?.includes('19.464') ? 'Categoría' : 'Función'}
            </p>
            <p className="font-medium text-slate-800">{data.funcion || '-'}</p>
          </div>

          {/* Campos Destacados */}
          <div className="md:col-span-2 bg-[#016098]/5 rounded-lg border border-[#016098]/20 p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
              <div>
                <p className="text-sm text-[#016098] font-bold mb-1 normal-case">Bienios Reconocidos CPEIP</p>
                <p className="text-lg font-bold text-[#016098]">{data.bienios ?? '-'}</p>
              </div>
              <div>
                <p className="text-sm text-[#016098] font-bold mb-1 normal-case">Fecha Ingreso CMDS</p>
                <p className="text-lg font-bold text-[#016098]">{formatDate(data.fecha_inicio_contrato) || '-'}</p>
              </div>
            </div>
            
            <div className="flex gap-2 p-3 bg-blue-50/80 border border-blue-100 rounded text-sm text-[#016098]">
              <Info className="shrink-0 mt-0.5" size={18} />
              <div className="flex flex-col gap-2">
                <p>
                  <strong>Funcionarios Asistentes de la Educación:</strong> La fecha de ingreso corresponde a la fecha de inicio del primer contrato a plazo fijo que dio continuidad ininterrumpida a la relación laboral vigente. No se considerarán contratos o períodos anteriores que hayan presentado interrupción o discontinuidad.
                </p>
                <p>
                  <strong>Funcionarios Docentes:</strong> La fecha de ingreso corresponde a la fecha en que asumió formalmente la calidad de titular.
                </p>
              </div>
            </div>
          </div>

          <div>
            <p className="text-sm text-slate-500 mb-1">Estado de Validación</p>
            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
              data.estado_validacion === 'APROBADO FUNCIONARIO' ? 'bg-green-100 text-green-700' :
              data.estado_validacion === 'RECHAZADO FUNCIONARIO' ? 'bg-amber-100 text-amber-700' :
              data.estado_validacion === 'APROBADO CMDS' ? 'bg-blue-100 text-blue-700' :
              data.estado_validacion === 'RECHAZADO CMDS' ? 'bg-red-100 text-red-700' :
              'bg-slate-100 text-slate-700'
            }`}>
              {(data.estado_validacion === 'APROBADO FUNCIONARIO' || data.estado_validacion === 'APROBADO CMDS') && <CheckCircle size={14} />}
              {(data.estado_validacion === 'RECHAZADO FUNCIONARIO' || data.estado_validacion === 'RECHAZADO CMDS') && <AlertCircle size={14} />}
              {data.estado_validacion}
            </span>
            {data.observacion_cmds && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-md">
                <p className="text-xs font-semibold text-blue-800 mb-1">Observación de CMDS:</p>
                <p className="text-sm text-blue-900 whitespace-pre-wrap">{data.observacion_cmds}</p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-100">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-[#016098] mb-1">Descarga de Documentación</h3>
            <p className="text-sm text-slate-500">Aquí puedes descargar una copia digital de tu carpeta de antecedentes para tu respaldo personal.</p>
          </div>
          <button 
            onClick={handleDownload}
            disabled={downloading}
            className={`flex items-center gap-2 font-medium py-3 px-6 rounded-lg border transition-colors duration-200 w-full md:w-auto justify-center ${
              downloading 
              ? 'bg-red-50 text-red-600 border-red-200 cursor-wait shadow-inner' 
              : 'bg-[#f8fafc] hover:bg-[#f1f5f9] text-[#016098] border-[#e2e8f0]'
            }`}
          >
            {downloading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="font-bold">{downloadProgress || 'Descargando (puede tomar unos minutos)...'}</span>
              </>
            ) : (
              <>
                <Download size={20} />
                Descargar mi Carpeta de Antecedentes (PDF)
              </>
            )}
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
                  ¿La información relacionada a su Fecha de Ingreso CMDS y Bienios Reconocidos es correcta?
                </p>
                <div className="flex gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="correcta" 
                      value="SI" 
                      checked={correcta === 'SI'}
                      onChange={() => {
                        setCorrecta('SI');
                        setRechazoMotivo('');
                        setObservaciones('');
                        setEmail('');
                        setCelular('');
                        setEvidencia(null);
                      }}
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
                      onChange={() => setCorrecta('NO')}
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
                      ¿Qué información es incorrecta?
                    </label>
                    <select 
                      value={rechazoMotivo}
                      onChange={(e) => setRechazoMotivo(e.target.value)}
                      className="w-full md:w-1/2 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#016098] focus:border-[#016098] outline-none"
                      required
                    >
                      <option value="">Seleccione una opción...</option>
                      <option value="Fecha de Ingreso">Fecha de Ingreso</option>
                      <option value="Bienios Reconocidos">Bienios Reconocidos</option>
                      <option value="Ambas">Ambas</option>
                      <option value="Otras">Otras</option>
                      <option value="Carpeta de Antecedentes No Disponible">Carpeta de Antecedentes No Disponible</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Observaciones (Indique la información correcta)
                    </label>
                    <textarea 
                      value={observaciones}
                      onChange={(e) => setObservaciones(e.target.value.slice(0, 300))}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#016098] focus:border-[#016098] outline-none min-h-[100px]"
                      placeholder="Explique brevemente el error..."
                      maxLength={300}
                    ></textarea>
                    <div className="text-right text-xs text-slate-500 mt-1">
                      {observaciones.length} / 300 caracteres
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Correo Electrónico (Obligatorio)
                      </label>
                      <input 
                        type="email" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#016098] focus:border-[#016098] outline-none"
                        placeholder="correo@ejemplo.com"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Teléfono Celular (Obligatorio)
                      </label>
                      <input 
                        type="tel" 
                        value={celular}
                        onChange={(e) => setCelular(e.target.value)}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#016098] focus:border-[#016098] outline-none"
                        placeholder="Ej: +56912345678"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Subir Evidencia (Opcional)
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
                            />
                          </label>
                        </div>
                        <p className="text-xs text-slate-500 mt-2">
                          {evidencia ? <span className="font-semibold text-[#016098]">{evidencia.name}</span> : "Opcional: Suba un archivo si necesita respaldar su reclamo."}
                          <br/>
                          Formatos permitidos: Imágenes, PDF, Word, Excel, ZIP y RAR. Peso máximo: 10MB
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || (correcta === 'NO' && (!rechazoMotivo || !email || !celular)) || !correcta}
                className="bg-[#016098] hover:bg-[#014f7d] text-white font-medium py-2.5 px-8 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Enviando...' : 'Guardar Validación'}
              </button>
            </form>
          )}
        </div>
      ) : (
        <div className={`p-6 rounded-xl border flex flex-col gap-4 ${data.estado_validacion.includes('RECHAZADO') ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
          <div className="flex items-start gap-3">
            {data.estado_validacion.includes('RECHAZADO') ? <AlertCircle className="mt-1 shrink-0 text-amber-600" size={24} /> : <CheckCircle className="mt-1 shrink-0 text-green-600" size={24} />}
            <div>
              <h3 className={`font-semibold text-lg ${data.estado_validacion.includes('RECHAZADO') ? 'text-amber-800' : 'text-green-800'}`}>
                Validación Completada
              </h3>
              <p className={`mt-1 ${data.estado_validacion.includes('RECHAZADO') ? 'text-amber-700' : 'text-green-700'}`}>
                Ya has completado el proceso de validación de tus antecedentes contractuales.
                {data.estado_validacion === 'RECHAZADO FUNCIONARIO' && ' Hemos registrado tu reparo y tu evidencia para la revisión de CMDS.'}
              </p>
            </div>
          </div>
          
          {(data.estado_validacion === 'RECHAZADO FUNCIONARIO' || data.estado_validacion === 'APROBADO CMDS' || data.estado_validacion === 'RECHAZADO CMDS') && data.rechazo_motivo && (
            <div className="mt-4 bg-white p-5 rounded-lg border border-slate-200 text-sm text-slate-700 space-y-3">
              <h4 className="font-semibold text-[#016098] border-b border-slate-100 pb-2 mb-3">Información de tu Solicitud</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><span className="font-medium text-slate-500">Motivo:</span> {data.rechazo_motivo}</div>
                <div><span className="font-medium text-slate-500">Correo:</span> {data.email}</div>
                <div><span className="font-medium text-slate-500">Celular:</span> {data.celular}</div>
                <div><span className="font-medium text-slate-500">Evidencia:</span> {data.ruta_evidencia ? 'Documento Adjuntado' : 'No adjunta'}</div>
                <div className="md:col-span-2">
                  <span className="font-medium text-slate-500 block mb-1">Observaciones:</span>
                  <p className="bg-slate-50 p-3 rounded border border-slate-100">{data.observaciones}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
