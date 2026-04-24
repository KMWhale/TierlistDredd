# 🗺 TKK DREDD — Sistema de Posicionamento Cartesiano

> Ferramenta visual para posicionar imagens em um plano cartesiano com eixos editáveis.  
> Sistema de login com permissões, histórico de acessos e salvamento versionado.

---

## 📁 Mapa completo de arquivos

```
tkk-dredd/
│
├── index.html              ← Página principal. Abra no navegador.
│
├── css/
│   └── style.css           ← Toda a aparência. Edite cores e fontes aqui.
│
├── js/
│   ├── auth.js             ← Usuários, permissões e histórico de acessos.
│   ├── saves.js            ← Sistema de save/load de posições.
│   ├── app.js              ← Lógica principal do plano (não editar).
│   └── auth-hashes.js      ← ⚠️ NÃO COMMITAR — arquivo local com hashes
│                              (gerado manualmente, listado no .gitignore)
│
├── images/
│   └── README.md           ← Coloque aqui suas imagens PNG/JPG.
│
├── saves/
│   └── README.md           ← JSONs salvos vão aqui (baixados pela interface).
│
├── .gitignore              ← Protege auth-hashes.js de ir ao GitHub.
└── README.md               ← Este arquivo.
```

---

## 🔐 Segurança — Como as senhas funcionam

As senhas **nunca ficam em texto puro** no código versionado. O sistema usa **SHA-256** (algoritmo de hash criptográfico) via a API nativa do navegador.

### Como funciona na prática:

**Primeira vez (setup inicial):**
- O `auth.js` contém um bloco `raw` com as senhas temporariamente para gerar os hashes.
- Ao abrir o site, os hashes são gerados automaticamente na memória.
- Isso funciona, mas as senhas ficam visíveis no `auth.js` — ok para uso local, mas não ideal para repositório público.

**Forma segura (recomendada para repositório público):**

1. Abra o `index.html` no navegador
2. Abra o Console do navegador (F12 → Console)
3. Cole e execute:
```js
async function gerarHashes() {
  const senhas = {
    sabonete: 'Sabao.478',
    salsa:    'MyMelody:666',
    ebras:    'IBGE_TBao',
    igor:     'Eletrica.My. passion',
    sraveia:  'Geodute.c.Agua',
    leandro:  'Biologia_The_Soft_Science',
    jesus:    'Pai.de.Orfanato',
    aquiles:  'Terra.concava',
    pato:     'Pato.Ateu.Dispor',
  };
  const resultado = {};
  for (const [k, v] of Object.entries(senhas)) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v));
    resultado[k] = Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
  }
  console.log('window.__TKK_HASHES =', JSON.stringify(resultado, null, 2));
}
gerarHashes();
```
4. Copie o resultado do console
5. Crie o arquivo `js/auth-hashes.js` com o conteúdo:
```js
window.__TKK_HASHES = {
  "sabonete": "hash_gerado_aqui...",
  "salsa":    "hash_gerado_aqui...",
  // ... etc
};
```
6. Adicione `<script src="js/auth-hashes.js"></script>` **antes** de `auth.js` no `index.html`
7. Remova o bloco `raw` do `auth.js`
8. O arquivo `auth-hashes.js` está no `.gitignore` — **nunca vai ao GitHub**

---

## 👥 Níveis de acesso

| Role | O que pode fazer |
|------|-----------------|
| **admin** | Upload de imagens, mover/redimensionar/excluir itens, editar eixos, salvar JSON, exportar PNG, ver histórico, tela cheia |
| **viewer** (logado) | Carregar JSON, visualizar plano. Registrado no histórico. |
| **visitante** | Apenas carregar JSON e visualizar. **Não registrado no histórico.** |

---

## 👤 Adicionar ou editar usuários

Abra `js/auth.js` e localize o array `USERS`:

```js
const USERS = [
  { user: 'sabonete', label: 'Sabonete', role: 'admin', hash: '' },
  // ...
];
```

Para adicionar um novo usuário:
```js
{ user: 'novouser', label: 'Nome Exibido', role: 'admin', hash: '' },
```

Depois gere o hash da senha pelo console (veja seção de segurança acima) e insira em `auth-hashes.js`.

---

## 💾 Salvar e Carregar Posições

### Salvar:
1. Login como **admin**
2. Posicione as imagens
3. Clique **"Salvar JSON"** na barra superior
4. Uma janela pedirá o nome do arquivo — por padrão é `seunome_data`
5. O download acontece automaticamente
6. Mova o arquivo para a pasta `saves/`

### Carregar:
1. Faça upload das imagens na galeria primeiro
2. Clique **"Carregar JSON"**
3. Escolha um save do histórico ou clique em "Selecionar arquivo local"
4. Os eixos e posições são restaurados automaticamente

> Os eixos (nomes dos quadrantes) ficam salvos no JSON e são carregados junto.

---

## 🏷 Editar os nomes dos eixos

1. Login como **admin**
2. Clique no botão **"Eixos"** na barra superior
3. Digite os nomes desejados
4. Clique **Aplicar**
5. Os nomes serão incluídos no próximo JSON salvo

---

## 📋 Histórico de acessos

- Cada login/logout de usuários **com conta** é registrado
- Visitantes anônimos **não são registrados**
- Para exportar: botão **"Histórico"** na barra (só admin) → baixa CSV
- O histórico fica no `localStorage` do navegador (persiste entre sessões)

---

## 🌐 Publicar no GitHub Pages — Passo a Passo

### O que você precisa:
- Uma conta no [github.com](https://github.com) (grátis)
- Os arquivos do projeto no seu computador

---

### Passo 1 — Criar conta no GitHub
1. Acesse [github.com](https://github.com) → clique **Sign up**
2. Preencha email, senha e nome de usuário
3. Confirme o email

---

### Passo 2 — Criar o repositório
1. Após entrar, clique no botão verde **"New"** (canto superior esquerdo)
2. Em **Repository name**: `tkk-dredd`
3. Marque **Public**
4. Clique **Create repository**

---

### Passo 3 — Enviar os arquivos (sem instalar nada)
1. Na página do repositório, clique em **"uploading an existing file"**
2. Arraste os arquivos e pastas do projeto:
   - `index.html`
   - pasta `css/`
   - pasta `js/` ← **não inclua `auth-hashes.js`** se já o criou
   - pasta `images/` (com o README.md dela)
   - pasta `saves/` (com o README.md dela)
   - `.gitignore`
   - `README.md`
3. Em **Commit changes**, escreva: `"Upload inicial TKK DREDD"`
4. Clique **Commit changes**

---

### Passo 4 — Ativar o GitHub Pages
1. No repositório → clique em **Settings**
2. Menu lateral → **Pages**
3. Em **Source**:
   - Branch: **main**
   - Pasta: **/ (root)**
4. Clique **Save**
5. Aguarde ~2 minutos
6. Seu site estará em:
   ```
   https://SEU_USUARIO.github.io/tkk-dredd/
   ```

---

### Passo 5 — Atualizar arquivos depois de mudanças
**Pelo site do GitHub:**
1. Acesse o repositório
2. Clique no arquivo (ex: `js/auth.js`)
3. Clique no lápis ✏️ → edite → **Commit changes**
4. Site atualiza em ~1 minuto

---

## 🕹 Controles da Interface

| Ação | Como |
|------|------|
| Adicionar imagem ao plano | Arraste da galeria OU duplo clique |
| Mover imagem | Clique e arraste (admin) |
| Redimensionar | Scroll do mouse sobre a imagem |
| Remover do plano | Botão ✕ vermelho (admin) |
| Remover da galeria | Hover no thumbnail → ✕ no canto inferior (admin) |
| Mover o fundo | Segure **Espaço** + arraste |
| Zoom | **Ctrl + Scroll** ou botões na barra |
| Deletar selecionado | Tecla **Delete** |
| Sair da tela cheia | Tecla **Esc** |

---

## 🎨 Personalizar cores

Edite as variáveis em `css/style.css`:

```css
:root {
  --accent:  #e8ff47;  /* amarelo — destaque principal */
  --accent2: #47ffe8;  /* ciano — coordenadas */
  --accent3: #ff4757;  /* vermelho — exclusão/alertas */
  --bg:      #08080c;  /* fundo escuro */
}
```

---

*TKK DREDD v2.2*
