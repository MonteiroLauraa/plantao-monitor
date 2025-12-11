import { Link } from 'react-router-dom';
import logo from '../assets/logo.png';
import './Login.css'; 

const PaginaVisitante = () => {
    return (
        <div className="login-wrapper">
            <div className="login-card" style={{ maxWidth: '600px' }}>
                <img src={logo} alt="Logo" className="login-logo" />
                
                <h1 style={{color: '#0f7436'}}>Cadastro Realizado!</h1>
                
                <div style={{ margin: '30px 0', fontSize: '1.1rem', color: '#555' }}>
                    <p>Sua conta foi criada e está em <strong>análise</strong>.</p>
                    <p>Um administrador precisa aprovar seu cadastro e definir seu perfil de acesso .</p>
                    <p>Você receberá uma notificação por email assim que seu acesso for liberado.</p>
                </div>

                <hr className="divider" />

                <Link to="/" className="btn btn-login" style={{backgroundColor: '#6c757d'}}>
                    Voltar para o Login
                </Link>
            </div>
        </div>
    );
};

export default PaginaVisitante;
