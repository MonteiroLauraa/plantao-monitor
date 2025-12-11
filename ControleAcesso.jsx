import { useState, useEffect } from 'react';
import api from '../services/api';
import './ControleAcesso.css'; // Vamos criar o CSS abaixo

const ControleAcesso = () => {
    const [permissoes, setPermissoes] = useState([]);
    const [config, setConfig] = useState([]);
    const [loading, setLoading] = useState(true);

    const roles = ['admin', 'operator', 'viewer'];

    useEffect(() => {
        carregarMatriz();
    }, []);

    const carregarMatriz = async () => {
        try {
            const res = await api.get('/sistema/matriz-permissoes');
            setPermissoes(res.data.permissoes);
            setConfig(res.data.configuracoes);
        } catch (e) {
            alert("Erro ao carregar permissões");
        } finally {
            setLoading(false);
        }
    };

    const isAtivo = (role, permId) => {
        const item = config.find(c => c.role === role && c.permissao_id === permId);
        return item ? item.ativo : false;
    };

    const handleToggle = async (role, permId, valorAtual) => {
        const novoValor = !valorAtual;


        setConfig(prev => {
            const index = prev.findIndex(c => c.role === role && c.permissao_id === permId);
            if (index >= 0) {
                const novo = [...prev];
                novo[index] = { ...novo[index], ativo: novoValor };
                return novo;
            }
            return [...prev, { role, permissao_id: permId, ativo: novoValor }];
        });

        try {
            await api.post('/sistema/toggle-permissao', {
                role,
                permissao_id: permId,
                ativo: novoValor
            });
        } catch (e) {
            alert("Erro ao salvar permissão");
            carregarMatriz();
        }
    };

    if (loading) return <div style={{ color: 'white', padding: '20px' }}>Carregando matriz...</div>;

    return (
        <div className="acesso-container">
            <h1>Controle de Acesso por Role</h1>
            <p>Defina o que cada perfil pode fazer no sistema.</p>

            <div className="table-responsive">
                <table className="permissoes-table">
                    <thead>
                        <tr>
                            <th>Permissão / Ação</th>
                            {roles.map(r => <th key={r}>{r.toUpperCase()}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {permissoes.map(perm => (
                            <tr key={perm.id}>
                                <td>
                                    <strong>{perm.codigo}</strong>
                                    <br />
                                    <small>{perm.descricao}</small>
                                </td>
                                {roles.map(role => {
                                    const ativo = isAtivo(role, perm.id);
                                    return (
                                        <td key={role} className="toggle-cell">
                                            <label className="switch">
                                                <input
                                                    type="checkbox"
                                                    checked={ativo}
                                                    onChange={() => handleToggle(role, perm.id, ativo)}
                                                    disabled={role === 'admin' && perm.codigo === 'GERIR_USUARIOS'} // Proteção para admin não se trancar
                                                />
                                                <span className="slider round"></span>
                                            </label>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ControleAcesso;
