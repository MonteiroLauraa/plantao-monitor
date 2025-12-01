require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const process = require("process");
const admin = require("firebase-admin");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8000;
const DATABASE_URL = process.env.DATABASE_URL;

// --- 1. CONFIGURAÇÃO FIREBASE (Autenticação) ---
if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log("🔥 Firebase Admin SDK inicializado!");
  } catch (e) {
    console.warn("⚠️ AVISO: Firebase não configurado (verifique .env).");
  }
}

// --- 2. CONFIGURAÇÃO BANCO DE DADOS (PostgreSQL) ---
if (!DATABASE_URL) {
  console.error("❌ ERRO: variável DATABASE_URL não definida no .env");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Inicialização de Segurança (Garante que tabela usuários existe)
async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        firebase_uid VARCHAR(128) UNIQUE NOT NULL,
        nome VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        matricula VARCHAR(20),
        role VARCHAR(20) DEFAULT 'viewer',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✅ Banco de dados conectado e tabela 'usuarios' verificada.");
  } catch (err) {
    console.error("❌ Erro ao conectar no banco:", err);
  } finally {
    client.release();
  }
}
initDB();

// --- 3. DEFINIÇÃO DAS TABELAS (Schema) ---
const TABLES = {
  usuarios: { 
    name: "usuarios", pk: "id", 
    cols: ["firebase_uid", "nome", "email", "matricula", "role"] 
  },
  regras: {
    name: "regras", pk: "id_regra",
    cols: [
      "id_banco", "nome", "descricao", "sql", 
      "minuto_atualizacao", "prioridade", "ativo", 
      "silenciado_ate", "hora_inicio", "hora_final", 
      "qtd_erro_max", "roles"
    ]
  },
  incidentes: {
    name: "incidentes", pk: "id",
    cols: ["id_regra", "data_abertura", "status", "prioridade", "detalhes"]
  },
  logs: { 
    name: "logs_auditoria", pk: "id",
    cols: ["responsavel", "acao", "alvo", "detalhes", "timestamp"]
  },
  execucoes: { 
    name: "regras_execucoes", pk: "id_execucao",
    cols: ["id_regra", "timestamp_inicio", "timestamp_fim", "status", "resultado_count", "erro_log"]
  },
  fila_runner: {
    name: "fila_runner", pk: "id",
    cols: ["id_regra", "status", "agendado_para"]
  }
};

async function registrarLog(client, responsavel, acao, alvo, detalhes) {
    try {
        await client.query(
            `INSERT INTO logs_auditoria (responsavel, acao, alvo, detalhes) VALUES ($1, $2, $3, $4)`,
            [responsavel || 'Sistema', acao, alvo, detalhes]
        );
        console.log(`📝 LOG: ${acao} -> ${alvo}`);
    } catch (e) {
        console.error("Erro ao gravar log:", e.message);
    }
}

async function executarRegra(idRegra) {
  const client = await pool.connect();
  const inicio = new Date();
  
  try {
    const regraRes = await client.query("SELECT * FROM regras WHERE id_regra = $1", [idRegra]);
    if (regraRes.rows.length === 0) throw new Error("Regra não encontrada");
    const regra = regraRes.rows[0];

    console.log(`[Runner] Executando: ${regra.nome}`);
    const resultadoSQL = await client.query(regra.sql);
    const fim = new Date();

    
    await client.query(`
      INSERT INTO regras_execucoes (id_regra, timestamp_inicio, timestamp_fim, status, resultado_count)
      VALUES ($1, $2, $3, $4, $5)
    `, [regra.id_regra, inicio, fim, 'sucesso', resultadoSQL.rowCount]);

    return { status: "sucesso", rows: resultadoSQL.rows, rowCount: resultadoSQL.rowCount };

  } catch (erro) {
    const fim = new Date();
   
    await client.query(`
      INSERT INTO regras_execucoes (id_regra, timestamp_inicio, timestamp_fim, status, erro_log)
      VALUES ($1, $2, $3, 'erro', $4)
    `, [idRegra, inicio, fim, erro.message]);

    return { status: "erro", mensagem: erro.message };
  } finally {
    client.release();
  }
}

app.get("/check-user", async (req, res) => {
  const { uid } = req.query; 
  if (!uid) return res.status(400).json({ error: "UID obrigatório" });

  const client = await pool.connect();
  try {
    const result = await client.query("SELECT * FROM usuarios WHERE firebase_uid = $1", [uid]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Não encontrado" });
    res.json(result.rows[0]);
  } finally { client.release(); }
});

app.post("/db-test", async (req, res) => {
  try {
    const { id_regra, sql } = req.body; 


    if (sql) {
        const client = await pool.connect();
        try {
            const result = await client.query(sql);
            return res.json({ status: "sucesso", rows: result.rows, rowCount: result.rowCount });
        } finally { client.release(); }
    }

    if (id_regra) {
        const resultado = await executarRegra(id_regra);
        return res.json(resultado);
    }
    res.status(400).json({ error: "Envie 'sql' ou 'id_regra'" });
  } catch (e) {
    res.status(500).json({ status: "erro", mensagem: e.message });
  }
});

app.post('/usuarios', async (req, res) => {
    const client = await pool.connect();
    try {
        const { firebase_uid, nome, email, matricula, role } = req.body;
        const q = `INSERT INTO usuarios (firebase_uid, nome, email, matricula, role) VALUES ($1, $2, $3, $4, $5) RETURNING *`;
        const { rows } = await client.query(q, [firebase_uid, nome, email, matricula, role]);
        
        await registrarLog(client, 'Visitante', 'CRIAR_USUARIO', email, `Role Inicial: ${role}`);
        res.status(201).json(rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { client.release(); }
});

app.put('/incidentes/:id', async (req, res) => {
    const client = await pool.connect();
    try {
        const { status } = req.body;
        const q = `UPDATE incidentes SET status = $1 WHERE id = $2 RETURNING *`;
        const { rows } = await client.query(q, [status, req.params.id]);

        if(rows.length > 0) {
            await registrarLog(client, 'Operador/Admin', 'ATUALIZAR_INCIDENTE', `Incidente #${req.params.id}`, `Novo Status: ${status}`);
        }
        res.json(rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { client.release(); }
});

Object.keys(TABLES).forEach(tableKey => {
  const table = TABLES[tableKey];

  app.get(`/${tableKey}`, async (req, res) => {
    const client = await pool.connect();
    try {
      const q = `SELECT * FROM ${table.name} ORDER BY ${table.pk} DESC LIMIT 200;`;
      const { rows } = await client.query(q);
      res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
    finally { client.release(); }
  });

  app.get(`/${tableKey}/:id`, async (req, res) => {
    const client = await pool.connect();
    try {
      const q = `SELECT * FROM ${table.name} WHERE ${table.pk} = $1`;
      const { rows } = await client.query(q, [req.params.id]);
      if (rows.length === 0) return res.status(404).json({ error: "Não encontrado" });
      res.json(rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
    finally { client.release(); }
  });

  
  app.post(`/${tableKey}`, async (req, res) => {
    const client = await pool.connect();
    try {
      const data = req.body;
      const validCols = table.cols.filter(col => data[col] !== undefined);
      const q = `INSERT INTO ${table.name} (${validCols.join(", ")}) VALUES (${validCols.map((_, i) => `$${i + 1}`).join(", ")}) RETURNING *;`;
      const { rows } = await client.query(q, validCols.map(c => data[c]));
      

      if (tableKey !== 'usuarios') {
          await registrarLog(client, 'Admin', `CRIAR_${tableKey.toUpperCase()}`, `ID ${rows[0][table.pk]}`, 'Via Painel');
      }
      res.status(201).json(rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
    finally { client.release(); }
  });

  app.put(`/${tableKey}/:id`, async (req, res) => {
    const client = await pool.connect();
    try {
        const data = req.body;
        const keys = table.cols.filter(k => data[k] !== undefined);
        if(keys.length === 0) return res.json({message: "Nada a atualizar"});
        
        const q = `UPDATE ${table.name} SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(", ")} WHERE ${table.pk} = $1 RETURNING *`;
        const { rows } = await client.query(q, [req.params.id, ...keys.map(k => data[k])]);
        res.json(rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
    finally { client.release(); }
  });

  
 app.delete(`/${tableKey}/:id`, async (req, res) => {
    const client = await pool.connect();
    try {
    
        if (tableKey === 'regras') {
            await client.query(`DELETE FROM incidentes WHERE id_regra = $1`, [req.params.id]);
            await client.query(`DELETE FROM regras_execucoes WHERE id_regra = $1`, [req.params.id]);
            await client.query(`DELETE FROM fila_runner WHERE id_regra = $1`, [req.params.id]);
        }
        await client.query(`DELETE FROM ${table.name} WHERE ${table.pk} = $1`, [req.params.id]);
        await registrarLog(client, 'Admin', `DELETAR_${tableKey.toUpperCase()}`, `ID ${req.params.id}`, 'Remoção permanente');
        res.json({ message: "Deletado com sucesso" });
    } catch (err) { 
        console.error(err); l
        res.status(500).json({ error: err.message }); 
    } 
    finally { client.release(); }
  });
});


app.listen(PORT, () => {
  console.log(` Servidor Backend rodando na porta ${PORT}`);
  console.log(`   --> http://localhost:${PORT}`);
});