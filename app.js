const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const TEMP_DIR = path.join(__dirname, 'temp_exn');
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

class EXNHandler {
    static async converterExn(files) {
        const archiveContent = {};
        for (const file of files) {
            const content = await fs.promises.readFile(file, 'utf-8');
            archiveContent[path.basename(file)] = content;
        }
        return JSON.stringify(archiveContent);
    }

    static async desconverterExn(exnContent) {
        try {
            const content = JSON.parse(exnContent);
            const folderPath = path.join(TEMP_DIR, Date.now().toString());
            fs.mkdirSync(folderPath, { recursive: true });

            for (const [filename, fileContent] of Object.entries(content)) {
                fs.writeFileSync(path.join(folderPath, filename), fileContent);
            }
            return folderPath;
        } catch (error) {
            throw new Error('Erro ao desconverter arquivo EXN: ' + error.message);
        }
    }
}

const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
            <html>
            <head><title>EXN Executor</title></head>
            <body>
                <h1>Executar e Converter EXN</h1>
                <h3>Executar EXN</h3>
                <input type="file" id="exnFile" accept=".exn">
                <button onclick="executeExn()">Executar</button>
                <pre id="output"></pre>

                <hr>

                <h3>Converter arquivos JS para EXN</h3>
                <input type="file" id="jsFile" multiple webkitdirectory directory accept=".js">
                <button onclick="convertToExn()">Converter e Baixar EXN</button>

                <script>
                    function executeExn() {
                        const fileInput = document.getElementById('exnFile');
                        const output = document.getElementById('output');
                        const file = fileInput.files[0];
                        if (!file) return alert('Selecione um arquivo EXN');

                        const reader = new FileReader();
                        reader.onload = function(e) {
                            fetch('/execute', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ exnContent: e.target.result })
                            })
                            .then(response => response.text())
                            .then(result => { output.innerHTML = result; })
                            .catch(err => { output.textContent = 'Erro: ' + err; });
                        };
                        reader.readAsText(file);
                    }

                    function convertToExn() {
                        const jsFileInput = document.getElementById('jsFile');
                        const files = jsFileInput.files;
                        if (!files.length) return alert('Selecione arquivos .js');

                        const archive = {};
                        let filesRead = 0;

                        for (const file of files) {
                            const reader = new FileReader();
                            reader.onload = function(e) {
                                archive[file.name] = e.target.result;
                                filesRead++;

                                if (filesRead === files.length) {
                                    const blob = new Blob([JSON.stringify(archive)], { type: 'application/json' });
                                    const url = URL.createObjectURL(blob);

                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = 'arquivo.exn';
                                    a.click();
                                    URL.revokeObjectURL(url);
                                }
                            };
                            reader.readAsText(file);
                        }
                    }
                </script>
            </body>
            </html>
        `);
    } else if (req.method === 'POST' && req.url === '/execute') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
            try {
                const { exnContent } = JSON.parse(body);
                const extractedFolder = await EXNHandler.desconverterExn(exnContent);
                const mainScriptPath = path.join(extractedFolder, 'main.js');
                const packageJsonPath = path.join(extractedFolder, 'package.json');

                if (!fs.existsSync(mainScriptPath)) {
                    res.writeHead(400, { 'Content-Type': 'text/html' });
                    return res.end('<span style="color:red;">main.js não encontrado</span>');
                }

                // Instalar dependências, se houver package.json
                if (fs.existsSync(packageJsonPath)) {
                    await new Promise((resolve, reject) => {
                        const install = spawn('npm', ['install'], { cwd: extractedFolder });
                        install.stdout.on('data', () => {});
                        install.stderr.on('data', () => {});
                        install.on('close', resolve);
                        install.on('error', reject);
                    });
                }

                const wrappedCode = `
                    (function() {
                        const createIn = {
                            write: (msg) => process.stdout.write(msg)
                        };
                        ${fs.readFileSync(mainScriptPath, 'utf-8')}
                    })();
                `;
                const wrappedPath = path.join(extractedFolder, '_wrapped.js');
                fs.writeFileSync(wrappedPath, wrappedCode);

                const scriptProcess = spawn('node', [wrappedPath], { cwd: extractedFolder });
                let output = '';

                scriptProcess.stdout.on('data', data => { output += data; });
                scriptProcess.stderr.on('data', data => { output += data; });
                scriptProcess.on('close', () => {
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(output ? `<span style="color:black;">${output}</span>` : '<span style="color:red;">Erro na execução</span>');
                });
            } catch (error) {
                res.writeHead(400, { 'Content-Type': 'text/html' });
                res.end('<span style="color:red;">Erro ao processar EXN</span>');
            }
        });
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Rota não encontrada');
    }
});

server.listen(PORT, () => {
    console.log(`http://localhost:${PORT}`);
});
