// ===== TEMA =====
const themeToggle = document.getElementById('themeToggle');
const htmlElement = document.documentElement;

const savedTheme = localStorage.getItem('theme') || 'light';
htmlElement.classList.toggle('dark', savedTheme === 'dark');

themeToggle.addEventListener('click', () => {
    htmlElement.classList.toggle('dark');
    localStorage.setItem('theme', htmlElement.classList.contains('dark') ? 'dark' : 'light');
});

// ===== CONEXÃO AO SERVIDOR =====
let exnContent = null;
let exnFilename = null;
const localServer = 'http://localhost:3000';
const productionServer = 'https://nodexn-server-nodexn-server.up.railway.app';
const SERVER_URL = productionServer;

// ===== CONTROLE DE ARQUIVOS =====
const exnFileInput = document.getElementById('exnFile');
const exnFileName = document.getElementById('exnFileName');
const jsFileInput = document.getElementById('jsFile');
const jsFileCount = document.getElementById('jsFileCount');
const loadingExn = document.getElementById('loadingExn');
const loadingConvert = document.getElementById('loadingConvert');
const output = document.getElementById('output');

const isMobileApp = typeof cordova !== 'undefined';

if (isMobileApp) {
    // Se for APK Cordova, intercepta o clique para abrir diretório
    const label = document.querySelector('.file-input-label');
    label.addEventListener('click', (e) => {
        e.preventDefault();
        openDirectoryWithCordova();
    });
} else {
    // Se for Web, continua com o input normal
    jsFileInput.addEventListener('change', function (e) {
        const result = updateJsFileCount(e);
        console.log(`Total de arquivos: ${result.count}`);
    });
}

exnFileInput.addEventListener('change', updateExnFileName);

// Atualiza nome do arquivo EXN
function updateExnFileName() {
    exnFileName.textContent = this.files[0]?.name || 'Nenhum arquivo selecionado';
}

// Atualiza contagem de arquivos JS
function updateJsFileCount(event) {
    const files = Array.from(event.target.files);
    let count = files.length;
    let folderName = null;

    if (files.length > 0 && files[0].webkitRelativePath) {
        folderName = files[0].webkitRelativePath.split('/')[0];
        count = files.filter(file => file.size > 0 || file.name.includes('.')).length;
        jsFileCount.textContent = `Pasta "${folderName}" selecionada (${count} arquivos)`;
        event.target.classList.add('folder-selected');
    } else {
        jsFileCount.textContent = count > 0
            ? `${count} arquivo(s) selecionado(s)`
            : 'Nenhum arquivo selecionado';
        event.target.classList.remove('folder-selected');
    }

    return { count, folderName, files };
}

// Função para abrir diretório no APK
function openDirectoryWithCordova() {
    window.resolveLocalFileSystemURL(cordova.file.externalRootDirectory, (dirEntry) => {
        const directoryReader = dirEntry.createReader();
        directoryReader.readEntries((entries) => {
            const files = entries.filter(entry => entry.isFile && entry.name.endsWith('.js'));
            if (files.length === 0) {
                showNotification('Nenhum arquivo JS encontrado na pasta.', 'error');
                return;
            }
            loadCordovaFiles(files);
        }, (error) => {
            console.error('Erro ao ler diretório:', error);
            showNotification('Erro ao ler diretório', 'error');
        });
    }, (error) => {
        console.error('Erro ao acessar sistema de arquivos:', error);
        showNotification('Erro ao acessar sistema de arquivos', 'error');
    });
}

// Lê arquivos Cordova
function loadCordovaFiles(fileEntries) {
    const files = [];

    const promises = fileEntries.map(fileEntry => {
        return new Promise((resolve, reject) => {
            fileEntry.file(file => {
                const reader = new FileReader();
                reader.onloadend = function () {
                    files.push({
                        name: fileEntry.name,
                        content: this.result
                    });
                    resolve();
                };
                reader.onerror = reject;
                reader.readAsText(file);
            }, reject);
        });
    });

    Promise.all(promises)
        .then(() => {
            window.selectedCordovaFiles = files;  // Salva globalmente
            jsFileCount.textContent = `${files.length} arquivo(s) selecionado(s)`;
            showNotification('Arquivos lidos com sucesso!', 'success');
        })
        .catch(error => {
            console.error('Erro ao ler arquivos:', error);
            showNotification('Erro ao ler arquivos', 'error');
        });
}

// Função auxiliar para ler arquivos Web
function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = () => reject(new Error(`Falha ao ler ${file.name}`));
        reader.readAsText(file);
    });
}

// ===== CONVERSÃO PARA EXN =====
async function convertToExn() {
    const archive = {
        metadata: {
            version: "2.0",
            createdAt: new Date().toISOString(),
            files: {}
        }
    };

    let fileList = [];

    if (isMobileApp) {
        // Usar arquivos lidos pelo Cordova
        if (!window.selectedCordovaFiles || window.selectedCordovaFiles.length === 0) {
            showNotification('Nenhum arquivo selecionado', 'error');
            return;
        }
        fileList = window.selectedCordovaFiles.map(f => ({
            path: f.name,
            content: f.content
        }));
    } else {
        // Usar arquivos do input web
        const files = jsFileInput.files;
        if (files.length === 0) {
            showNotification('Selecione a pasta raiz do projeto', 'error');
            return;
        }
        fileList = await Promise.all(Array.from(files).map(async (file) => {
            let path = file.webkitRelativePath || file.name;
            if (path.includes('/')) {
                path = path.split('/').slice(1).join('/');
            }
            return {
                path: path,
                content: await readFileAsText(file)
            };
        }));
    }

    loadingConvert.classList.remove('hidden');

    try {
        fileList.forEach(entry => {
            archive.files[entry.path] = entry.content;
        });

        if (!archive.files['package.json']) {
            throw new Error('package.json não encontrado.');
        }

        const packageJson = JSON.parse(archive.files['package.json']);
        archive.metadata.name = packageJson.name || 'unnamed-project';
        archive.metadata.version = packageJson.version || '1.0.0';
        archive.metadata.type = packageJson.type || 'commonjs';
        archive.metadata.entryPoint = detectEntryPoint(archive.files);

        const blob = new Blob([JSON.stringify(archive, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${archive.metadata.name}.exn`;
        a.click();
        URL.revokeObjectURL(url);

        showNotification('Conversão concluída!', 'success');
    } catch (error) {
        console.error('Erro na conversão:', error);
        outputLog([error.message], 'error');
        showNotification('Erro: ' + error.message, 'error');
    } finally {
        loadingConvert.classList.add('hidden');
    }
}

// ===== EXECUTAR EXN =====
async function executeExn() {
    if (!exnContent) {
        showNotification('Nenhum arquivo EXN carregado.', 'error');
        return;
    }

    const loadingElement = document.getElementById('loadingExn');
    const outputElement = document.getElementById('output');

    try {
        loadingElement.classList.remove('hidden');
        outputElement.textContent = 'Iniciando execução...';

        try {
            await fetch(SERVER_URL, { method: 'HEAD' });
        } catch {
            throw new Error('Servidor não está acessível.');
        }

        const formData = new FormData();
        const blob = new Blob([exnContent], { type: 'application/json' });
        formData.append('file', blob, exnFilename || 'project.exn');

        const response = await fetch(`${SERVER_URL}/execute`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(await response.text());
        }

        const result = await response.text();
        outputElement.innerHTML = '';
        const preElement = document.createElement('pre');
        preElement.textContent = result;
        outputElement.appendChild(preElement);

        showNotification('Arquivo EXN executado com sucesso!', 'success');
    } catch (error) {
        console.error('Erro na execução:', error);
        outputElement.textContent = `Erro: ${error.message}`;
        showNotification(error.message, 'error');
    } finally {
        loadingElement.classList.add('hidden');
    }
}

// ===== FUNÇÕES UTILITÁRIAS =====
function detectEntryPoint(files) {
    const entries = ['index.js', 'main.js', 'app.js', 'server.js', 'src/index.js'];
    for (const entry of entries) {
        if (files[entry]) return entry;
    }
    throw new Error('Ponto de entrada não encontrado.');
}

function outputLog(args, type) {
    const message = args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');

    const div = document.createElement('div');
    div.textContent = message;
    div.style.color = type === 'error' ? 'red' : 'black';
    output.appendChild(div);
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.position = 'fixed';
    notification.style.bottom = '20px';
    notification.style.right = '20px';
    notification.style.padding = '10px 20px';
    notification.style.borderRadius = '8px';
    notification.style.backgroundColor = type === 'error' ? '#e53e3e' : '#38a169';
    notification.style.color = '#fff';
    notification.style.zIndex = '1000';
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

// ===== EVENTOS =====
document.getElementById('executeButton').addEventListener('click', executeExn);
document.getElementById('convertButton').addEventListener('click', convertToExn);

exnFileInput.addEventListener('change', async function () {
    const file = this.files[0];
    if (file) {
        exnContent = await readFileAsText(file);
        exnFilename = file.name;
        showNotification('Arquivo EXN carregado!', 'success');
    }
});
