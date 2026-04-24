/* ═══════════════════════════════════════════════════════════════
   TKK DREDD — js/firebase-sync.js
   Integração com Firebase Realtime Database
═══════════════════════════════════════════════════════════════ */

const firebaseConfig = {
  apiKey: "AIzaSyDXHH2i4cQxmq3DQw-g1ENmkBQpm0aM0uU",
  authDomain: "dredd-744bc.firebaseapp.com",
  projectId: "dredd-744bc",
  storageBucket: "dredd-744bc.firebasestorage.app",
  messagingSenderId: "533296611386",
  appId: "1:533296611386:web:1efe34ab5a439fc26ab503",
  databaseURL: "https://dredd-744bc-default-rtdb.firebaseio.com" // Necessário para o Realtime Database
};

// Inicializa o Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

let isSyncingFromFirebase = false;

// Função para escutar mudanças no banco e atualizar a tela
function listenToFirebase() {
  const boardRef = db.ref('board/items');
  
  boardRef.on('value', (snapshot) => {
    const data = snapshot.val();
    
    // Marca que a atualização está vindo do Firebase para não re-emitir
    isSyncingFromFirebase = true;
    
    // Se não há dados, significa que o plano foi limpo
    if (!data) {
      Object.keys(S.items).forEach(id => {
        // Remove os itens locais que não estão no Firebase
        if (typeof removeItem === 'function') {
          // Temporariamente desabilita a verificação de lock para limpar via Firebase
          const originalLocked = S.items[id].locked;
          S.items[id].locked = false; 
          removeItem(id, true); // passa flag para não enviar de volta (opcional, vamos ajustar em app.js)
          S.items[id] = undefined; 
        }
      });
      isSyncingFromFirebase = false;
      return;
    }
    
    // Adiciona ou atualiza itens que estão no Firebase
    for (const [id, itemData] of Object.entries(data)) {
      if (!S.items[id]) {
        // Item novo, precisamos achar a imagem na galeria
        const gItem = S.gallery.find(g => g.name === itemData.name || g.src === itemData.src);
        if (gItem || itemData.src) {
           addToPlane(itemData.src, itemData.name, itemData.px, itemData.py, itemData.size, gItem?.el, id);
        }
      } else {
        // Atualiza a posição e tamanho
        const item = S.items[id];
        // Evitar jitter se o próprio usuário estiver arrastando E for o editor original
        // Mas para simplificar, se não for o item que está arrastando atualmente:
        if (S.dragging !== id) {
          item.px = itemData.px;
          item.py = itemData.py;
          item.size = itemData.size;
          
          item.el.style.left = item.px + 'px';
          item.el.style.top = item.py + 'px';
          item.el.style.width = item.size + 'px';
          item.el.style.height = item.size + 'px';
          
          const co = pixelToCoord(item.px + item.size/2, item.py + item.size/2);
          item.x = co.x;
          item.y = co.y;
          
          if (S.selectedId === id) {
            updateCoordPanel(id);
          }
        }
      }
    }
    
    // Remove itens que foram deletados no Firebase
    Object.keys(S.items).forEach(id => {
      if (!data[id]) {
        if (typeof removeItem === 'function') {
           const originalLocked = S.items[id].locked;
           S.items[id].locked = false;
           removeItem(id, true);
        }
      }
    });
    
    if (typeof syncFStoPlane === 'function' && S.fsActive) {
       // Atualizar fullscreen se estiver ativo
       // Faremos essa parte manualmente se necessário ou fechamos fs
    }
    
    if (typeof updateItemsList === 'function') {
      updateItemsList();
    }
    
    isSyncingFromFirebase = false;
  });
}

// Enviar uma nova posição/tamanho/adicionar item
function firebaseUpdateItem(id, item) {
  if (isSyncingFromFirebase || !isEditor()) return; // Não re-emite se veio de lá
  
  const ref = db.ref('board/items/' + id);
  ref.set({
    name: item.name,
    src: item.src,
    px: item.px,
    py: item.py,
    size: item.size
  });
}

// Remover um item
function firebaseRemoveItem(id) {
  if (isSyncingFromFirebase || !isEditor()) return;
  db.ref('board/items/' + id).remove();
}

// Limpar todo o plano
function firebaseClearPlane() {
  if (isSyncingFromFirebase || !isAdmin()) return;
  db.ref('board/items').remove();
}

// Iniciar a sincronização quando a aplicação carregar
window.addEventListener('DOMContentLoaded', () => {
  // Dá um tempinho pro auth carregar
  setTimeout(() => {
     listenToFirebase();
  }, 500);
});
