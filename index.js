import { Client } from "discord.js-selfbot-v13";
import { Manager } from "@lavaclient/discord";
import { QueueStore } from "@lavaclient/queue";
import dotenv from "dotenv";

dotenv.config();

const client = new Client();
const prefix = process.env.PREFIX;

const manager = new Manager({
  send(guildId, payload) {
    const guild = client.guilds.cache.get(guildId);
    if (guild) guild.shard.send(payload);
  },
  nodes: [
    {
      id: "main",
      host: process.env.LAVALINK_HOST,
      port: Number(process.env.LAVALINK_PORT),
      password: process.env.LAVALINK_PASSWORD
    }
  ]
}).use(new QueueStore());

client.on("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  await manager.init(client.user.id);
});

client.on("messageCreate", async (message) => {
  // Only process messages from your account and matching your ID
  if (
    message.author.id !== client.user.id ||
    message.author.id !== process.env.OWNER_ID ||
    !message.content.startsWith(prefix)
  ) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  const voice = message.member?.voice?.channel;
  const needsVC = ["play", "pause", "resume", "skip", "queue", "volume"];

  if (!voice && needsVC.includes(command)) {
    return message.reply("🚫 You must be in a voice channel to use this command.");
  }

  let player = manager.players.get(message.guild.id);
  if (!player && voice) {
    player = await manager.createPlayer({
      guildId: message.guild.id,
      voiceChannelId: voice.id,
      textChannelId: message.channel.id,
      selfDeaf: true
    });
    await player.connect();
  }

  switch (command) {
    case "play": {
      if (!args.length) return message.reply("🎶 Provide a song name or URL.");
      const search = args.join(" ");
      const result = await manager.search(search);
      if (!result.tracks.length) return message.reply("🔍 No results found.");

      const track = result.tracks[0];
      player.queue.add(track);
      message.reply(`🎵 Queued: **${track.title}**`);
      if (!player.playing) await player.play();
      break;
    }

    case "pause": {
      if (!player?.playing) return message.reply("⚠️ Nothing is playing.");
      player.pause(true);
      message.reply("⏸️ Paused.");
      break;
    }

    case "resume": {
      if (!player?.paused) return message.reply("⚠️ Player is not paused.");
      player.pause(false);
      message.reply("▶️ Resumed.");
      break;
    }

    case "skip": {
      if (!player || !player.queue.size) return message.reply("⚠️ No tracks to skip.");
      await player.stop();
      message.reply("⏭️ Skipped.");
      break;
    }

    case "queue": {
      if (!player || !player.queue.current) return message.reply("📭 Queue is empty.");
      const current = `🎶 Now Playing: **${player.queue.current.title}**`;
      const upcoming = player.queue.slice(0, 5).map((t, i) => `**${i + 1}.** ${t.title}`).join("\n") || "No upcoming tracks.";
      message.reply(`${current}\n\n🔜 Upcoming:\n${upcoming}`);
      break;
    }

    case "volume": {
      const vol = parseInt(args[0], 10);
      if (isNaN(vol) || vol < 0 || vol > 100) {
        return message.reply("🔊 Provide a volume between 0 and 100.");
      }
      player.setVolume(vol);
      message.reply(`🔊 Volume set to **${vol}%**`);
      break;
    }

    default:
      break;
  }
});

client.login(process.env.DISCORD_TOKEN);
