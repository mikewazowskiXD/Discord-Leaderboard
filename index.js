// Packages
const editJsonFile = require("edit-json-file");
const { EmbedBuilder, GatewayIntentBits, Client, ButtonBuilder, ButtonStyle, ActionRowBuilder, TextInputStyle, ModalBuilder, TextInputBuilder } = require('discord.js');
const fs = require('fs');
const client = new Client({ intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
] });
const Twitter = require('twitter');
const request = require('request');

// Config
const { token, mainAccountName, twitterCredentials, verifiedRole, verificationPassMessage, verificationFailMessage, startVerificationEmbed, menu } = require('./system/config.json');
let cooldown = [];
const twClient = new Twitter(twitterCredentials);

// Functions
async function wait(ms) {
    return new Promise(md => {
        setTimeout(() => {
            return md("done");
        }, ms);
    });
}
async function getComments(id) {
    return new Promise(async md => {

        // function req
        getConversationIDs = () => {
            return new Promise(xx => {
                request({
                    'method': 'GET',
                    'url': `https://api.twitter.com/2/tweets?ids=${id}&tweet.fields=author_id,conversation_id,created_at,in_reply_to_user_id,referenced_tweets&expansions=author_id,in_reply_to_user_id,referenced_tweets.id&user.fields=name,username`,
                    'headers': {
                        'Authorization': `Bearer ${twitterCredentials.bearer_token}`,
                        'Cookie': 'guest_id=v1%3A165346017919047352'
                    }
                }, function (error, response) {
                    if(error) {
                        //console.log(error);
                        return xx([]);
                    }
                    return xx(JSON.parse(response.body)?.data?.map(t => t.conversation_id));
                });
            });
        };
        getCommentThread = (conversation_id) => {
            return new Promise(xx => {
                request({
                    'method': 'GET',
                    'url': `https://api.twitter.com/2/tweets/search/recent?query=conversation_id:${conversation_id}&tweet.fields=in_reply_to_user_id,author_id,created_at,conversation_id`,
                    'headers': {
                        'Authorization': `Bearer ${twitterCredentials.bearer_token}`,
                        'Cookie': 'guest_id=v1%3A165346017919047352'
                    }
                }, async function (error, response) {
                    if(error) {
                        //console.log(error);
                        return xx([]);
                    }

                    // hold while looping
                    tweets = JSON.parse(response.body);
                    returnedData = tweets?.data?.map(t => t.author_id);

                    // function to get pages
                    x = (nextPage) => {
                        return new Promise(yy => {
                            request({
                                'method': 'GET',
                                'url': `https://api.twitter.com/2/tweets/search/recent?query=conversation_id:${conversation_id}&pagination_token=${nextPage}&tweet.fields=in_reply_to_user_id,author_id,created_at,conversation_id`,
                                'headers': {
                                    'Authorization': `Bearer ${twitterCredentials.bearer_token}`,
                                    'Cookie': 'guest_id=v1%3A165346017919047352'
                                }
                            }, function (error, response) {
                                if(error) {
                                    //console.log(error);
                                    return yy([]);
                                }
                                return yy(response.body);
                            });
                        });
                    };

                    // loop through pages
                    while(tweets?.meta?.result_count != 0 && tweets?.meta?.next_token != null) {
                        page = await x(tweets.meta.next_token);
                        tweets = JSON.parse(page);
                        for(i in tweets?.data) returnedData.push(tweets?.data[i]?.author_id);
                    }

                    // continue process
                    return xx(returnedData);
                });
            });
        };

        // iterate through
        chats = await getConversationIDs();
        data11 = [];
        for(i in chats) {
            data11.push((await getCommentThread(chats[i])));
        }
        data11 = data11.filter(t => t != null);

        // convert to objects
        toReturn = [];
        for(i in data11) {
            for(x in data11[i]) {
                toReturn.push(data11[i][x]);
            }
        }

        return md(toReturn);
    });
}
async function getRetweets(id) {
    return new Promise(async md => {

        // function req
        r = (nextPage) => {
            return new Promise(xx => {
                request({
                    'method': 'GET',
                    'url': `https://api.twitter.com/2/tweets/${id}/retweeted_by${nextPage == null ? `` : `?pagination_token=${nextPage}`}`,
                    'headers': {
                        'Authorization': `Bearer ${twitterCredentials.bearer_token}`,
                        'Cookie': 'guest_id=v1%3A165346017919047352'
                    }
                }, function (error, response) {
                    return xx(response.body);
                });
            });
        };

        // fetch initial
        tweets = JSON.parse(((await r())));

        // retweets
        ids = tweets?.data?.map(t => parseInt(t.id));

        // next page
        while(tweets?.meta?.result_count != 0 && tweets?.meta?.next_token != null) {
            
            // fetch
            tweets = JSON.parse(((await r(tweets.meta.next_token))));

            // record new ids
            for(i in tweets.data) ids.push(parseInt(tweets.data[i].id));
        }

        return md(ids || []);
    });
}
async function getFollowers(screen_name) {
    return new Promise(async md => {

        // function req
        r = (nextPage) => {
            return new Promise(xx => {
                request({
                    'method': 'GET',
                    'url': `https://api.twitter.com/1.1/followers/ids.json?screen_name=${screen_name}${nextPage == null ? `&cursor=-1` : `&cursor=${nextPage}`}`,
                    'headers': {
                        'Authorization': `Bearer ${twitterCredentials.bearer_token}`
                    }
                }, function (error, response) {
                    return xx(JSON.stringify(response.body, null, 4));
                });
            });
        };

        // fetch initial
        tweets = JSON.parse(JSON.parse(JSON.parse(JSON.stringify((await r()), null, 4))));
        if(tweets.errors && tweets.errors[0] && tweets.errors[0].message) {
            console.warn(`Rate limit reached.`);
            return md(null);
        }

        // retweets
        ids = tweets.ids;

        // next page
        while(tweets.next_cursor != null && tweets.next_cursor != 0) {
            
            // wait
            t = await wait(2000);
     
            // fetch
            tweets = JSON.parse(JSON.parse(JSON.parse(JSON.stringify((await r(tweets.next_cursor))))));
            if(tweets.errors && tweets.errors[0] && tweets.errors[0].message) {
                console.warn(`Rate limit reached.`);
                return md(ids);
            }

            // record new ids
            for(i in tweets.ids) ids.push(parseInt(tweets.ids[i]));
        }

        return md(ids);
    });
}
async function getLikes(id) {
    return new Promise(async md => {

        // function req
        r = (nextPage) => {
            return new Promise(xx => {
                request({
                    'method': 'GET',
                    'url': `https://api.twitter.com/2/tweets/${id}/liking_users${nextPage == null ? `` : `?pagination_token=${nextPage}`}`,
                    'headers': {
                        'Authorization': `Bearer ${twitterCredentials.bearer_token}`,
                        'Cookie': 'guest_id=v1%3A165346017919047352'
                    }
                }, function (error, response) {
                    if(error) {
                        //console.log(error);
                        return xx([]);
                    }
                    return xx(response.body);
                });
            });
        };

        // fetch initial
        tweets = JSON.parse(((await r())));
        console.log(tweets);
        ids = tweets?.data?.map(t => parseInt(t.id));

        // next page
        while(tweets?.meta?.result_count != 0 && tweets?.meta?.next_token != null) {
            tweets = JSON.parse(((await r(tweets.meta.next_token))));
            for(i in tweets.data) ids.push(parseInt(tweets.data[i].id));
        }

        // filter
        ids = ids?.filter(t => t != null);

        return md(ids || []);
    });
}
async function getUser(handle, user_id) {
    return new Promise(async md => {
        if(handle != null) {
            twClient.get(`users/lookup`, { screen_name: handle }, function(error, tweets, response) {
                if(error) {
                    console.log(error);
                    return md(null);
                }
                return md(tweets);
            });
        } else {
            twClient.get(`users/lookup`, { user_id: user_id }, function(error, tweets, response) {
                if(error) {
                    console.log(error);
                    return md(null);
                }
                return md(tweets);
            });

        }
    });
}
async function getUser1(handle) {
    return new Promise(mdd => {
        request({
            'method': 'GET',
            'url': `https://api.twitter.com/2/users/by/username/${handle}?user.fields=id`,
            'headers': {
                'Authorization': `Bearer ${twitterCredentials.bearer_token}`,
                'Cookie': 'guest_id=v1%3A165346017919047352'
            }
        }, async function (error, response) {
            if(JSON.parse(response.body)?.data?.id == null) {
                return mdd(null);
            } else {
                const d = await getUser(null, JSON.parse(response.body)?.data?.id);
                if(d && d[0]) {
                    return mdd(d[0]);
                } else {
                    return mdd(null);
                }
            }   
        });
    });
}

// Listeners
client.on("ready", async () => {

    // slash commands
    require('./system/slash').run(client);

    // log
    console.log(`--> Bot online`);

    // send embed to join
    row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`Start`)
                .setStyle(ButtonStyle.Primary)
                .setLabel(startVerificationEmbed.buttonName)
        )
    embed = new EmbedBuilder()
        .setColor(startVerificationEmbed.color)
        .setTitle(startVerificationEmbed.title)
        .setDescription(startVerificationEmbed.description)
    await (await client.guilds.cache.first().channels.fetch(startVerificationEmbed.channel)).send({ embeds: [embed], components: [row] });

    // fetch following list
    async function updateList() {

        // fetch
        followers = await getFollowers(mainAccountName);
        fs.writeFileSync(`./system/followingList.json`, JSON.stringify(followers, null, 4));
    }
    setInterval(() => {
        updateList();
    }, (1000*60*5));
});
client.on("interactionCreate", async interaction => {

    // commands
    if(interaction.customId == 'Start') {

        // format modal
		modal = new ModalBuilder()
            .setCustomId('ModalResponse')
            .setTitle(menu.title)
            .addComponents(new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('username')
                    .setLabel(menu.question)
                    .setPlaceholder(menu.placeholder)
                    .setStyle(TextInputStyle.Short)
                ));

        // reply
        await interaction.showModal(modal);
    }
    if(interaction.customId == 'ModalResponse') {

        // defer
        await interaction.deferReply({ ephemeral: true });

        // not listed?
        const id = await getUser1(interaction.fields.getTextInputValue('username'));
        if(!id || (!JSON.parse(fs.readFileSync(`./system/followingList.json`)).includes(id.id) && !JSON.parse(fs.readFileSync(`./system/followingList.json`)).includes(id.id_str))) {
            embed = new EmbedBuilder()
                .setColor('DarkRed')
                .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
                .setDescription(verificationFailMessage)
                .setFooter({ text: `Follower list refreshes every 5 minutes` })
            await interaction.editReply({ embeds: [embed] });
            return
        }
    
        // assign role
        await interaction.member.roles.add(verifiedRole).catch(err => console.warn(`Missing permissions to assign roles.`));

        // reply
        embed = new EmbedBuilder()
            .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
            .setDescription(verificationPassMessage)
            .setColor(startVerificationEmbed.color)
        await interaction.editReply({ embeds: [embed] });
    }
    if(interaction.commandName == `addtweet`) {

        // valid options?
        string = interaction.options._hoistedOptions[1].value.toLowerCase();
        if(!string.includes("like") && !string.includes("retweet") && !string.includes("comment")) {
            embed = new EmbedBuilder()
                .setColor('DarkRed')
                .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
                .setDescription(`Invalid actions. You must include the words "like", "retweet" or "comment".`)
            await interaction.reply({ embeds: [embed], ephemeral: true });
            return
        }

        // reply
        embed = new EmbedBuilder()
            .setColor('Green')
            .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
            .setDescription(`Processing this now. I'll notify you once the data has been sorted.`)
        await interaction.reply({ embeds: [embed], ephemeral: true });

        // fetch data
        comments = string.includes("comment") ? (await getComments(interaction.options._hoistedOptions[0].value)) : null;
        likes = string.includes("like") ? (await getLikes(interaction.options._hoistedOptions[0].value)).map(t => parseInt(t)) : null;
        retweets = string.includes("retweet") ? (await getRetweets(interaction.options._hoistedOptions[0].value)).map(t => parseInt(t)) : null;

        // process
        data = JSON.parse(fs.readFileSync(`./system/linked.json`));
        for(i = 0; i < data.length; i++) {
            try {
                if(![(string.includes("like") ? likes.includes(data[i].id) : true), (string.includes("retweet") ? retweets.includes(data[i].id) : true), (string.includes("comment") ? comments.includes(data[i].id_str) : true)].includes(false)) {
                    d = JSON.parse(fs.readFileSync(`./system/users/${data[i].user}.json`));
                    d.points += interaction.options._hoistedOptions[2].value;
                    fs.writeFileSync(`./system/users/${data[i].user}.json`, JSON.stringify(d, null, 4));
                }
            } catch(err) {};
        }

        // followup
        await interaction.followUp({ content: `${interaction.user.toString()} Points have been distributed.`, ephemeral: true });
    }
    if(interaction.commandName == `link`) {

        // defer
        await interaction.deferReply({ ephemeral: true });

        // cooldown?
        if(cooldown.filter(t => t.id == interaction.user.id && t.time > Date.now())[0]) {
            embed = new EmbedBuilder()
                .setColor('DarkRed')
                .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
                .setDescription(`You are on cooldown! You may only use this command once a minute.`)
            await interaction.editReply({ embeds: [embed], ephemeral: true }); 
        }

        // update cooldown
        cooldown.push({
            id: interaction.user.id,
            iconURL: interaction.user.displayAvatarURL()
        });

        // fetch user
        result = await getUser(interaction.options._hoistedOptions[0].value);

        // error?
        if(result == null || !result[0]) {
            embed = new EmbedBuilder()
                .setColor('DarkRed')
                .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
                .setDescription(`An error has occured. Likely your account could not be found, or a rate limit has been reached. Please try again later!`)
            await interaction.editReply({ embeds: [embed], ephemeral: true });
            return
        }

        // update json
        data = JSON.parse(fs.readFileSync(`./system/linked.json`));

        // inuse?
        if(data.filter(t => t.id == result[0].id || t.id_str == result[0].id_str)[0]) {
            embed = new EmbedBuilder()
                .setColor('DarkRed')
                .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
                .setDescription(`Handle is already in use.`)
            await interaction.editReply({ embeds: [embed], ephemeral: true });
            return
        }

        // reply
        embed = new EmbedBuilder()
            .setColor('Green')
            .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
            .setDescription(`Success! Your account has been linked.`)
        await interaction.editReply({ embeds: [embed], ephemeral: true });

        data = data.filter(t => t.user != interaction.user.id);
        data.push({
            user: interaction.user.id,
            handle: interaction.options._hoistedOptions[0].value,
            id: result[0].id,
            id_str: result[0].id_str
        });
        fs.writeFileSync(`./system/linked.json`, JSON.stringify(data, null, 4));
        fs.writeFileSync(`./system/users/${interaction.user.id}.json`, JSON.stringify({
            id: interaction.user.id,
            points: 0,
            data: []
        }, null, 4));
    }
    if(interaction.commandName == `reset`) {

        // defer
        await interaction.deferReply();

        // reset
        files = fs.readdirSync(`./system/users/`).filter(t => t.endsWith(`.json`));
        for(i in files) {
            data = JSON.parse(fs.readFileSync(`./system/users/${files[i]}`));
            data.points = 0;
            fs.writeFileSync(`./system/users/${files[i]}`, JSON.stringify(data, null, 4));
        }

        // reply
        await interaction.editReply({ content: `Done!` });
    }
    if(interaction.commandName == `leaderboard`) {

        // defer
        await interaction.deferReply();

        // load files
        files = fs.readdirSync(`./system/users/`).filter(t => t.endsWith(`.json`));
        
        // process
        data = [];
        for(i in files) data.push(JSON.parse(fs.readFileSync(`./system/users/${files[i]}`)));
        points = data.sort((a, b) => b.points - a.points).map((t, i) => `${i+1}) <@${t.id}> (${t.points} Points)`).slice(0, 25);

        // reply
        embed = new EmbedBuilder()
            .setColor('DarkBlue')
            .setTitle(`Leaderboard`)
            .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() })
            .setDescription(points.length == 0 ? `No data.` : points.join("\n") )
        await interaction.editReply({ embeds: [embed] });
    }
    if(interaction.commandName == 'addpoint') {

        await interaction.deferReply({ ephemeral: true });

        const point_value = interaction.options.getNumber('points');
        const user = interaction.options.getUser('user');
        let file = editJsonFile(`${__dirname}/system/users/${user.id}.json`);
        let newPoints = point_value + file.get("points")
        file.set("points", newPoints)
        file.save();

        await interaction.editReply({ content: `Done!` });
    }
});

// Login
client.login(token);