import { useState } from 'react';
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from '../firebaseConfig';
import { useNavigate, Link } from 'react-router-dom';
import logo from '../assets/logo.png';
import './Login.css';
import api from '../services/api';
import { iniciarNotificacoes } from '../services/notificationService';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {

      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      // 1. Busca os dados reais no SEU banco de dados (PostgreSQL)
      const response = await api.get(`/check-user?uid=${firebaseUser.uid}`);
      const dadosUsuario = response.data; // Aqui vem { id, nome, role, email, ... }

      console.log("Dados Login Real:", dadosUsuario);

      // 2. Salva TUDO no navegador (Sessão Única por Aba)
      sessionStorage.setItem('token', await firebaseUser.getIdToken());
      sessionStorage.setItem('user_uid', firebaseUser.uid);
      sessionStorage.setItem('user_id', dadosUsuario.id);      // ID numérico para o banco
      sessionStorage.setItem('user_name', dadosUsuario.nome);  // Nome real para o Header
      sessionStorage.setItem('user_role', dadosUsuario.role);  // Role para proteção
      sessionStorage.setItem('user_email', dadosUsuario.email); // Email para displays

      // 3. Redireciona baseado na Role (Dispara evento para atualizar Header)
      window.dispatchEvent(new Event('session-update'));

      // Ativar notificações
      iniciarNotificacoes(firebaseUser.uid);

      // 3. Redireciona baseado na Role
      if (dadosUsuario.role === 'admin') {
        navigate('/admin');
      } else if (dadosUsuario.role === 'viewer' || dadosUsuario.role === 'visitante') {
        navigate('/visitante');
      } else {
        navigate('/operador');
      }

    } catch (error) {
      console.error("Erro Login:", error);
      alert("Erro: " + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">


        <img src={logo} alt="Logo da Empresa" className="login-logo" />

        <form onSubmit={handleLogin}>
          <div className="input-group">
            <input
              type="email"
              placeholder="Usuario"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <input
              type="password"
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-login" disabled={loading}>
            {loading ? "Acessando..." : "Acessar"}
          </button>
        </form>

        <p className="footer-text">
          Primeiro acesso? <Link to="/cadastro" className="footer-link">Cadastre-se aqui</Link>
        </p>
        <p className="footer-text">
          <Link to="/recuperar-senha" className="footer-link">Perdeu a senha?</Link>
        </p>

        <hr className="divider" />

        <div className="visitante">
          <h3>Alguns cursos podem permitir o acesso a visitantes</h3>
          <button className="btn btn-guest" onClick={() => alert("Função de visitante em desenvolvimento")}>
            Acessar como visitante
          </button>
        </div>

        <hr className="divider" />

        <footer className="card-footer">
          <a href="#" className="lang-select">Português - Brasil (pt_br) &#9662;</a>
        </footer>

      </div>
    </div>
  );
};

export default Login;