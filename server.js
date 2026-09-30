const express = require("express");
const mariadb = require("mariadb");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

const banco = mariadb.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "estoque",
    port: Number(process.env.DB_PORT) || 3306
});

async function testarBanco() {
    let conexao;

    try {
        conexao = await banco.getConnection();
        console.log("Banco conectado!");
    } finally {
        if (conexao) {
            conexao.release();
        }
    }
}

app.get("/", (req, res) => {
    res.send("Sistema de estoque funcionando!");
});

app.post("/produtos", async (req, res) => {

    const {
        nome,
        categoria,
        quantidade,
        valor_unitario
    } = req.body;

    if (!nome || !categoria) {
        return res.status(400).json({
            mensagem: "Preencha nome e categoria"
        });
    }

    if (quantidade < 0) {
        return res.status(400).json({
            mensagem: "Quantidade inválida"
        });
    }

    if (valor_unitario <= 0) {
        return res.status(400).json({
            mensagem: "Valor inválido"
        });
    }

    const sql = `
        INSERT INTO produtos
        (nome, categoria, quantidade, valor_unitario)
        VALUES (?, ?, ?, ?)
    `;

    try {
        const resultado = await banco.query(
            sql,
            [nome, categoria, quantidade, valor_unitario]
        );

        res.json({
            mensagem: "Produto cadastrado!",
            id: Number(resultado.insertId)
        });
    } catch (erro) {
        res.status(500).json({
            erro: erro.message
        });
    }
});

async function iniciarServidor() {
    try {
        await testarBanco();
        app.listen(3000, () => {
            console.log("Servidor rodando na porta 3000");
        });
    } catch (erro) {
        console.error("Erro ao conectar no banco:");
        console.error(erro.cause?.message || erro.message);
        process.exitCode = 1;
    }
}

iniciarServidor();