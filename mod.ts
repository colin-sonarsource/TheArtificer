/* The Artificer was built in memory of Babka
 * With love, Ean
 *
 * December 21, 2020
 */

import config from './config.ts';
import { DEBUG, DEVMODE, LOCALMODE } from './flags.ts';
import {
	botId,
	cache,
	DiscordActivityTypes,
	DiscordenoGuild,
	DiscordenoMessage,
	editBotNickname,
	editBotStatus,
	initLog,
	Intents,
	log,
	// Log4Deno deps
	LT,
	sendMessage,
	// Discordeno deps
	startBot,
} from './deps.ts';
import api from './src/api.ts';
import commands from './src/commands/_index.ts';
import intervals from './src/intervals.ts';
import utils from './src/utils.ts';

// Initialize logging client with folder to use for logs, needs --allow-write set on Deno startup
initLog('logs', DEBUG);

// Start up the Discord Bot
startBot({
	token: LOCALMODE ? config.localtoken : config.token,
	intents: [Intents.GuildMessages, Intents.DirectMessages, Intents.Guilds],
	eventHandlers: {
		ready: () => {
			log(LT.INFO, `${config.name} Logged in!`);
			editBotStatus({
				activities: [{
					name: 'Booting up . . .',
					type: DiscordActivityTypes.Game,
					createdAt: new Date().getTime(),
				}],
				status: 'online',
			});

			// Interval to rotate the status text every 30 seconds to show off more commands
			setInterval(async () => {
				log(LT.LOG, 'Changing bot status');
				try {
					// Wrapped in try-catch due to hard crash possible
					editBotStatus({
						activities: [{
							name: await intervals.getRandomStatus(),
							type: DiscordActivityTypes.Game,
							createdAt: new Date().getTime(),
						}],
						status: 'online',
					});
				} catch (e) {
					log(LT.ERROR, `Failed to update status: ${JSON.stringify(e)}`);
				}
			}, 30000);

			// Interval to update bot list stats every 24 hours
			LOCALMODE ? log(LT.INFO, 'updateListStatistics not running') : setInterval(() => {
				log(LT.LOG, 'Updating all bot lists statistics');
				intervals.updateListStatistics(botId, cache.guilds.size);
			}, 86400000);

			// setTimeout added to make sure the startup message does not error out
			setTimeout(() => {
				LOCALMODE && editBotNickname(config.devServer, `LOCAL - ${config.name}`);
				LOCALMODE ? log(LT.INFO, 'updateListStatistics not running') : intervals.updateListStatistics(botId, cache.guilds.size);
				editBotStatus({
					activities: [{
						name: 'Booting Complete',
						type: DiscordActivityTypes.Game,
						createdAt: new Date().getTime(),
					}],
					status: 'online',
				});
				sendMessage(config.logChannel, `${config.name} has started, running version ${config.version}.`).catch((e) => {
					log(LT.ERROR, `Failed to send message: ${JSON.stringify(e)}`);
				});
			}, 1000);
		},
		guildCreate: (guild: DiscordenoGuild) => {
			log(LT.LOG, `Handling joining guild ${JSON.stringify(guild)}`);
			sendMessage(config.logChannel, `New guild joined: ${guild.name} (id: ${guild.id}). This guild has ${guild.memberCount} members!`).catch((e) => {
				log(LT.ERROR, `Failed to send message: ${JSON.stringify(e)}`);
			});
		},
		guildDelete: (guild: DiscordenoGuild) => {
			log(LT.LOG, `Handling leaving guild ${JSON.stringify(guild)}`);
			sendMessage(config.logChannel, `I have been removed from: ${guild.name} (id: ${guild.id}).`).catch((e) => {
				log(LT.ERROR, `Failed to send message: ${JSON.stringify(e)}`);
			});
		},
		debug: DEVMODE ? (dmsg) => log(LT.LOG, `Debug Message | ${JSON.stringify(dmsg)}`) : () => {},
		messageCreate: (message: DiscordenoMessage) => {
			// Ignore all other bots
			if (message.isBot) return;

			// Ignore all messages that are not commands
			if (message.content.indexOf(config.prefix) !== 0) {
				// Handle @bot messages
				if (message.mentionedUserIds[0] === botId && (message.content.trim().startsWith(`<@${botId}>`) || message.content.trim().startsWith(`<@!${botId}>`))) {
					commands.handleMentions(message);
				}

				// return as we are done handling this command
				return;
			}

			log(LT.LOG, `Handling ${config.prefix}command message: ${JSON.stringify(message)}`);

			// Split into standard command + args format
			const args = message.content.slice(config.prefix.length).trim().split(/[ \n]+/g);
			const command = args.shift()?.toLowerCase();

			// All commands below here

			// [[ping
			// Its a ping test, what else do you want.
			if (command === 'ping') {
				commands.ping(message);
			} // [[rip [[memory
			// Displays a short message I wanted to include
			else if (command === 'rip' || command === 'memory') {
				commands.rip(message);
			} // [[rollhelp or [[rh or [[hr or [[??
			// Help command specifically for the roll command
			else if (command === 'rollhelp' || command === 'rh' || command === 'hr' || command === '??' || command?.startsWith('xdy')) {
				commands.rollHelp(message);
			} // [[help or [[h or [[?
			// Help command, prints from help file
			else if (command === 'help' || command === 'h' || command === '?') {
				commands.help(message);
			} // [[info or [[i
			// Info command, prints short desc on bot and some links
			else if (command === 'info' || command === 'i') {
				commands.info(message);
			} // [[privacy
			// Privacy command, prints short desc on bot's privacy policy
			else if (command === 'privacy') {
				commands.privacy(message);
			} // [[version or [[v
			// Returns version of the bot
			else if (command === 'version' || command === 'v') {
				commands.version(message);
			} // [[report or [[r (command that failed)
			// Manually report a failed roll
			else if (command === 'report' || command === 'r') {
				commands.report(message, args);
			} // [[stats or [[s
			// Displays stats on the bot
			else if (command === 'stats' || command === 's') {
				commands.stats(message);
			} // [[api arg
			// API sub commands
			else if (command === 'api') {
				commands.api(message, args);
			} // [[roll]]
			// Dice rolling commence!
			else if (command && (`${command}${args.join('')}`).indexOf(config.postfix) > -1) {
				commands.roll(message, args, command);
			} // [[emoji or [[emojialias
			// Check if the unhandled command is an emoji request
			else if (command) {
				commands.emoji(message, command);
			}
		},
	},
});

// Start up the command prompt for debug usage
if (DEBUG) {
	utils.cmdPrompt(config.logChannel, config.name);
}

// Start up the API for rolling from third party apps (like excel macros)
if (config.api.enable) {
	api.start();
}
