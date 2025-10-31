// ======================== DEPENDENCIAS ========================
const {
  Client, GatewayIntentBits,
  ActionRowBuilder, EmbedBuilder,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
  REST, Routes
} = require('discord.js');
const express = require('express');

// ================== VARIABLES DE ENTORNO (Render) ==================
const TOKEN = process.env.DISCORD_BOT_TOKEN || process.env.BOT_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID || process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID || null; // si lo pones, registro instantáneo por guild

// Opcional: roles a mencionar al publicar
const ROLE_POLICIAS_ID = process.env.ROLE_POLICIAS_ID || null;
const ROLE_DELINCUENTES_ID = process.env.ROLE_DELINCUENTES_ID || null;

// Puerto keep-alive web
const PORT = process.env.PORT || 10000;

if (!TOKEN || !CLIENT_ID) {
  console.error('❌ Faltan DISCORD_BOT_TOKEN y/o DISCORD_CLIENT_ID.');
  process.exit(1);
}

// ============================ KEEP-ALIVE ============================
const app = express();
app.get('/', (_req, res) => res.send('Bot is ALIVE! /dispo con normativa ✅'));
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Keep-Alive web en puerto ${PORT}`);
});

// =============== ACTOS DELICTUALES (según normativa) ===============
// NOTA: Solo mostramos líneas de OD como pediste (mínimo/máximo OD, etc.)
// Fuente: Loud RP - Actos delictuales (GitBook)
const ACTOS = {
  // --------- ACTOS PARA TODOS (usamos solo datos OD) ----------
  "asalto_civiles": {
    title: "Asalto a Civiles",
    minOD: null,
    maxOD: "12 Participantes",
    policia: "3 LSPD CONECTADOS (+1)",
    vehiculos: "UN vehículo para CIVILES / TRES para OD",
    armamento: "Todo tipo (restringido por lugar).",
    refuerzo: "NO permitido."
  },
  "venta_droga": {
    title: "Venta de Droga",
    minOD: null,
    maxOD: "1 Participantes",
    policia: "2 LSPD DISPONIBLES (+1)",
    vehiculos: "UN vehículo para CIVILES / UN vehículo para OD",
    armamento: "Bajo calibre.",
    refuerzo: "—"
  },
  "secuestro_civiles": {
    title: "Secuestro a Civiles",
    minOD: null,
    maxOD: "12 Participantes",
    policia: "5 LSPD CONECTADOS (+2)",
    vehiculos: "UN vehículo para CIVILES / TRES vehículos para OD",
    armamento: "Todo tipo (restringido por lugar).",
    refuerzo: "NO permitido."
  },
  "estafas": {
    title: "Estafas",
    minOD: null,
    maxOD: "Sin límite (respetando +2 de LSPD)",
    policia: "5 LSPD CONECTADOS (+2)",
    vehiculos: "UN vehículo para CIVILES / TRES vehículos para OD",
    armamento: "Todo tipo (restringido por lugar).",
    refuerzo: "NO permitido."
  },
  "cosecha_proc_venta_droga_armas": {
    title: "Cosecha/Procesado/Venta de Droga/Armas",
    minOD: null,
    maxOD: "16 Participantes",
    policia: "5 LSPD CONECTADOS (+1)",
    vehiculos: "UN vehículo para CIVILES / CUATRO vehículos para OD",
    armamento: "Todo tipo.",
    refuerzo: "NO permitido."
  },
  "robo_badulaque": {
    title: "Robo a Badulaque / Liquor Store",
    minOD: null,
    maxOD: "4 Participantes",
    policia: "7 LSPD CONECTADOS (+1)",
    vehiculos: "UN vehículo para CIVILES / UN vehículo para OD",
    armamento: "Todo tipo (restringido por lugar).",
    refuerzo: "NO permitido."
  },
  "robo_banco_fleeca": {
    title: "Robo a Banco Fleeca",
    minOD: null,
    maxOD: "8 Participantes",
    policia: "5 LSPD DISPONIBLES ó 10 LSPD CONECTADOS (+1)",
    vehiculos: "UN vehículo para CIVILES / DOS vehículos para OD",
    armamento: "Todo tipo (restringido por lugar).",
    refuerzo: "NO permitido."
  },

  // --------- EXCLUSIVOS OD ----------
  "blackmarket_tablet": {
    title: "Blackmarket Tablet (EXCLUSIVO OD)",
    minOD: "1 Participantes",
    maxOD: "4 Participantes",
    policia: "5 LSPD CONECTADOS (+1)",
    vehiculos: "UN vehículo.",
    armamento: "Dependiendo la zona, NO será necesario en persecución.",
    refuerzo: "NO permitido."
  },
  "graffiti": {
    title: "Uso de Graffiti (EXCLUSIVO OD)",
    minOD: null,
    maxOD: "Toda la OD DISPONIBLE (respetando +1 LSPD)",
    policia: "5 LSPD CONECTADOS (+1)",
    vehiculos: "—",
    armamento: "Arma blanca (melee).",
    refuerzo: "—"
  },
  "asalto_lspd": {
    title: "Asalto a LSPD (EXCLUSIVO OD)",
    minOD: "6 Participantes",
    maxOD: "16 Participantes",
    policia: "12 LSPD CONECTADOS (+2) ó 8 DISPONIBLES (+2)",
    vehiculos: "CUATRO vehículos.",
    armamento: "Todo tipo (restringido por lugar).",
    refuerzo: "Permitido solo para asaltantes (ver TyC)."
  },
  "secuestro_lspd": {
    title: "Secuestro a LSPD (EXCLUSIVO OD)",
    minOD: "6 Participantes",
    maxOD: "16 Participantes",
    policia: "15 LSPD CONECTADOS (+3) ó 10 DISPONIBLES (+3)",
    vehiculos: "CUATRO vehículos.",
    armamento: "Todo tipo (restringido por lugar).",
    refuerzo: "PERMITIDO bajo TyC."
  },
  "secuestro_sams": {
    title: "Secuestro a SAMS (EXCLUSIVO OD)",
    minOD: "6 Participantes",
    maxOD: "8 Participantes",
    policia: "11 LSPD DISPONIBLES (+1) • SAMS: 4 CONECTADOS",
    vehiculos: "HASTA 2 vehículos.",
    armamento: "Todo tipo (restringido por lugar).",
    refuerzo: "—"
  },
  "life_invader": {
    title: "Robo a Sucursal Life Invader (EXCLUSIVO OD)",
    minOD: "3 Participantes",
    maxOD: "6 Participantes",
    policia: "5 LSPD DISPONIBLES (+1)",
    vehiculos: "DOS vehículos.",
    armamento: "Bajo y medio calibre.",
    refuerzo: "PERMITIDO bajo TyC."
  },
  "banco_paleto": {
    title: "Robo a Banco Paleto (EXCLUSIVO OD)",
    minOD: "6 Participantes",
    maxOD: "8 Participantes",
    policia: "9 LSPD DISPONIBLES (+1)",
    vehiculos: "DOS vehículos.",
    armamento: "Medio calibre.",
    refuerzo: "NO permitido."
  },
  "joyeria_od": {
    title: "Robo a Joyería (EXCLUSIVO OD)",
    minOD: "6 Participantes",
    maxOD: "8 Participantes",
    policia: "10 LSPD DISPONIBLES (+2)",
    vehiculos: "DOS vehículos.",
    armamento: "Medio y alto calibre.",
    refuerzo: "PERMITIDO bajo TyC."
  },
  "humane": {
    title: "Robo a Humane (EXCLUSIVO OD)",
    minOD: "10 Participantes",
    maxOD: "16 Participantes",
    policia: "12 LSPD DISPONIBLES (+2)",
    vehiculos: "CUATRO vehículos.",
    armamento: "Medio y alto calibre.",
    refuerzo: "NO permitido."
  },
  "yate": {
    title: "Robo al Yate (EXCLUSIVO OD)",
    minOD: null,
    maxOD: "10 Participantes",
    policia: "12 LSPD DISPONIBLES (+2)",
    vehiculos: "TRES vehículos ACUÁTICOS.",
    armamento: "Medio calibre.",
    refuerzo: "NO permitido."
  },
  "banco_central_od": {
    title: "Robo a Banco Central (EXCLUSIVO OD)",
    minOD: "10 Participantes",
    maxOD: "20 Participantes",
    policia: "12 LSPD DISPONIBLES (+3)",
    vehiculos: "SEIS vehículos.",
    armamento: "Medio y alto calibre.",
    refuerzo: "PERMITIDO bajo TyC."
  }
};

// ============================ CLIENTE =============================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ]
});

// ======================= REGISTRO DE COMANDOS ======================
async function registerCommands() {
  const commands = [
    {
      name: 'dispo',
      description: 'Publica disponibilidad/objetivo RP.',
      options: [
        {
          name: 'zona',
          description: 'Escribe para buscar/filtrar la zona (autocomplete).',
          type: 3,            // STRING
          autocomplete: true, // autocompletado
          required: false
        }
      ]
    }
  ];

  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    if (GUILD_ID) {
      console.log('📝 Registrando /dispo en GUILD (rápido para pruebas)…');
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    } else {
      console.log('📝 Registrando /dispo GLOBAL (puede tardar unos minutos la primera vez)…');
      await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    }
    console.log('✅ Comando(s) registrado(s).');
  } catch (err) {
    console.error('❌ Error registrando comandos:', err);
  }
}

// =============================== HELPERS ===========================
const trunca = (s = '', max = 100) => (s.length <= max ? s : s.slice(0, max - 1) + '…');
const norm = (s = '') => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// Genera la descripción vertical (solo líneas OD)
function buildVerticalText(a) {
  const lines = [];
  if (a.minOD) lines.push(`Mínimo permitido a Organizaciones delictuales: ${a.minOD}.`);
  if (a.maxOD) lines.push(`Máximo permitido para Organizaciones delictuales: ${a.maxOD}.`);
  if (a.policia) lines.push(`Necesidad policial: ${a.policia}.`);
  if (a.vehiculos) lines.push(`Vehículos a utilizar: ${a.vehiculos}.`);
  if (a.armamento) lines.push(`Armamento permitido: ${a.armamento}`);
  if (a.refuerzo) lines.push(`Refuerzo: ${a.refuerzo}`);
  return lines.join("\n\n");
}

const makeEmbed = (act, userTag) =>
  new EmbedBuilder()
    .setTitle(`📢 Disponibilidad: ${act.title}`)
    .setColor('#5865F2')
    .setDescription(buildVerticalText(act))
    .setFooter({ text: `Solicitado por ${userTag}` })
    .setTimestamp(new Date());

const mentionPrefix =
  (ROLE_POLICIAS_ID || ROLE_DELINCUENTES_ID)
    ? `${ROLE_POLICIAS_ID ? `<@&${ROLE_POLICIAS_ID}> ` : ''}${ROLE_DELINCUENTES_ID ? `<@&${ROLE_DELINCUENTES_ID}> ` : ''}`
    : '';

// =============================== EVENTOS ===========================
client.once('ready', async () => {
  console.log(`✅ Bot conectado como ${client.user.tag}`);
  await registerCommands();
});

// ---- AUTOCOMPLETE: /dispo zona ----
client.on('interactionCreate', async (interaction) => {
  // Autocomplete
  if (interaction.isAutocomplete() && interaction.commandName === 'dispo') {
    try {
      const focused = interaction.options.getFocused() || '';
      const q = norm(focused);

      const allChoices = Object.entries(ACTOS).map(([key, a]) => ({
        name: a.title,
        value: key,
        haystack: norm(`${a.title} ${a.policia} ${a.armamento}`)
      }));

      let matches = allChoices;
      if (q.length > 0) {
        matches = allChoices
          .filter(c => c.haystack.includes(q))
          .sort((a, b) => a.haystack.indexOf(q) - b.haystack.indexOf(q));
      }

      await interaction.respond(matches.slice(0, 25).map(({ name, value }) => ({ name, value })));
    } catch (e) {
      console.error('❌ Error en autocomplete /dispo:', e);
    }
    return;
  }

  // Slash command
  if (interaction.isChatInputCommand() && interaction.commandName === 'dispo') {
    try {
      const zonaArg = interaction.options.getString('zona');

      // a) Sin argumento -> mostrar select con TODO
      if (!zonaArg) {
        const options = Object.entries(ACTOS).map(([key, a]) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(a.title)
            .setDescription(trunca(a.policia || a.armamento || "", 100))
            .setValue(key)
        );

        const select = new StringSelectMenuBuilder()
          .setCustomId('dispo_select')
          .setPlaceholder('Elige el acto/objetivo…')
          .addOptions(options);

        const row = new ActionRowBuilder().addComponents(select);

        await interaction.reply({
          content: 'Selecciona la disponibilidad / objetivo para publicarla:',
          components: [row],
          flags: 0 // público
        });
        return;
      }

      // b) Con argumento (key de ACTOS)
      const act = ACTOS[zonaArg];
      if (act) {
        await interaction.channel.send({
          content: mentionPrefix || undefined,
          embeds: [makeEmbed(act, interaction.user.tag)],
          allowedMentions: { parse: [], roles: [ROLE_POLICIAS_ID, ROLE_DELINCUENTES_ID].filter(Boolean) }
        });
        await interaction.reply({ content: `✅ Publicado: **${act.title}**`, flags: 64 }).catch(() => {});
        return;
      }

      // c) El user escribió pero no eligió (filtrar y mostrar select reducido)
      const q = norm(zonaArg);
      const filtered = Object.entries(ACTOS).filter(([_, a]) =>
        norm(`${a.title} ${a.policia} ${a.armamento}`).includes(q)
      );

      if (filtered.length === 0) {
        await interaction.reply({ content: '⚠️ No encontré actos con ese término.', flags: 64 });
        return;
      }

      const options = filtered.slice(0, 25).map(([key, a]) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(a.title)
          .setDescription(trunca(a.policia || a.armamento || "", 100))
          .setValue(key)
      );

      const select = new StringSelectMenuBuilder()
        .setCustomId('dispo_select')
        .setPlaceholder('Resultados de tu búsqueda…')
        .addOptions(options);

      const row = new ActionRowBuilder().addComponents(select);

      await interaction.reply({
        content: 'Elige una de las coincidencias para publicarla:',
        components: [row],
        flags: 0
      });
    } catch (err) {
      console.error('❌ Error en /dispo:', err);
      if (!interaction.replied) {
        await interaction.reply({ content: '❌ Error al procesar /dispo.', flags: 64 }).catch(() => {});
      }
    }
    return;
  }

  // Select menu
  if (interaction.isStringSelectMenu() && interaction.customId === 'dispo_select') {
    const choice = interaction.values?.[0];
    const act = ACTOS[choice];

    if (!act) {
      await interaction.reply({ content: '❌ Opción desconocida.', flags: 64 });
      return;
    }

    const embed = makeEmbed(act, interaction.user.tag);

    await interaction.channel.send({
      content: mentionPrefix || undefined,
      embeds: [embed],
      allowedMentions: { parse: [], roles: [ROLE_POLICIAS_ID, ROLE_DELINCUENTES_ID].filter(Boolean) }
    });

    await interaction.reply({ content: `✅ Publicado: **${act.title}**`, flags: 64 }).catch(() => {});
    return;
  }
});

// =============================== LOGIN =============================
client.login(TOKEN).catch(err => {
  console.error('❌ Error al conectar el bot. Verifica DISCORD_BOT_TOKEN.', err);
});
