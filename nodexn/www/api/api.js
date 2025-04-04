const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const TEMP_DIR = path.join(__dirname, 'temp_exn');
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

class EXNHandler {
    static async converterExn(files, folderName) {
        const archiveContent = {};
        for (const file of files) {
            const content = await fs.promises.readFile(file, 'utf-8');
            archiveContent[path.basename(file)] = content;
        }
        const exnFileName = `${folderName}.exn`;
        const exnFilePath = path.join(TEMP_DIR, exnFileName);
        await fs.promises.writeFile(exnFilePath, JSON.stringify(archiveContent));
        return exnFilePath;
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
    } else if (req.method === 'POST' && req.url === '/convert') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
            try {
                const { files } = JSON.parse(body);
                const allowedExtensions = ['.js', 'package.json', 'package-lock.json'];
                const invalidFiles = files.filter(file => !allowedExtensions.includes(path.extname(file)));
                if (invalidFiles.length > 0) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'Apenas arquivos .js, package.json e package-lock.json são permitidos' }));
                }
                const exnContent = await EXNHandler.converterExn(files);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ exnContent }));
            } catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Erro ao converter arquivos' }));
            }
        });
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
