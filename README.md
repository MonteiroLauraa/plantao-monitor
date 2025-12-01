#  Plantão Monitor

Sistema Fullstack de Monitoramento de Banco de Dados, Gestão de Incidentes e Escalas de Plantão.
---

## Funcionalidades Entregues (Sprint 1)

### 1. Backend & API (Node.js)
- **API RESTful** robusta com Express.
- **Autenticação Híbrida:** Firebase (Identidade) + PostgreSQL (Perfil & RBAC).
- **CRUD Genérico:** Arquitetura flexível para gestão de entidades.
- **Auditoria:** Sistema de Logs automático para rastreabilidade de ações (Admin/Operador).

### 2. Frontend (React + Vite)
- **SPA :** Navegação fluida sem recarregamento.
- **RBAC Visual:** Menus e rotas protegidas dinamicamente (Admin vs. Operador).
- **Dashboard Real-time:** Atualização automática de incidentes (Polling).

### 3. Automação (Python Runner)
- **Service Worker:** Script Python independente.
- **Cron Job:** Execução agendada de regras SQL a cada 60 segundos.
- **Detecção de Anomalias:** Geração automática de incidentes baseada em queries.

---

## 
 Camada | Tecnologia | Função |
| :--- | :--- | :--- |
| **Frontend** | React.js, Vite, Axios | Interface do Usuário |
| **Backend** | Node.js, Express | API Gateway e Regras de Negócio |
| **Worker** | Python, Psycopg2, Schedule | Processamento em Background |
| **Database** | PostgreSQL | Persistência Relacional |
| **Auth** | Firebase Auth | Segurança e Tokens JWT |

---

##  Como Rodar o Projeto

O sistema opera de forma distribuída. É necessário rodar os 3 serviços simultaneamente.

### Pré-requisitos
- Node.js v18+
- Python 3.8+
- PostgreSQL rodando localmente
- Arquivo `.env` configurado na raiz

### Passo 1: Backend (API)
```bash
# Na raiz do projeto
npm install
node api.js
# Servidor rodará em http://localhost:8000
