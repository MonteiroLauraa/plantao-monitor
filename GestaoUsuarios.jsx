import { useState, useEffect } from 'react';
import api from '../services/api';
import './GestaoRegras.css';
import { useNavigate } from 'react-router-dom';

const GestaoUsuarios = () => {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [usuarioEditando, setUsuarioEditando] = useState(null);
  const [permissoesUser, setPermissoesUser] = useState([]);

  const navigate = useNavigate();

  useEffect(() => {
    carregarUsuarios();
  }, []);

  const carregarUsuarios = async () => {
    try {
      const response = await api.get('/usuarios');
      setUsuarios(response.data.sort((a, b) => a.id - b.id));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const abrirModalPermissoes = async (user) => {
    setUsuarioEditando(user);
    setModalOpen(true);
    try {
      const res = await api.get(`/usuarios/${user.id}/permissoes-calculadas`);
      setPermissoesUser(res.data);
    } catch (e) {
      alert("Erro ao carregar permissões");
    }
  };

  const handleTogglePermissao = async (permId, novoStatus) => {
    setPermissoesUser(prev => prev.map(p =>
      p.permissao_id === permId ? { ...p, ativo_final: novoStatus, is_customizado: true } : p
    ));

    try {
      await api.post(`/usuarios/${usuarioEditando.id}/toggle-permissao`, {
        permissao_id: permId,
        ativo: novoStatus
      });
    } catch (e) {
      console.error("Erro ao salvar permissão");
    }
  };

  const handleTrocarRole = async (id, novaRole) => {
    try {
      await api.put(`/usuarios/${id}`, { role: novaRole });
      setUsuarios(prev => prev.map(u => u.id === id ? { ...u, role: novaRole } : u));
    } catch (error) {
      alert("Erro ao atualizar: " + error.message);
    }
  };

  const handleDeletar = async (id) => {
    if (!confirm("Confirmar remoção deste usuário?")) return;
    try {
      await api.delete(`/usuarios/${id}`);
      setUsuarios(prev => prev.filter(u => u.id !== id));
    } catch (error) {
      alert("Erro ao deletar: " + error.message);
    }
  };

  return (
    <div className="page-container">
      <style>{`
    .modal-overlay { 
      position: fixed; 
      top: 0; left: 0; right: 0; bottom: 0; 
      display: flex; 
      justify-content: center; 
      align-items: center; 
      z-index: 1000; 
      /* CORREÇÃO: Fundo preto semi-transparente para focar no modal */
      background-color: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(2px); /* Opcional: desfoque leve no fundo */
    }

    .modal-content { 
      width: 550px; 
      max-width: 95%; 
      max-height: 85vh; 
      overflow-y: auto; 
      display: flex; 
      flex-direction: column; 
      /* CORREÇÃO: Cor de fundo sólida (Dark Theme) e bordas arredondadas */
      background-color: #0d1117; 
      border: 1px solid #30363d;
      border-radius: 12px;
      box-shadow: 0 15px 30px rgba(0, 0, 0, 0.6); /* Sombra para dar destaque */
    }

    .modal-header { 
      display: flex; 
      justify-content: space-between; 
      align-items: center; 
      padding: 16px 20px; 
      border-bottom: 1px solid #30363d; 
      background: #161b22; 
      position: sticky; 
      top: 0; 
      z-index: 10; 
      /* Garante que o header tenha cantos arredondados no topo */
      border-top-left-radius: 12px;
      border-top-right-radius: 12px;
    }

    .modal-body { 
      padding: 20px; 
      background-color: #0d1117; /* Garante fundo sólido no corpo */
    }

    .perm-group-title { 
      font-size: 0.75rem; 
      text-transform: uppercase; 
      color: #8b949e; 
      letter-spacing: 1px; 
      margin-bottom: 8px; 
      font-weight: 600; 
    }
    
    /* Switch Minimalista (Mantido igual) */
    .switch { position: relative; display: inline-block; width: 36px; height: 20px; }
    .switch input { opacity: 0; width: 0; height: 0; }
    .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #30363d; transition: .3s; border-radius: 20px; }
    .slider:before { position: absolute; content: ""; height: 14px; width: 14px; left: 3px; bottom: 3px; background-color: #c9d1d9; transition: .3s; border-radius: 50%; }
    
    input:checked + .slider { background-color: #238636; border-color: #238636; }
    input:checked + .slider:before { transform: translateX(16px); background-color: #fff; }
    input.danger:checked + .slider { background-color: #da3633; }
  `}</style>

      <div className="header-flex">
        <div>
          <h1>Usuários</h1>
          <small>Gerenciamento de acesso e permissões</small>
        </div>
        <div className="actions-group">
          <button className="btn-modern" onClick={() => navigate('/admin/permissoes')}>
            Configurar Roles
          </button>
          <button className="btn-modern btn-primary" onClick={() => alert("Use a tela pública.")}>
            Novo Usuário
          </button>
        </div>
      </div>

      {loading ? <div style={{ color: '#888' }}>Carregando...</div> : (
        <div className="table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nome / Email</th>
                <th>Matrícula</th>
                <th>Role</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((user) => (
                <tr key={user.id} className={user.role === 'viewer' ? 'row-dimmed' : ''}>
                  <td style={{ width: '50px', color: '#555' }}>#{user.id}</td>
                  <td>
                    <div style={{ fontWeight: '500' }}>{user.nome}</div>
                    <div style={{ fontSize: '0.8rem', color: '#8b949e' }}>{user.email}</div>
                  </td>
                  <td>{user.matricula}</td>
                  <td>
                    <select
                      className="role-select"
                      value={user.role}
                      onChange={(e) => handleTrocarRole(user.id, e.target.value)}
                    >
                      <option value="viewer">Viewer</option>
                      <option value="operator">Operador</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        className="btn-modern"
                        style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                        onClick={() => abrirModalPermissoes(user)}
                      >
                        Permissões
                      </button>

                      <button
                        className="btn-modern btn-danger"
                        style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                        onClick={() => handleDeletar(user.id)}
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && usuarioEditando && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#fff' }}>Permissões Individuais</h3>
                <span style={{ fontSize: '0.85rem', color: '#8b949e' }}>
                  {usuarioEditando.nome} • <span style={{ color: '#58a6ff' }}>{usuarioEditando.role}</span>
                </span>
              </div>
              <button onClick={() => setModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#8b949e', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>

            <div className="modal-body">
              <div className="perm-group">
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #30363d' }}>
                  <div className="perm-group-title" style={{ color: '#d29922' }}>Banco de Dados (SQL)</div>
                </div>
                {permissoesUser.filter(p => p.codigo.startsWith('SQL_')).map(perm => (
                  <div key={perm.id} className="perm-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '0.9rem', color: '#c9d1d9' }}>
                        {perm.codigo.replace('SQL_', '')}
                        {perm.is_customizado && <span className="tag-custom">Modificado</span>}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#8b949e' }}>{perm.descricao}</div>
                    </div>
                    <label className="switch">
                      <input
                        type="checkbox"
                        className="danger"
                        checked={perm.ativo_final}
                        onChange={() => handleTogglePermissao(perm.permissao_id, !perm.ativo_final)}
                      />
                      <span className="slider round"></span>
                    </label>
                  </div>
                ))}
              </div>
              <div className="perm-group">
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #30363d' }}>
                  <div className="perm-group-title" style={{ color: '#238636' }}>Acesso ao Sistema</div>
                </div>
                {permissoesUser.filter(p => !p.codigo.startsWith('SQL_')).map(perm => (
                  <div key={perm.id} className="perm-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '0.9rem', color: '#c9d1d9' }}>
                        {perm.codigo.replace('_', ' ')}
                        {perm.is_customizado && <span className="tag-custom">Modificado</span>}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#8b949e' }}>{perm.descricao}</div>
                    </div>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={perm.ativo_final}
                        onChange={() => handleTogglePermissao(perm.permissao_id, !perm.ativo_final)}
                      />
                      <span className="slider round"></span>
                    </label>
                  </div>
                ))}
              </div>

              <div style={{ textAlign: 'right', marginTop: '10px' }}>
                <button onClick={() => setModalOpen(false)} className="btn-modern btn-primary" style={{ width: '100%' }}>
                  Salvar Alterações
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GestaoUsuarios;