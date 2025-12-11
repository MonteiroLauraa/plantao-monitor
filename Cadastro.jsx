import { useState } from 'react';
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from '../firebaseConfig'; // Importa o "Porteiro"
import { useNavigate, Link } from 'react-router-dom';
import logo from '../assets/logo.png';
import './Cadastro.css';
import api from '../services/api';

const Cadastro = () => {
    const [formData, setFormData] = useState({
        nome: '',
        matricula: '',
        email: '',
        senha: '',
        confirmarSenha: ''
    });
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    // Função para atualizar os inputs
    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleCadastro = async (e) => {
        e.preventDefault();

        // 1. Validação simples de senha
        if (formData.senha !== formData.confirmarSenha) {
            alert("As senhas não conferem!");
            return;
        }

        if (formData.senha.length < 6) {
            alert("A senha deve ter pelo menos 6 caracteres.");
            return;
        }

        setLoading(true);

        try {
          const userCredential = await createUserWithEmailAndPassword(
            auth, 
            formData.email, 
            formData.senha
        );
        const user = userCredential.user;
        await api.post('/usuarios', {
            firebase_uid: user.uid,
            nome: formData.nome,
            email: formData.email,
            matricula: formData.matricula,
            role: 'viewer' 
    });

    alert("Usuário cadastrado com sucesso e aguardando aprovação!");
    navigate('/');

        } catch (error) {
            console.error("Erro no cadastro:", error);
            if (error.code === 'auth/email-already-in-use') {
                alert("Este email já está cadastrado.");
            } else {
                alert("Erro ao cadastrar: " + error.message);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="cadastro-wrapper">
            <div className="cadastro-card">
                <img src={logo} alt="Logo" className="cadastro-logo" />
                
                <h1>Cadastro de Perfil</h1>
                
                <form onSubmit={handleCadastro}>
                    <div className="form-group">
                        <label>Nome Completo:</label>
                        <input type="text" name="nome" value={formData.nome} onChange={handleChange} required />
                    </div>

                    <div className="form-group">
                        <label>Matricula:</label>
                        <input type="number" name="matricula" value={formData.matricula} onChange={handleChange} required />
                    </div>

                    <div className="form-group">
                        <label>Email:</label>
                        <input type="email" name="email" value={formData.email} onChange={handleChange} required />
                    </div>

                    <div className="form-group">
                        <label>Senha:</label>
                        <input type="password" name="senha" value={formData.senha} onChange={handleChange} required />
                    </div>

                    <div className="form-group">
                        <label>Confirmar Senha:</label>
                        <input type="password" name="confirmarSenha" value={formData.confirmarSenha} onChange={handleChange} required />
                    </div>

                    <button type="submit" className="btn-cadastrar" disabled={loading}>
                        {loading ? 'Cadastrando...' : 'Cadastrar'}
                    </button>
                </form>

                <Link to="/" className="link-voltar">Já tenho conta? Fazer Login</Link>
            </div>
        </div>
    );
};

export default Cadastro;
