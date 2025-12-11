require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const admin = require("firebase-admin");

// --- CONFIGURAÇÃO INICIAL ---
const app = express();
app.use(express.json());
app.use(cors());

const PORT = 8000;
const DATABASE_URL = process.env.DATABASE_URL;

console.log("🚀 INICIANDO API (Produção)...");

// Firebase Init
try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log("✅ Firebase: Start.");
} catch (e) {
  console.warn("⚠️ Firebase não configurado:", e.message);
}

// Banco de Dados
const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.connect().then(async client => {
  console.log("✅ Banco de Dados: Conectado.");
  const res = await client.query("SELECT current_database(), current_user");
  console.log("ℹ️ DB Info:", res.rows[0]);
  client.release();
}).catch(e => {
  console.error("❌ Erro Banco:", e.message);
});

// --- TABELAS e SCHEMA ---
const TABLES = {
  usuarios: { name: "usuarios", pk: "id", cols: ["firebase_uid", "nome", "email", "matricula", "role", "fcm_token", "profile_type", "enable_push", "start_time", "end_time", "som_email", "som_push", "enable_email", "recebe_push", "recebe_email", "inicio_nao_perturbe", "fim_nao_perturbe"] },
  regras: { name: "regras", pk: "id", cols: ["nome", "descricao", "sql", "minuto_atualizacao", "active", "hora_inicio", "hora_final", "qtd_erro_max", "roles", "email_notificacao", "prioridade", "role_target", "banco_alvo", "usuario_id"] },
  escalas: { name: "escalas", pk: "id", cols: ["id_usuario", "data_inicio", "data_fim", "canal"] },
  permissoes: { name: "permissoes", pk: "id", cols: ["codigo", "descricao"] },
  permissoes_usuarios: { name: "permissoes_usuarios", pk: "id", cols: ["usuario_id", "permissao_id", "ativo", "is_customizado"] },
  incidentes: { name: "incidentes", pk: "id_incidente", cols: ["id_regra", "data_abertura", "status", "prioridade", "detalhes", "id_execucao_origem", "data_ultima_ocorrencia"] },
  notificacoes: { name: "notificacoes", pk: "id", cols: ["id_incidente", "canal", "destinatario", "mensagem", "status", "titulo", "metadados"] },
  dispositivos_usuarios: { name: "dispositivos_usuarios", pk: "id", cols: ["id_usuario", "push_token", "tipo_dispositivo", "ultimo_acesso", "ativo"] },
  eventos_incidente: { name: "eventos_incidente", pk: "id", cols: ["id_incidente", "tipo", "usuario", "detalhes"] },
  logs: { name: "logs_auditoria", pk: "id", cols: ["responsavel", "acao", "alvo", "detalhes", "timestamp"] },
  usuarios_roles: { name: "usuarios_roles", pk: "id", cols: ["id_usuario", "role_name"] },
  fila_runner: { name: "fila_runner", pk: "id", cols: ["id_regra", "status", "agendado_para"] }
};

// --- ROTAS GERAIS ---

// Notificações Header
app.get('/notificacoes/pendentes', async (req, res) => {
  const client = await pool.connect();
  try {
    const q = `
            SELECT 
                n.id, 
                n.mensagem, 
                n.id_incidente,
                r.nome as nome_regra,
                n.created_at
            FROM notificacoes n
            LEFT JOIN incidentes i ON n.id_incidente = i.id_incidente 
            LEFT JOIN regras r ON i.id_regra = r.id
            WHERE n.lida = false 
            ORDER BY n.id DESC LIMIT 10
        `;
    const { rows } = await client.query(q);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { client.release(); }
});

app.put('/notificacoes/:id/ler', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("UPDATE notificacoes SET lida = true WHERE id = $1", [req.params.id]);
    res.json({ message: "Lida" });
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { client.release(); }
});

// Check User Login
app.get("/check-user", async (req, res) => {
  const { uid } = req.query;
  if (!uid) return res.status(400).json({ error: "UID obrigatório" });
  const client = await pool.connect();
  try {
    const result = await client.query("SELECT * FROM usuarios WHERE firebase_uid = $1", [uid]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Não encontrado" });
    res.json(result.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { client.release(); }
});

// Actions Incidente
app.post('/incidentes/:id/ack', async (req, res) => {
  const client = await pool.connect();
  try {
    const { usuario } = req.body;
    await client.query("UPDATE incidentes SET status = 'ACK' WHERE id_incidente = $1", [req.params.id]);
    await client.query("INSERT INTO eventos_incidente (id_incidente, tipo, usuario, detalhes) VALUES ($1, 'ACK', $2, 'Incidente reconhecido')", [req.params.id, usuario || 'Operador']);
    await logAudit(client, usuario, 'INCIDENTE_ACK', `Incidente ${req.params.id}`, 'Reconhecido pelo operador');
    res.json({ message: "OK" });
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { client.release(); }
});

app.post('/incidentes/:id/close', async (req, res) => {
  const client = await pool.connect();
  try {
    const { usuario, comentario } = req.body;
    await client.query("UPDATE incidentes SET status = 'CLOSED', comentario_resolucao = $2 WHERE id_incidente = $1", [req.params.id, comentario || '']);
    await client.query("INSERT INTO eventos_incidente (id_incidente, tipo, usuario, detalhes) VALUES ($1, 'CLOSE', $2, 'Incidente fechado')", [req.params.id, usuario || 'Operador']);
    await logAudit(client, usuario, 'INCIDENTE_CLOSE', `Incidente ${req.params.id}`, `Fechado. Comentário: ${comentario || 'N/A'}`);
    res.json({ message: "OK" });
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { client.release(); }
});

app.post('/incidentes/:id/reexecute', async (req, res) => {
  const client = await pool.connect();
  try {
    const resInc = await client.query("SELECT id_regra FROM incidentes WHERE id_incidente = $1", [req.params.id]);
    if (resInc.rows.length === 0) return res.status(404).json({ error: "Incidente não achado" });
    const idRegra = resInc.rows[0].id_regra;
    await client.query("INSERT INTO fila_runner (id_regra, status, agendado_para) VALUES ($1, 'pendente', NOW())", [idRegra]);
    await logAudit(client, req.body.usuario || 'Operador', 'INCIDENTE_REEXECUTE', `Incidente ${req.params.id}`, 'Solicitada reexecução');
    res.json({ message: "Agendado" });
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { client.release(); }
});

// --- PERMISSÕES (Access Control) ---

app.get('/sistema/matriz-permissoes', async (req, res) => {
  const client = await pool.connect();
  try {
    const perms = await client.query("SELECT * FROM permissoes ORDER BY id");
    const configs = await client.query("SELECT role, permissao_id, ativo FROM permissoes_roles");
    res.json({ permissoes: perms.rows, configuracoes: configs.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { client.release(); }
});

app.post('/sistema/toggle-permissao', async (req, res) => {
  const { role, permissao_id, ativo } = req.body;
  const client = await pool.connect();
  try {
    await client.query(`INSERT INTO permissoes_roles (role, permissao_id, ativo) VALUES ($1, $2, $3) ON CONFLICT (role, permissao_id) DO UPDATE SET ativo = $3`, [role, permissao_id, ativo]);
    await logAudit(client, 'Admin', 'PERMISSAO_ROLE_CHANGE', `Role: ${role}`, `Permissão ID ${permissao_id} set to ${ativo}`);
    res.json({ message: "OK" });
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { client.release(); }
});

app.get('/usuarios/:id/permissoes-calculadas', async (req, res) => {
  const client = await pool.connect();
  try {
    const uRes = await client.query("SELECT role FROM usuarios WHERE id = $1", [req.params.id]);
    if (uRes.rows.length === 0) return res.status(404).json({ error: "User not found" });
    const userRole = uRes.rows[0].role;
    const q = `SELECT p.id as permissao_id, p.codigo, p.descricao, COALESCE(pu.ativo, pr.ativo, false) as ativo_final, COALESCE(pu.is_customizado, false) as is_customizado FROM permissoes p LEFT JOIN permissoes_roles pr ON pr.permissao_id = p.id AND pr.role = $1 LEFT JOIN permissoes_usuarios pu ON pu.permissao_id = p.id AND pu.usuario_id = $2 ORDER BY p.id`;
    const result = await client.query(q, [userRole, req.params.id]);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { client.release(); }
});

app.post('/usuarios/:id/toggle-permissao', async (req, res) => {
  const { permissao_id, ativo } = req.body;
  const client = await pool.connect();
  try {
    await client.query(`INSERT INTO permissoes_usuarios (usuario_id, permissao_id, ativo, is_customizado) VALUES ($1, $2, $3, true) ON CONFLICT (usuario_id, permissao_id) DO UPDATE SET ativo = $3, is_customizado = true`, [req.params.id, permissao_id, ativo]);
    await logAudit(client, 'Admin', 'PERMISSAO_USER_CHANGE', `User ID: ${req.params.id}`, `Permissão ID ${permissao_id} set to ${ativo}`);
    res.json({ message: "OK" });
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { client.release(); }
});

// --- USER ROLES MANAGEMENT ---
app.get('/usuarios/:id/roles', async (req, res) => {
  const client = await pool.connect();
  try {
    const { rows } = await client.query("SELECT role_name FROM usuarios_roles WHERE id_usuario = $1", [req.params.id]);
    res.json(rows.map(r => r.role_name));
  } catch (e) {
    console.error("❌ ERRO GET ROLES:", e);
    res.status(500).json({ error: e.message });
  }
  finally { client.release(); }
});

app.post('/usuarios/:id/roles', async (req, res) => {
  const client = await pool.connect();
  try {
    const { roles } = req.body;
    if (!Array.isArray(roles)) return res.status(400).json({ error: "Roles deve ser um array." });

    // Transacao
    await client.query("BEGIN");
    await client.query("DELETE FROM usuarios_roles WHERE id_usuario = $1", [req.params.id]);

    for (const role of roles) {
      await client.query("INSERT INTO usuarios_roles (id_usuario, role_name) VALUES ($1, $2)", [req.params.id, role]);
    }

    await client.query("COMMIT");
    await logAudit(client, req.body.usuario_responsavel || 'Admin', 'USER_ROLES_UPDATE', `User ID ${req.params.id}`, `Roles: ${roles.join(', ')}`);
    res.json({ message: "Roles atualizadas" });
  } catch (e) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: e.message });
  }
  finally { client.release(); }
});

app.post('/db-test', async (req, res) => { // Teste SQL Nova Regra
  const { sql_query } = req.body;
  const client = await pool.connect();
  try {
    const result = await client.query(sql_query);
    res.json({ status: 'sucesso', rowCount: result.rowCount, rows: result.rows });
  } catch (e) { res.status(400).json({ status: 'erro', mensagem: e.message }); }
  finally { client.release(); }
});

app.post("/save-token", async (req, res) => {
  const client = await pool.connect();
  try {
    const { uid, token, tipo_dispositivo } = req.body;
    const q = `INSERT INTO dispositivos_usuarios (push_token, tipo_dispositivo, ultimo_acesso, ativo) VALUES ($1, $2, NOW(), true) ON CONFLICT (push_token) DO UPDATE SET ultimo_acesso = NOW(), ativo = true`;
    await client.query(q, [token, tipo_dispositivo || 'WEB']);
    res.json({ message: "Token salvo" });
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { client.release(); }
});

// --- NOTIFICAÇÃO PUSH ---
// --- NOTIFICAÇÃO PUSH ---
// --- NOTIFICAÇÃO PUSH ---
app.post("/notify/push", async (req, res) => {
  const { titulo, mensagem, email_alvo, target_role } = req.body;

  const client = await pool.connect();
  try {
    let q = "";
    let params = [];

    // CENÁRIO A: Notificar um Operador Específico (Direct Message)
    if (email_alvo) {
      console.log(`🎯 [Push] Alvo Específico: ${email_alvo}`);
      q = `
            SELECT d.push_token 
            FROM dispositivos_usuarios d
            JOIN usuarios u ON d.id_usuario = u.id
            WHERE u.email = $1
        `;
      params = [email_alvo];
    }
    // CENÁRIO B: Notificar Todos os Admins (Broadcast RBAC)
    else if (target_role === 'admin') {
      console.log(`📢 [Push] Broadcast para ADMINS`);
      q = `
            SELECT d.push_token 
            FROM dispositivos_usuarios d
            JOIN usuarios u ON d.id_usuario = u.id
            WHERE u.role = 'admin'
      `;
    } else {
      // Fallback / Broadcast Geral (Legacy)
      console.log(`📢 [Push] Broadcast Geral (Fallback)`);
      q = "SELECT push_token FROM dispositivos_usuarios";
    }

    const result = await client.query(q, params);

    if (result.rows.length === 0) {
      console.log("⚠️ [Push] Nenhum dispositivo encontrado.");
      return res.json({ message: "Nenhum dispositivo encontrado." });
    }

    const tokens = [...new Set(result.rows.map(r => r.push_token))]; // Unique tokens

    if (admin.apps.length > 0) {
      const response = await admin.messaging().sendEachForMulticast({
        tokens: tokens,
        notification: { title: titulo, body: mensagem }
      });
      console.log(`📲 [Push] Enviado. Sucessos: ${response.successCount}`);
      res.json({ success: response.successCount });
    } else {
      res.status(503).json({ error: "Firebase not initialized" });
    }
  } catch (e) {
    console.error("Erro Push:", e);
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

// --- HELPER: LOG AUDITORIA ---
async function logAudit(client, responsavel, acao, alvo, detalhes) {
  try {
    await client.query(
      "INSERT INTO logs_auditoria (responsavel, acao, alvo, detalhes, timestamp) VALUES ($1, $2, $3, $4, NOW())",
      [responsavel || 'Sistema', acao, alvo, detalhes]
    );
  } catch (e) { console.error("Erro logAudit:", e); }
}

// --- HELPER: NOTIFY ADMINS ---
async function notifyAdmins(client, title, message) {
  try {
    console.log("🔔 [NotifyAdmins] Buscando tokens de administradores...");

    // Busca tokens de quem tem role = 'admin' e push habilitado
    // Nota: Como 'admin' é uma string, buscamos direto na tabela usuarios (ou usuarios_roles se for N:N)
    // Assumindo 'role' no usuarios para simplificar ou ajustar conforme schema
    const q = `
      SELECT d.push_token, u.email
      FROM dispositivos_usuarios d
      JOIN usuarios u ON d.id_usuario = u.id
      WHERE LOWER(u.role) = 'admin'
    `;
    const res = await client.query(q);

    if (res.rows.length === 0) {
      console.warn("⚠️ [NotifyAdmins] Nenhum admin com token Push encontrado no banco.");
      // Debug: Check if there are ANY admins
      const debugRes = await client.query("SELECT email, role FROM usuarios WHERE LOWER(role) = 'admin'");
      console.log(`ℹ️ [Debug] Total de Admins cadastrados no sistema: ${debugRes.rowCount}`);
      return;
    }

    const tokens = res.rows.map(r => r.push_token);
    console.log(`📣 [NotifyAdmins] Enviando para ${tokens.length} admins:`, res.rows.map(r => r.email));

    if (admin.apps.length > 0) {
      const response = await admin.messaging().sendEachForMulticast({
        tokens: tokens,
        notification: { title, body: message }
      });
      console.log(`✅ [NotifyAdmins] Sucessos: ${response.successCount}, Falhas: ${response.failureCount}`);
    }
  } catch (e) {
    console.error("❌ Erro fatal em notifyAdmins:", e);
  }
}

// --- CRUD GENÉRICO ---


// --- GESTÃO DE ESCALAS (ROTA) ---

// Listar escalas futuras (com nome do usuário)
app.get('/escalas', async (req, res) => {
  const client = await pool.connect();
  try {
    const q = `
            SELECT e.*, u.nome, u.email, u.id as id_usuario_real 
            FROM escalas e
            JOIN usuarios u ON e.id_usuario = u.id
            ORDER BY e.data_inicio ASC
        `;
    const { rows } = await client.query(q);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { client.release(); }
});

// Criar nova escala
// Criar nova escala
// Criar nova escala
app.post('/escalas', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id_usuario, canal, data_inicio, data_fim } = req.body;

    // 1. Validar datas
    if (new Date(data_inicio) >= new Date(data_fim)) {
      return res.status(400).json({ error: "Data final deve ser maior que inicial" });
    }

    // 2. Inserir Escala
    const q = `INSERT INTO escalas (id_usuario, canal, data_inicio, data_fim) VALUES ($1, $2, $3, $4) RETURNING *`;
    const { rows } = await client.query(q, [id_usuario, canal, data_inicio, data_fim]);

    // 3. Buscar dados do usuário para notificar
    const resUser = await client.query("SELECT email, nome FROM usuarios WHERE id = $1", [id_usuario]);
    const user = resUser.rows[0];

    // 4. Criar Notificação (Assíncrono, não bloqueia resposta)
    if (user) {
      const msg = `Olá ${user.nome}, você foi escalado para ${canal} de ${data_inicio} até ${data_fim}.`;
      const titulo = `📅 Nova Escala: ${canal}`;
      await client.query(`
            INSERT INTO notificacoes (destinatario, Canal, mensagem, status, titulo, metadados) 
            VALUES ($1, 'EMAIL', $2, 'PENDING', $3, $4)
        `, [user.email, msg, titulo, JSON.stringify({ tipo: 'escala', id_escala: rows[0].id })]);
    }

    await logAudit(client, 'Admin', 'ESCALA_CRIAR', `User ${id_usuario}`, `Escala criada para ${canal}`);
    res.json(rows[0]);

  } catch (e) {
    console.error("Erro POST /escalas:", e);
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

// Deletar escala
app.delete('/escalas/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("DELETE FROM escalas WHERE id = $1", [req.params.id]);
    res.json({ message: "Escala removida" });
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { client.release(); }
});

// Confirmar Escala (ACK)
app.put('/escalas/:id/ack', async (req, res) => {
  const client = await pool.connect();
  try {
    // Só permite dar ACK se for o dono da escala
    const { id_usuario } = req.body;

    const result = await client.query(
      "UPDATE escalas SET status_confirmacao = 'ACK_OK' WHERE id = $1 AND id_usuario = $2 RETURNING *",
      [req.params.id, id_usuario]
    );

    if (result.rowCount === 0) {
      return res.status(403).json({ error: "Escala não encontrada ou não pertence a você." });
    }

    await logAudit(client, `User ${id_usuario}`, 'ESCALA_ACK', `Escala ${req.params.id}`, 'Confirmou presença no plantão');
    res.json({ message: "Plantão confirmado com sucesso!", escala: result.rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

// --- CRUD USUÁRIOS (CUSTOM) ---
app.delete('/usuarios/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    const uid = req.params.id;

    // 1. Remove dependências (Cascade manual)
    await client.query("DELETE FROM usuarios_roles WHERE id_usuario = $1", [uid]);
    await client.query("DELETE FROM dispositivos_usuarios WHERE id_usuario = $1", [uid]);
    await client.query("DELETE FROM escalas WHERE id_usuario = $1", [uid]);
    await client.query("DELETE FROM permissoes_usuarios WHERE usuario_id = $1", [uid]);

    // 2. Remove o usuário
    await client.query("DELETE FROM usuarios WHERE id = $1", [uid]);

    await logAudit(client, 'Admin', 'DELETE_USER', `ID ${uid}`, 'Usuário excluído com dependências');
    res.json({ message: "Usuário e dados vinculados removidos com sucesso." });
  } catch (e) {
    console.error("Erro delete user:", e);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// --- PREFERÊNCIAS DE USUÁRIO ---
app.put('/usuarios/:id/preferencias', async (req, res) => {
  const client = await pool.connect();
  try {
    const { recebe_push, recebe_email, inicio_nao_perturbe, fim_nao_perturbe } = req.body;

    await client.query(`
            UPDATE usuarios 
            SET recebe_push = $1, 
                recebe_email = $2, 
                inicio_nao_perturbe = $3, 
                fim_nao_perturbe = $4
            WHERE id = $5
        `, [recebe_push, recebe_email, inicio_nao_perturbe, fim_nao_perturbe, req.params.id]);

    await logAudit(client, 'Usuario', 'UPDATE_PREFS', `ID ${req.params.id}`, 'Preferências de notificação atualizadas');
    res.json({ message: "Preferências atualizadas com sucesso!" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao salvar preferências" });
  } finally { client.release(); }
});

// --- CRUD GENÉRICO ---
Object.keys(TABLES).forEach(tableKey => {
  const table = TABLES[tableKey];

  app.get(`/${tableKey}`, async (req, res) => {
    const client = await pool.connect();
    try {
      const { rows } = await client.query(`SELECT * FROM ${table.name} ORDER BY ${table.pk} DESC LIMIT 200;`);
      res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
    finally { client.release(); }
  });

  app.get(`/${tableKey}/:id`, async (req, res) => {
    const client = await pool.connect();
    try {
      const { rows } = await client.query(`SELECT * FROM ${table.name} WHERE ${table.pk} = $1`, [req.params.id]);
      if (rows.length === 0) return res.status(404).json({ error: "404" });
      res.json(rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
    finally { client.release(); }
  });

  app.post(`/${tableKey}`, async (req, res) => {
    const client = await pool.connect();
    try {
      let data = { ...req.body };
      if (tableKey === 'regras') {
        if (data.sql_query) data.sql = data.sql_query;
        if (data.intervalo_minutos) data.minuto_atualizacao = data.intervalo_minutos;
      }
      const validCols = table.cols.filter(col => data[col] !== undefined);
      if (validCols.length === 0) return res.status(400).json({ error: "Dados inválidos" });

      const q = `INSERT INTO ${table.name} (${validCols.join(", ")}) VALUES (${validCols.map((_, i) => `$${i + 1}`).join(", ")}) RETURNING *;`;
      const { rows } = await client.query(q, validCols.map(c => data[c]));

      if (tableKey === 'usuarios') {
        const novoUser = rows[0];
        await notifyAdmins(client, "Novo Cadastro", `Usuário ${novoUser.nome} (${novoUser.email}) solicitou acesso.`);
        await logAudit(client, 'Sistema', 'USUARIO_CRIAR', novoUser.email, `Novo usuário criado: ${novoUser.nome}`);
      } else if (tableKey === 'regras') {
        await logAudit(client, req.body.usuario_responsavel || 'Admin', 'REGRA_CRIAR', rows[0].nome, 'Nova regra criada');
      }
      res.status(201).json(rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
    finally { client.release(); }
  });

  app.put(`/${tableKey}/:id`, async (req, res) => {
    const client = await pool.connect();
    try {
      let data = { ...req.body };
      if (tableKey === 'regras') {
        if (data.sql_query) data.sql = data.sql_query;
        if (data.intervalo_minutos) data.minuto_atualizacao = data.intervalo_minutos;
      }
      const validCols = table.cols.filter(col => data[col] !== undefined);
      if (validCols.length === 0) return res.status(400).json({ error: "Sem dados" });

      const setClause = validCols.map((col, i) => `${col} = $${i + 2}`).join(", ");
      const q = `UPDATE ${table.name} SET ${setClause} WHERE ${table.pk} = $1 RETURNING *`;

      const { rows } = await client.query(q, [req.params.id, ...validCols.map(c => data[c])]);
      if (rows.length === 0) return res.status(404).json({ error: "404" });

      if (tableKey === 'usuarios') {
        await logAudit(client, req.body.usuario_responsavel || 'Admin', 'USUARIO_UPDATE', rows[0].email, 'Dados de usuário atualizados');
      } else if (tableKey === 'regras') {
        await logAudit(client, req.body.usuario_responsavel || 'Admin', 'REGRA_UPDATE', rows[0].nome, 'Regra atualizada');
      }

      res.json(rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
    finally { client.release(); }
  });

  app.delete(`/${tableKey}/:id`, async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query(`DELETE FROM ${table.name} WHERE ${table.pk} = $1`, [req.params.id]);
      await logAudit(client, req.body.usuario || 'Admin', 'DELETE_GENERIC', `${tableKey} ID ${req.params.id}`, 'Registro deletado');
      res.json({ message: "Deleted" });
    } catch (err) { res.status(500).json({ error: err.message }); }
    finally { client.release(); }
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 API: http://localhost:${PORT}`);
});
