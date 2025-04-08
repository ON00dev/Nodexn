// ===== TEMA =====
const themeToggle = document.getElementById('themeToggle');
const htmlElement = document.documentElement;

// Verifica e aplica o tema salvo
const savedTheme = localStorage.getItem('theme') || 'light';
htmlElement.classList.toggle('dark', savedTheme === 'dark');

themeToggle.addEventListener('click', () => {
    htmlElement.classList.toggle('dark');
    localStorage.setItem('theme', htmlElement.classList.contains('dark') ? 'dark' : 'light');
});

// ===== CONEXAO AO SERVIDOR =====
let exnContent = null;
let exnFilename = null;
const SERVER_URL = 'https://nodexn-server-nodexn-server.up.railway.app'; // Replace with your server URL

// ===== CONTROLE DE ARQUIVOS =====
const exnFileInput = document.getElementById('exnFile');
const exnFileName = document.getElementById('exnFileName');
const jsFileInput = document.getElementById('jsFile');
const jsFileCount = document.getElementById('jsFileCount');
const loadingExn = document.getElementById('loadingExn');
const loadingConvert = document.getElementById('loadingConvert');
const output = document.getElementById('output');

exnFileInput.addEventListener('change', updateExnFileName);
jsFileInput.addEventListener('change', function(e) {
    const result = updateJsFileCount(e);
    console.log(`Total de arquivos: ${result.count}`);
    
    // Se quiser acessar a estrutura de pastas:
    if (result.folderName) {
        const fileStructure = {};
        result.files.forEach(file => {
            fileStructure[file.webkitRelativePath] = file;
        });
        console.log('Estrutura de pastas:', fileStructure);
    }
});

function updateExnFileName() {
    exnFileName.textContent = this.files[0]?.name || 'Nenhum arquivo selecionado';
}

function updateJsFileCount(event) {
    const files = Array.from(event.target.files);
    let count = files.length;
    let folderName = null;

    // Verifica se foi selecionada uma pasta (possui webkitRelativePath)
    if (files.length > 0 && files[0].webkitRelativePath) {
        folderName = files[0].webkitRelativePath.split('/')[0];
        
        // Filtra apenas arquivos (ignora pastas vazias se necessário)
        count = files.filter(file => file.size > 0 || file.name.includes('.')).length;
        
        // Atualiza a exibição com o nome da pasta e contagem
        jsFileCount.textContent = `Pasta "${folderName}" selecionada (${count} arquivos)`;
        
        // Adiciona classe para feedback visual (opcional)
        event.target.classList.add('folder-selected');
    } else {
        // Modo de seleção de arquivos individuais
        jsFileCount.textContent = count > 0 
            ? `${count} arquivo(s) selecionado(s)` 
            : 'Nenhum arquivo selecionado';
        
        // Remove classe de feedback (opcional)
        event.target.classList.remove('folder-selected');
    }

    // Retorna a estrutura de arquivos se necessário para outras funções
    return {
        count,
        folderName,
        files
    };
}

// ===== SISTEMA DE MÓDULOS =====
class ModuleSystem {
    constructor() {
        this.cache = new Map();
        this.sandbox = this.createSandbox();
    }

    createSandbox() {
        return {
            console: {
                log: (...args) => outputLog(args, 'log'),
                error: (...args) => outputLog(args, 'error')
            },
            require: this.require.bind(this),
            import: this.import.bind(this),
            process: {
                env: {},
                cwd: () => '/',
                exit: (code) => { throw new Error(`Process exited with code ${code}`); }
            },
            __dirname: '/',
            __filename: ''
        };
    }

    async require(moduleName) {
        if (this.cache.has(moduleName)) {
            return this.cache.get(moduleName).exports;
        }
        throw new Error(`Module '${moduleName}' not found`);
    }

    async import(moduleName) {
        return this.require(moduleName);
    }

    async evaluateModule(filename, code, isESModule = false) {
        const moduleObj = { exports: {}, filename };
        this.cache.set(filename, moduleObj);

        try {
            if (isESModule) {
                // Implementação real de ES Modules
                const module = { exports: moduleObj.exports };
                const exports = moduleObj.exports;
                const sandbox = this.sandbox;
                
                // Usando Function para evitar eval direto
                const moduleFunc = new Function(
                    'exports', 'module', 'require', 'import', 
                    '__dirname', '__filename', 'process', 'console',
                    code
                );
                
                await moduleFunc.call(
                    sandbox,
                    exports,
                    module,
                    sandbox.require,
                    sandbox.import,
                    `/${filename.split('/').slice(0, -1).join('/')}`,
                    `/${filename}`,
                    sandbox.process,
                    sandbox.console
                );
            } else {
                // CommonJS
                const wrappedCode = `(function(module, exports, require, __dirname, __filename, process, console) {
                    ${code}
                })`;
                
                const moduleFunc = new Function('return ' + wrappedCode)();
                moduleFunc.call(
                    this.sandbox,
                    moduleObj,
                    moduleObj.exports,
                    this.sandbox.require,
                    `/${filename.split('/').slice(0, -1).join('/')}`,
                    `/${filename}`,
                    this.sandbox.process,
                    this.sandbox.console
                );
            }
            
            return moduleObj.exports;
        } catch (error) {
            this.cache.delete(filename);
            throw error;
        }
    }
}

function outputLog(args, type) {
    const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    
    const div = document.createElement('div');
    div.textContent = message;
    div.style.color = type === 'error' ? 'var(--destructive)' : 'var(--foreground)';
    output.appendChild(div);
}

// ===== DETECÇÃO DO PONTO DE ENTRADA =====
function detectEntryPoint(files) {
    // 1. Filtra apenas arquivos relevantes (ignora node_modules e não-JS)
    const projectFiles = Object.keys(files).filter(file => {
        return !file.includes('node_modules/') && 
               file.endsWith('.js') && 
               !file.startsWith('.');
    });

    // Debug: mostra arquivos considerados
    console.log("Arquivos do projeto considerados:", projectFiles);

    // 2. Verifica package.json primeiro (se existir)
    if (files['package.json']) {
        try {
            const pkg = JSON.parse(files['package.json']);
            
            // Verifica o campo 'main' com várias variações de caminho
            if (pkg.main) {
                const possibleMainPaths = [
                    pkg.main,
                    pkg.main.startsWith('./') ? pkg.main : `./${pkg.main}`,
                    pkg.main.startsWith('src/') ? pkg.main : `src/${pkg.main}`,
                    pkg.main.replace(/^\.?\//, '')
                ].filter((v, i, a) => a.indexOf(v) === i);

                for (const path of possibleMainPaths) {
                    const normalizedPath = path.replace(/^\.?\//, '');
                    if (projectFiles.includes(normalizedPath)) {
                        console.log(`Ponto de entrada encontrado via package.json: ${normalizedPath}`);
                        return normalizedPath;
                    }
                }
                
                // Se especificado mas não encontrado, mostra erro detalhado
                throw new Error(
                    `O arquivo especificado no package.json ("main": "${pkg.main}") não foi encontrado.\n` +
                    `Caminhos testados:\n${possibleMainPaths.map(p => `• ${p}`).join('\n')}\n\n` +
                    `Arquivos disponíveis:\n${projectFiles.map(f => `• ${f}`).join('\n')}`
                );
            }
        } catch (e) {
            console.error('Erro ao analisar package.json:', e);
            // Continua para outros métodos se houver erro no package.json
        }
    }

    // 3. Lista priorizada de pontos de entrada (apenas na raiz ou src/)
    const priorityEntries = [
        'index.js',
        'main.js',
        'app.js',
        'server.js',
        'src/index.js',
        'src/main.js',
        'src/app.js',
        'src/server.js',
        'src/run.js'  // Adicionado especificamente para seu caso
    ];

    for (const entry of priorityEntries) {
        if (projectFiles.includes(entry)) {
            console.log(`Ponto de entrada encontrado por prioridade: ${entry}`);
            return entry;
        }
    }

    // 4. Fallback: qualquer arquivo .js em src/ (exceto testes)
    const srcFiles = projectFiles.filter(file => 
        file.startsWith('src/') && 
        !file.includes('.test.') && 
        !file.includes('spec.js')
    );

    if (srcFiles.length === 1) {
        console.log(`Ponto de entrada fallback (único arquivo em src/): ${srcFiles[0]}`);
        return srcFiles[0];
    }

    // 5. Se nada encontrado, gera erro detalhado
    const availableFiles = projectFiles
        .map(f => `• ${f}`)
        .join('\n');

    throw new Error(
        `Não foi possível determinar o ponto de entrada automaticamente.\n\n` +
        `Arquivos JavaScript disponíveis no projeto:\n${availableFiles || 'Nenhum arquivo .js encontrado'}\n\n` +
        `Soluções:\n` +
        `1. Crie um index.js ou main.js na raiz do projeto\n` +
        `2. Especifique o campo "main" no package.json (ex: "main": "src/run.js")\n` +
        `3. Renomeie seu arquivo principal para um dos nomes padrão\n` +
        `4. Certifique-se de selecionar a pasta raiz do projeto (contendo package.json)`
    );
}

// ===== ATUALIZAÇÃO NA FUNÇÃO executeExn =====
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

        // Criar FormData com o arquivo EXN
        const formData = new FormData();
        const blob = new Blob([exnContent], { type: 'application/json' });
        formData.append('file', blob, exnFilename || 'project.exn');

        const response = await fetch(`${SERVER_URL}/execute`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`Erro ${response.status}: ${response.statusText}`);
        }

        // Processar a resposta em tempo real
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        outputElement.textContent = '';

        while (true) {
            const {value, done} = await reader.read();
            if (done) break;
            
            const text = decoder.decode(value, {stream: true});
            outputElement.textContent += text;
            outputElement.scrollTop = outputElement.scrollHeight;
        }

    } catch (error) {
        console.error('Erro na execução:', error);
        outputElement.textContent = `Erro: ${error.message}`;
        showNotification('Falha na execução do arquivo EXN', 'error');
    } finally {
        loadingElement.classList.add('hidden');
    }
}

function debugFileStructure(files) {
    console.groupCollapsed('Estrutura completa de arquivos');
    Object.keys(files).forEach(file => {
        console.log(file);
    });
    console.groupEnd();

    console.groupCollapsed('Arquivos JavaScript encontrados');
    Object.keys(files)
        .filter(f => f.endsWith('.js'))
        .forEach(file => {
            console.log(file);
        });
    console.groupEnd();
}


// ===== CONVERSÃO PARA EXN =====
async function convertToExn() {
    const files = jsFileInput.files;
    if (files.length === 0) {
        showNotification('Selecione a pasta raiz do projeto', 'error');
        return;
    }

    loadingConvert.classList.remove('hidden');

    try {
        const archive = {
            metadata: {
                version: "2.0",
                createdAt: new Date().toISOString()
            },
            files: {}
        };

        // 1. Processa todos os arquivos e remove o prefixo da pasta raiz
        const fileEntries = await Promise.all(Array.from(files).map(async (file) => {
            let path = file.webkitRelativePath || file.name;
            // Remove o prefixo da pasta raiz (ex: "Raldowork/")
            if (path.includes('/')) {
                path = path.split('/').slice(1).join('/');
            }
            return {
                path: path,
                content: await readFileAsText(file)
            };
        }));

        // Preenche archive.files com caminhos normalizados
        fileEntries.forEach(entry => {
            archive.files[entry.path] = entry.content;
        });

        // DEBUG: Mostra estrutura de arquivos
        console.log("Arquivos disponíveis:", Object.keys(archive.files));

        // 2. Processa package.json se existir
        let packageJson = null;
        if (archive.files['package.json']) {
            try {
                packageJson = JSON.parse(archive.files['package.json']);
                archive.metadata.name = packageJson.name || 'unnamed-project';
                archive.metadata.version = packageJson.version || '1.0.0';
                archive.metadata.type = packageJson.type || 'commonjs';
            } catch (e) {
                console.warn('Package.json inválido', e);
            }
        }

        // 3. Determinação do ponto de entrada - VERSÃO SIMPLIFICADA
        archive.metadata.entryPoint = (() => {
            // Primeiro: usa o campo 'main' do package.json se existir
            if (packageJson?.main) {
                const mainFile = packageJson.main.replace(/^\.?\//, ''); // Remove ./ se existir
                if (archive.files[mainFile]) {
                    console.log(`Entrada encontrada via package.json: ${mainFile}`);
                    return mainFile;
                }
            }

            // Segundo: tenta os arquivos padrão na raiz
            const defaultEntries = ['index.js', 'main.js', 'app.js', 'server.js'];
            for (const entry of defaultEntries) {
                if (archive.files[entry]) {
                    console.log(`Entrada encontrada (padrão raiz): ${entry}`);
                    return entry;
                }
            }

            // Se não encontrou, lista os arquivos disponíveis para ajudar no debug
            const availableFiles = Object.keys(archive.files)
                .filter(f => f.endsWith('.js') && !f.includes('node_modules'))
                .map(f => `• ${f}`)
                .join('\n');

            throw new Error(
                `Nenhum ponto de entrada encontrado!\n\n` +
                `Arquivos .js disponíveis:\n${availableFiles}\n\n` +
                `Soluções:\n` +
                `1. Crie um index.js ou main.js na raiz\n` +
                `2. Especifique o campo "main" no package.json\n` +
                `3. Verifique se selecionou a pasta raiz do projeto`
            );
        })();

        // 4. Validação final do ponto de entrada
        if (!archive.files[archive.metadata.entryPoint]) {
            throw new Error(
                `Erro crítico: O arquivo de entrada '${archive.metadata.entryPoint}' ` +
                `foi selecionado mas não existe nos arquivos!`
            );
        }

        // 5. Gera o arquivo .exn
        const blob = new Blob([JSON.stringify(archive, null, 2)], { 
            type: 'application/json' 
        });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `${archive.metadata.name || 'project'}.exn`;
        a.click();
        
        URL.revokeObjectURL(url);
        showNotification('Conversão concluída!', 'success');

    } catch (error) {
        console.error('Erro na conversão:', error);
        outputLog([error.message], 'error');
        showNotification('Erro na conversão: ' + error.message, 'error');
    } finally {
        loadingConvert.classList.add('hidden');
    }
}

// Função auxiliar para ler arquivos
function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = () => reject(new Error(`Falha ao ler ${file.name}`));
        reader.readAsText(file);
    });
}

// ===== FUNÇÕES UTILITÁRIAS =====
exnFileInput.addEventListener('change', async function() {
    try {
        const file = this.files[0];
        if (file) {
            exnContent = await readFileAsText(file);
            exnFilename = file.name;
            showNotification('Arquivo EXN carregado com sucesso!', 'success');
        }
    } catch (error) {
        console.error('Erro ao ler arquivo:', error);
        showNotification('Erro ao carregar arquivo EXN', 'error');
    }
});
function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = e => reject(new Error(`Falha ao ler ${file.name}`));
        reader.readAsText(file);
    });
}

function downloadFile(filename, content) {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    // Estilos
    Object.assign(notification.style, {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        padding: '12px 20px',
        borderRadius: 'var(--radius)',
        backgroundColor: type === 'error' ? 'var(--destructive)' : '#10b981',
        color: '#ffffff',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        zIndex: '1000',
        transform: 'translateY(20px)',
        opacity: '0',
        transition: 'all 0.3s ease'
    });
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.transform = 'translateY(0)';
        notification.style.opacity = '1';
    }, 10);
    
    setTimeout(() => {
        notification.style.transform = 'translateY(20px)';
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ===== VINCULA EVENTOS =====
document.getElementById('executeExnBtn').addEventListener('click', executeExn);
document.getElementById('convertToExnBtn').addEventListener('click', convertToExn);