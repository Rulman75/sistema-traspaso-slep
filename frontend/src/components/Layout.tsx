import { useEffect, useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { FileCheck, LogOut, BarChart3, Users } from 'lucide-react';

interface UserData {
  rut: string;
  nombre: string;
  roles?: string[];
}

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [userData, setUserData] = useState<UserData>({ rut: '', nombre: '', roles: [] });

  useEffect(() => {
    // Soportar transiciones del token viejo (adminToken) al nuevo único (token)
    // Pero como lo unificamos, leemos de 'token'.
    const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
    const userStr = localStorage.getItem('user') || localStorage.getItem('adminUser');
    
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        setUserData({
            rut: user.rut,
            nombre: user.nombre_completo || user.nombre,
            roles: user.roles || []
        });
      } catch (e) {
        navigate('/login');
      }
    } else {
      navigate('/login');
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  const isWorker = userData.roles?.includes('worker');
  const isAdmin = userData.roles?.includes('admin');

  return (
    <div className="flex h-screen bg-[#f4f7f6] font-sans text-[#1e293b]">
      {/* Sidebar Corporativo */}
      <aside className="w-[260px] bg-white border-r border-[#e2e8f0] flex flex-col shrink-0">
        
        {/* Logo / Header del Sidebar */}
        <div className="p-6 flex flex-col items-center border-b border-[#e2e8f0]">
          <img src="/logo.png" alt="CMDS Logo" className="w-full max-w-[140px] h-auto object-contain mb-2" />
          <span className="text-[1rem] text-[#64748b] text-center font-semibold leading-tight mt-2">
            Traspaso SLEP<br/>Validación de Antecedentes
          </span>
          
          {userData.nombre && (
            <div className="flex flex-col items-center mt-4 text-center">
               <div className="flex items-center gap-2 text-xs text-[#016098] bg-[#e0f2fe] px-3 py-1.5 rounded-full font-medium tracking-wide">
                 <span className="w-1.5 h-1.5 bg-[#39BABD] rounded-full"></span>
                 {userData.nombre}
               </div>
               <span className="text-xs text-slate-500 mt-1">{userData.rut}</span>
               
               {isAdmin && (
                   <span className="mt-2 text-[10px] font-bold uppercase bg-slate-800 text-white px-2 py-0.5 rounded">
                       Administrador
                   </span>
               )}
            </div>
          )}
        </div>
        
        {/* Navegación */}
        <nav className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <ul className="space-y-1">
            {isWorker && (
              <li>
                <Link 
                  to="/dashboard" 
                  className={`flex items-center gap-3 w-full px-4 py-3 text-sm font-medium rounded-lg transition-colors duration-200 ${
                    isActive('/dashboard') 
                    ? 'bg-[#016098] text-white' 
                    : 'text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#016098]'
                  }`}
                >
                  <FileCheck size={18} />
                  Mi Validación
                </Link>
              </li>
            )}
            
            {isAdmin && (
              <>
                <li>
                  <Link 
                    to="/admin/dashboard" 
                    className={`flex items-center gap-3 w-full px-4 py-3 text-sm font-medium rounded-lg transition-colors duration-200 mt-2 ${
                      isActive('/admin/dashboard') 
                      ? 'bg-[#016098] text-white' 
                      : 'text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#016098]'
                    }`}
                  >
                    <BarChart3 size={18} />
                    Panel Administrador
                  </Link>
                </li>
                <li>
                  <Link 
                    to="/admin/users" 
                    className={`flex items-center gap-3 w-full px-4 py-3 text-sm font-medium rounded-lg transition-colors duration-200 mt-2 ${
                      isActive('/admin/users') 
                      ? 'bg-[#016098] text-white' 
                      : 'text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#016098]'
                    }`}
                  >
                    <Users size={18} />
                    Administradores
                  </Link>
                </li>
              </>
            )}
          </ul>
        </nav>

        {/* Footer Sidebar (Logout) */}
        <div className="p-4 border-t border-[#e2e8f0]">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-4 py-2 text-sm font-medium text-red-600 rounded-lg hover:bg-red-50 transition-colors duration-200"
          >
            <LogOut size={16} />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto flex flex-col">
        <header className="bg-white border-b border-[#e2e8f0] px-8 py-5 flex items-center justify-between shrink-0 shadow-sm">
           <h1 className="text-xl font-semibold text-[#016098]">
             {isActive('/admin/dashboard') ? 'Gestión del Traspaso SLEP' : 'Validación de Antecedentes Contractuales'}
           </h1>
        </header>
        <div className="p-8 flex-1">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
