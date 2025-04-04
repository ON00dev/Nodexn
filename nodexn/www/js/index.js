// Theme toggle functionality
const themeToggle = document.getElementById('themeToggle');
const htmlElement = document.documentElement;

// Check for saved theme preference or use default
const savedTheme = localStorage.getItem('theme') || 'light';
if (savedTheme === 'dark') {
    htmlElement.classList.add('dark');
}

themeToggle.addEventListener('click', () => {
    htmlElement.classList.toggle('dark');
    const currentTheme = htmlElement.classList.contains('dark') ? 'dark' : 'light';
    localStorage.setItem('theme', currentTheme);
});

// File input handling
const exnFileInput = document.getElementById('exnFile');
const exnFileName = document.getElementById('exnFileName');
const jsFileInput = document.getElementById('jsFile');
const jsFileCount = document.getElementById('jsFileCount');
const loadingExn = document.getElementById('loadingExn');
const loadingConvert = document.getElementById('loadingConvert');
const output = document.getElementById('output');

exnFileInput.addEventListener('change', function() {
    if (this.files.length > 0) {
        exnFileName.textContent = this.files[0].name;
    } else {
        exnFileName.textContent = 'Nenhum arquivo selecionado';
    }
});

jsFileInput.addEventListener('change', function() {
    if (this.files.length > 0) {
        jsFileCount.textContent = `${this.files.length} arquivo(s) selecionado(s)`;
    } else {
        jsFileCount.textContent = 'Nenhum arquivo selecionado';
    }
});

// Execute EXN function
function executeExn() {
    const file = exnFileInput.files[0];
    if (!file) {
        showNotification('Selecione um arquivo EXN', 'error');
        return;
    }

    output.textContent = '';
    loadingExn.classList.remove('hidden');

    const reader = new FileReader();
    reader.onload = function(e) {
        fetch('/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ exnContent: e.target.result })
        })
        .then(response => response.text())
        .then(result => { 
            output.innerHTML = result; 
            loadingExn.classList.add('hidden');
            showNotification('EXN executado com sucesso!', 'success');
        })
        .catch(err => { 
            output.textContent = 'Erro: ' + err; 
            loadingExn.classList.add('hidden');
            showNotification('Erro ao executar o arquivo', 'error');
        });

        // Uncomment this for actual API implementation
        /*
        fetch('/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ exnContent: e.target.result })
        })
        .then(response => response.text())
        .then(result => { 
            output.innerHTML = result; 
            loadingExn.classList.add('hidden');
            showNotification('EXN executado com sucesso!', 'success');
        })
        .catch(err => { 
            output.textContent = 'Erro: ' + err; 
            loadingExn.classList.add('hidden');
            showNotification('Erro ao executar o arquivo', 'error');
        });
        */
    };
    reader.readAsText(file);
}

// Convert to EXN function
function convertToExn() {
    const files = jsFileInput.files;
    if (!files.length) {
        showNotification('Selecione arquivos .js', 'error');
        return;
    }

    loadingConvert.classList.remove('hidden');
    const archive = {};
    let filesRead = 0;

    for (const file of files) {
        const reader = new FileReader();
        reader.onload = function(e) {
            archive[file.name] = e.target.result;
            filesRead++;

            if (filesRead === files.length) {
                fetch('/convert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ files: Object.keys(archive) })
        })
        .then(response => response.json())
        .then(data => {
            const blob = new Blob([JSON.stringify(data.exnContent, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'arquivo.exn';
            a.click();
            URL.revokeObjectURL(url);
            loadingConvert.classList.add('hidden');
            showNotification('Conversão concluída com sucesso!', 'success');
        })
        .catch(err => {
            loadingConvert.classList.add('hidden');
            showNotification('Erro ao converter arquivos', 'error');
        });
            }
        };
        reader.readAsText(file);
    }
}

// Notification function
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.style.position = 'fixed';
    notification.style.bottom = '20px';
    notification.style.right = '20px';
    notification.style.padding = '12px 20px';
    notification.style.borderRadius = 'var(--radius)';
    notification.style.backgroundColor = type === 'error' ? 'var(--destructive)' : '#10b981';
    notification.style.color = '#ffffff';
    notification.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
    notification.style.zIndex = '1000';
    notification.style.transform = 'translateY(20px)';
    notification.style.opacity = '0';
    notification.style.transition = 'all 0.3s ease';
    
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.transform = 'translateY(0)';
        notification.style.opacity = '1';
    }, 10);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.transform = 'translateY(20px)';
        notification.style.opacity = '0';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}