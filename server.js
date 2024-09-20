const ws = require('ws');
 wss = new ws.WebSocketServer({port : 8060} , () => {
    console.log('WebSocket server is running at the port 8060')
});
const mysql = require('mysql');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
let players = {};
const ids = JSON.parse(fs.readFileSync('userids.json'));
for(let id of ids){
    players[id] = 'no';
}
let rooms = {};
let rooms_players = {};
let rooms_Content = {};
const pool = mysql.createPool({
    host:'sql5.freesqldatabase.com',
    user:'sql5731887',
    password : 'RuYdPDLBpw',
    database:'sql5731887',
    port: 3306
});
pool.getConnection((err) => {
    if(err){
        console.log(err);
    }
    else{
        console.log('connected')
    }
})

pool.query(`select * from rooms` , (err , data) => {
    if(err){
        console.log(err);
    }
    else{
       for(let room of data){
        rooms[room.id] = [];
        rooms_players[room.id] =[];
       }
    }
})
wss.on('connection' , (ws) => {
    console.log('New client connected');
    ws.on('message' , (data) => {
        const message = JSON.parse(data);
        if(message.Type == 'Join'){
            rooms[message.room].push(ws);
            rooms_players[message.room].push({
                Name : message.Name,
                ID : message.ID,
                Score : 0,
            })
            players[message.ID] = 'yes';
            console.log('logged in')
            rooms[message.room].forEach(client => {
                if(client !== ws && client.readyState === WebSocket.OPEN){
                    try{
                        client.send(JSON.stringify({
                            Name : message.Name,
                            ID: message.ID,
                            Score : 0,
                            Type : 'Join'
                        }))
                    }
                    catch{};
                }
                else if (client.readyState === WebSocket.OPEN ){
                    client.send(JSON.stringify({
                        Type : 'New',
                       players: rooms_players[message.room],
                       Round : rooms[message.room].length > 2 ? rooms_Content[message.room] : undefined
                    }));
                }
            });
            if(rooms[message.room].length == 2 ){
                console.log('enough')
                rooms[message.room].forEach(client => {
                    
                    client.send(JSON.stringify({
                        Type:'Wait',
                        res : client === ws 
                    }))
                }); 
            }
        }
        else if (message.Type == 'Increase'){
            const ind = rooms[message.room].indexOf(ws);
            rooms_players[message.room][ind].Score++;
            rooms[message.room].forEach(client => {
                client.send(JSON.stringify({
                    Type:'Increase',
                    ID: message.ID ,
                    Name : message.Name,
                }))
            })
        }
        else if(message.Type == 'Leave'){
            rooms_players[message.room] = rooms_players[message.room].filter(player => player.ID != message.ID)
            rooms[message.room] = rooms[message.room].filter(client => client != ws);
            rooms[message.room].forEach(client => client.send(JSON.stringify({
                Type:'Leave',
                ID : message.ID
            })));
            if(rooms[message.room].length == 0){
                delete rooms[message.room];
                delete rooms_players[message.room];
                delete rooms_Content[message.room];
                let ids = JSON.parse(fs.readFileSync('roomids.json'));
                ids = ids.filter(room => room != message.room);
                fs.writeFileSync('roomids.json' , JSON.stringify(ids)); 
                pool.query(`delete from rooms where id = "${message.room}"` , )
            }
            else if(rooms[message.room].length == 1 ){
                rooms[message.room].forEach(client => {
                    client.send(JSON.stringify({
                        Type:'Wait4Players'
                    }))
                }); 
            }
        }
        else if(message.Type == 'First'){
            console.log(rooms[message.room].length);
            if(rooms[message.room].length > 1 ){
                
                console.log('round');
                let round = CreateRound();
                rooms_Content[message.room] = {
                    Target:round.Target,
                    Tools : round.Tools,
                }
                rooms[message.room].forEach(client => {
                    client.send(JSON.stringify({
                        Type : 'Round',
                        Target: round.Target,
                        Tools: round.Tools,
                    }))
                }); 
            }
        }
        else if (message.Type == 'Send'){
            console.log(`${message.Sender} : ${message.Content}`);
            rooms[message.room].forEach(client => {
                client.send(JSON.stringify({
                    Type:'Recieve',
                    message :`${message.Sender}: ${message.Content}`
                }))
            })
        }
        else if (message.Type == 'Over'){
            for(let player of rooms_players[message.room]){
                player.Score = 0;
            }
            rooms[message.room].forEach(client => client.send(JSON.stringify({
                Type:'Over',
                Winner:message.Name,
            })))
        }
        else if(message.Type == 'Reset'){
            rooms[message.room].forEach(client => {
                client.send(JSON.stringify({
                    Type:'Reset'
                }))
            })
            rooms_players[message.room].forEach(player => player.Score = 0)
        }
        else if(message.Type == 'logout'){
            console.log(players);
            players[message.ID] = 'no';
            console.log('logged out')
        }
    })
    ws.on('close' , () => {
        //rooms[room].filter(client => client != ws)
        console.log('client disconnected')
    })
})
