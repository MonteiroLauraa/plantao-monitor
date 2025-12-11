import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';
import { auth } from '../firebaseConfig'; // Import Auth
import './Incidentes.css';

const Incidentes = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [incidentes, setIncidentes] = useState([]);
  const [regras, setRegras] = useState({});
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroTexto, setFiltroTexto] = useState('');
  const [mySchedule, setMySchedule] = useState(null); // New State

  useEffect(() => {
    carregarRegras();
    carregarIncidentes();
    checkOnCall(); // Check Status
    const interval = setInterval(() => {
      carregarIncidentes();
      checkOnCall();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const checkOnCall = async () => {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;

      // 1. Get My ID
      const userRes = await api.get(`/check-user?uid=${uid}`);
      const myId = userRes.data.id;

      // 2. Get All Schedules (or optimized endpoint)
      const res = await api.get('/escalas');
      const now = new Date();

      const current = res.data.find(e =>
        e.id_usuario === myId &&
        new Date(e.data_inicio) <= now &&
        new Date(e.data_fim) >= now
      );
      setMySchedule(current);

    } catch (e) { console.error("Erro checkOnCall", e); }
  };

  const carregarRegras = async () => {
    try {
      const res = await api.get('/regras');
      const mapa = {};
      res.data.forEach(r => mapa[r.id_regra] = r.nome);
      setRegras(mapa);
    } catch (e) { console.error(e); }
  };

  const carregarIncidentes = async () => {
    try {
      const res = await api.get('/incidentes');
      setIncidentes(res.data);
    } catch (e) { console.error(e); }
  };


  const handleExportCSV = () => {
    const headers = ['ID,Regra,Status,Prioridade,Data,Detalhes'];
    const rows = incidentesFiltrados.map(inc => {
      const nomeRegra = regras[inc.id_regra] || `ID ${inc.id_regra}`;
      return `${inc.id_incidente},"${nomeRegra}",${inc.status},${inc.prioridade},"${inc.data_abertura}","${inc.detalhes.replace(/"/g, '""')}"`;
    });

    const csvContent = headers.concat(rows).join('\n');
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'relatorio_incidentes.csv';
    link.click();
  };


  const incidentesFiltrados = incidentes.filter(inc => {
    const matchStatus = filtroStatus === 'todos' ? true : inc.status === filtroStatus.toUpperCase();
    const nomeRegra = (regras[inc.id_regra] || '').toLowerCase();
    const matchTexto = nomeRegra.includes(filtroTexto.toLowerCase());
    return matchStatus && matchTexto;
  });

  const getBasePath = () => {
    return location.pathname.includes('/operador') ? '/operador' : '/admin';
  };
  return (
    <div className="incidentes-container">
      <h1>Painel de Incidentes em Tempo Real</h1>

      {/* ON-CALL WIDGET REMOVIDO PARA O DASHBOARD */}

      <div className="metricas-grid">
        <div className="metrica-card">
          <h3>Incidentes Criados</h3>
          <span>{incidentes.length}</span>
        </div>
        <div className="metrica-card">
          <h3>Abertos (OPEN)</h3>
          <span style={{ color: '#dc3545' }}>{incidentes.filter(i => i.status === 'OPEN').length}</span>
        </div>
        <div className="metrica-card">
          <h3>Em Análise (ACK)</h3>
          <span style={{ color: '#ffc107' }}>{incidentes.filter(i => i.status === 'ACK').length}</span>
        </div>
        <button className="btn-csv" onClick={handleExportCSV}>Exportar CSV</button>
      </div>


      <div className="filtros-bar">
        <label>Status:</label>
        <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
          <option value="todos">Todos</option>
          <option value="open">OPEN</option>
          <option value="ack">ACK</option>
          <option value="closed">CLOSED</option>
        </select>

        <label>Regra:</label>
        <input
          type="text"
          placeholder="Digite o nome da regra..."
          value={filtroTexto}
          onChange={(e) => setFiltroTexto(e.target.value)}
        />
        <button className="btn-filtrar">Filtrar</button>
      </div>


      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Regra</th>
            <th>Status</th>
            <th>Prioridade</th>
            <th>Ocorrência</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {incidentesFiltrados.map(inc => (
            <tr key={inc.id_incidente}>
              <td>#{inc.id_incidente}</td>
              <td>{regras[inc.id_regra] || `Regra ${inc.id_regra}`}</td>
              <td className={`status-${inc.status.toLowerCase()}`}>{inc.status}</td>
              <td>{inc.prioridade === 1 ? 'Alta' : 'Baixa'}</td>
              <td>{new Date(inc.data_abertura).toLocaleString()}</td>
              <td>

                <button
                  className="btn-details"
                  onClick={() => navigate(`${getBasePath()}/incidentes/${inc.id_incidente}`)}
                >
                  Detalhes
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Incidentes;