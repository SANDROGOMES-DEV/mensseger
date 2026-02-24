const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Diz ao servidor para usar a pasta 'public' para os arquivos do site (HTML/CSS)
app.use(express.static('public'));

// Quando alguém entra no site...
io.on('connection', (socket) => {
    console.log('Um usuário se conectou ao chat!');

    // Quando o servidor recebe uma mensagem nova de alguém...
    socket.on('mensagem_chat', (dados) => {
        // Ele retransmite essa mensagem para TODOS os outros usuários conectados
        io.emit('mensagem_chat', dados);
    });

    // Quando alguém fecha a aba do navegador...
    socket.on('disconnect', () => {
        console.log('Um usuário saiu do chat.');
    });
});

// Inicia o servidor na porta 3000
server.listen(3000, () => {
    console.log('Servidor rodando! Acesse http://localhost:3000');
});