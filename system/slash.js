// Packages
const { SlashCommandBuilder } = require('@discordjs/builders');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');

// Config
const { token } = require('./config.json');

// Export
module.exports = {
    async run(client) {

        // Form the commands
        commands = [
            new SlashCommandBuilder()
                .setName(`reset`)
                .setDescription(`Wipes every leaderboard.`),
            new SlashCommandBuilder()
                .setName(`addpoint`)
                .setDescription(`Adds 1 point to user.`)
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('Type the users ID only.')
                        .setRequired(true))
                .addNumberOption(option =>
                    option
                        .setName('points')
                        .setDescription('The number of points to give')
                        .setRequired(true)),
            new SlashCommandBuilder()
                .setName(`leaderboard`)
                .setDescription(`Displays the top 25 users by points.`),
            new SlashCommandBuilder()
                .setName(`addtweet`)
                .setDescription(`Assigns roles based on tweets.`)
                .addStringOption(option =>
                    option
                        .setName('tweet-id')
                        .setDescription('The tweet ID.')
                        .setRequired(true))
                .addStringOption(option =>
                    option
                        .setName('actions')
                        .setDescription('Required actions. E.g. comment, like and retweet')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option
                        .setName('amount')
                        .setDescription('The amount of points.')
                        .setRequired(true)),
            new SlashCommandBuilder()
                .setName(`link`)
                .setDescription(`Allows you to link your twitter account!`)
                .addStringOption(option =>
                    option
                        .setName('handle')
                        .setDescription('Your twitter account name. Do not include the @')
                        .setRequired(true)),
        ].map(command => command.toJSON());
        
        // Set API version & Token
        rest = new REST({ version: '9' }).setToken(token);

        // Push the commands
        tt = await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    }
}