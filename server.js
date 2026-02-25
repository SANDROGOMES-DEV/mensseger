const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Banco de dados conectado!'))
  .catch(err => console.error('❌ Erro DB:', err));

// --- MODELOS ---
const userSchema = new mongoose.Schema({
    nome: String,
    email: { type: String, unique: true, required: true },
    senha: { type: String, required: true },
    foto: { type: String, default: 'https://cdn-icons-png.flaticon.com/512/149/149071.png' },
    contatos: [String] 
});
const User = mongoose.model('User', userSchema);

const messageSchema = new mongoose.Schema({
    de: String, para: String, texto: String, foto: String,
    data: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', messageSchema);

// FUNÇÃO AUXILIAR: Transforma lista de e-mails em lista de perfis (nome, email, foto)
const buscarDadosContatos = async (emails) => {
    const dados = await User.find({ email: { $in: emails } }, 'nome email foto');
    return dados.map(u => ({ nome: u.nome, email: u.email, foto: u.foto }));
};

io.on('connection', (socket) => {
    
    socket.on('registar_utilizador', async (dados) => {
        try {
            const senhaHash = await bcrypt.hash(dados.senha, 10);
            const novoUser = new User({ 
                nome: dados.nome, email: dados.email, senha: senhaHash,
                foto: dados.foto || undefined 
            });
            await novoUser.save();
            socket.emit('registo_sucesso');
        } catch (err) { socket.emit('registo_erro', 'E-mail já existe.'); }
    });

    socket.on('tentativa_login', async (dados) => {
        const user = await User.findOne({ email: dados.email });
        if (user && await bcrypt.compare(dados.senha, user.senha)) {
            socket.email = user.email;
            socket.nome = user.nome;
            socket.foto = user.foto;
            socket.join(user.email);
            
            // Busca os nomes e fotos dos contatos antes de enviar o sucesso do login
            const contatosComDados = await buscarDadosContatos(user.contatos);
            socket.emit('login_sucesso', { 
                nome: user.nome, 
                email: user.email, 
                foto: user.foto, 
                contatos: contatosComDados 
            });
        } else { socket.emit('login_erro'); }
    });

    socket.on('adicionar_contato', async (emailAlvo) => {
        const alvo = await User.findOne({ email: emailAlvo });
        if (alvo && emailAlvo !== socket.email) {
            await User.findOneAndUpdate({ email: socket.email }, { $addToSet: { contatos: emailAlvo } });
            const eu = await User.findOne({ email: socket.email });
            const contatosComDados = await buscarDadosContatos(eu.contatos);
            socket.emit('atualizar_contatos', contatosComDados);
        } else {
            socket.emit('erro_sistema', 'Usuário não encontrado.');
        }
    });

    socket.on('enviar_privado', async (dados) => {
        const msg = new Message({ de: socket.email, para: dados.para, texto: dados.texto, foto: socket.foto });
        await msg.save();
        io.to(dados.para).emit('nova_msg', { de: socket.email, nome: socket.nome, texto: dados.texto, foto: socket.foto });
        socket.emit('nova_msg', { de: socket.email, nome: socket.nome, texto: dados.texto, foto: socket.foto });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Servidor na porta ${PORT}`));
