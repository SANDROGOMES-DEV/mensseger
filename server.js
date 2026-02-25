const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// Ligar ao MongoDB usando a variável que configuraste no Render
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('Conectado ao MongoDB com sucesso!'))
    .catch(err => console.error('Erro ao ligar ao MongoDB:', err));

// Esquema do Utilizador (Nome, Email, Senha e Lista de Contactos)
const userSchema = new mongoose.Schema({
    nome: String,
    email: { type: String, unique: true, required: true },
    senha: { type: String, required: true },
    contactos: [String] // Lista de emails dos amigos
});

const User = mongoose.model('User', userSchema);

// Esquema das Mensagens (Para o Histórico)
const messageSchema = new mongoose.Schema({
    de: String,
    para: String,
    texto: String,
    data: { type: Date, default: Date.now }
});

const Message = mongoose.model('Message', messageSchema);

io.on('connection', (socket) => {

    // LÓGICA DE REGISTO (NOVO)
    socket.on('registar_utilizador', async (dados) => {
        try {
            const senhaEncriptada = await bcrypt.hash(dados.senha, 10);
            const novoUser = new User({
                nome: dados.nome,
                email: dados.email,
                senha: senhaEncriptada
            });
            await novoUser.save();
            socket.emit('registo_sucesso');
        } catch (err) {
            socket.emit('registo_erro', 'Email já existe ou erro no sistema.');
        }
    });

    // LÓGICA DE LOGIN COM BANCO DE DADOS
    socket.on('tentativa_login', async (dados) => {
        const user = await User.findOne({ email: dados.email });
        if (user && await bcrypt.compare(dados.senha, user.senha)) {
            socket.emailUtilizador = user.email;
            socket.nomeUtilizador = user.nome;
            socket.emit('login_sucesso', { nome: user.nome, email: user.email });

            io.emit('mensagem_chat', { nome: 'Sistema', texto: `👋 ${user.nome} entrou.` });
        } else {
            socket.emit('login_erro');
        }
    });

    socket.on('mensagem_chat', async (dados) => {
        if (socket.nomeUtilizador) {
            // Guarda a mensagem no banco de dados antes de enviar
            const novaMsg = new Message({ de: socket.nomeUtilizador, texto: dados.texto });
            await novaMsg.save();

            io.emit('mensagem_chat', { nome: socket.nomeUtilizador, texto: dados.texto });
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor na porta ${PORT}`));