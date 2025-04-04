const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000;

// Servir arquivos estáticos da pasta www
app.use(express.static(path.join(__dirname, 'www')));

// Rota para a página principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'www', 'index.html'));
});

// Rota para processar conversão de arquivos
app.post('/convert', (req, res) => {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    try {
      const { files } = JSON.parse(body);
      res.json({ exnContent: files });
    } catch (error) {
      res.status(400).json({ error: 'Erro ao converter arquivos' });
    }
  });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});