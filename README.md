# Backend do sistema de estoque

## Configurar o banco

O backend usa MariaDB/MySQL. No HeidiSQL, copie os dados da sessão do banco
(host, porta, usuário e nome do banco) para as variáveis abaixo.

1. Crie o arquivo local `.env` copiando `.env.example`.
2. Preencha `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` e `DB_NAME` no `.env`.
3. Inicie o backend com `npm start`.

O servidor confirma a conexão antes de iniciar na porta 3000. O arquivo `.env`
é local e não deve ser enviado ao Git.

Se o servidor exigir `auth_gssapi_client`, crie pelo HeidiSQL um usuário próprio
para a aplicação com autenticação por senha. No MariaDB, por exemplo:

```sql
CREATE USER 'estoque_app'@'localhost' IDENTIFIED BY 'defina-uma-senha';
GRANT SELECT, INSERT ON estoque.* TO 'estoque_app'@'localhost';
```

Use esse usuário e a senha definidos em `DB_USER` e `DB_PASSWORD`. Se o backend
conectar de outra máquina, ajuste o host permitido do usuário e `DB_HOST`.
