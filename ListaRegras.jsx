import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import './GestaoRegras.css';

const ListaRegras = () => {
  const [regras, setRegras] = useState([]);
  const navigate = useNavigate();

  useEffect(() => { carregarRegras(); }, []);

  const carregarRegras = async () => {
    try {
      const response = await api.get('/regras');
      setRegras(response.data.sort((a, b) => a.id - b.id));
    } catch (e) {
      console.error("Erro ao carregar regras:", e);
    }
  };

  const handleDeletar = async (id) => {
    if (!confirm("Tem certeza que deseja apagar esta regra?")) return;
    try {
      await api.delete(`/regras/${id}`);
      carregarRegras();
    } catch (e) { alert("Erro ao deletar: " + (e.response?.data?.error || e.message)); }
  };

  const handleToggleAtivo = async (regra) => {
    try {
      await api.put(`/regras/${regra.id}`, { active: !regra.active });
      carregarRegras();
    } catch (e) { alert("Erro ao atualizar status: " + (e.response?.data?.error || e.message)); }
  };

  const handleSilenciar = (id) => {
    alert(`Regra ${id} silenciada (Simulação)`);
  };

  return (
    <div className="regras-container">
      <div className="header-flex">
        <h1>Regras Cadastradas</h1>
        <Link to="/admin/regras/nova"><button>+ Nova Regra</button></Link>
      </div>

      <table>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Status</th>
            <th>Prioridade</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {regras.map(regra => (
            <tr key={regra.id} style={{ opacity: regra.active ? 1 : 0.6 }}>
              <td>{regra.nome}</td>
              <td>
                <span style={{
                  color: regra.active ? '#28a745' : '#6c757d',
                  fontWeight: 'bold'
                }}>
                  {regra.active ? 'ATIVO' : 'PARADO'}
                </span>
              </td>
              <td>{regra.prioridade === 1 ? 'Alta' : (regra.prioridade === 2 ? 'Média' : 'Baixa')}</td>
              <td className="actions-cell">

                <button
                  className="btn-acao"
                  onClick={() => navigate(`/admin/regras/editar/${regra.id}`)}
                >
                  Editar
                </button>

                <button className="btn-acao" onClick={() => handleToggleAtivo(regra)}>
                  {regra.active ? '⏸ Parar' : '▶ Iniciar'}
                </button>

                <button className="btn-acao" onClick={() => handleSilenciar(regra.id)}>
                  silenciar
                </button>

                <button
                  className="btn-acao btn-danger"
                  onClick={() => handleDeletar(regra.id)}
                >
                  apagar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ListaRegras;