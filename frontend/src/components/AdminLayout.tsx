import { useEffect, useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { LogOut, BarChart3 } from 'lucide-react';

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [userData, setUserData] = useState({ nombre: '', username: '' });

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    const userStr = localStorage.getItem('adminUser');
    
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        setUserData(user);
      } catch (e) {
        navigate('/admin/login');
      }
    } else {
      navigate('/admin/login');
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    navigate('/admin/login');
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800">
      <aside className="w-[260px] bg-slate-900 text-white flex flex-col shrink-0 shadow-xl z-10">
        
        <div className="p-6 flex flex-col items-center border-b border-slate-800">
          <img src="/logo.png" alt="CMDS Logo" className="w-full max-w-[140px] h-auto object-contain mb-2 brightness-0 invert" />
          <span className="text-sm text-slate-400 text-center font-semibold leading-tight mt-2 uppercase tracking-wider">
            Admin Panel
          </span>
          
          {userData.nombre && (
            <div className="flex flex-col items-center mt-4 bg-slate-800 w-full py-2 rounded-lg">
               <span className="text-sm font-medium">{userData.nombre}</span>
               <span className="text-xs text-slate-400">@{userData.username}</span>
            </div>
          )}
        </div>
        
        <nav className="flex-1 overflow-y-auto p-4">
          <ul className="space-y-2">
            <li>
              <Link 
                to="/admin/dashboard" 
                className={`flex items-center gap-3 w-full px-4 py-3 text-sm font-medium rounded-lg transition-colors duration-200 ${
                  isActive('/admin/dashboard') 
                  ? 'bg-slate-800 text-white border-l-4 border-blue-500' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <BarChart3 size={18} />
                Estadísticas y Usuarios
              </Link>
            </li>
          </ul>
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-4 py-2 text-sm font-medium text-slate-400 rounded-lg hover:bg-slate-800 hover:text-red-400 transition-colors duration-200"
          >
            <LogOut size={16} />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto flex flex-col">
        <header className="bg-white border-b border-slate-200 px-8 py-5 flex items-center justify-between shrink-0 shadow-sm">
           <h1 className="text-xl font-semibold text-slate-800">
             Gestión del Traspaso SLEP
           </h1>
        </header>
        <div className="p-8 flex-1">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
