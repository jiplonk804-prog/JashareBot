

/*⏤͟͟͞͞⏤͟͟͞͞⏤͟͟͞͞⏤͟͟͞͞⏤͟͟͞͞⏤͟͟͞͞⏤͟͟͞͞⏤͟͟͞͞⏤͟͟͞͞⏤͟͟͞͞⏤͟͟͞͞⏤͟͟͞͞⏤͟͟͞͞
  ⏤͟͟͞͞⚡ SCRIPT BOT BY JUN OFFICIAL ⚡⏤͟͟͞͞
⏤͟͟͞͞ Dibuat bukan hanya untuk jalan, tapi untuk menang
⏤͟͟͞͞ Follow Channel: @Junofficial354ch2
⏤͟͟͞͞ Telegram Bot : @Junofficial354new
⏤͟͟͞͞ Tanks Buat pengguna script ini ✰
⏤͟͟͞͞⏤͟͟͞͞⏤͟͟͞͞⏤͟͟͞͞⏤͟͟͞͞⏤͟͟͞͞⏤͟͟͞͞⏤͟͟͞͞⏤͟͟͞͞⏤͟͟͞͞⏤͟͟͞͞⏤͟͟͞͞
*/

const chalk = require('chalk').default;
const moment = require('moment');
const fs = require('fs');
const path = require('path');
const { Telegraf, Markup  } = require('telegraf');
const { TOKEN, OWNER_ID, MENU_IMAGE_URL } = require('./setting');
const setting = require('./setting');
const ownerId = setting.OWNER_ID
const username = setting.USER_OWNER;
const chanel = setting.CHANEL;
const promoteall = []
const bot = new Telegraf(TOKEN);
const OWNER_ID_NUM = Number(OWNER_ID);
// === Path Database ===
const GROUP_DB_PATH = './database/group.json';
const USER_DB_PATH = './database/user.json';
const MESSAGES_DIR = './database/messages';
const LIMIT_PATH = './database/limits.json';

// === Premium & Pro DB ===
const DB_DIR = path.join(__dirname, 'Plan-Status');
const PREMIUM_FILE = path.join(DB_DIR, 'premium.json');
const PRO_FILE = path.join(DB_DIR, 'pro.json');

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR);
if (!fs.existsSync(PREMIUM_FILE)) fs.writeFileSync(PREMIUM_FILE, JSON.stringify([]));
if (!fs.existsSync(PRO_FILE)) fs.writeFileSync(PRO_FILE, JSON.stringify([]));

// === Helper: DB I/O ===
function loadData(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return [];
  }
}

function saveData(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function addId(file, id) {
  const data = loadData(file);
  if (!data.includes(id)) {
    data.push(id);
    saveData(file, data);
    return true;
  }
  return false;
}

function removeId(file, id) {
  const data = loadData(file);
  const newData = data.filter(x => x !== id);
  if (newData.length !== data.length) {
    saveData(file, newData);
    return true;
  }
  return false;
}

// === Helper: Owner & Reply ===
function isOwner(ctx) {
  return Number(ctx.from?.id) === OWNER_ID_NUM;
}

function replyBlock(ctx, text, extra = {}) {
  return ctx.reply(`<blockquote>${text}</blockquote>`, {
    parse_mode: 'HTML',
    ...extra
  });
}

function sanitizeId(raw) {
  if (!raw) return null;
  const id = String(raw).trim();
  return /^-?\d+$/.test(id) ? id : null;
}

// === Load Databases ===
let groupDb = fs.existsSync(GROUP_DB_PATH) ? JSON.parse(fs.readFileSync(GROUP_DB_PATH)) : [];
let userDb = fs.existsSync(USER_DB_PATH) ? JSON.parse(fs.readFileSync(USER_DB_PATH)) : [];
let limitDb = fs.existsSync(LIMIT_PATH) ? JSON.parse(fs.readFileSync(LIMIT_PATH)) : {};

// === Save DB Utils ===
function saveJson(path, data) {
  fs.writeFileSync(path, JSON.stringify(data, null, 2));
}

function saveLimitDb() {
  saveJson(LIMIT_PATH, limitDb);
}

// === Plan System ===
function getUserPlan(userId) {
  const proUsers = loadData(PRO_FILE);
  const premiumUsers = loadData(PREMIUM_FILE);

  if (proUsers.includes(String(userId))) {
    return { name: 'pro', limit: 20, resetMs: 5 * 60 * 60 * 1000 };
  }
  if (premiumUsers.includes(String(userId))) {
    return { name: 'premium', limit: 15, resetMs: 24 * 60 * 60 * 1000 }; 
  }
  return { name: 'free', limit: 10, resetMs: 2 * 24 * 60 * 60 * 1000 };
}

// === Limit Utilities ===
function getUserLimit(userId) {
  const { resetMs } = getUserPlan(userId);
  const now = Date.now();
  const data = limitDb[userId] || { count: 0, resetAt: now + resetMs };

  if (now > data.resetAt) {
    limitDb[userId] = { count: 0, resetAt: now + resetMs };
    saveLimitDb();
    return 0;
  }

  return data.count;
}

function incrementLimit(userId) {
  const { resetMs } = getUserPlan(userId);
  const now = Date.now();

  if (!limitDb[userId] || now > limitDb[userId].resetAt) {
    limitDb[userId] = { count: 1, resetAt: now + resetMs };
  } else {
    limitDb[userId].count++;
  }
  saveLimitDb();
}

function isLimitExceeded(userId) {
  const { limit } = getUserPlan(userId);
  return getUserLimit(userId) >= limit;
}

// === Save User & Group ===
function saveUser(userId) {
  if (!userDb.includes(userId)) {
    userDb.push(userId);
    saveJson(USER_DB_PATH, userDb);
    console.log('👤 User baru disimpan:', userId);
  }
}

function saveGroup(groupId, userId) {
  if (!groupDb.find(g => g.group_id === groupId)) {
    groupDb.push({ group_id: groupId, added_by: userId });
    saveJson(GROUP_DB_PATH, groupDb);
    console.log('📦 Grup baru disimpan:', groupId);
  }
}

// === Eligibility Check ===
function isUserEligible(userId) {
  return groupDb.some(g => g.added_by === userId);
}

// === Middleware Proteksi ===
function protectCommand(fn) {
  return (ctx) => {
    const userId = ctx.from?.id;

    if (!isUserEligible(userId)) {
      const botUsername = ctx.botInfo?.username || 'your_bot_username';
      return ctx.reply(
        `<b>❌ Akses Ditolak</b>\n<blockquote>Tambahkan bot ini ke grupmu terlebih dahulu untuk menggunakan fitur ini.</blockquote>`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '➕ Tambahkan ke Grup', url: `https://t.me/${ctx.me}?startgroup=new` }]
            ]
          }
        }
      );
    }

    return fn(ctx);
  };
}

// === Developer Utils ===
const DEVELOPER_IDS = [8091720389];
function isDeveloper(id) {
  return DEVELOPER_IDS.includes(id);
}

// Simple parser tombol: "Text - URL"
function parseURLButton(line) {
  const parts = line.split(" - ").map(s => s.trim());
  if (parts.length !== 2) return null;
  const [text, url] = parts;
  if (!text || !url.startsWith("")) return null;
  return { text, url };
}
// === Exports ===
module.exports = {
  GROUP_DB_PATH,
  USER_DB_PATH,
  MESSAGES_DIR,
  limitDb,
  groupDb,
  userDb,
  saveJson,
  saveLimitDb,
  saveUser,
  saveGroup,
  isUserEligible,
  protectCommand,
  getUserLimit,
  incrementLimit,
  isLimitExceeded,
  isDeveloper,
  getUserPlan
};

const wrapPre = (text) => `<blockquote>${text}</blockquote>`;
const wrapBlock = (text) => `<blockquote>${text}</blockquote>`;

bot.start(async (ctx) => {
  const senderId = ctx.from?.id;
  const chat = ctx.chat;
  const args = ctx.message.text.split(" ");

  if (args[1] === "status_account") {
    const plan = getUserPlan(senderId);
    const used = getUserLimit(senderId);
    const limit = plan.limit === Infinity ? "∞" : plan.limit;
    const sisa = plan.limit === Infinity ? "∞" : Math.max(0, plan.limit - used);

    const card = wrapPre(
      `╓──────≪≪◈≫≫──────╖\n      📊 ACCOUNT STATUS\n╙──────≪≪◈≫≫──────╜\n╓──────≪≪◈≫≫──────╖\n 🆔 ID       : ${senderId}\n 🌐 PLAN     : ${plan.name.toUpperCase()}\n 📦 LIMIT    : ${limit}\n 📊 DIGUNAKAN: ${used}\n ✅ SISA     : ${sisa}\n╙──────≪≪◈≫≫──────╜`
    ) + wrapBlock('\nTekan tombol di bawah untuk mengelola akun atau melakukan upgrade.');

    try {
      return await ctx.replyWithPhoto(
        { url: MENU_IMAGE_URL },
        {
          caption: card,
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "⪨ ᴜᴘɢʀᴀᴅᴇ ᴀᴄᴏᴜɴᴛ ⪩", callback_data: "update_account" }],
              [{ text: "⬅️ Back to Menu", callback_data: "back_menu" }]
            ]
          }
        }
      );
    } catch (err) {
      console.error("❌ Gagal tampilkan status via deep link:", err);
      return ctx.reply(wrapBlock("⚠️ Gagal memuat status akun."), { parse_mode: 'HTML' });
    }
  }

  if (chat.type === "group" || chat.type === "supergroup") {
    saveGroup(chat.id, senderId);

    const groupCaption = wrapPre(
`══════════════════════════════════
      ╓──────≪≪◈≫≫──────╖
         🤖 BOT KAZUKIBLAST 
      ╙──────≪≪◈≫≫──────╜
           
Gunakan bot di PRIVATE CHAT untuk fitur penuh.\nKlik tombol di bawah untuk memulai.
══════════════════════════════════`
    );

    return ctx.reply(groupCaption, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🚀 GET START BOT", url: `https://t.me/${ctx.me}` },
            { text: "📊 STATUS ACCOUNT", url: `https://t.me/${ctx.me}?start=status_account` }
          ]
        ]
      }
    });
  }

  saveUser(senderId);
  const totalGroups = groupDb.length;
  const totalUsers = userDb.length;

  const caption = wrapPre(`
Selamat Datang di Bot Asisten Digital Anda!

📊 Statistik Saat Ini:
  ├─ 👥 Total Pengguna: ${totalUsers}
  └─ 📦 Total Grup: ${totalGroups}

📖 Daftar Perintah:
  ├─ /share  - Bagikan pesan balasan ke semua grup.
  ├─ /set    - Simpan pesan untuk dibagikan nanti.
  ├─ /auto   - Kirim pesan yang sudah disimpan.
  └─ /status - Cek status akun Anda

Pilih salah satu opsi di bawah untuk memulai.
`) + wrapBlock('Butuh bantuan? Hubungi owner atau gunakan tombol Info.');
  return ctx.replyWithPhoto(
    { url: MENU_IMAGE_URL },
    {
      caption,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "➕ ᴀᴅᴅ ɢʀᴏᴜᴘ", url: `https://t.me/${ctx.me}?startgroup=new` }],
          [
            { text: "⏤͟͟͞ ᴄᴏɴᴛᴀᴄᴛ ᴏᴡɴᴇʀ", url: `https://t.me/${username}` },
            { text: "⏤͟͟͞ ɪɴғᴏʀᴍᴀᴛɪᴏɴ ʙᴏᴛ", url: `https://t.me/${chanel}` }
          ],
          [{ text: "❖ sᴛᴀᴛᴜs ᴀᴄᴏᴜɴᴛ ❖", callback_data: "status_account" }]
        ]
      }
    }
  );
});

bot.command("status", (ctx) => {
  ctx.reply(wrapBlock("📡 STATUS BOT\nKlik tombol di bawah untuk cek status!"), {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [{ text: "⚡ CEK STATUS", callback_data: "status" }]
      ]
    }
  });
});

bot.action('status', async (ctx) => {
  const senderId = ctx.from?.id;
  const plan = getUserPlan(senderId);
  const used = getUserLimit(senderId);
  const limit = plan.limit === Infinity ? '∞' : plan.limit;
  const sisa = plan.limit === Infinity ? '∞' : Math.max(0, plan.limit - used);

  const card = wrapPre(`
📊 Dashboard Akun Anda

Berikut adalah ringkasan status dan penggunaan akun Anda saat ini.

  ├─ 🆔 ID Pengguna: ${senderId}
  ├─ 🌐 Paket Aktif: ${plan.name.toUpperCase()}
  ├─ 📈 Limit Digunakan: ${used} / ${limit}
  └─ ✅ Sisa Limit: ${sisa} Pengiriman
`) + wrapBlock('Upgrade untuk mendapatkan limit lebih besar!');
  try {
    await ctx.editMessageText(card, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '❌ Close', callback_data: 'close_status' }]
        ]
      }
    });
  } catch (err) {
    console.error('❌ Gagal tampilkan status:', err);
  }
});

bot.action('close_status', async (ctx) => {
  try {
    await ctx.deleteMessage();
  } catch (err) {
    console.error('❌ Gagal hapus pesan:', err);
  }
});
bot.action('status_account', async (ctx) => {
  const senderId = ctx.from?.id;
  const plan = getUserPlan(senderId);
  const used = getUserLimit(senderId);
  const limit = plan.limit === Infinity ? '∞' : plan.limit;
  const sisa = plan.limit === Infinity ? '∞' : Math.max(0, plan.limit - used);

  const card = wrapPre(`
📊 Dashboard Akun Anda

Berikut adalah ringkasan status dan penggunaan akun Anda saat ini.

  ├─ 🆔 ID Pengguna: ${senderId}
  ├─ 🌐 Paket Aktif: ${plan.name.toUpperCase()}
  ├─ 📈 Limit Digunakan: ${used} / ${limit}
  └─ ✅ Sisa Limit: ${sisa} Pengiriman
`) + wrapBlock('Upgrade untuk mendapatkan limit lebih besar!');
  try {
    await ctx.editMessageCaption(card, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '⪨ ᴜᴘɢʀᴀᴅᴇ ᴀᴄᴏᴜɴᴛ ⪩ ', callback_data: 'update_account' }],
          [{ text: '⬅️ ʙᴀᴄᴋ ᴛᴏ ᴍᴇɴᴜ', callback_data: 'back_menu' }]
        ]
      }
    });
  } catch (err) {
    console.error('❌ Gagal tampilkan status:', err);
  }
});

bot.action('update_account', async (ctx) => {
  const info = wrapPre(`
🚀 Pusat Upgrade Paket

Tingkatkan potensi Anda dan buka fitur-fitur superior.
`) + wrapBlock('Pilih paket yang paling sesuai di bawah ini.');

  try {
    await ctx.editMessageCaption(info, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '⭐ ᴘʟᴀɴ ᴘʀᴇᴍɪᴜᴍ', callback_data: 'choose_premium' }],
          [{ text: '💎 ᴘʟᴀɴ ᴘʀᴏ ', callback_data: 'choose_pro' }],
          [{ text: '⬅️ sᴛᴀᴛᴜs ᴀᴄᴏᴜɴᴛ', callback_data: 'status_account' }]
        ]
      }
    });
  } catch (err) {
    console.error('❌ Gagal tampilkan upgrade menu:', err);
  }
});

bot.action('choose_premium', async (ctx) => {
  const plan = getUserPlan(ctx.from.id);
  let caption = '';
  let buttons = [];

  if (plan.name === 'free') {
    caption = wrapPre(`
⭐ Detail Paket Premium

Paket ideal untuk penggunaan reguler dengan limit yang lebih besar dan reset harian.

Fitur & Keuntungan:
  ✅ Limit Pengiriman: 15 / hari
  ✅ Reset Limit: Setiap 24 jam
  ✅ Akses Semua Fitur Dasar
  ✅ Prioritas Pengiriman
`) + wrapBlock('Harga: 5 Bintang Telegram atau Rp 5.000 (Segera Hadir)');

    buttons = [
      [{ text: 'Beli dengan 5 Bintang ⭐', callback_data: 'buy_premium_stars' }],
      [{ text: '⬅️ Kembali', callback_data: 'update_account' }]
    ];
  } else if (plan.name === 'premium') {
    caption = wrapPre(`
✨ Anda Sudah Premium!

Terima kasih telah menjadi pengguna Premium. Anda sudah menikmati limit yang lebih tinggi dan prioritas pengiriman.
`) + wrapBlock('Ingin lebih?');

    buttons = [
      [{ text: '💎 Upgrade ke Paket Pro', callback_data: 'choose_pro' }],
      [{ text: '⬅️ Kembali', callback_data: 'update_account' }]
    ];
  } else if (plan.name === 'pro') {
    caption = wrapPre(`
💎 Paket Anda Lebih Tinggi!

Anda saat ini adalah pengguna PRO, yang merupakan paket di atas Premium.
`) + wrapBlock('Terima kasih atas dukungan Anda.');

    buttons = [
      [{ text: '⬅️ Kembali', callback_data: 'update_account' }]
    ];
  }

  try {
    await ctx.editMessageCaption(caption, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: buttons }
    });
  } catch (err) {}
});

bot.action('choose_pro', async (ctx) => {
  const plan = getUserPlan(ctx.from.id);
  let caption = '';
  let buttons = [];

  if (plan.name === 'pro') {
    caption = wrapPre(`
💎 Anda Adalah Pengguna PRO!

Nikmati limit maksimal dan semua fitur eksklusif tanpa batasan.
`) + wrapBlock('Terima kasih!');

    buttons = [
      [{ text: '⬅️ Kembali', callback_data: 'update_account' }]
    ];
  } else {
    caption = wrapPre(`
💎 Detail Paket Pro

Paket ultimate untuk kekuatan maksimal.
`) + wrapBlock('Fitur utama: Limit 20 / 5 jam, reset super cepat. Harga: 10 Bintang Telegram atau Rp 10.000 (Segera Hadir)');

    buttons = [
      [{ text: 'Beli dengan 10 Bintang ⭐', callback_data: 'buy_pro_stars' }],
      [{ text: '⬅️ Kembali', callback_data: 'update_account' }]
    ];
  }

  try {
    await ctx.editMessageCaption(caption, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: buttons }
    });
  } catch (err) {}
});

// Simpan invoice aktif
const activeInvoices = {};

// Helper buat kirim invoice + tombol cancel
async function sendPlanInvoice(ctx, plan) {
  const plans = {
    premium: {
      title: "⭐ Premium Plan",
      description: "Upgrade ke Premium Plan - Limit 15 share / hari",
      payload: "premium_plan_stars",
      amount: 5
    },
    pro: {
      title: "💎 Pro Plan",
      description: "Upgrade ke Pro Plan - Limit 20 share / 5 jam",
      payload: "pro_plan_stars",
      amount: 10
    }
  };

  const { title, description, payload, amount } = plans[plan];

  // kirim invoice
  const invoiceMsg = await ctx.replyWithInvoice({
    title,
    description,
    payload,
    currency: "XTR",
    prices: [{ label: title, amount }],
    provider_token: ""
  });

  // simpan invoice id buat user ini
  activeInvoices[ctx.from.id] = invoiceMsg.message_id;

  // kirim tombol cancel
  await ctx.reply("👉 Jika ingin batal, klik tombol di bawah:", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "❌ Batal", callback_data: `cancel_${plan}` }]
      ]
    }
  });
}

// Premium
bot.action("buy_premium_stars", async (ctx) => {
  try {
    await ctx.deleteMessage();
    await sendPlanInvoice(ctx, "premium");
  } catch (err) {
    console.error("❌ Gagal kirim invoice Premium:", err);
    await ctx.reply("<blockquote>⚠️ Gagal memproses pembayaran Stars Premium.</blockquote>", { parse_mode: "HTML" });
  }
});

// Pro
bot.action("buy_pro_stars", async (ctx) => {
  try {
    await ctx.deleteMessage();
    await sendPlanInvoice(ctx, "pro");
  } catch (err) {
    console.error("❌ Gagal kirim invoice Pro:", err);
    await ctx.reply("<blockquote>⚠️ Gagal memproses pembayaran Stars Pro.</blockquote>", { parse_mode: "HTML" });
  }
});

// Handle cancel
bot.action(/cancel_(premium|pro)/, async (ctx) => {
  try {
    await ctx.deleteMessage(); // hapus tombol cancel
    const userId = ctx.from.id;
    const invoiceId = activeInvoices[userId];

    if (invoiceId) {
      await ctx.deleteMessage(invoiceId); // hapus invoice ⭐
      delete activeInvoices[userId];
    }

    // Balik ke menu utama / kasih info
    await ctx.reply("❌ Pembelian dibatalkan. Kamu kembali ke menu utama.");
    // bisa panggil fungsi showMainMenu(ctx) kalau punya
  } catch (err) {
    console.error("❌ Error cancel:", err);
  }
});

bot.action('buy_premium_money', async (ctx) => {
  const text = wrapBlock('COMING SOON, GUNAKAN STARS AGAR LEBIH MUDAH');
  await ctx.reply(text, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [{ text: '𝗨𝗦𝗘 𝗦𝗧𝗔𝗥𝗦', callback_data: 'buy_premium_stars' }]
      ]
    }
  });
});

bot.action('buy_pro_money', async (ctx) => {
  const text = wrapBlock('COMING SOON, GUNAKAN STARS AGAR LEBIH MUDAH');
  await ctx.reply(text, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [{ text: '𝗨𝗦𝗘 𝗦𝗧𝗔𝗥𝗦', callback_data: 'buy_pro_stars' }]
      ]
    }
  });
});

bot.on('successful_payment', (ctx) => {
  const userId = String(ctx.from.id);
  const payment = ctx.message.successful_payment;
  const payload = payment.invoice_payload;

  if (payload === "premium_plan_stars") {
    addId(PREMIUM_FILE, userId);
    ctx.reply(
      wrapBlock(`
✅ Pembayaran Berhasil!

Selamat, akun kamu telah diupgrade ke: ⭐ PREMIUM PLAN

Limit: 15 share / hari
Reset: 24 jam

Terima kasih sudah mendukung bot ini 🙏
`),
      { parse_mode: 'HTML' }
    );
  }

  if (payload === "pro_plan_stars") {
    addId(PRO_FILE, userId);
    ctx.reply(
      wrapBlock(`
✅ Pembayaran Berhasil!

Selamat, akun kamu telah diupgrade ke: 💎 PRO PLAN

Limit: 20 share / 5 jam
Reset: Tiap 5 jam

Terima kasih sudah mendukung bot ini 🙏
`),
      { parse_mode: 'HTML' }
    );
  }
});

bot.action('back_menu', async (ctx) => {
  const totalGroups = groupDb.length;
  const totalUsers = userDb.length;

  const caption = wrapPre(`
Selamat Datang di Bot Asisten Digital Anda!

📊 Statistik Saat Ini:
  ├─ 👥 Total Pengguna: ${totalUsers}
  └─ 📦 Total Grup: ${totalGroups}

📖 Daftar Perintah:
  ├─ /share - Bagikan pesan balasan ke semua grup.
  ├─ /set   - Simpan pesan untuk dibagikan nanti.
  ├─ /auto  - Kirim pesan yang sudah disimpan.
  └─ /status  - cek status akun kamu

Pilih salah satu opsi di bawah untuk memulai.
`) + wrapBlock('Butuh bantuan? Hubungi owner.');

  try {
    await ctx.editMessageCaption(caption, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '➕ ᴀᴅᴅ ɢʀᴏᴜᴘ', url: `https://t.me/${ctx.me}?startgroup=new` }],
          [
            { text: '⏤͟͟͞ ᴄᴏɴᴛᴀᴄᴛ ᴏᴡɴᴇʀ', url: 'https://t.me/junofficialBot' },
            { text: '⏤͟͟͞ ɪɴғᴏʀᴍᴀᴛɪᴏɴ ʙᴏᴛ', url: 'https://t.me/junofficial354ch2' }
          ],
          [{ text: '∉ sᴛᴀᴛᴜs ᴀᴄᴏᴜɴᴛ ∌', callback_data: 'status_account' }]
        ]
      }
    });
  } catch (err) {
    console.error('❌ Gagal kembali ke menu:', err);
  }
});

bot.command('share', protectCommand(async (ctx) => {
  const userId = ctx.from.id;
  const plan = getUserPlan(userId);

  if (isLimitExceeded(userId)) return replyBlock(ctx, wrapBlock(`🚫 <b>Limit Tercapai</b>\n\nAnda telah mencapai batas pengiriman untuk paket <b>${plan.name}</b> Anda. Limit akan direset dalam ${moment.duration(plan.resetMs).humanize()}.`));

  const reply = ctx.message?.reply_to_message;
  if (!reply) return replyBlock(ctx, '💡 <b>Cara Penggunaan:</b>\nBalas sebuah pesan dengan perintah <code>/share</code> untuk langsung membagikannya.');

  const statusMsg = await ctx.reply(`🚀 <b>Mempersiapkan Pengiriman...</b>\n\n<i>Menghitung target dan memulai proses...</i>`, { parse_mode: 'HTML' });

  let success = 0;
  let failed = 0;

  for (const group of groupDb) {
    try {
      await bot.telegram.forwardMessage(group.group_id, ctx.chat.id, reply.message_id);
      success++;
    } catch (err) {
      failed++;
    }
  }

  incrementLimit(userId);

  const finalReport = wrapPre(`✅ Pesan Terkirim!\n\nPesan Anda telah berhasil dibagikan ke jaringan grup.\n  ├─ ✔️ Berhasil Dibagikan: ${success} grup\n  └─ ✖️ Gagal Dibagikan: ${failed} grup`) + wrapBlock('Satu kredit limit telah digunakan.');

  await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null, finalReport, { parse_mode: 'HTML' });
}));

bot.command('set', protectCommand((ctx) => {
  const reply = ctx.message?.reply_to_message;
  if (!reply) {
    return replyBlock(ctx, '💡 <b>Cara Penggunaan:</b>\nBalas sebuah pesan dengan perintah <code>/set</code> untuk menyiapkannya.');
  }

  const filePath = path.join(MESSAGES_DIR, `${ctx.from.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify({
    chat_id: reply.chat.id,
    message_id: reply.message_id
  }, null, 2));

  return replyBlock(ctx, `📝 <b>Pesan Disiapkan!</b>\n\n${wrapBlock('Pesan berhasil disimpan. Gunakan /auto untuk memulai distribusi ke semua grup terhubung.')}`);
}));


bot.command('auto', protectCommand(async (ctx) => {
  const userId = ctx.from.id;
  const plan = getUserPlan(userId);

  if (isLimitExceeded(userId)) {
    return replyBlock(ctx, wrapBlock(`🚫 <b>Limit Tercapai</b>\n\nAnda telah mencapai batas pengiriman untuk paket <b>${plan.name}</b> Anda. Limit akan direset dalam ${moment.duration(plan.resetMs).humanize()}.`));
  }

  const filePath = path.join(MESSAGES_DIR, `${userId}.json`);
  if (!fs.existsSync(filePath)) {
    return replyBlock(ctx, wrapBlock(`⚠️ <b>Pesan Tidak Ditemukan</b>\n\nAnda belum menyiapkan pesan. Gunakan perintah /set pada sebuah pesan terlebih dahulu.`));
  }

  const confirmText = wrapPre(`🚀 Konfirmasi Publikasi\n\nAnda akan mempublikasikan pesan yang telah Anda siapkan ke ${groupDb.length} grup. Tindakan ini akan menggunakan 1 kredit dari limit Anda.`) +
    wrapBlock('Harap periksa kembali konten Anda sebelum melanjutkan.');

  return ctx.reply(confirmText, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ Lanjutkan Publikasi', callback_data: `auto_confirm` },
          { text: '❌ Batalkan', callback_data: `auto_cancel` }
        ]
      ]
    }
  });
}));


bot.action('auto_confirm', async (ctx) => {
  await ctx.answerCbQuery();
  const userId = ctx.from.id;

  await ctx.editMessageText(
    wrapPre(`⏳ Sedang Memproses...\n\nSistem sedang mendistribusikan pesan Anda.`) +
    wrapBlock('Status: Memulai pengiriman...'),
    { parse_mode: 'HTML' }
  );

  const filePath = path.join(MESSAGES_DIR, `${userId}.json`);
  if (!fs.existsSync(filePath)) {
    return ctx.editMessageText('❌ <b>Gagal:</b> Pesan yang disimpan tidak ditemukan.', { parse_mode: 'HTML' });
  }

  const { chat_id, message_id } = JSON.parse(fs.readFileSync(filePath));

  let success = 0, failed = 0;

  for (const group of groupDb) {
    try {
      await bot.telegram.forwardMessage(group.group_id, chat_id, message_id);
      success++;
    } catch {
      failed++;
    }
  }

  incrementLimit(userId);

  const finalReport =
    wrapPre(`✅ Publikasi Selesai\n\nKampanye Anda telah berhasil didistribusikan. Berikut adalah laporannya:\n  ├─ 🎯 Target Grup: ${groupDb.length}\n  ├─ ✔️ Terkirim: ${success}\n  └─ ✖️ Gagal: ${failed}`) +
    wrapBlock('Limit Anda telah diperbarui. Terima kasih!');

  await ctx.editMessageText(finalReport, { parse_mode: 'HTML' });
});


bot.action('auto_cancel', async (ctx) => {
  await ctx.answerCbQuery('Dibatalkan oleh pengguna.');
  await ctx.editMessageText(wrapBlock('🚫 <b>Dibatalkan.</b> Tidak ada pesan yang dikirim.'), { parse_mode: 'HTML' });
});


bot.command('setlimit', (ctx) => {
  if (!isOwner(ctx)) {
    return replyBlock(ctx, '🔒 Akses ditolak. Perintah ini khusus untuk Owner.');
  }

  const limit = parseInt(ctx.message.text.split(' ')[1]);
  if (!limit || isNaN(limit) || limit < 1 || limit > 100) {
    return replyBlock(ctx, '⚠️ <b>Format Salah.</b>\nGunakan: <code>/setlimit [angka 1-100]</code>');
  }

  const limitPath = path.join(__dirname, './database/max_limit.json');
  fs.writeFileSync(limitPath, JSON.stringify({ max: limit }, null, 2));

  return replyBlock(ctx, `🔧 <b>Pengaturan Diubah.</b>\nLimit pengiriman global untuk paket <b>Free</b> telah diatur ke <b>${limit}</b> per periode reset.`);
});

bot.on('my_chat_member', async (ctx) => {
  const { old_chat_member, new_chat_member, chat, from } = ctx.update.my_chat_member;

  if (chat.type !== "group" && chat.type !== "supergroup") return;

  const isJoin =
    (old_chat_member.status === 'left' || old_chat_member.status === 'kicked') &&
    (new_chat_member.status === 'member' || new_chat_member.status === 'administrator');

  if (!isJoin) return;

  let groupLink = "❌ Tidak ada link publik";
  if (chat.username) {
    groupLink = `https://t.me/${chat.username}`;
  } else {
    try {
      groupLink = await ctx.telegram.exportChatInviteLink(chat.id);
    } catch {
      groupLink = "❌ Tidak bisa generate link";
    }
  }

  const text = `
<b>📢 BOT DITAMBAHKAN KE GROUP</b>

💬 <b>Nama Group:</b> ${chat.title}
🆔 <b>Group ID:</b> <code>${chat.id}</code>
👤 <b>Ditambahkan oleh:</b> <a href="tg://user?id=${from.id}">${from.first_name}</a>
⚡ <b>Status:</b> Bot berhasil join ke grup
`;

  // kirim ke OWNER
  await ctx.telegram.sendMessage(setting.OWNER_ID, text, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [{ text: "📊 TAMPILKAN DATA", callback_data: `show_data:${from.id}` }],
        [{ text: "🌐 GROUP", url: groupLink }]
      ]
    }
  }).catch(() => {});

  // kirim ke user yang nambahin bot
  await ctx.telegram.sendMessage(from.id, text, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [{ text: "🌐 GROUP", url: groupLink }]
      ]
    }
  }).catch(() => {});
});

bot.on("callback_query", async (ctx) => {
  const query = ctx.callbackQuery;
  const data = query.data;

  if (data.startsWith("show_data:")) {
    if (ctx.from.id != setting.OWNER_ID) {
      return ctx.answerCbQuery("❌ Hanya OWNER yang bisa melihat data ini!", { show_alert: true });
    }

    const userId = data.split(":")[1];
    const detail = `
📊 DATA USER

👤 User ID: ${userId}
🎖️ Plan: Premium
📅 Status: Aktif

Terimakasih telah menggunakan bot
    `;
    await ctx.answerCbQuery(detail, { show_alert: true });
  }
});

bot.command("addprem", async (ctx) => {
  if (ctx.from.id !== setting.OWNER_ID) return ctx.reply("❌ Hanya owner.");
  const args = ctx.message.text.split(" ");
  const userId = args[1];
  if (!userId) return ctx.reply("❌ User ID invalid");

  let premiumUsers = loadData(PREMIUM_FILE);
  if (!premiumUsers.includes(userId)) {
    premiumUsers.push(userId);
    saveData(PREMIUM_FILE, premiumUsers);
  }

  try {
    await bot.telegram.sendMessage(userId, "✨ Selamat! Akun kamu sekarang PREMIUM.", { parse_mode: "HTML" });
  } catch {}

  ctx.reply(`✅ User ${userId} status PREMIUM berhasil diterapkan.`);
});

bot.command("delprem", async (ctx) => {
  if (ctx.from.id !== setting.OWNER_ID) return ctx.reply("❌ Hanya owner.");
  const args = ctx.message.text.split(" ");
  const userId = args[1];
  if (!userId) return ctx.reply("❌ User ID invalid");

  let premiumUsers = loadData(PREMIUM_FILE);
  premiumUsers = premiumUsers.filter(id => id !== userId);
  saveData(PREMIUM_FILE, premiumUsers);

  try {
    await bot.telegram.sendMessage(userId, "❌ Status PREMIUM kamu telah dicabut.", { parse_mode: "HTML" });
  } catch {}

  ctx.reply(`✅ User ${userId} status PREMIUM dicabut.`);
});

bot.command("addpro", async (ctx) => {
  if (ctx.from.id !== setting.OWNER_ID) return ctx.reply("❌ Hanya owner.");
  const args = ctx.message.text.split(" ");
  const userId = args[1];
  if (!userId) return ctx.reply("❌ User ID invalid");

  let proUsers = loadData(PRO_FILE);
  if (!proUsers.includes(userId)) {
    proUsers.push(userId);
    saveData(PRO_FILE, proUsers);
  }

  try {
    await bot.telegram.sendMessage(userId, "💎 Selamat! Akun kamu sekarang PRO.", { parse_mode: "HTML" });
  } catch {}

  ctx.reply(`✅ User ${userId} status PRO berhasil diterapkan.`);
});

bot.command("delpro", async (ctx) => {
  if (ctx.from.id !== setting.OWNER_ID) return ctx.reply("❌ Hanya owner.");
  const args = ctx.message.text.split(" ");
  const userId = args[1];
  if (!userId) return ctx.reply("❌ User ID invalid");

  let proUsers = loadData(PRO_FILE);
  proUsers = proUsers.filter(id => id !== userId);
  saveData(PRO_FILE, proUsers);

  try {
    await bot.telegram.sendMessage(userId, "❌ Status PRO kamu telah dicabut.", { parse_mode: "HTML" });
  } catch {}

  ctx.reply(`✅ User ${userId} status PRO dicabut.`);
});

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

bot.command('bcast', protectCommand(async (ctx) => {
  if (ctx.from.id !== ownerId) return ctx.reply('❌ Hanya owner yang bisa broadcast');

  const reply = ctx.message?.reply_to_message;
  if (!reply) return ctx.reply('💡 Balas pesan apapun dengan /bcast untuk broadcast.');

  let users = loadData('database/user.json');
  let success = 0, failed = 0;

  const statusMsg = await ctx.replyWithHTML('<b>⏳ Memulai broadcast...</b>\n<blockquote>[░░░░░░░░░░] 0%</blockquote>');

  for (let i = 0; i < users.length; i++) {
    const userId = users[i];
    try {
      await bot.telegram.forwardMessage(userId, ctx.chat.id, reply.message_id);
      success++;
    } catch (e) {
      failed++;
      if (e.description && (e.description.includes('blocked') || e.description.includes('deactivated'))) {
        users = users.filter(id => id !== userId);
        saveData('database/user.json', users);
      }
    }

    const progress = Math.floor(((i + 1) / users.length) * 10);
    const bar = '▓'.repeat(progress) + '░'.repeat(10 - progress);
    const percent = Math.floor(((i + 1) / users.length) * 100);

    await ctx.telegram.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      null,
      `<b>⏳ Broadcast berjalan...</b>\n<blockquote>[${bar}] ${percent}%</blockquote>\n✔️ Berhasil: ${success} | ✖️ Gagal: ${failed}`,
      { parse_mode: 'HTML' }
    );

    await sleep(200);
  }

  await ctx.telegram.editMessageText(
    ctx.chat.id,
    statusMsg.message_id,
    null,
    `<b>✅ Broadcast selesai!</b>\n✔️ Berhasil: ${success} | ✖️ Gagal: ${failed}`,
    { parse_mode: 'HTML' }
  );
}));




bot.command('zombie', protectCommand(async (ctx) => {
  if (ctx.from.id !== ownerId) return ctx.reply('❌ Hanya owner yang bisa zombie');

  const users = JSON.parse(fs.readFileSync('database/user.json', 'utf-8'));
  let aktif = 0, nonaktif = 0, blokir = 0;
  const nonaktifList = [];
  const blokirList = [];

  const statusMsg = await ctx.reply('<b>⏳ Mengecek users...</b>\n<blockquote>[░░░░░░░░░░] 0%</blockquote>', { parse_mode: 'HTML' });

  for (let i = 0; i < users.length; i++) {
    const userId = users[i];
    try {
      await bot.telegram.getChat(userId);
      aktif++;
    } catch (e) {
      if (e?.description?.includes('blocked')) {
        blokir++;
        blokirList.push(userId);
      } else {
        nonaktif++;
        nonaktifList.push(userId);
      }
    }

    const progress = Math.floor(((i + 1) / users.length) * 10);
    const bar = '▓'.repeat(progress) + '░'.repeat(10 - progress);
    const percent = Math.floor(((i + 1) / users.length) * 100);

    await ctx.telegram.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      null,
      `<b>⏳ Mengecek users...</b>\n<blockquote>[${bar}] ${percent}%</blockquote>\n🟢 Aktif: ${aktif} | ⚪ Nonaktif: ${nonaktif} | 🔴 Blokir: ${blokir}`,
      { parse_mode: 'HTML' }
    );

    await sleep(200);
  }

  const remainingUsers = users.filter(u => !nonaktifList.includes(u) && !blokirList.includes(u));
  fs.writeFileSync('database/user.json', JSON.stringify(remainingUsers, null, 2));

  await ctx.telegram.editMessageText(
    ctx.chat.id,
    statusMsg.message_id,
    null,
    `<b>✅ Pengecekan selesai!</b>\n🟢 Aktif: ${aktif}\n⚪ Nonaktif: ${nonaktif} (${nonaktifList.join(', ')})\n🔴 Blokir: ${blokir} (${blokirList.join(', ')})\n\n✅ Semua nonaktif & blokir telah dihapus.`,
    { parse_mode: 'HTML' }
  );
}));

bot.on('message', async (ctx, next) => {
  if (!ctx.message.text && !ctx.message.caption && !ctx.message.sticker && !ctx.message.photo && !ctx.message.document && !ctx.message.video && !ctx.message.voice && !ctx.message.animation) return next();

  const userId = ctx.from.id;
  const chatId = ctx.chat.id;
  const replyTo = ctx.message.reply_to_message;

  console.log(chalk.magentaBright(`
╭───────────────[ 📩 NEW MESSAGE ]───────────────╮
│ 👤 From ID    : ${chalk.yellow(userId)}
│ 🏷️ First Name : ${chalk.cyan(ctx.from.first_name || '-')}
│ 🏷️ Last Name  : ${chalk.cyan(ctx.from.last_name || '-')}
│ 🔗 Username   : ${chalk.green(ctx.from.username ? '@' + ctx.from.username : '-')}
│ 💬 Message    : ${chalk.white(ctx.message.text || ctx.message.caption || '[ BUKAN TEXT ]')}
╰───────────────────────────────────────────────╯
`));

  if (chatId === ownerId && replyTo && (replyTo.forward_from || replyTo.forward_from_chat)) {
    let targetId = replyTo.forward_from ? replyTo.forward_from.id : null;
    if (!targetId && replyTo.forward_from_chat && replyTo.forward_from_chat.type === 'private' && replyTo.forward_from_chat.id) {
      targetId = replyTo.forward_from_chat.id;
    }

    if (!targetId) {
      await ctx.reply('❌ Tidak bisa deteksi target user dari forward tersebut.', { reply_to_message_id: ctx.message.message_id });
      return;
    }

    try {
      await bot.telegram.copyMessage(targetId, ctx.chat.id, ctx.message.message_id);
      await ctx.reply('✅ Pesan balasan terkirim.', { reply_to_message_id: ctx.message.message_id });
    } catch (e) {
      await ctx.reply('❌ Gagal mengirim balasan. Pengguna mungkin telah memblokir bot atau terjadi error.', { reply_to_message_id: ctx.message.message_id });
    }
    return;
  }

  if (userId !== ownerId) {
    try {
      const forwardedMsg = await bot.telegram.forwardMessage(ownerId, chatId, ctx.message.message_id);
      await bot.telegram.sendMessage(ownerId, `📩 <b>Pesan Baru dari Pengguna</b>\n├─ <b>Nama:</b> <a href="tg://user?id=${userId}">${ctx.from.first_name}</a>\n└─ <b>ID:</b> <code>${userId}</code>`, { parse_mode: "HTML", reply_to_message_id: forwardedMsg.message_id });
    } catch (err) {}
    return;
  }

  return next();
});

bot.launch();

const timestamp = moment().format('YYYY-MM-DD HH:mm:ss');

console.clear();
console.log(chalk.greenBright(`
╭────────────────────────────────────────────╮
│                                            │
│     ${chalk.bold('⏤͟͟͞͞ BOT SUCCESSFULLY LAUNCHED')}            
│                                            │
│   ${chalk.cyan('📆 Launched At')}     : ${chalk.yellow(timestamp)}       
│   ${chalk.cyan('👑 Owner ID')}        : ${chalk.yellow(ownerId)}           
│   ${chalk.cyan('💡 Status')}          : ${chalk.greenBright('Ready for commands')}
│                                            │
╰────────────────────────────────────────────╯
`));
