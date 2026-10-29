
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  Collection
} = require("discord.js");

const fs = require("node:fs");
const path = require("node:path");

// ==================== SETTINGS ====================

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId || !guildId) {
  throw new Error(
    "Missing DISCORD_TOKEN, CLIENT_ID, or GUILD_ID."
  );
}

const BIRTHDAY_CHANNEL = "1521672147250970784";
const BIRTHDAY_ROLE = "1555171582551531611";
const DATA_FILE = path.join(__dirname, "valin-data.json");

// ==================== DATA STORAGE ====================

const blankData = () => ({
  birthdays: {},
  replies: {},
  replyMode: "exact",
  schedules: [],
  warnings: {},
  lastBirthdayDate: ""
});

let data = blankData();

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const saved = JSON.parse(
        fs.readFileSync(DATA_FILE, "utf8")
      );

      data = {
        ...blankData(),
        ...saved,
        birthdays: saved.birthdays || {},
        replies: saved.replies || {},
        schedules: saved.schedules || [],
        warnings: saved.warnings || {}
      };
    }
  } catch (error) {
    console.error("Data loading error:", error);
  }
}

function admin(command, permission = PermissionFlagsBits.ManageGuild) {
  return command.setDefaultMemberPermissions(permission);
}

// ==================== SLASH COMMANDS ====================

const commands = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check bot status"),

  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show all bot commands"),

  admin(
    new SlashCommandBuilder()
      .setName("kick")
      .setDescription("Kick a member")
      .addUserOption(o =>
        o.setName("member").setDescription("Member").setRequired(true)
      )
      .addStringOption(o =>
        o.setName("reason").setDescription("Reason")
      ),
    PermissionFlagsBits.KickMembers
  ),

  admin(
    new SlashCommandBuilder()
      .setName("ban")
      .setDescription("Ban a member")
      .addUserOption(o =>
        o.setName("member").setDescription("Member").setRequired(true)
      )
      .addStringOption(o =>
        o.setName("reason").setDescription("Reason")
      ),
    PermissionFlagsBits.BanMembers
  ),

  admin(
    new SlashCommandBuilder()
      .setName("timeout")
      .setDescription("Timeout a member")
      .addUserOption(o =>
        o.setName("member").setDescription("Member").setRequired(true)
      )
      .addIntegerOption(o =>
        o.setName("minutes")
          .setDescription("Duration in minutes")
          .setMinValue(1)
          .setMaxValue(40320)
          .setRequired(true)
      )
      .addStringOption(o =>
        o.setName("reason").setDescription("Reason")
      ),
    PermissionFlagsBits.ModerateMembers
  ),

  admin(
    new SlashCommandBuilder()
      .setName("warn")
      .setDescription("Warn a member")
      .addUserOption(o =>
        o.setName("member").setDescription("Member").setRequired(true)
      )
      .addStringOption(o =>
        o.setName("reason").setDescription("Reason").setRequired(true)
      ),
    PermissionFlagsBits.ModerateMembers
  ),

  admin(
    new SlashCommandBuilder()
      .setName("clear")
      .setDescription("Delete recent messages")
      .addIntegerOption(o =>
        o.setName("amount")
          .setDescription("Number of messages, 1-100")
          .setMinValue(1)
          .setMaxValue(100)
          .setRequired(true)
      ),
    PermissionFlagsBits.ManageMessages
  ),

  admin(
    new SlashCommandBuilder()
      .setName("clearuser")
      .setDescription("Delete messages from one member")
      .addUserOption(o =>
        o.setName("member").setDescription("Member").setRequired(true)
      )
      .addIntegerOption(o =>
        o.setName("amount")
          .setDescription("Maximum number to check, 1-100")
          .setMinValue(1)
          .setMaxValue(100)
          .setRequired(true)
      ),
    PermissionFlagsBits.ManageMessages
  ),

  admin(
    new SlashCommandBuilder()
      .setName("clearbots")
      .setDescription("Delete recent bot messages")
      .addIntegerOption(o =>
        o.setName("amount")
          .setDescription("Maximum number to check, 1-100")
          .setMinValue(1)
          .setMaxValue(100)
          .setRequired(true)
      ),
    PermissionFlagsBits.ManageMessages
  ),

  admin(
    new SlashCommandBuilder()
      .setName("dm")
      .setDescription("Send a direct message")
      .addUserOption(o =>
        o.setName("member").setDescription("Recipient").setRequired(true)
      )
      .addStringOption(o =>
        o.setName("message").setDescription("Message").setRequired(true)
      )
  ),

  admin(
    new SlashCommandBuilder()
      .setName("birthday")
      .setDescription("Manage birthdays")
      .addSubcommand(s =>
        s.setName("add")
          .setDescription("Add birthday")
          .addUserOption(o =>
            o.setName("member").setDescription("Member").setRequired(true)
          )
          .addStringOption(o =>
            o.setName("date")
              .setDescription("DD/MM, e.g. 20/01")
              .setRequired(true)
          )
      )
      .addSubcommand(s =>
        s.setName("remove")
          .setDescription("Remove birthday")
          .addUserOption(o =>
            o.setName("member").setDescription("Member").setRequired(true)
          )
      )
      .addSubcommand(s =>
        s.setName("list").setDescription("List birthdays")
      )
  ),

  admin(
    new SlashCommandBuilder()
      .setName("addreply")
      .setDescription("Add automatic reply")
      .addStringOption(o =>
        o.setName("trigger").setDescription("Trigger phrase").setRequired(true)
      )
      .addStringOption(o =>
        o.setName("response").setDescription("Reply text").setRequired(true)
      )
  ),

  admin(
    new SlashCommandBuilder()
      .setName("editreply")
      .setDescription("Edit automatic reply")
      .addStringOption(o =>
        o.setName("trigger").setDescription("Existing trigger").setRequired(true)
      )
      .addStringOption(o =>
        o.setName("response").setDescription("New reply").setRequired(true)
      )
  ),

  admin(
    new SlashCommandBuilder()
      .setName("delreply")
      .setDescription("Delete automatic reply")
      .addStringOption(o =>
        o.setName("trigger").setDescription("Trigger to delete").setRequired(true)
      )
  ),

  admin(
    new SlashCommandBuilder()
      .setName("listreplies")
      .setDescription("List automatic replies")
  ),

  admin(
    new SlashCommandBuilder()
      .setName("replymode")
      .setDescription("Choose reply matching mode")
      .addStringOption(o =>
        o.setName("mode")
          .setDescription("Matching mode")
          .setRequired(true)
          .addChoices(
            { name: "Exact phrase", value: "exact" },
            { name: "Contains phrase", value: "contains" }
          )
      )
  ),

  admin(
    new SlashCommandBuilder()
      .setName("schedule")
      .setDescription("Schedule a future message")
      .addChannelOption(o =>
        o.setName("channel")
          .setDescription("Text channel")
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
      .addStringOption(o =>
        o.setName("datetime")
          .setDescription("ISO date with timezone")
          .setRequired(true)
      )
      .addStringOption(o =>
        o.setName("message").setDescription("Message").setRequired(true)
      )
  )
].map(command => command.toJSON());

// ==================== DISCORD CLIENT ====================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ==================== SAUDI DATE ====================

function riyadhDate() {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Riyadh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date());
}

// ==================== BIRTHDAYS ====================

async function checkBirthdays() {
  const today = riyadhDate();

  if (data.lastBirthdayDate === today) return;

  const [day, month] = today.split("/");
  const channel = await client.channels
    .fetch(BIRTHDAY_CHANNEL)
    .catch(() => null);

  if (!channel || !channel.isTextBased()) {
    console.error("Birthday channel unavailable; retrying later.");
    return;
  }

  try {
    for (const [userId, info] of Object.entries(data.birthdays)) {
      if (info.date !== `${day}/${month}`) continue;

      await channel.send({
        content:
          `🎂 اليوم عيد ميلاد <@${userId}>! ` +
          `كل عام وأنت بخير! 🎉 <@&${BIRTHDAY_ROLE}>`,
        allowedMentions: {
          users: [userId],
          roles: [BIRTHDAY_ROLE]
        }
      });
    }

    data.lastBirthdayDate = today;
    saveData();
  } catch (error) {
    console.error("Birthday error:", error);
  }
}

// ==================== SCHEDULED MESSAGES ====================

async function checkSchedules() {
  for (const item of data.schedules) {
    if (item.sent || Date.now() < item.timestamp) continue;

    const channel = await client.channels
      .fetch(item.channelId)
      .catch(() => null);

    if (!channel || !channel.isTextBased()) {
      console.error("Scheduled channel unavailable:", item.channelId);
      continue;
    }

    try {
      await channel.send({
        content: item.message,
        allowedMentions: { parse: [] }
      });

      item.sent = true;
      saveData();
    } catch (error) {
      console.error("Schedule error:", error);
    }
  }
}

async function checkReminders() {
  await checkBirthdays();
  await checkSchedules();
}

// ==================== REGISTER COMMANDS ====================

client.once("ready", async () => {
  console.log(`Valin is online as ${client.user.tag}`);

  try {
    const rest = new REST({ version: "10" }).setToken(token);

    console.log("Commands count:", commands.length);
    console.log(
      "Commands:",
      commands.map(command => command.name).join(", ")
    );

    const result = await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: commands }
    );

    console.log("Slash commands registered:", result.length);
    console.log(
      "Registered names:",
      result.map(command => command.name).join(", ")
    );
  } catch (error) {
    console.error("Command registration failed:", error);
  }

  await checkReminders();

  setInterval(() => {
    checkReminders().catch(error =>
      console.error("Reminder check error:", error)
    );
  }, 30_000);
});

// ==================== AUTOMATIC REPLIES ====================

client.on("messageCreate", async message => {
  if (!message.guild || message.author.bot || !message.content) return;

  const content = message.content.toLowerCase().trim();

  for (const [trigger, response] of Object.entries(data.replies)) {
    const word = trigger.toLowerCase();

    const matches = data.replyMode === "exact"
      ? content === word
      : content.includes(word);

    if (!matches) continue;

    await message.reply({
      content: response,
      allowedMentions: { parse: [] }
    }).catch(error => console.error("Auto-reply error:", error));

    break;
  }
});

// ==================== COMMAND HANDLER ====================

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const name = interaction.commandName;

  const reply = content =>
    interaction.reply({
      content,
      ephemeral: true,
      allowedMentions: { parse: [] }
    });

  try {
    if (name === "ping") {
      return reply("Pong! بوت ڤالين يعمل بنجاح 🌙");
    }

    if (name === "help") {
      return reply(
        "**أوامر بوت ڤالين 🌙**\n\n" +
        "**الإدارة:** `/kick` `/ban` `/timeout` `/warn`\n" +
        "**الحذف:** `/clear` `/clearuser` `/clearbots`\n" +
        "**الرسائل:** `/dm` `/schedule`\n" +
        "**أعياد الميلاد:** `/birthday add` `/birthday remove` `/birthday list`\n" +
        "**الردود التلقائية:** `/addreply` `/editreply` `/delreply` `/listreplies` `/replymode`\n" +
        "**عام:** `/ping` `/help`"
      );
    }

    if (["kick", "ban", "timeout"].includes(name)) {
      const user = interaction.options.getUser("member");
      const member = await interaction.guild.members
        .fetch(user.id)
        .catch(() => null);

      const reason =
        interaction.options.getString("reason") || "No reason provided";

      if (!member) return reply("لم أجد العضو في السيرفر.");

      if (name !== "ban" && !member.manageable) {
        return reply("لا أستطيع إدارة هذا العضو بسبب ترتيب الرتب.");
      }

      if (name === "kick") {
        await member.kick(reason);
        return reply(`تم إخراج ${user.tag}.`);
      }

      if (name === "ban") {
        await interaction.guild.members.ban(user.id, { reason });
        return reply(`تم حظر ${user.tag}.`);
      }

      const minutes = interaction.options.getInteger("minutes");
      await member.timeout(minutes * 60_000, reason);
      return reply(`تم تقييد ${user.tag} لمدة ${minutes} دقيقة.`);
    }

    if (name === "warn") {
      const user = interaction.options.getUser("member");
      const reason = interaction.options.getString("reason");

      data.warnings[user.id] ??= [];
      data.warnings[user.id].push({
        reason,
        moderator: interaction.user.id,
        date: new Date().toISOString()
      });

      saveData();

      const sent = await user.send(
        `⚠️ تحذير من سيرفر ڤالين.\nالسبب: ${reason}`
      ).then(() => true).catch(() => false);

      return reply(
        `تم تسجيل التحذير لـ ${user.tag}.` +
        (sent ? " أُرسلت رسالة خاصة." : " لم أستطع إرسال رسالة خاصة.")
      );
    }

    if (name === "clear") {
      if (!interaction.channel?.isTextBased() ||
          !interaction.channel.bulkDelete) {
        return reply("استخدمي الأمر في قناة نصية.");
      }

      const amount = interaction.options.getInteger("amount");
      const deleted = await interaction.channel.bulkDelete(amount, true);

      return reply(`تم حذف ${deleted.size} رسالة. الرسائل الأقدم من 14 يومًا لا تُحذف بهذه الطريقة.`);
    }

    if (name === "clearuser" || name === "clearbots") {
      if (!interaction.channel?.messages) {
        return reply("استخدمي الأمر في قناة نصية.");
      }

      const amount = interaction.options.getInteger("amount");
      const user = name === "clearuser"
        ? interaction.options.getUser("member")
        : null;

      const fetched = await interaction.channel.messages.fetch({ limit: 100 });

      const selected = fetched.filter(message =>
        name === "clearuser"
          ? message.author.id === user.id
          : message.author.bot
      ).first(amount);

      const messages = new Collection(
        selected.map(message => [message.id, message])
      );

      const deleted = messages.size
        ? await interaction.channel.bulkDelete(messages, true)
        : messages;

      return reply(`تم حذف ${deleted.size} رسالة مطابقة. الرسائل الأقدم من 14 يومًا لا تُحذف بهذه الطريقة.`);
    }

    if (name === "dm") {
      const user = interaction.options.getUser("member");
      const message = interaction.options.getString("message");

      await user.send({
        content: message,
        allowedMentions: { parse: [] }
      });

      return reply(`تم إرسال الرسالة إلى ${user.tag}.`);
    }

    if (name === "birthday") {
      const sub = interaction.options.getSubcommand();

      if (sub === "add") {
        const user = interaction.options.getUser("member");
        const date = interaction.options.getString("date").trim();

        if (!/^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])$/.test(date)) {
          return reply("اكتبي التاريخ بصيغة DD/MM، مثل 20/01.");
        }

        const [day, month] = date.split("/").map(Number);
        if (day > new Date(2000, month, 0).getDate()) {
          return reply("هذا التاريخ غير صحيح.");
        }

        data.birthdays[user.id] = { date };
        saveData();

        return reply(`تم حفظ عيد ميلاد ${user.tag} بتاريخ ${date} 🎂`);
      }

      if (sub === "remove") {
        const user = interaction.options.getUser("member");

        if (!data.birthdays[user.id]) {
          return reply("لا يوجد عيد ميلاد محفوظ لهذا العضو.");
        }

        delete data.birthdays[user.id];
        saveData();

        return reply(`تم حذف عيد ميلاد ${user.tag}.`);
      }

      const entries = Object.entries(data.birthdays);

      if (!entries.length) {
        return reply("لا توجد أعياد ميلاد مسجلة.");
      }

      const list = entries.map(([id, info]) =>
        `<@${id}> — ${info.date}`
      ).join("\n");

      return reply(list.length > 1900 ? list.slice(0, 1850) : list);
    }

    if (name === "addreply" || name === "editreply") {
      const trigger = interaction.options
        .getString("trigger").trim().toLowerCase();

      const response = interaction.options.getString("response").trim();

      if (!trigger || !response) {
        return reply("اكتبي كلمة الرد ونص الرد.");
      }

      if (name === "editreply" && !data.replies[trigger]) {
        return reply("لم أجد هذا الرد.");
      }

      if (name === "addreply" && data.replies[trigger]) {
        return reply("هذا الرد موجود مسبقًا. استخدمي /editreply.");
      }

      data.replies[trigger] = response;
      saveData();

      return reply(name === "addreply" ? "تمت إضافة الرد." : "تم تعديل الرد.");
    }

    if (name === "delreply") {
      const trigger = interaction.options
        .getString("trigger").trim().toLowerCase();

      if (!data.replies[trigger]) return reply("الرد غير موجود.");

      delete data.replies[trigger];
      saveData();

      return reply("تم حذف الرد.");
    }

    if (name === "listreplies") {
      const entries = Object.entries(data.replies);

      if (!entries.length) return reply("لا توجد ردود محفوظة.");

      const list = entries.map(([trigger, response]) =>
        `**${trigger}** → ${response}`
      ).join("\n");

      return reply(list.length > 1900 ? list.slice(0, 1850) : list);
    }

    if (name === "replymode") {
      data.replyMode = interaction.options.getString("mode");
      saveData();

      return reply(
        data.replyMode === "exact"
          ? "تم اختيار المطابقة الكاملة."
          : "تم اختيار مطابقة العبارة داخل الرسالة."
      );
    }

    if (name === "schedule") {
      const channel = interaction.options.getChannel("channel");
      const dateText = interaction.options.getString("datetime").trim();
      const message = interaction.options.getString("message");

      const timestamp = Date.parse(dateText);
      const hasTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(dateText);

      if (!hasTimezone || !Number.isFinite(timestamp)) {
        return reply("استخدمي صيغة مثل 2026-12-31T20:00:00+03:00.");
      }

      if (timestamp <= Date.now()) {
        return reply("اختاري وقتًا في المستقبل.");
      }

      data.schedules.push({
        channelId: channel.id,
        timestamp,
        message,
        sent: false
      });

      saveData();

      return reply(`تمت جدولة الرسالة في <#${channel.id}>.`);
    }
  } catch (error) {
    console.error(`Error in /${name}:`, error);

    const message = "حدث خطأ. تحققي من صلاحيات البوت وإعدادات السيرفر.";

    if (interaction.replied || interaction.deferred) {
      return interaction.followUp({
        content: message,
        ephemeral: true,
        allowedMentions: { parse: [] }
      }).catch(() => {});
    }

    return reply(message).catch(() => {});
  }
});

// ==================== START ====================

loadData();

client.login(token).catch(error => {
  console.error("Bot login failed:", error);
});
 
