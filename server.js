
const express = require("express");
const mariadb = require("mariadb");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

// Conexão com o banco de dados
const banco = mariadb.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "senai",
  database: process.env.DB_NAME || "almoxarifado",
  port: Number(process.env.DB_PORT) || 3306,
});

// Testar conexão
async function testarBanco() {
  let conexao;

  try {
    conexao = await banco.getConnection();
    console.log("Banco de dados conectado!");
  } catch (erro) {
    console.error("Erro ao conectar ao banco:", erro.message);
    throw erro;
  } finally {
    if (conexao) conexao.release();
  }
}

// Rota inicial
app.get("/", (req, res) => {
  res.send("Sistema de estoque funcionando!");
});

// CADASTRAR PRODUTO
app.post("/produtos", async (req, res) => {
  try {
    const { nome, categoria, quantidade, valor_unitario } = req.body;

    if (!nome || !categoria) {
      return res.status(400).json({
        erro: "Nome e categoria são obrigatórios.",
      });
    }

    if (
      !Number.isFinite(Number(quantidade)) ||
      Number(quantidade) < 0
    ) {
      return res.status(400).json({
        erro: "A quantidade deve ser um número maior ou igual a zero.",
      });
    }

    if (
      !Number.isFinite(Number(valor_unitario)) ||
      Number(valor_unitario) <= 0
    ) {
      return res.status(400).json({
        erro: "O valor unitário deve ser maior que zero.",
      });
    }

    const sql = `
      INSERT INTO produtos
      (nome, categoria, quantidade, valor_unitario)
      VALUES (?, ?, ?, ?)
    `;

    const resultado = await banco.query(sql, [
      nome,
      categoria,
      Number(quantidade),
      Number(valor_unitario),
    ]);

    res.status(201).json({
      mensagem: "Produto cadastrado com sucesso!",
      id: Number(resultado.insertId),
    });
  } catch (erro) {
    res.status(500).json({ erro: erro.message });
  }
});

// LISTAR TODOS OS PRODUTOS
app.get("/produtos", async (req, res) => {
  try {
    const resultado = await banco.query(
      "SELECT * FROM produtos ORDER BY nome"
    );

    res.json(resultado);
  } catch (erro) {
    res.status(500).json({ erro: erro.message });
  }
});

// LISTAR VALOR TOTAL POR CATEGORIA
app.get("/categorias", async (req, res) => {
  try {
    const sql = `
      SELECT
        categoria,
        SUM(quantidade * valor_unitario) AS valor_total
      FROM produtos
      GROUP BY categoria
      ORDER BY categoria
    `;

    const resultado = await banco.query(sql);
    res.json(resultado);
  } catch (erro) {
    res.status(500).json({ erro: erro.message });
  }
});

// REGISTRAR ENTRADA DE PRODUTO
app.post("/entradas", async (req, res) => {
  let conexao;

  try {
    const { id_produto, quantidade, data_inicial } = req.body;

    if (
      !Number.isInteger(Number(id_produto)) ||
      Number(id_produto) <= 0
    ) {
      return res.status(400).json({
        erro: "Informe um ID de produto válido.",
      });
    }

    if (
      !Number.isInteger(Number(quantidade)) ||
      Number(quantidade) <= 0
    ) {
      return res.status(400).json({
        erro: "A quantidade deve ser um número inteiro maior que zero.",
      });
    }

    if (!data_inicial) {
      return res.status(400).json({
        erro: "A data da entrada é obrigatória.",
      });
    }

    conexao = await banco.getConnection();
    await conexao.beginTransaction();

    const produto = await conexao.query(
      "SELECT id FROM produtos WHERE id = ? FOR UPDATE",
      [Number(id_produto)]
    );

    if (produto.length === 0) {
      await conexao.rollback();
      return res.status(404).json({
        erro: "Produto não encontrado.",
      });
    }

    await conexao.query(
      `INSERT INTO entradas
       (id_produto, quantidade, data_inicial)
       VALUES (?, ?, ?)`,
      [Number(id_produto), Number(quantidade), data_inicial]
    );

    await conexao.query(
      `UPDATE produtos
       SET quantidade = quantidade + ?
       WHERE id = ?`,
      [Number(quantidade), Number(id_produto)]
    );

    await conexao.commit();

    res.status(201).json({
      mensagem: "Entrada registrada com sucesso!",
    });
  } catch (erro) {
    if (conexao) await conexao.rollback();

    res.status(500).json({ erro: erro.message });
  } finally {
    if (conexao) conexao.release();
  }
});

// LISTAR SAÍDAS
app.get("/saidas", async (req, res) => {
  try {
    const sql = `
      SELECT
        s.id,
        p.nome,
        s.quantidade,
        s.data_final
      FROM saidas s
      INNER JOIN produtos p ON s.id_produto = p.id
      ORDER BY s.data_final DESC
    `;

    const resultado = await banco.query(sql);
    res.json(resultado);
  } catch (erro) {
    res.status(500).json({ erro: erro.message });
  }
});

// RELATÓRIO DE MOVIMENTAÇÕES POR PERÍODO
app.get("/relatorios/movimentacoes", async (req, res) => {
  try {
    const { data_inicial, data_final } = req.query;

    if (!data_inicial || !data_final || data_inicial > data_final) {
      return res.status(400).json({
        erro: "Informe um período válido.",
      });
    }

    const sql = `
      SELECT
        p.nome,
        'Unidade' AS unidade,
        COALESCE(e.total_entradas, 0) AS total_entradas,
        COALESCE(s.total_saidas, 0) AS total_saidas,
        p.quantidade AS saldo,
        COALESCE(e.total_entradas, 0) * p.valor_unitario
          AS financeiro_entradas,
        COALESCE(s.total_saidas, 0) * p.valor_unitario
          AS financeiro_saidas
      FROM produtos p
      LEFT JOIN (
        SELECT
          id_produto,
          SUM(quantidade) AS total_entradas
        FROM entradas
        WHERE data_inicial BETWEEN ? AND ?
        GROUP BY id_produto
      ) e ON p.id = e.id_produto
      LEFT JOIN (
        SELECT
          id_produto,
          SUM(quantidade) AS total_saidas
        FROM saidas
        WHERE data_final BETWEEN ? AND ?
        GROUP BY id_produto
      ) s ON p.id = s.id_produto
      ORDER BY p.nome
    `;

    const resultado = await banco.query(sql, [
      data_inicial,
      data_final,
      data_inicial,
      data_final,
    ]);

    res.json(resultado);
  } catch (erro) {
    res.status(500).json({ erro: erro.message });
  }
});

// RELATÓRIO DE MAIORES SAÍDAS
app.get("/relatorios/maiores-saidas", async (req, res) => {
  try {
    const { data_inicial, data_final } = req.query;

    if (!data_inicial || !data_final || data_inicial > data_final) {
      return res.status(400).json({
        erro: "Informe um período válido.",
      });
    }

    const sql = `
      SELECT
        p.nome,
        SUM(s.quantidade) AS total_saida,
        SUM(s.quantidade * p.valor_unitario) AS valor_total
      FROM saidas s
      INNER JOIN produtos p ON s.id_produto = p.id
      WHERE s.data_final BETWEEN ? AND ?
      GROUP BY p.id, p.nome
      ORDER BY total_saida DESC
    `;

    const resultado = await banco.query(sql, [
      data_inicial,
      data_final,
    ]);

    res.json(resultado);
  } catch (erro) {
    res.status(500).json({ erro: erro.message });
  }
});

// RELATÓRIO DE LIMITES DE ESTOQUE
app.get("/relatorios/limites", async (req, res) => {
  try {
    const sql = `
      SELECT
        nome,
        quantidade,
        CASE
          WHEN quantidade = 0 THEN 'Estoque zerado'
          WHEN quantidade = 100 THEN 'Estoque máximo'
        END AS limite,
        quantidade AS percentual
      FROM produtos
      WHERE quantidade = 0 OR quantidade = 100
      ORDER BY quantidade, nome
    `;

    const resultado = await banco.query(sql);
    res.json(resultado);
  } catch (erro) {
    res.status(500).json({ erro: erro.message });
  }
});

// INICIAR SERVIDOR
async function iniciarServidor() {
  try {
    await testarBanco();

    app.listen(3000, () => {
      console.log("Servidor rodando em http://localhost:3000");
    });
  } catch (erro) {
    console.error("Não foi possível iniciar o servidor.");
  }
}

iniciarServidor();