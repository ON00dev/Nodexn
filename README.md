# Nodexn - Aplicativo de Conversão e Execução de Projetos Node.js para .EXN

## 🌟 Visão Geral
O Nodexn é um aplicativo pronto para uso que permite converter e executar projetos Node.js em um ambiente isolado, sem necessidade de instalação ou configuração prévia.

## 📥 Como Obter
1. **Download**:
   - Baixe o apk mais recente na [página de releases](#) (https://github.com)

2. **Execução**:
   - Abra o app `Nodexn`

## 📱 Interface do Usuário

### Áreas Principais:
1. **Seletor de Arquivos**:
   - Botão para selecionar arquivos/projetos
   - Visualização dos arquivos selecionados

2. **Painel de Controle**:
   - "Converter para EXN" - Transforma seu projeto em um arquivo .exn
   - "Executar EXN" - Roda arquivos .exn no ambiente seguro

3. **Saída**:
   - Exibe logs e resultados da execução
   - Destaque para mensagens de erro

## 🛠️ Funcionalidades Principais

### Conversão de Projetos
1. Selecione a pasta do seu projeto Node.js
2. Clique em "Converter"
3. Receba um arquivo `.exn` único contendo:
   - Todos os arquivos do projeto
   - Dependências incluídas
   - Metadados e configurações

### Execução Segura
- Ambiente isolado (sandbox)
- Controle de permissões
- Suporte a:
  - [x] CommonJS
  - [x] ES Modules
  - [x] Plugins (.exnplugin.js)

## ⚙️ Configuração

### Permissões
Edite o `package.json` do seu projeto para definir permissões:
```json
{
  "exnPermissions": [
    "filesystem",
    "network"
  ]
}
```

### Plugins
Crie arquivos `.exnplugin.js` para estender funcionalidades:
```javascript
plugins.register('meu-plugin', {
  init(sandbox) {
    sandbox.minhasFuncoes = {
      saudacao: () => "Olá do plugin!"
    };
  }
});
```

## 📌 Dicas Rápidas

1. **Para projetos simples**:
   - Basta ter um `main.js` ou `index.js` na raiz

2. **Para projetos complexos**:
   - Mantenha a estrutura padrão (src/, public/, etc.)
   - Especifique o ponto de entrada no `package.json` no campo `main`

3. **Para distribuição**:
   - Converta para .exn
   - Compartilhe o único arquivo gerado

## ⚠️ Limitações Conhecidas

- Tamanho máximo do projeto: 500MB
- Não suporta módulos nativos do Node.js
- Algumas APIs restritas por segurança

## 🤔 Perguntas Frequentes

**P: Posso usar npm install no projeto convertido?**  
R: Não é necessário - todas as dependências são incluídas no arquivo .exn

**P: Como debugar erros?**  
R: Verifique o painel de saída no aplicativo e os logs gerados

**P: Meu plugin não está funcionando**  
R: Verifique se:
1. O arquivo termina com .exnplugin.js
2. Está na pasta raiz ou /plugins
3. Usa plugins.register() corretamente

## 📞 Suporte

Para ajuda adicional:
- Email: on00dev.dev@gmail.com
- Horário comercial: 09:00 - 18:00 (GMT-3)

---

📌 **Nota**: Este é um aplicativo autônomo - não requer Node.js instalado nem acesso à internet para funcionar!
