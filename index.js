const {
  Client, GatewayIntentBits,
  ActionRowBuilder, EmbedBuilder,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
  REST, Routes
} = require('discord.js');
const express = require('express');

// ===== ENV =====
const TOKEN = process.env.DISCORD_BOT_TOKEN || process.env.BOT_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID || process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID || null;
const ROLE_POLICIAS_ID = process.env.ROLE_POLICIAS_ID || null;
const ROLE_DELINCUENTES_ID = process.env.ROLE_DELINCUENTES_ID || null;
const PORT = process.env.PORT || 10000;

if (!TOKEN || !CLIENT_ID) {
  console.error('❌ Faltan DISCORD_BOT_TOKEN y/o DISCORD_CLIENT_ID.');
  process.exit(1);
}

// ===== Keep Alive =====
const app = express();
app.get('/', (_req, res) => res.send('Bot /dispo activo ✅'));
app.listen(PORT, '0.0.0.0', () => console.log(`🌐 Keep-Alive en ${PORT}`));

// ===== Catálogo (edítalo libremente) =====
// Nota: donde no tengas números exactos, deja null y el campo no se mostrará.
// minMax: { min: 6, max: 8 } -> mostrará "6 a 8".
const ACTOS = {
  asalto_civiles: {
    title: "👛 Asalto a Civiles",
    minMax: null,
    policia: "3 LSPD CONECTADOS (+1)",
    vehiculos: "UN vehículo (civiles) / TRES (OD)",
    armamento: "Bajo/medio calibre",
    refuerzo: "NO permitido",
    calibre: "bajo/medio",
    accion: "asaltando a civiles en la vía pública"
  },
  secuestro_civiles: {
    title: "🎭 Secuestro a Civiles",
    minMax: null,
    policia: "5 LSPD CONECTADOS (+2)",
    vehiculos: "UN (civiles) / TRES (OD)",
    armamento: "Medio calibre",
    refuerzo: "NO permitido",
    calibre: "medio",
    accion: "retirando por la fuerza a un civil"
  },
  estafas: {
    title: "💼 Estafas",
    minMax: null,
    policia: "5 LSPD CONECTADOS (+2)",
    vehiculos: "UN (civiles) / TRES (OD)",
    armamento: "Bajo calibre",
    refuerzo: "NO permitido",
    calibre: "bajo",
    accion: "realizando estafas coordinadas"
  },
  venta_droga: {
    title: "🌿 Venta de Droga",
    minMax: null,
    policia: "2 LSPD DISPONIBLES (+1)",
    vehiculos: "UN (civiles) / UN (OD)",
    armamento: "Bajo calibre",
    refuerzo: "—",
    calibre: "bajo",
    accion: "vendiendo sustancia a terceros"
  },

  // Zonas rojas (divide por calibre)
  reco_bajo: {
    title: "🧺 Recolección de Droga (Bajo calibre)",
    minMax: null,
    policia: "5 LSPD CONECTADOS (+1)",
    vehiculos: "Hasta 1 (civiles) / Hasta 4 (OD)",
    armamento: "Bajo calibre",
    refuerzo: "NO permitido",
    calibre: "bajo",
    accion: "recolectando en zona roja"
  },
  reco_medio: {
    title: "🧺 Recolección de Droga (Medio calibre)",
    minMax: null,
    policia: "5 LSPD CONECTADOS (+1)",
    vehiculos: "Hasta 1 (civiles) / Hasta 4 (OD)",
    armamento: "Medio calibre",
    refuerzo: "NO permitido",
    calibre: "medio",
    accion: "recolectando en zona roja"
  },
  proc_bajo: {
    title: "🧪 Proceso de Droga (Bajo calibre)",
    minMax: null,
    policia: "5 LSPD CONECTADOS (+1)",
    vehiculos: "Hasta 1 (civiles) / Hasta 4 (OD)",
    armamento: "Bajo calibre",
    refuerzo: "NO permitido",
    calibre: "bajo",
    accion: "procesando en zona roja"
  },
  proc_medio: {
    title: "🧪 Proceso de Droga (Medio calibre)",
    minMax: null,
    policia: "5 LSPD CONECTADOS (+1)",
    vehiculos: "Hasta 1 (civiles) / Hasta 4 (OD)",
    armamento: "Medio calibre",
    refuerzo: "NO permitido",
    calibre: "medio",
    accion: "procesando en zona roja"
  },

  badulaque: {
    title: "🛒 Robo a Badulaque/Liquor",
    minMax: { min: 1, max: 4 },
    policia: "7 LSPD CONECTADOS (+1)",
    vehiculos: "UN (civiles) / UN (OD)",
    armamento: "Según lugar",
    refuerzo: "NO permitido",
    calibre: "bajo/medio",
    accion: "saliendo de un minimarket con botín"
  },
  fleeca: {
    title: "🏦 Robo a Banco Fleeca",
    minMax: { min: 1, max: 8 },
    policia: "5 DISPONIBLES o 10 CONECTADOS (+1)",
    vehiculos: "DOS vehículos",
    armamento: "Medio calibre",
    refuerzo: "NO permitido",
    calibre: "medio",
    accion: "forzando la bóveda de un Fleeca"
  },
  tablet: {
    title: "💻 Blackmarket Tablet (OD)",
    minMax: { min: 1, max: 4 },
    policia: "5 LSPD CONECTADOS (+1)",
    vehiculos: "UN vehículo",
    armamento: "Dependiendo la zona, NO necesario en persecución",
    refuerzo: "NO permitido",
    calibre: "bajo/medio",
    accion: "operando una tablet del mercado negro"
  },
  graffiti: {
    title: "🖌️ Graffiti (OD)",
    minMax: null,
    policia: "5 LSPD CONECTADOS (+1)",
    vehiculos: "—",
    armamento: "Arma blanca (melee)",
    refuerzo: "—",
    calibre: "bajo",
    accion: "marcando territorio con graffiti"
  },
  asalto_lspd: {
    title: "🚓 Asalto a LSPD (OD)",
    minMax: { min: 6, max: 16 },
    policia: "12 LSPD CONECTADOS (+2) o 8 DISPONIBLES (+2)",
    vehiculos: "CUATRO vehículos",
    armamento: "Todo tipo (lugar restringe)",
    refuerzo: "Permitido para asaltantes (TyC)",
    calibre: "medio/alto",
    accion: "emboscando a personal LSPD"
  },
  secuestro_lspd: {
    title: "👮‍♀️ Secuestro a LSPD (OD)",
    minMax: { min: 6, max: 16 },
    policia: "15 LSPD CONECTADOS (+3) o 10 DISPONIBLES (+3)",
    vehiculos: "CUATRO vehículos",
    armamento: "Todo tipo (lugar restringe)",
    refuerzo: "PERMITIDO (TyC)",
    calibre: "medio/alto",
    accion: "secuestrando a un efectivo LSPD"
  },
  secuestro_sams: {
    title: "🚑 Secuestro a SAMS (OD)",
    minMax: { min: 6, max: 8 },
    policia: "11 LSPD DISPONIBLES (+1) • SAMS: 4 CONECTADOS",
    vehiculos: "HASTA 2 vehículos",
    armamento: "Todo tipo (lugar restringe)",
    refuerzo: "—",
    calibre: "medio",
    accion: "subiendo por la fuerza a un miembro de SAMS"
  },
  life_invader: {
    title: "🏢 Robo a Life Invader (OD)",
    minMax: { min: 3, max: 6 },
    policia: "5 LSPD DISPONIBLES (+1)",
    vehiculos: "DOS vehículos",
    armamento: "Bajo/Medio calibre",
    refuerzo: "PERMITIDO (TyC)",
    calibre: "bajo/medio",
    accion: "irrumpiendo en una sucursal Life Invader"
  },
  paleto: {
    title: "🌲 Robo a Banco Paleto (OD)",
    minMax: { min: 6, max: 8 },
    policia: "9 LSPD DISPONIBLES (+1)",
    vehiculos: "DOS vehículos",
    armamento: "Medio calibre",
    refuerzo: "NO permitido",
    calibre: "medio",
    accion: "abriendo la bóveda de Paleto"
  },
  joyeria: {
    title: "💎 Robo a Joyería (OD)",
    minMax: { min: 6, max: 8 },
    policia: "10 LSPD DISPONIBLES (+2)",
    vehiculos: "DOS vehículos",
    armamento: "Medio y alto calibre",
    refuerzo: "PERMITIDO (TyC)",
    calibre: "medio/alto",
    accion: "rompiendo vitrinas de la joyería"
  },
  humane: {
    title: "🏭 Robo a Humane (OD)",
    minMax: { min: 10, max: 16 },
    policia: "12 LSPD DISPONIBLES (+2)",
    vehiculos: "CUATRO vehículos",
    armamento: "Medio y alto calibre",
    refuerzo: "NO permitido",
    calibre: "medio/alto",
    accion: "irrumpiendo en instalaciones de Humane"
  },
  yate: {
    title: "🛥️ Robo al Yate (OD)",
    minMax: null,
    policia: "12 LSPD DISPONIBLES (+2)",
    vehiculos: "TRES vehículos ACUÁTICOS",
    armamento: "Medio calibre",
    refuerzo: "NO permitido",
    calibre: "medio",
    accion: "subiéndose a un yate para sustraer valores"
  },
  banco_central: {
    title: "🏦 Robo a Banco Central (OD)",
    minMax: { min: 10, max: 20 },
    policia: "12 LSPD DISPONIBLES (+3)",
    vehiculos: "SEIS vehículos",
    armamento: "Medio y alto calibre",
    refuerzo: "PERMITIDO (TyC)",
    calibre: "medio/alto",
    accion: "iniciando un robo al banco central"
  }
};

// ===== Discord Client =====
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

// ===== Registro /dispo con autocomplete =====
async function registerCommands() {
  const commands = [{
    name: 'dispo',
    description: 'Publica disponibilidad/objetivo RP.',
    options: [{
      name: 'zona',
      description: 'Escribe para buscar/filtrar la zona (autocomplete).',
      type: 3,
      autocomplete: true,
      required: false
    }]
  }];
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  if (GUILD_ID) {
    console.log('📝 Registrando /dispo en GUILD…');
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
  } else {
    console.log('📝 Registrando /dispo GLOBAL…');
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
  }
  console.log('✅ Comando(s) registrado(s).');
}

// ===== Helpers =====
const trunca = (s = '', m = 100) => (s.length <= m ? s : s.slice(0, m - 1) + '…');
const norm = (s = '') => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function entornoAuto(acto) {
  const personas = acto.minMax ? `${acto.minMax.min}–${acto.minMax.max}` : "4–6";
  const veh = "sedán gris";
  const cal = (acto.calibre || "bajo").toLowerCase();
  return `Buenas señores oficiales, acabo de ver a ${personas} sujetos con ropa oscura, enmascarados, bajar de un ${veh}.
Portaban armas de ${cal} calibre y estarían ${acto.accion} (entrada y salida coordinadas).`;
}

const mentionPrefix =
  (ROLE_POLICIAS_ID || ROLE_DELINCUENTES_ID)
    ? `${ROLE_POLICIAS_ID ? `<@&${ROLE_POLICIAS_ID}> ` : ''}${ROLE_DELINCUENTES_ID ? `<@&${ROLE_DELINCUENTES_ID}> ` : ''}`
    : '';

function fieldLine(act) {
  const lines = [];
  if (act.minMax) lines.push(`🥷•**Mínimo permitido a Organizaciones delictuales:** ${act.minMax.min} a ${act.minMax.max}`);
  if (act.policia) lines.push(`\n🚨•**Necesidad policial:** ${act.policia}.`);
  if (act.vehiculos) lines.push(`\n🚗•**Vehículos a utilizar:** ${act.vehiculos}.`);
  if (act.armamento) lines.push(`\n🔫•**Armamento permitido:** ${act.armamento}.`);
  if (act.refuerzo) lines.push(`\n🧑‍🤝‍🧑•**Refuerzo:** ${act.refuerzo}.`);
  return lines.join('');
}

function entornoBloc(act) {
  return `✍️•**Entorno (dependiendo el robo o acción):**
Salida:
entrada:`;
}

function makeEmbed(act, userTag) {
  const desc = fieldLine(act);
  const autoTxt = entornoAuto(act);
  return new EmbedBuilder()
    .setTitle(`📢 Disponibilidad: ${act.title}`)
    .setColor('#5865F2')
    .setDescription(desc)
    .addFields(
      { name: '🗣️ Entorno (auto)', value: trunca(autoTxt, 1024) },
      { name: '📋 Copiar/pegar', value: entornoBloc(act) }
    )
    .setFooter({ text: `Solicitado por ${userTag}` })
    .setTimestamp(new Date());
}

// ===== Events =====
client.once('ready', async () => {
  console.log(`✅ Bot conectado como ${client.user.tag}`);
  await registerCommands();
});

client.on('interactionCreate', async (interaction) => {
  // Autocomplete
  if (interaction.isAutocomplete() && interaction.commandName === 'dispo') {
    try {
      const focused = interaction.options.getFocused() || '';
      const q = norm(focused);
      const allChoices = Object.entries(ACTOS).map(([key, a]) => ({
        name: a.title, value: key, haystack: norm(`${a.title} ${a.accion} ${a.armamento}`)
      }));
      const matches = (q ? allChoices.filter(c => c.haystack.includes(q)).sort((a,b)=>a.haystack.indexOf(q)-b.haystack.indexOf(q)) : allChoices)
        .slice(0, 25)
        .map(({ name, value }) => ({ name, value }));
      await interaction.respond(matches);
    } catch (e) { console.error('❌ Autocomplete /dispo:', e); }
    return;
  }

  // Slash command
  if (interaction.isChatInputCommand() && interaction.commandName === 'dispo') {
    try {
      const arg = interaction.options.getString('zona');

      if (!arg) {
        // mostrar select completo
        const opts = Object.entries(ACTOS).map(([key, a]) =>
          new StringSelectMenuOptionBuilder().setLabel(a.title).setDescription(trunca(a.accion, 100)).setValue(key)
        );
        const select = new StringSelectMenuBuilder().setCustomId('dispo_select').setPlaceholder('Elige el acto…').addOptions(opts);
        await interaction.reply({ content: 'Selecciona la disponibilidad / objetivo para publicarla:', components: [ new ActionRowBuilder().addComponents(select) ], flags: 0 });
        return;
      }

      const act = ACTOS[arg];
      if (act) {
        await interaction.channel.send({
          content: mentionPrefix || undefined,
          embeds: [ makeEmbed(act, interaction.user.tag) ],
          allowedMentions: { parse: [], roles: [ROLE_POLICIAS_ID, ROLE_DELINCUENTES_ID].filter(Boolean) }
        });
        await interaction.reply({ content: `✅ Publicado: **${act.title}**`, flags: 64 }).catch(()=>{});
        return;
      }

      // si escribió pero no eligió -> filtro
      const q = norm(arg);
      const filtered = Object.entries(ACTOS).filter(([_, a]) => norm(`${a.title} ${a.accion}`).includes(q));
      if (!filtered.length) return interaction.reply({ content: '⚠️ No encontré actos con ese término.', flags: 64 });
      const opts = filtered.slice(0,25).map(([key,a]) => new StringSelectMenuOptionBuilder().setLabel(a.title).setDescription(trunca(a.accion,100)).setValue(key));
      const select = new StringSelectMenuBuilder().setCustomId('dispo_select').setPlaceholder('Resultados de tu búsqueda…').addOptions(opts);
      await interaction.reply({ content: 'Elige una de las coincidencias para publicarla:', components: [ new ActionRowBuilder().addComponents(select) ], flags: 0 });
    } catch (err) {
      console.error('❌ /dispo:', err);
      if (!interaction.replied) await interaction.reply({ content: '❌ Error al procesar /dispo.', flags: 64 }).catch(()=>{});
    }
    return;
  }

  // Select menu
  if (interaction.isStringSelectMenu() && interaction.customId === 'dispo_select') {
    const choice = interaction.values?.[0];
    const act = ACTOS[choice];
    if (!act) return interaction.reply({ content: '❌ Opción desconocida.', flags: 64 });

    await interaction.channel.send({
      content: mentionPrefix || undefined,
      embeds: [ makeEmbed(act, interaction.user.tag) ],
      allowedMentions: { parse: [], roles: [ROLE_POLICIAS_ID, ROLE_DELINCUENTES_ID].filter(Boolean) }
    });
    await interaction.reply({ content: `✅ Publicado: **${act.title}**`, flags: 64 }).catch(()=>{});
  }
});

client.login(TOKEN).catch(err => console.error('❌ Login:', err));
