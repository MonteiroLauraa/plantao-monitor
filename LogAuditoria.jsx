import { useState, useEffect } from 'react';
import api from '../services/api';
import './Incidentes.css';

const LogAuditoria = () => {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    carregarLogs();
  }, []);

  const carregarLogs = async () => {
    try {
      const res = await api.get('/logs');
      setLogs(res.data);
    } catch (e) {
      console.error("Erro ao carregar logs", e);
    }
  };

  return (
    <div className="incidentes-container">
      <h1>Log de Auditoria e Rastreabilidade</h1>
      <p style={{ color: '#aaa', marginBottom: '20px' }}>
        Histórico completo de ações realizadas no sistema (Admin, Operadores e Robôs).
      </p>

      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Data/Hora</th>
            <th>Responsável</th>
            <th>Ação</th>
            <th>Alvo</th>
            <th>Detalhes</th>
          </tr>
        </thead>
        <tbody>
          {logs.map(log => (
            <tr key={log.id}>
              <td>#{log.id}</td>
              <td>{new Date(log.timestamp).toLocaleString()}</td>
              <td style={{ color: '#fff', fontWeight: 'bold' }}>{log.responsavel || '-'}</td>
              <td>
                <span style={{
                  color: (log.acao || '').includes('CRIAR') ? '#28a745' : ((log.acao || '').includes('INCIDENTE') ? '#ffc107' : '#0d6efd'),
                  fontWeight: 'bold'
                }}>
                  {log.acao || 'N/A'}
                </span>
              </td>
              <td>{log.alvo || '-'}</td>
              <td style={{ color: '#ccc', fontSize: '0.9rem' }}>{log.detalhes || '-'}</td>
            </tr>
          ))}
          {logs.length === 0 && (
            <tr><td colSpan="6" style={{ textAlign: 'center' }}>Nenhum registro de auditoria encontrado.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default LogAuditoria;