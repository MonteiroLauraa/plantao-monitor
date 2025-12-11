
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import './Incidentes.css'; // Reusa o CSS bonito

const DashboardOperador = () => {
    const navigate = useNavigate();
    const [meusPlantoes, setMeusPlantoes] = useState([]);
    const [meusIncidentes, setMeusIncidentes] = useState([]);
    const userId = sessionStorage.getItem('user_id'); // Pega o ID salvo no login da sessão

    useEffect(() => {
        if (!userId) {
            console.warn("Sem userID. Redirecionando...");
            // navigate('/'); // Uncomment if you want auto-redirect
            return;
        }
        carregarDashboard();
    }, [userId]);

    const darAckEscala = async (idEscala) => {
        try {
            const userId = sessionStorage.getItem('user_id');
            await api.put(`/escalas/${idEscala}/ack`, { id_usuario: userId });
            alert("Presença confirmada!");
            carregarDashboard(); // Recarrega para atualizar UI
        } catch (e) {
            alert("Erro ao confirmar: " + (e.response?.data?.error || e.message));
        }
    };

    const carregarDashboard = async () => {
        try {
            // 1. Busca TODAS as escalas e filtra as minhas (Frontend filter por simplicidade)
            const resEscalas = await api.get('/escalas');
            const minhas = resEscalas.data.filter(e => String(e.id_usuario) === String(userId));
            setMeusPlantoes(minhas);

            // 2. Busca Incidentes e filtra (Lógica: Mostra incidentes dos canais onde estou de plantão HOJE)
            const resInc = await api.get('/incidentes');
            const resRegras = await api.get('/regras');

            // Descobre meus canais ativos agora
            const agora = new Date();
            const meusCanaisAtivos = minhas
                .filter(e => new Date(e.data_inicio) <= agora && new Date(e.data_fim) >= agora)
                .map(e => e.canal.toUpperCase());

            // Filtra incidentes desses canais
            const incidentesFiltrados = resInc.data.filter(inc => {
                if (inc.status === 'CLOSED') return false; // Não mostrar fechados
                const regra = resRegras.data.find(r => r.id === inc.id_regra);
                if (!regra) return false;

                // Se a regra for do meu canal OU se eu fui marcado nela
                const canalRegra = (regra.roles || 'GERAL').toUpperCase();
                // Also check role_target if available
                const target = (regra.role_target || '').toUpperCase();

                return meusCanaisAtivos.includes(canalRegra) || meusCanaisAtivos.includes(target);
            });

            setMeusIncidentes(incidentesFiltrados);

        } catch (e) {
            console.error("Erro dashboard:", e);
        }
    };

    return (
        <div style={{ padding: '20px' }}>
            <h1>Olá, {sessionStorage.getItem('user_name')}! 👋</h1>

            {/* SEÇÃO 1: MEUS PLANTÕES */}
            <div className="card" style={{ marginBottom: '20px', borderLeft: '5px solid #007bff' }}>
                <h3>📅 Meus Próximos Plantões</h3>
                {meusPlantoes.length === 0 ? <p>Nenhuma escala agendada.</p> : (
                    <ul style={{ listStyle: 'none', padding: 0 }}>
                        <ul style={{ listStyle: 'none', padding: 0 }}>
                            {meusPlantoes.map(p => (
                                <li key={p.id} style={{ padding: '10px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <strong>{p.canal}</strong>: {new Date(p.data_inicio).toLocaleString()} até {new Date(p.data_fim).toLocaleString()}
                                    </div>
                                    <div>
                                        {(!p.status_confirmacao || p.status_confirmacao === 'PENDING') && (
                                            <button
                                                onClick={() => darAckEscala(p.id)}
                                                className="btn-success"
                                                style={{ backgroundColor: '#28a745', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}
                                            >
                                                ✅ Confirmar Presença
                                            </button>
                                        )}
                                        {p.status_confirmacao === 'ACK_OK' && <span style={{ color: '#28a745', fontWeight: 'bold' }}>Confirmado 🔒</span>}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </ul>
                )}
            </div>

            {/* SEÇÃO 2: INCIDENTES SOB MINHA RESPONSABILIDADE */}
            <div className="card" style={{ borderLeft: '5px solid #dc3545' }}>
                <h3>🚨 Incidentes Ativos (Meu Canal)</h3>
                {meusIncidentes.length === 0 ? <p className="text-success">Tudo tranquilo! Nenhum incidente no seu turno.</p> : (
                    <table>
                        <thead>
                            <tr><th>ID</th><th>Regra</th><th>Status</th><th>Ação</th></tr>
                        </thead>
                        <tbody>
                            {meusIncidentes.map(inc => (
                                <tr key={inc.id_incidente}>
                                    <td>#{inc.id_incidente}</td>
                                    <td>Regra {inc.id_regra}</td>
                                    <td className={`status-${inc.status.toLowerCase()}`}>{inc.status}</td>
                                    <td>
                                        <button className="btn-details" onClick={() => navigate(`/operador/incidentes/${inc.id_incidente}`)}>
                                            Resolver
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default DashboardOperador;
