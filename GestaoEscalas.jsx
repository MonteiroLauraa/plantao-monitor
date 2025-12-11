import { useState, useEffect } from 'react';
import api from '../services/api';
import './GestaoRegras.css'; // Reusing layout styles

const GestaoEscalas = ({ role }) => {
    const [escalas, setEscalas] = useState([]);
    const [usuarios, setUsuarios] = useState([]);
    const [formData, setFormData] = useState({
        id_usuario: '',
        data_inicio: '',
        data_fim: '',
        canal: ''
    });

    useEffect(() => {
        carregarDados();
    }, []);

    const carregarDados = async () => {
        try {
            const usersRes = await api.get('/usuarios');
            setUsuarios(usersRes.data);

            const escalasRes = await api.get('/escalas');
            setEscalas(escalasRes.data);
        } catch (e) {
            console.error("Erro ao carregar dados", e);
        }
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSalvar = async (e) => {
        e.preventDefault();
        try {
            if (new Date(formData.data_inicio) >= new Date(formData.data_fim)) {
                alert("Data Fim deve ser maior que Data Início");
                return;
            }

            await api.post('/escalas', formData);
            alert("Plantão agendado!");
            setFormData({ id_usuario: '', data_inicio: '', data_fim: '', canal: '' });
            carregarDados();
        } catch (e) {
            alert("Erro ao salvar: " + (e.response?.data?.error || e.message));
        }
    };

    const handleRemover = async (id) => {
        if (!window.confirm("Remover este plantão?")) return;
        try {
            await api.delete(`/escalas/${id}`);
            carregarDados();
        } catch (e) {
            alert("Erro ao remover");
        }
    };

    const getNomeUsuario = (id) => {
        const u = usuarios.find(u => u.id === id);
        return u ? u.nome : 'Desconhecido';
    };

    const isAdmin = role === 'admin';

    return (
        <div className="regras-container">
            <div className="header-flex">
                <h1>{isAdmin ? 'Gestão de Rota (On-Call)' : 'Escala'}</h1>
            </div>

            {isAdmin && (
                <div className="form-container" style={{ background: '#1e1e1e', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
                    <h3 style={{ marginTop: 0 }}>Agendar Plantonista</h3>
                    <form onSubmit={handleSalvar} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                        <div className="form-group">
                            <label>Usuário:</label>
                            <select name="id_usuario" value={formData.id_usuario} onChange={handleChange} required>
                                <option value="">Selecione...</option>
                                {usuarios.map(u => (
                                    <option key={u.id} value={u.id}>{u.nome}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Canal (Role/Target):</label>
                            <input type="text" name="canal" value={formData.canal} onChange={handleChange} placeholder="Ex: DBA, INFRA, OPERATOR" required />
                        </div>

                        <div className="form-group">
                            <label>Início:</label>
                            <input type="datetime-local" name="data_inicio" value={formData.data_inicio} onChange={handleChange} required />
                        </div>

                        <div className="form-group">
                            <label>Fim:</label>
                            <input type="datetime-local" name="data_fim" value={formData.data_fim} onChange={handleChange} required />
                        </div>

                        <button type="submit" className="btn-modern btn-primary" style={{ gridColumn: 'span 2' }}>Agendar</button>
                    </form>
                </div>
            )}

            {!isAdmin && <h2>Escala Atual</h2>}

            <div className="tabela-scroll">
                <table className="regras-table">
                    <thead>
                        <tr>
                            <th>Usuário</th>
                            <th>Canal</th>
                            <th>Início</th>
                            <th>Fim</th>
                            {isAdmin && <th>Ações</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {escalas.map(esc => (
                            <tr key={esc.id}>
                                <td>{getNomeUsuario(esc.id_usuario)}</td>
                                <td><span className="badge-role">{esc.canal}</span></td>
                                <td>{new Date(esc.data_inicio).toLocaleString()}</td>
                                <td>{new Date(esc.data_fim).toLocaleString()}</td>
                                {isAdmin && (
                                    <td>
                                        <button onClick={() => handleRemover(esc.id)} className="btn-icon delete" title="Remover">🗑️</button>
                                    </td>
                                )}
                            </tr>
                        ))}
                        {escalas.length === 0 && (
                            <tr><td colSpan={isAdmin ? 5 : 4} style={{ textAlign: 'center', padding: '20px' }}>Nenhum plantão agendado.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default GestaoEscalas;
