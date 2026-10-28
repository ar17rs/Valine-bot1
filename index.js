
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

// ==================== إعدادات البوت ====================

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId || !guildId) {
  throw new Error(
    "Missing DISCORD_TOKEN, CLIENT_ID, or GUILD_ID in environment variables."
  );
}

const BIRTHDAY_CHANNEL = "1521672147250970784";
const BIRTHDAY_ROLE = "1555171582551531611";

const DATA_FILE = path.join(__dirname, "valin-data.json");

// ==================== حفظ البيانات ====================

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
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Failed to save data:", error);
    throw error;
  }
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
    console.error("Failed to load saved data:", error);
  }
}

// ==================== صلاحيات الأوامر ====================

function admin(command, permission = PermissionFlagsBits.ManageGuild) {
  return command.setDefaultMemberPermissions(permission);
}

// ==================== قائمة الأوامر ====================

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
      .addUserOption(option =>
        option.setName("member")
          .setDescription("Member to kick")
          .setRequired(true)
      )
      .addStringOption(option =>
        option.setName("reason")
          .setDescription("Reason for the kick")
      ),
    PermissionFlagsBits.KickMembers
  ),

  admin(
    new SlashCommandBuilder()
      .setName("ban")
      .setDescription("Ban a member")
      .addUserOption(option =>
        option.setName("member")
          .setDescription("Member to ban")
          .setRequired(true)
      )
      .addStringOption(option =>
        option.setName("reason")
          .setDescription("Reason for the ban")
      ),
    PermissionFlagsBits.BanMembers
  ),

  admin(
    new SlashCommandBuilder()
      .setName("timeout")
      .setDescription("Timeout a member")
      .addUserOption(option =>
        option.setName("member")
          .setDescription("Member to timeout")
          .setRequired(true)
      )
      .addIntegerOption(option =>
        option.setName("minutes")
          .setDescription("Duration in minutes, 1-40320")
          .setMinValue(1)
          .setMaxValue(40320)
          .setRequired(true)
      )
      .addStringOption(option =>
        option.setName("reason")
          .setDescription("Reason for timeout")
      ),
    PermissionFlagsBits.ModerateMembers
  ),

  admin(
    new SlashCommandBuilder()
      .setName("warn")
      .setDescription("Warn a member")
      .addUserOption(option =>
        option.setName("member")
          .setDescription("Member to warn")
          .setRequired(true)
      )
      .addStringOption(option =>
        option.setName("reason")
          .setDescription("Warning reason")
          .setRequired(true)
      ),
    PermissionFlagsBits.ModerateMembers
  ),

  admin(
    new SlashCommandBuilder()
      .setName("clear")
      .setDescription("Delete recent messages")
      .addIntegerOption(option =>
        option.setName("amount")
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
      .setDescription("Delete recent messages from one member")
      .addUserOption(option =>
        option.setName("member")
          .setDescription("Member whose messages to delete")
          .setRequired(true)
      )
      .addIntegerOption(option =>
        option.setName("amount")
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
      .setDescription("Delete recent messages sent by bots")
      .addIntegerOption(option =>
        option.setName("amount")
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
      .setDescription("Send a direct message to a member")
      .addUserOption(option =>
        option.setName("member")
          .setDescription("Message recipient")
          .setRequired(true)
      )
      .addStringOption(option =>
        option.setName("message")
          .setDescription("Message content")
          .setRequired(true)
      )
  ),

  admin(
    new SlashCommandBuilder()
      .setName("birthday")
      .setDescription("Manage member birthdays")
      .addSubcommand(sub =>
        sub.setName("add")
          .setDescription("Register a birthday")
          .addUserOption(option =>
            option.setName("member")
              .setDescription("Member")
              .setRequired(true)
          )
          .addStringOption(option =>
            option.setName("date")
              .setDescription("Date in DD/MM format, e.g. 20/01")
              .setRequired(true)
          )
      )
      .addSubcommand(sub =>
        sub.setName("remove")
          .setDescription("Remove a registered birthday")
          .addUserOption(option =>
            option.setName("member")
              .setDescription("Member")
              .setRequired(true)
          )
      )
      .addSubcommand(sub =>
        sub.setName("list")
          .setDescription("List registered birthdays")
      )
  ),

  admin(
    new SlashCommandBuilder()
      .setName("addreply")
      .setDescription("Create an automatic reply")
      .addStringOption(option =>
        option.setName("trigger")
          .setDescription("Word or phrase that triggers the reply")
          .setRequired(true)
      )
      .addStringOption(option =>
        option.setName("response")
          .setDescription("Bot response")
          .setRequired(true)
      )
  ),

  admin(
    new SlashCommandBuilder()
      .setName("editreply")
      .setDescription("Edit an automatic reply")
      .addStringOption(option =>
        option.setName("trigger")
          .setDescription("Existing trigger phrase")
          .setRequired(true)
      )
      .addStringOption(option =>
        option.setName("response")
          .setDescription("New bot response")
          .setRequired(true)
      )
  ),

  admin(
    new SlashCommandBuilder()
      .setName("delreply")
      .setDescription("Delete an automatic reply")
      .addStringOption(option =>
        option.setName("trigger")
          .setDescription("Trigger phrase to delete")
          .setRequired(true)
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
      .setDescription("Choose automatic reply matching mode")
      .addStringOption(option =>
        option.setName("mode")
          .setDescription("How the trigger should match")
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
      .setDescription("Schedule a message for a future time")
      .addChannelOption(option =>
        option.setName("channel")
          .setDescription("Destination text channel")
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
      .addStringOption(option =>
        option.setName("datetime")
          .setDescription("Date/time with timezone, e.g. 2026-12-31T20:00:00+03:00")
          .setRequired(true)
      )
      .addStringOption(option =>
        option.setName("message")
          .setDescription("Message to send")
          .setRequired(true)
      )
  )
].map(command => command.toJSON());

// ==================== تشغيل العميل ====================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ==================== الوقت السعودي ====================

function riyadhDate() {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Riyadh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date());
}

// ==================== أعياد الميلاد والرسائل المجدولة ====================

async function checkBirthdays() {
  const today = riyadhDate();

  if (data.lastBirthdayDate === today) return;

  const [day, month] = today.split("/");
  const channel = await client.channels
    .fetch(BIRTHDAY_CHANNEL)
    .catch(() => null);

  if (!channel || !channel.isTextBased()) {
    console.error("Birthday channel unavailable. Will retry.");
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
    console.error("Birthday message failed; will retry:", error);
  }
}

async function checkSchedules() {
  for (const item of data.schedules) {
    if (item.sent || Date.now() < item.timestamp) continue;

    const channel = await client.channels
      .fetch(item.channelId)
      .catch(() => null);

    if (!channel || !channel.isTextBased()) {
      console.error("Scheduled message channel unavailable:", item.channelId);
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
      console.error("Scheduled message failed; will retry:", error);
    }
  }
}

async function checkReminders() {
  await checkBirthdays();
  await checkSchedules();
}

// ==================== تشغيل البوت وتسجيل الأوامر ====================

client.once("ready", async () => {
  console.log(`Valin is online as ${client.user.tag}`);

  try {
    const rest = new REST({ version: "10" }).setToken(token);

    await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: commands }
    );

    console.log("Slash commands registered successfully.");
  } catch (error) {
    console.error("Command registration failed:", error);
  }

  await checkReminders();

  setInterval(() => {
    checkReminders().catch(error => {
      console.error("Reminder check failed:", error);
    });
  }, 30_000);
});

// ==================== الردود التلقائية ====================

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
    }).catch(error => {
      console.error("Automatic reply failed:", error);
    });

    break;
  }
});

// ==================== التفاعلات والأوامر ====================

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
    // ---------- Ping ----------

    if (name === "ping") {
      return reply("Pong! بوت ڤالين يعمل بنجاح 🌙");
    }

    // ---------- Help ----------

    if (name === "help") {
      return reply(
        "**أوامر بوت ڤالين 🌙**\n\n" +
        "**الإدارة:**\n" +
        "`/kick` — إخراج عضو\n" +
        "`/ban` — حظر عضو\n" +
        "`/timeout` — تقييد عضو مؤقتًا\n" +
        "`/warn` — تحذير عضو\n\n" +
        "**حذف الرسائل:**\n" +
        "`/clear` — حذف رسائل حديثة\n" +
        "`/clearuser` — حذف رسائل عضو\n" +
        "`/clearbots` — حذف رسائل البوتات\n\n" +
        "**الرسائل:**\n" +
        "`/dm` — إرسال رسالة خاصة\n" +
        "`/schedule` — جدولة رسالة\n\n" +
        "**أعياد الميلاد:**\n" +
        "`/birthday add` — إضافة تاريخ\n" +
        "`/birthday remove` — حذف تاريخ\n" +
        "`/birthday list` — عرض التواريخ\n\n" +
        "**الردود التلقائية:**\n" +
        "`/addreply` — إضافة رد\n" +
        "`/editreply` — تعديل رد\n" +
        "`/delreply` — حذف رد\n" +
        "`/listreplies` — عرض الردود\n" +
        "`/replymode` — تحديد طريقة المطابقة\n\n" +
        "`/ping` و`/help`"
      );
    }

    // ---------- Kick / Ban / Timeout ----------

    if (["kick", "ban", "timeout"].includes(name)) {
      const user = interaction.options.getUser("member");
      const member = await interaction.guild.members
        .fetch(user.id)
        .catch(() => null);

      const reason =
        interaction.options.getString("reason") || "لم يُحدَّد سبب";

      if (!member) {
        return reply("ما قدرت أجد العضو داخل السيرفر.");
      }

      if (!member.manageable) {
        return reply(
          "ما أقدر أطبق الإجراء. تأكدي من ترتيب رتبة البوت وصلاحياته."
        );
      }

      if (name === "kick") {
        await member.kick(reason);
        return reply(`تم إخراج ${user.tag} من السيرفر.`);
      }

      if (name === "ban") {
        await interaction.guild.members.ban(user.id, { reason });
        return reply(`تم حظر ${user.tag}.`);
      }

      const minutes = interaction.options.getInteger("minutes");

      await member.timeout(minutes * 60_000, reason);

      return reply(
        `تم تقييد ${user.tag} لمدة ${minutes} دقيقة.`
      );
    }

    // ---------- Warn ----------

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

      const dmSent = await user.send(
        `⚠️ لديك تحذير من سيرفر ڤالين.\nالسبب: ${reason}`
      ).then(() => true).catch(() => false);

      return reply(
        `تم تسجيل التحذير على ${user.tag}.` +
        (dmSent
          ? " وأُرسلت له رسالة خاصة."
          : " تعذّر إرسال الخاص؛ قد تكون رسائله الخاصة مغلقة.")
      );
    }

    // ---------- Clear messages ----------

    if (name === "clear") {
      if (!interaction.channel?.isTextBased()) {
        return reply("هذا الأمر يعمل داخل القنوات النصية فقط.");
      }

      const amount = interaction.options.getInteger("amount");

      const deleted = await interaction.channel.bulkDelete(
        amount,
        true
      );

      return reply(
        `تم حذف ${deleted.size} رسالة. ` +
        "لا يمكن حذف الرسائل الأقدم من 14 يومًا بهذه الطريقة."
      );
    }

    // ---------- Clear user / bots ----------

    if (name === "clearuser" || name === "clearbots") {
      if (
        !interaction.channel?.isTextBased() ||
        !interaction.channel.messages
      ) {
        return reply("هذا الأمر يعمل داخل القنوات النصية فقط.");
      }

      const amount = interaction.options.getInteger("amount");

      const user = name === "clearuser"
        ? interaction.options.getUser("member")
        : null;

      const fetched = await interaction.channel.messages.fetch({
        limit: 100
      });

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

      return reply(
        `تم حذف ${deleted.size} رسالة مطابقة. ` +
        "الرسائل الأقدم من 14 يومًا لا يمكن حذفها بهذه الطريقة."
      );
    }

    // ---------- Direct message ----------

    if (name === "dm") {
      const user = interaction.options.getUser("member");
      const message = interaction.options.getString("message");

      await user.send({
        content: message,
        allowedMentions: { parse: [] }
      });

      return reply(`تم إرسال الرسالة الخاصة إلى ${user.tag}.`);
    }

    // ---------- Birthday management ----------

    if (name === "birthday") {
      const sub = interaction.options.getSubcommand();

      if (sub === "add") {
        const user = interaction.options.getUser("member");
        const date = interaction.options.getString("date").trim();

        const validFormat =
          /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])$/.test(date);

        if (!validFormat) {
          return reply(
            "اكتبي التاريخ بصيغة DD/MM، مثل `20/01`."
          );
        }

        const [day, month] = date.split("/").map(Number);
        const daysInMonth = new Date(2000, month, 0).getDate();

        if (day > daysInMonth) {
          return reply("هذا التاريخ غير صحيح.");
        }

        data.birthdays[user.id] = { date };
        saveData();

        return reply(
          `تم حفظ عيد ميلاد ${user.tag} بتاريخ ${date} 🎂`
        );
      }

      if (sub === "remove") {
        const user = interaction.options.getUser("member");

        if (!data.birthdays[user.id]) {
          return reply("ما فيه عيد ميلاد مسجل لهذا العضو.");
        }

        delete data.birthdays[user.id];
        saveData();

        return reply(`تم حذف عيد ميلاد ${user.tag}.`);
      }

      if (sub === "list") {
        const entries = Object.entries(data.birthdays);

        if (!entries.length) {
          return reply("ما فيه أعياد ميلاد مسجلة حاليًا.");
        }

        const list = entries.map(([id, info]) =>
          `<@${id}> — ${info.date}`
        ).join("\n");

        return reply(
          list.length > 1900
            ? list.slice(0, 1850) + "\n... القائمة طويلة."
            : list
        );
      }
    }

    // ---------- Add / edit automatic reply ----------

    if (name === "addreply" || name === "editreply") {
      const trigger = interaction.options
        .getString("trigger")
        .trim()
        .toLowerCase();

      const response = interaction.options.getString("response").trim();

      if (!trigger || !response) {
        return reply("اكتبي كلمة الرد والرسالة بشكل صحيح.");
      }

      if (name === "editreply" && !data.replies[trigger]) {
        return reply("ما لقيت هذا الرد. تأكدي من كتابة الكلمة نفسها.");
      }

      if (name === "addreply" && data.replies[trigger]) {
        return reply(
          "هذا الرد موجود مسبقًا. استخدمي `/editreply` لتعديله."
        );
      }

      data.replies[trigger] = response;
      saveData();

      return reply(
        name === "addreply"
          ? `تمت إضافة الرد التلقائي للكلمة: ${trigger}`
          : `تم تعديل الرد الخاص بالكلمة: ${trigger}`
      );
    }

    // ---------- Delete automatic reply ----------

    if (name === "delreply") {
      const trigger = interaction.options
        .getString("trigger")
        .trim()
        .toLowerCase();

      if (!data.replies[trigger]) {
        return reply("هذا الرد غير موجود.");
      }

      delete data.replies[trigger];
      saveData();

      return reply(`تم حذف الرد التلقائي: ${trigger}`);
    }

    // ---------- List automatic replies ----------

    if (name === "listreplies") {
      const entries = Object.entries(data.replies);

      if (!entries.length) {
        return reply("ما فيه ردود تلقائية محفوظة.");
      }

      const list = entries.map(([trigger, response]) =>
        `**${trigger}** → ${response}`
      ).join("\n");

      return reply(
        list.length > 1900
          ? list.slice(0, 1850) + "\n... القائمة طويلة."
          : list
      );
    }

    // ---------- Reply mode ----------

    if (name === "replymode") {
      data.replyMode = interaction.options.getString("mode");
      saveData();

      return reply(
        data.replyMode === "exact"
          ? "تم اختيار المطابقة الكاملة: يجب أن تطابق الرسالة الكلمة أو العبارة."
          : "تم اختيار مطابقة المحتوى: سيرد البوت إذا احتوت الرسالة على العبارة."
      );
    }

    // ---------- Schedule message ----------

    if (name === "schedule") {
      const channel = interaction.options.getChannel("channel");
      const dateText = interaction.options.getString("datetime").trim();
      const message = interaction.options.getString("message");

      const hasTimezone =
        /(?:Z|[+-]\d{2}:\d{2})$/i.test(dateText);

      const timestamp = Date.parse(dateText);

      if (!hasTimezone || !Number.isFinite(timestamp)) {
        return reply(
          "اكتبي تاريخًا ووقتًا مع المنطقة الزمنية، مثل:\n" +
          "`2026-12-31T20:00:00+03:00`"
        );
      }

      if (timestamp <= Date.now()) {
        return reply("اختاري موعدًا في المستقبل.");
      }

      data.schedules.push({
        channelId: channel.id,
        timestamp,
        message,
        sent: false
      });

      saveData();

      return reply(
        `تمت جدولة الرسالة في <#${channel.id}>.\n` +
        `الموعد: ${dateText}`
      );
    }
  } catch (error) {
    console.error(`Error in /${name}:`, error);

    const errorMessage =
      "صار خطأ أثناء تنفيذ الأمر. تأكدي من صلاحيات البوت وترتيب رتبته.";

    if (interaction.replied || interaction.deferred) {
      return interaction.followUp({
        content: errorMessage,
        ephemeral: true,
        allowedMentions: { parse: [] }
      }).catch(() => {});
    }

    return reply(errorMessage).catch(() => {});
  }
});

// ==================== بدء التشغيل ====================

loadData();

client.login(token).catch(error => {
  console.error("Bot login failed:", error);
});
