import Cadastro from './pages/Cadastro';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import GestaoUsuarios from './pages/GestaoUsuarios';
import Login from './pages/Login';
import PaginaVisitante from './pages/PaginaVisitante';
import ListaRegras from './pages/ListaRegras';
import NovaRegra from './pages/NovaRegra';
import Incidentes from './pages/Incidentes';
import DetalhesIncidente from './pages/DetalhesIncidente';
import LogAuditoria from './pages/LogAuditoria';
import ControleAcesso from './pages/ControleAcesso';
import GestaoEscalas from './pages/GestaoEscalas';
import Preferencias from './pages/Preferencias';



import DashboardOperador from './pages/DashboardOperador';

function App() {
  return (
    <BrowserRouter>
      <Routes>

        <Route path="/" element={<Login />} />
        <Route path="/visitante" element={<PaginaVisitante />} />
        <Route path="/cadastro" element={<Cadastro />} />


        <Route path="/admin" element={<MainLayout role="admin" />}>
          <Route index element={<div><h2>Dashboard Geral do Admin</h2></div>} />
          <Route path="usuarios" element={<GestaoUsuarios />} />
          <Route path="regras" element={<ListaRegras />} />
          <Route path="regras/nova" element={<NovaRegra />} />
          <Route path="regras/editar/:id" element={<NovaRegra />} />
          <Route path="incidentes" element={<Incidentes />} />
          <Route path="incidentes/:id" element={<DetalhesIncidente />} />

          <Route path="escalas" element={<GestaoEscalas role="admin" />} />
          <Route path="permissoes" element={<ControleAcesso />} />
          <Route path="notificacoes" element={<Preferencias />} />
          <Route path="logs" element={<LogAuditoria />} />
        </Route>

        <Route path="/operador" element={<MainLayout role="operator" />}>
          <Route index element={<DashboardOperador />} />
          <Route path="incidentes" element={<Incidentes />} />
          <Route path="incidentes/:id" element={<DetalhesIncidente />} />
          <Route path="escalas" element={<GestaoEscalas role="operator" />} />
          <Route path="notificacoes" element={<Preferencias />} />
          <Route path="perfil" element={<div className="card"><h2>Editar Perfil</h2></div>} />
        </Route>

      </Routes>
    </BrowserRouter>
  );
}

export default App;