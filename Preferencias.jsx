import { useState, useEffect } from 'react';
import api from '../services/api';
import { auth } from '../firebaseConfig';
import './GestaoRegras.css';

const Preferencias = () => {
    const [formData, setFormData] = useState({
        enable_email: true,
        enable_push: true,
        som_email: 'default',
        som_push: 'default',
        start_time: '00:00',
        end_time: '23:59'
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        carregarPreferencias();
    }, []);

    const carregarPreferencias = async () => {
        try {
            const uid = auth.currentUser?.uid;
            if (!uid) return;

            const res = await api.get(`/check-user?uid=${uid}`);
            if (res.data) {
                setFormData({
                    enable_email: res.data.enable_email ?? true,
                    enable_push: res.data.enable_push ?? true,
                    som_email: res.data.som_email || 'default',
                    som_push: res.data.som_push || 'default',
                    start_time: res.data.start_time || '08:00',
                    end_time: res.data.end_time || '18:00'
                });
            }
        } catch (e) {
            console.error("Erro ao carregar preferências", e);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        setFormData({ ...formData, [e.target.name]: value });
    };

    const handleSalvar = async (e) => {
        e.preventDefault();
        try {
            const uid = auth.currentUser?.uid;
            // First get ID
            const check = await api.get(`/check-user?uid=${uid}`);
            const id = check.data.id;

            await api.put(`/usuarios/${id}`, formData);
            alert("Preferências salvas com sucesso!");
        } catch (e) {
            alert("Erro ao salvar: " + e.message);
        }
    };

    if (loading) return <div>Carregando...</div>;

    return (
        <div className="regras-container">
            <div className="header-flex">
                <h1>Minhas Preferências de Notificação</h1>
            </div>

            <div className="form-container" style={{ background: '#1e1e1e', padding: '20px', borderRadius: '8px' }}>
                <form onSubmit={handleSalvar}>

                    <fieldset style={{ border: '1px solid #444', padding: '15px', marginBottom: '20px', borderRadius: '6px' }}>
                        <legend style={{ padding: '0 5px', color: '#307c10ff' }}>Notificações por Email</legend>

                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '10px' }}>
                                <input
                                    type="checkbox"
                                    name="enable_email"
                                    checked={formData.enable_email}
                                    onChange={handleChange}
                                    style={{ width: '20px', height: '20px' }}
                                />
                                Habilitar notificações por email
                            </label>
                        </div>

                        <div className="form-group">
                            <label>Som da Notificação por email:</label>
                            <input
                                type="text"
                                name="som_email"
                                value={formData.som_email}
                                onChange={handleChange}
                                placeholder="default"
                            />
                        </div>
                    </fieldset>

                    <fieldset style={{ border: '1px solid #444', padding: '15px', marginBottom: '20px', borderRadius: '6px' }}>
                        <legend style={{ padding: '0 5px', color: '#307c10ff' }}>Notificações pelo sistema (Push)</legend>

                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '10px' }}>
                                <input
                                    type="checkbox"
                                    name="enable_push"
                                    checked={formData.enable_push}
                                    onChange={handleChange}
                                    style={{ width: '20px', height: '20px' }}
                                />
                                Habilitar notificações pelo sistema
                            </label>
                        </div>

                        <div className="form-group">
                            <label>Som da Notificação pelo sistema:</label>
                            <input
                                type="text"
                                name="som_push"
                                value={formData.som_push}
                                onChange={handleChange}
                                placeholder="default"
                            />
                        </div>
                    </fieldset>

                    <fieldset style={{ border: '1px solid #444', padding: '15px', marginBottom: '20px', borderRadius: '6px' }}>
                        <legend style={{ padding: '0 5px', color: '#307c10ff' }}>Janela de Alerta (Não-Perturbe)</legend>
                        <p style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '15px' }}>
                            As notificações só serão enviadas dentro deste intervalo de horário.
                        </p>

                        <div style={{ display: 'flex', gap: '20px' }}>
                            <div className="form-group" style={{ flex: 1 }}>
                                <label>Hora de Início:</label>
                                <input
                                    type="time"
                                    name="start_time"
                                    value={formData.start_time}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="form-group" style={{ flex: 1 }}>
                                <label>Hora de Fim:</label>
                                <input
                                    type="time"
                                    name="end_time"
                                    value={formData.end_time}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>
                    </fieldset>

                    <button type="submit" className="btn-modern btn-primary" style={{ width: '100%', padding: '15px' }}>
                        Salvar Preferências
                    </button>

                </form>
            </div>
        </div>
    );
};

export default Preferencias;
