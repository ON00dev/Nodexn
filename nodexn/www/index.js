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

// ===== CONTROLE DE ARQUIVOS =====
const exnFileInput = document.getElementById('exnFile');
const exnFileName = document.getElementById('exnFileName');
const jsFileInput = document.getElementById('jsFile');
const jsFileCount = document.getElementById('jsFileCount');
const loadingExn = document.getElementById('loadingExn');
const loadingConvert = document.getElementById('loadingConvert');
const output = document.getElementById('output');

exnFileInput.addEventListener('change', updateExnFileName);
jsFileInput.addEventListener('change', updateJsFileCount);

function updateExnFileName() {
    exnFileName.textContent = this.files[0]?.name || 'Nenhum arquivo selecionado';
}

function updateJsFileCount() {
    jsFileCount.textContent = this.files.length > 0 
        ? `${this.files.length} arquivo(s) selecionado(s)` 
        : 'Nenhum arquivo selecionado';
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
    // Ordem de prioridade para detecção
    const entryPoints = [
        'main.js',
        'index.js',
        'run.js',
        'app.js',
        'server.js',
        'start.js',
        'src/main.js',
        'src/index.js',
        'src/run.js',
        'src/app.js',
        'src/server.js',
        'src/start.js',
        'dist/main.js',
        'dist/index.js',
        'dist/run.js',
        'dist/app.js',
        'dist/server.js',
        'dist/start.js'
    ];

    // Verifica primeiro no package.json (se existir)
    if (files['package.json']) {
        try {
            const pkg = JSON.parse(files['package.json']);
            
            // 1. Verifica o campo 'main'
            if (pkg.main && files[pkg.main]) {
                return pkg.main;
            }
            
            // 2. Verifica o campo 'bin' (para aplicações CLI)
            if (pkg.bin) {
                const binEntry = typeof pkg.bin === 'string' 
                    ? pkg.bin 
                    : Object.values(pkg.bin)[0];
                if (files[binEntry]) {
                    return binEntry;
                }
            }
            
            // 3. Verifica scripts de start (analisa o package.json)
            if (pkg.scripts && pkg.scripts.start) {
                const startScript = pkg.scripts.start;
                // Extrai o nome do arquivo de comandos como "node server.js"
                const scriptFile = startScript.split(' ').find(part => 
                    part.endsWith('.js') && files[part]
                );
                if (scriptFile) return scriptFile;
            }
        } catch (e) {
            console.error('Erro ao analisar package.json', e);
        }
    }

    // Verifica os padrões comuns
    for (const entry of entryPoints) {
        if (files[entry]) {
            return entry;
        }
    }

    // Tenta encontrar qualquer arquivo .js na raiz
    const rootJsFiles = Object.keys(files).filter(file => 
        file.split('/').length === 1 && file.endsWith('.js')
    );
    
    if (rootJsFiles.length === 1) {
        return rootJsFiles[0];
    }

    throw new Error('Não foi possível determinar o ponto de entrada. Possíveis candidatos: ' +
        entryPoints.join(', ') + ' ou especifique no package.json');
}

// ===== ATUALIZAÇÃO NA FUNÇÃO executeExn =====
async function executeExn() {
    const file = exnFileInput.files[0];
    if (!file) {
        showNotification('Selecione um arquivo EXN', 'error');
        return;
    }

    output.innerHTML = '';
    loadingExn.classList.remove('hidden');

    try {
        const exnData = JSON.parse(await readFileAsText(file));
        if (!exnData.files || typeof exnData.files !== 'object') {
            throw new Error('Formato EXN inválido: faltam arquivos');
        }

        const moduleSystem = new ModuleSystem();
        const entryPoint = detectEntryPoint(exnData.files);
        const isESModule = exnData.metadata?.type === 'module' || 
                          entryPoint.endsWith('.mjs') || 
                          (exnData.files['package.json'] && 
                           JSON.parse(exnData.files['package.json']).type === 'module');

        if (!entryPoint) {
            throw new Error('Nenhum ponto de entrada detectado');
        }

        if (!exnData.files[entryPoint]) {
            throw new Error(`Ponto de entrada '${entryPoint}' não encontrado nos arquivos`);
        }

        // Carrega todos os arquivos JS no sistema de módulos
        for (const [path, content] of Object.entries(exnData.files)) {
            if (path.endsWith('.js') || path.endsWith('.mjs')) {
                moduleSystem.cache.set(path, {
                    exports: {},
                    filename: path,
                    loaded: false
                });
            }
        }

        // Executa o ponto de entrada
        await moduleSystem.evaluateModule(entryPoint, exnData.files[entryPoint], isESModule);
        showNotification('EXN executado com sucesso!', 'success');
    } catch (error) {
        outputLog([`Erro: ${error.message}`], 'error');
        showNotification('Falha ao executar EXN', 'error');
    } finally {
        loadingExn.classList.add('hidden');
    }
}

// ===== CONVERSÃO PARA EXN =====
async function convertToExn() {
    const files = jsFileInput.files;
    if (files.length === 0) {
        showNotification('Selecione os arquivos do projeto', 'error');
        return;
    }

    loadingConvert.classList.remove('hidden');

    try {
        const archive = {
            metadata: {
                version: "1.0",
                createdAt: new Date().toISOString()
            },
            files: {}
        };

        let packageJson = null;
        
        // Processa todos os arquivos
        for (const file of files) {
            const content = await readFileAsText(file);
            const filePath = file.webkitRelativePath || file.name;
            archive.files[filePath] = content;

            if (file.name === 'package.json') {
                packageJson = JSON.parse(content);
                archive.metadata.name = packageJson.name || 'unnamed-project';
                archive.metadata.version = packageJson.version || '1.0.0';
                archive.metadata.type = packageJson.type || 'commonjs';
                
                if (packageJson.main) {
                    archive.metadata.entryPoint = packageJson.main;
                }
            }
        }

        if (!packageJson) {
            throw new Error('O projeto deve conter um package.json');
        }

        if (!archive.metadata.entryPoint) {
            if (archive.files['index.js']) {
                archive.metadata.entryPoint = 'index.js';
            } else if (archive.files['main.js']) {
                archive.metadata.entryPoint = 'main.js';
            } else {
                throw new Error('Nenhum ponto de entrada encontrado (main.js ou index.js)');
            }
        }

        // Cria e faz download do arquivo .exn
        downloadFile(
            `${archive.metadata.name || 'project'}.exn`,
            JSON.stringify(archive, null, 2)
        );
        
        showNotification('Conversão concluída!', 'success');
    } catch (error) {
        outputLog([`Erro: ${error.message}`], 'error');
        showNotification('Falha na conversão', 'error');
    } finally {
        loadingConvert.classList.add('hidden');
    }
}

// ===== FUNÇÕES UTILITÁRIAS =====
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