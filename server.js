const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Define a pasta public como local dos arquivos do site
app.use(express.static('public'));

// Conexão com o Banco de Dados via Variável de Ambiente do Render
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Banco de dados conectado com sucesso!'))
  .catch(err => console.error('❌ Erro ao conectar ao MongoDB:', err));

// --- MODELOS DE DADOS ---

// Modelo de Usuário: Nome, Email, Senha Criptografada, Foto e Amigos
const userSchema = new mongoose.Schema({
    nome: String,
    email: { type: String, unique: true, required: true },
    senha: { type: String, required: true },
    foto: { type: String, default: 'https://cdn-icons-png.flaticon.com/512/149/149071.png' },
    contatos: [String] 
});
const User = mongoose.model('User', userSchema);

// Modelo de Mensagem: Quem enviou, para quem, o texto e a foto no momento
const messageSchema = new mongoose.Schema({
    de: String, 
    para: String, 
    texto: String, 
    foto: String,
    data: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', messageSchema);

// --- LÓGICA EM TEMPO REAL (SOCKET.IO) ---

io.on('connection', (socket) => {
    
    // Cadastro de novo usuário
    socket.on('registar_utilizador', async (dados) => {
        try {
            const senhaHash = await bcrypt.hash(dados.senha, 10);
            const novoUser = new User({ 
                nome: dados.nome, 
                email: dados.email, 
                senha: senhaHash,
                foto: dados.foto || undefined 
            });
            await novoUser.save();
            socket.emit('registo_sucesso');
        } catch (err) {
            socket.emit('registo_erro', 'E-mail já cadastrado ou erro no servidor.');
        }
    });

    // Login com validação de senha e entrada em sala privada
    socket.on('tentativa_login', async (dados) => {
        const user = await User.findOne({ email: dados.email });
        if (user && await bcrypt.compare(dados.senha, user.senha)) {
            socket.email = user.email;
            socket.nome = user.nome;
            socket.foto = user.foto;
            
            // O usuário entra em uma "sala" com o próprio e-mail para receber msgs privadas
            socket.join(user.email); 
            
            socket.emit('login_sucesso', { 
                nome: user.nome, 
                email: user.email, 
                foto: user.foto, 
                contatos: user.contatos 
            });
        } else {
            socket.emit('login_erro');
        }
    });

    // Adicionar um amigo à lista de contatos
    socket.on('adicionar_contato', async (emailAlvo) => {
        const alvo = await User.findOne({ email: emailAlvo });
        if (alvo && emailAlvo !== socket.email) {
            await User.findOneAndUpdate(
                { email: socket.email }, 
                { $addToSet: { contatos: emailAlvo } } // Adiciona sem duplicar
            );
            const eu = await User.findOne({ email: socket.email });
            socket.emit('atualizar_contatos', eu.contatos);
        } else {
            socket.emit('erro_sistema', 'Usuário não encontrado ou e-mail inválido.');
        }
    });

    // Envio de mensagem privada (apenas para o destinatário e para si mesmo)
    socket.on('enviar_privado', async (dados) => {
        if (!socket.email) return;

        const novaMsg = new Message({ 
            de: socket.email, 
            para: dados.para, 
            texto: dados.texto, 
            foto: socket.foto 
        });
        await novaMsg.save();
        
        // Envia para a "sala" do destinatário e para o remetente
        io.to(dados.para).emit('nova_msg', { 
            de: socket.email, 
            nome: socket.nome, 
            texto: dados.texto, 
            foto: socket.foto 
        });
        socket.emit('nova_msg', { 
            de: socket.email, 
            nome: socket.nome, 
            texto: dados.texto, 
            foto: socket.foto 
        });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
