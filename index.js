const { executionAsyncResource } = require('async_hooks');
const Discord = require('discord.js');
const { lookup } = require('dns');
const ytdl = require('ytdl-core');

const { YTSearcher } = require('ytsearcher');

const searcher = new YTSearcher({
    key: process.env.youtube_api,
    revealed: true
});

const client = new Discord.Client();

const queue = new Map();

client.once('ready', () => {
    console.log('Mida è online.')
})

client.on('message', async(message) => {
    const prefix = 'mida';

    const serverQueue = queue.get(message.guild.id)

    const args = message.content.slice(prefix.length).trim().split(/ +/g)
    const command = args.shift().toLowerCase();
    
    switch(command){
        case 'play':
            execute(message, serverQueue);
            break;
        case 'stop':
            stop(message,serverQueue);
            break;
        case 'skip':
            skip(message, serverQueue);
            break;
        case 'pause':
            pause(serverQueue);
            break;
        case 'resume':
            resume(serverQueue);
            break;
        case 'loop':
            loop(args, serverQueue);
            break;
        case 'queue':
            queue(serverQueue);
            break;

    }       
    
    async function execute(message, serverQueue){
        let vc = message.member.voice.channel;
        if(!vc){
            return message.channel.send("Per favore, unisciti ad un canale vocale!");
        }else{
            let result = await searcher.search(args.join(" "), { type: "video" })
            const songInfo = await ytdl.getInfo(result.first.url)

            let song = {
                title: songInfo.videoDetails.title,
                url: songInfo.videoDetails.video_url
            };

            if(!serverQueue){
                const queueConstructor = {
                    txtChannel: message.channel,
                    vChannel: vc,
                    connection: null,
                    songs: [],
                    volume: 10,
                    playing: true,
                    loopone: false,
                    loopall: false
                };
                queue.set(message.guild.id, queueConstructor);

                queueConstructor.songs.push(song);

                try{
                    let connection = await vc.join();
                    queueConstructor.connection = connection;
                    play(message.guild, queueConstructor.songs[0]);
                }catch (err){
                    console.error(err);
                    queue.delete(message.guild.id);
                    return message.channel.send(`Impossibile unirsi al canale ${err}`)
                }
            }else{
                serverQueue.songs.push(song);
                return message.channel.send(`La canzone è stata aggiunta: ${song.title}`);
            }
        }
    }
    function play(guild, song){
        const serverQueue = queue.get(guild.id);
        if(!song){
            serverQueue.vChannel.leave();
            queue.delete(guild.id);
            return;
        }
        const dispatcher = serverQueue.connection
            .play(ytdl(song.url))
            .on('finish', () =>{
                if(serverQueue.loopone){
                    play(guild, serverQueue.songs[0]);
                }
                else if(serverQueue.loopall){
                    serverQueue.songs.push(serverQueue.songs[0])
                    serverQueue.songs.shift()
                }else{
                    serverQueue.songs.shift();
                } 
                play(guild, serverQueue.songs[0]);
            })
            serverQueue.txtChannel.send(`In onda: ${serverQueue.songs[0].title}`)
    }
    function stop (message, serverQueue){
        if(!message.member.voice.channel)
            return message.channel.send("Devi prima andare in un canale vocale!")
        serverQueue.songs = [];
        serverQueue.connection.dispatcher.end();
    }
    function skip (message, serverQueue){
        if(!message.member.voice.channel)
            return message.channel.send("Devi prima unirti ad un canale vocale!")
        if(!serverQueue)
            return message.channel.send("Non c'è nulla da saltare!");
        serverQueue.connection.dispatcher.end();
    }
    function pause(serverQueue){
        if(!serverQueue.connection)
            return message.channel.send("In questo momento non c'è nessun brano in riproduzione");
        if(!message.member.voice.channel)
            return message.channel.send("Per favore, unisciti ad un canale vocale!")
        if(serverQueue.connection.dispatcher.paused)
            return message.channel.send("Il brano è già in pausa!");
        serverQueue.connection.dispatcher.pause();
        message.channel.send("La canzone è ora in pausa!");
    }
    function resume(serverQueue){
        if(!serverQueue.connection)
            return message.channel.send("In questo momento non c'è nessun brano in riproduzione");
        if(!message.member.voice.channel)
            return message.channel.send("Per favore, unisciti ad un canale vocale!")
        if(serverQueue.connection.dispatcher.resumed)
            return message.channel.send("Il brano è già in riproduzione!");
        serverQueue.connection.dispatcher.resume();
        message.channel.send("Di nuovo in onda!");
    }
    function loop(args, serverQueue){
    if(!serverQueue.connection)
        return message.channel.send("In questo momento non c'è nessun brano in riproduzione");
    if(!message.member.voice.channel)
        return message.channel.send("Per favore, unisciti ad un canale vocale!");

        switch(args[0].toLowerCase()){
            case 'all':
                serverQueue.loopall = !serverQueue.loopall;
                serverQueue.loopone = false;

                if(serverQueue.loopall === true)
                   message.channel.send("Il loop di tutti i brani è stato attivato!");
                else
                   message.channel.send("Il loop di tutti è stato disattivato!");
                break;
            case 'one':
                serverQueue.loopone = !serverQueue.loopall;
                serverQueue.loopall = false;

                if(serverQueue.loopone === true)
                   message.channel.send("Il loop del singolo brano è stato attivato!");
                else
                   message.channel.send("Il loop del singolo brano è stato disattivato!");
                break;
            
            case 'off':
                serverQueue.loopall = false;
                serverQueue.loopone = false;

                message.channel.send("Il loop è stato disattivato!")
            break;
    }
    function queue(serverQueue){
        if(!serverQueue.connection)
            return message.channel.send("In questo momento non c'è nessun brano in riproduzione");
        if(!message.member.voice.channel)
            return message.channel.send("Per favore, unisciti ad un canale vocale!")

        let nowPlaying = serverQueue.songs[0];
        let qMsg = `In onda: ${nowPlaying.title}\n---------------------------\n`

        for(var i = 1; i < serverQueue.songs.length; i++){
            qMsg += `${i}. ${serverQueue.songs[i].title}\n`
        }

        message.channel.send('```' + qMsg + 'Richiesta da: ' + message.author.username + '```')
    }
}})

client.login(process.env.token)
