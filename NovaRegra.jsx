import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import { auth } from '../firebaseConfig';
import './GestaoRegras.css';

const NovaRegra = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    sql: '',
    id_banco: '1',
    intervalo_minutos: 5,
    prioridade: 3,
    hora_inicio: '00:00',
    hora_final: '23:59',
    qtd_erro_max: 1,
    role_target: 'OPERATOR',
    email_notificacao: '',
    usuario_id: '',
    ativo: true
  });

  const [rolesDisponiveis, setRolesDisponiveis] = useState([]);
  const [usuariosDisponiveis, setUsuariosDisponiveis] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  // Estados para o Modal de Teste
  const [modalOpen, setModalOpen] = useState(false);
  const [testeResultado, setTesteResultado] = useState(null);
  const [loadingTeste, setLoadingTeste] = useState(false);

  useEffect(() => {
    carregarDadosIniciais();
  }, [id]);

  const carregarDadosIniciais = async () => {
    try {
      // 1. Identificar Usuário Atual
      const { data: user } = await api.get(`/check-user?uid=${auth.currentUser?.uid}`);
      setCurrentUser(user);

      // 2. Carregar Lista de Usuários (Apenas Admin vê tudo, mas endpoint é aberto por enquanto)
      const userRes = await api.get('/usuarios');
      setUsuariosDisponiveis(userRes.data);

      const uniqueRoles = [...new Set(userRes.data.map(u => u.role))];
      setRolesDisponiveis(uniqueRoles);

      // 3. Se for Edição, carregar regra
      if (isEditing) {
        const regraRes = await api.get(`/regras/${id}`);
        const regra = regraRes.data;
        if (regra) {
          setFormData({
            ...regra,
            sql: regra.sql || regra.sql_query,
            role_target: regra.role_target || 'OPERATOR',
            email_notificacao: regra.email_notificacao || '',
            usuario_id: regra.usuario_id || ''
          });
        }
      } else {
        // Se NOVA regra e NÃO for Admin, auto-atribui
        if (user && user.role !== 'admin') {
          setFormData(prev => ({ ...prev, usuario_id: user.id }));
        }
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    }
  };

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
  };

  const handleSalvar = async (e) => {
    e.preventDefault();
    try {
      // Regra de Negócio: Se Operador, garante que é ele mesmo o dono (segurança Frontend)
      const payload = { ...formData };
      if (currentUser && currentUser.role !== 'admin') {
        payload.usuario_id = currentUser.id;
      }

      if (isEditing) {
        await api.put(`/regras/${id}`, payload);
        alert("Regra atualizada com sucesso!");
      } else {
        await api.post('/regras', payload);
        alert("Regra criada com sucesso!");
      }
      navigate('/admin/regras');
    } catch (error) {
      alert("Erro ao salvar: " + error.message);
    }
  };

  // Função para testar a query (CORRIGIDA)
  const handleTestar = async () => {
    // CORREÇÃO: Usamos formData.sql (nome correto do estado)
    if (!formData.sql) {
      alert("Digite um SQL para testar!");
      return;
    }

    setModalOpen(true);
    setLoadingTeste(true);
    setTesteResultado(null);

    try {
      const res = await api.post('/db-test', { sql_query: formData.sql });
      setTesteResultado(res.data);
    } catch (e) {
      const msg = e.response?.data?.mensagem || e.message;
      setTesteResultado({ status: 'erro', mensagem: msg });
    } finally {
      setLoadingTeste(false);
    }
  };

  return (
    <div className="regras-container">
      <div className="header-flex">
        <h1>{isEditing ? `Editando Regra #${id}` : 'Nova Regra de Monitoramento'}</h1>

        {/* CORREÇÃO: Chamamos handleTestar (nome certo) */}
        <button className="btn-test" type="button" onClick={handleTestar}>
          ▶️ Testar Query
        </button>
      </div>

      <form className="form-regra" onSubmit={handleSalvar}>

        <div className="form-group full-width" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ flex: 1 }}>
            <label>Nome da Regra:</label>
            <input type="text" name="nome" value={formData.nome} onChange={handleChange} required placeholder="Ex: Falha no Login" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', marginTop: '20px' }}>
            <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <input
                type="checkbox"
                name="ativo"
                checked={formData.ativo}
                onChange={handleChange}
                style={{ width: '20px', height: '20px' }}
              />
              Ativo?
            </label>
          </div>
        </div>

        <div className="form-group full-width">
          <label>Descrição:</label>
          <input type="text" name="descricao" value={formData.descricao || ''} onChange={handleChange} />
        </div>

        <div className="form-group">
          <label>Banco de Dados:</label>
          <select name="id_banco" value={formData.id_banco} onChange={handleChange}>
            <option value="1">PostgreSQL</option>
            <option value="2" disabled>Oracle (Em breve)</option>
          </select>
        </div>


        <div className="form-group">
          <label>Dono da Regra (Owner):</label>
          <select
            name="usuario_id"
            value={formData.usuario_id}
            onChange={handleChange}
            disabled={currentUser?.role !== 'admin'}
            style={{ borderColor: currentUser?.role !== 'admin' ? '#333' : '#58a6ff' }}
          >
            <option value="">-- Sem Dono Específico --</option>
            {usuariosDisponiveis.map(u => (
              <option key={u.id} value={u.id}>{u.nome} ({u.email}) [{u.role}]</option>
            ))}
          </select>
          {currentUser?.role !== 'admin' && <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>Definido automaticamente como você.</small>}
        </div>

        <div className="form-group">
          <label>Destino do Alerta (Role):</label>
          <select name="role_target" value={formData.role_target} onChange={handleChange}>
            <option value="">Selecione...</option>
            {rolesDisponiveis.map(role => (
              <option key={role} value={role}>{role ? role.toUpperCase() : 'N/A'}</option>
            ))}
            <option value="OPERATOR">OPERATOR (Padrão)</option>
            <option value="DBA">DBA</option>
            <option value="FINANCEIRO">FINANCEIRO</option>
            <option value="MARKETING">MARKETING</option>
          </select>
        </div>

        <div className="form-group full-width">
          <label>Query SQL (SELECT):</label>
          <textarea
            name="sql" // Nome do campo deve bater com o estado
            rows="6"
            value={formData.sql}
            onChange={handleChange}
            required
            placeholder="SELECT count(*) as erros FROM logs WHERE..."
            style={{ fontFamily: 'monospace', background: '#111', color: '#0f0' }}
          />
        </div>

        <div className="form-group">
          <label>Intervalo (min):</label>
          <input type="number" name="intervalo_minutos" value={formData.intervalo_minutos} onChange={handleChange} min="1" />
        </div>

        <div className="form-group">
          <label>Prioridade:</label>
          <select name="prioridade" value={formData.prioridade} onChange={handleChange}>
            <option value="1">Alta (Crítico)</option>
            <option value="2">Média</option>
            <option value="3">Baixa</option>
          </select>
        </div>

        <div className="form-group">
          <label>Hora Início:</label>
          <input type="time" name="hora_inicio" value={formData.hora_inicio} onChange={handleChange} />
        </div>

        <div className="form-group">
          <label>Hora Fim:</label>
          <input type="time" name="hora_final" value={formData.hora_final} onChange={handleChange} />
        </div>

        <div className="form-group full-width">
          <label>Email para Notificação:</label>
          <input
            type="email"
            name="email_notificacao"
            value={formData.email_notificacao}
            onChange={handleChange}
            placeholder="exemplo@empresa.com"
          />
        </div>

        <div className="full-width actions" style={{ marginTop: '20px', borderTop: '1px solid #333', paddingTop: '20px', display: 'flex', gap: '10px' }}>
          <button type="submit" className="btn-modern btn-primary">{isEditing ? 'Atualizar Regra' : 'Salvar Regra'}</button>
          <button type="button" className="btn-modern btn-danger" onClick={() => navigate('/admin/regras')}>Cancelar</button>
        </div>
      </form>

      {/* MODAL DE RESULTADO DO TESTE */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>Resultado do Teste</h3>
              <button onClick={() => setModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
            </div>

            <div className="modal-body" style={{ padding: '20px' }}>
              {loadingTeste ? (
                <p>Executando query no banco...</p>
              ) : testeResultado && (
                <div>
                  <p style={{
                    color: testeResultado.status === 'sucesso' ? '#0f7436' : '#dc3545',
                    fontWeight: 'bold',
                    marginBottom: '10px'
                  }}>
                    {testeResultado.status === 'sucesso'
                      ? `✅ Sucesso! ${testeResultado.rowCount ?? 0} linhas encontradas.`
                      : '❌ Erro na Query!'}
                  </p>

                  {testeResultado.rows && testeResultado.rows.length > 0 && (
                    <div className="resultado-box" style={{ background: '#000', padding: '10px', borderRadius: '4px', overflowX: 'auto' }}>
                      <pre style={{ margin: 0, fontSize: '0.8rem', color: '#ccc' }}>
                        {JSON.stringify(testeResultado.rows.slice(0, 3), null, 2)}
                        {testeResultado.rows.length > 3 && '\n... (mais resultados)'}
                      </pre>
                    </div>
                  )}

                  {testeResultado.mensagem && (
                    <div className="resultado-box status-erro" style={{ background: '#3d1a1a', padding: '10px', borderRadius: '4px', color: '#ff8888' }}>
                      {testeResultado.mensagem}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div style={{ textAlign: 'right', padding: '10px 20px' }}>
              <button onClick={() => setModalOpen(false)} className="btn-modern">Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NovaRegra;