const socket = io();
let userEmail = '', userFoto = '', chatAtivo = '', isLogin = true;

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('active');
}

function alternar() {
    isLogin = !isLogin;
    document.getElementById('auth-title').innerText = isLogin ? 'AGD Mensseger' : 'Criar Conta';
    document.getElementById('reg-fields').style.display = isLogin ? 'none' : 'block';
    document.getElementById('btn-auth').innerText = isLogin ? 'Entrar' : 'Cadastrar';
}

function executarAuth() {
    const email = document.getElementById('auth-email').value;
    const senha = document.getElementById('auth-senha').value;
    if(isLogin) socket.emit('tentativa_login', { email, senha });
    else socket.emit('registar_utilizador', { 
        nome: document.getElementById('reg-nome').value, foto: document.getElementById('reg-foto').value, email, senha 
    });
}

socket.on('login_sucesso', d => {
    userEmail = d.email; userFoto = d.foto;
    document.getElementById('auth-area').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    document.getElementById('my-pic').src = d.foto;
    renderizarContatos(d.contatos);
});

function adicionarAmigo() {
    const mail = document.getElementById('add-mail').value;
    if(mail) socket.emit('adicionar_contato', mail);
    document.getElementById('add-mail').value = '';
}

socket.on('atualizar_contatos', renderizarContatos);

function renderizarContatos(lista) {
    document.getElementById('contacts-list').innerHTML = lista.map(c => `
        <div class="contact-item" onclick="abrirChat('${c.email}', '${c.nome}', '${c.foto}')">
            <img src="${c.foto}" class="avatar">
            <div class="info">
                <span class="name">${c.nome}</span>
                <span class="mail">${c.email}</span>
            </div>
        </div>
    `).join('');
}

function abrirChat(email, nome, foto) {
    chatAtivo = email;
    document.getElementById('chat-nome').innerText = nome;
    document.getElementById('chat-status').innerText = 'Online';
    document.getElementById('controls').style.display = 'flex';
    document.getElementById('messages').innerHTML = '<p style="text-align:center; font-size:0.8rem; color:#94a3b8;">Carregando histórico...</p>';
    
    // Solicita as mensagens antigas ao servidor
    socket.emit('buscar_historico', email);
    
    if(window.innerWidth <= 768) toggleSidebar();
}

// Renderiza as mensagens do histórico recebidas do banco
socket.on('historico_carregado', mensagens => {
    const box = document.getElementById('messages');
    box.innerHTML = '';
    mensagens.forEach(msg => {
        exibirMensagemNoChat(msg);
    });
});

function enviar() {
    const txt = document.getElementById('msg-input').value;
    if(txt && chatAtivo) {
        socket.emit('enviar_privado', { para: chatAtivo, texto: txt });
        document.getElementById('msg-input').value = '';
    }
}

socket.on('nova_msg', d => {
    if(d.de === chatAtivo || d.de === userEmail) {
        exibirMensagemNoChat(d);
    }
});

function exibirMensagemNoChat(d) {
    const box = document.getElementById('messages');
    const div = document.createElement('div');
    div.className = `msg-row ${d.de === userEmail ? 'msg-me' : ''}`;
    div.innerHTML = `<img src="${d.foto}" class="avatar"><div class="bubble">${d.texto}</div>`;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
}

socket.on('registo_sucesso', () => { alert("Conta criada!"); alternar(); });
socket.on('erro_sistema', m => alert(m));
document.getElementById('msg-input').addEventListener('keypress', e => { if(e.key === 'Enter') enviar(); });
