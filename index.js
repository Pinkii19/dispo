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
app.get('/', (_req, res) => res.send('Bot is ALIVE! /dispo con autocomplete ✅'));
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Keep-Alive web en puerto ${PORT}`);
});

// ====================== ZONAS / CONFIG EDITABLES ====================
const ZONAS_DISPO = {
  robo_fleca: {
    title: 'Robo a Fleca',
    police: '2 policías online recomendados',
    weapon: 'Armas cortas / no letales (RP)',
    participants: { delincuentes: '3–6', policias: '2+' },
    environment: 'Interior pequeño; tránsito peatonal alto',
    notes: 'Ventanas de escape cortas.'
  },
  banco_central: {
    title: 'Robo a Banco Central',
    police: '4+ policías y negociador',
    weapon: 'Armas largas / táctico (RP)',
    participants: { delincuentes: '6–12', policias: '4–8' },
    environment: 'Seguridad reforzada y cámaras',
    notes: 'Alto riesgo; coordinar roles por voz.'
  },
  joyeria: {
    title: 'Robo a Joyería',
    police: '2–3 policías',
    weapon: 'Armas cortas (RP)',
    participants: { delincuentes: '3–5', policias: '2–3' },
    environment: 'Local con escaparates y salida limitada',
    notes: 'Táctica rápida.'
  },
  zona_droga: {
    title: 'Zona de Recolección de Droga',
    police: 'Patrullas aleatorias; verificar dispo',
    weapon: 'No letales o cortas (RP)',
    participants: { delincuentes: '2–4', policias: '1–3' },
    environment: 'Calles oscuras con patrullaje frecuente',
    notes: 'Posibles emboscadas; tener refuerzos.'
  },
  asaltar_civiles: {
    title: 'Asaltar Civiles (RP)',
    police: '1–2 policías en ronda mínima',
    weapon: 'No letales / amenazas (RP)',
    participants: { delincuentes: '2–3', policias: '1–2' },
    environment: 'Vías públicas y parques',
    notes: 'Usar reglas anti-griefing.'
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
          autocomplete: true, // <--- autocompletado
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

const makeEmbed = (zona, userTag) =>
  new EmbedBuilder()
    .setTitle(`📢 Disponibilidad: ${zona.title}`)
    .setColor('#5865F2')
    .addFields(
      { name: 'Policía requerida', value: zona.police, inline: true },
      { name: 'Tipo de arma (RP)', value: zona.weapon, inline: true },
      { name: 'Participantes (Delincuentes)', value: zona.participants.delincuentes, inline: true },
      { name: 'Participantes (Policías)', value: zona.participants.policias, inline: true },
      { name: 'Entorno', value: zona.environment, inline: false },
      { name: 'Notas', value: zona.notes, inline: false }
    )
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

      const allChoices = Object.entries(ZONAS_DISPO).map(([key, z]) => ({
        name: z.title,
        value: key,
        haystack: norm(`${z.title} ${z.environment} ${z.notes}`)
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

      // a) Sin argumento -> mostrar select completo
      if (!zonaArg) {
        const options = Object.entries(ZONAS_DISPO).map(([key, z]) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(z.title)
            .setDescription(trunca(z.environment, 100))
            .setValue(key)
        );

        const select = new StringSelectMenuBuilder()
          .setCustomId('dispo_select')
          .setPlaceholder('Elige la misión/objetivo…')
          .addOptions(options);

        const row = new ActionRowBuilder().addComponents(select);

        await interaction.reply({
          content: 'Selecciona la disponibilidad / objetivo para publicarla:',
          components: [row],
          flags: 0 // público
        });
        return;
      }

      // b) Con argumento (esperamos la key de ZONAS_DISPO devuelta por autocomplete)
      const zona = ZONAS_DISPO[zonaArg];
      if (zona) {
        await interaction.channel.send({
          content: mentionPrefix || undefined,
          embeds: [makeEmbed(zona, interaction.user.tag)],
          allowedMentions: { parse: [], roles: [ROLE_POLICIAS_ID, ROLE_DELINCUENTES_ID].filter(Boolean) }
        });
        await interaction.reply({ content: `✅ Publicado: **${zona.title}**`, flags: 64 }).catch(() => {});
        return;
      }

      // c) Si el user escribió pero no eligió (no coincide la key), filtramos y mostramos select reducido
      const q = norm(zonaArg);
      const filtered = Object.entries(ZONAS_DISPO).filter(([_, z]) =>
        norm(`${z.title} ${z.environment} ${z.notes}`).includes(q)
      );

      if (filtered.length === 0) {
        await interaction.reply({ content: '⚠️ No encontré zonas con ese término.', flags: 64 });
        return;
      }

      const options = filtered.slice(0, 25).map(([key, z]) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(z.title)
          .setDescription(trunca(z.environment, 100))
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

  // Select menu de /dispo
  if (interaction.isStringSelectMenu() && interaction.customId === 'dispo_select') {
    const choice = interaction.values?.[0];
    const zona = ZONAS_DISPO[choice];

    if (!zona) {
      await interaction.reply({ content: '❌ Opción desconocida.', flags: 64 });
      return;
    }

    const embed = makeEmbed(zona, interaction.user.tag);

    await interaction.channel.send({
      content: mentionPrefix || undefined,
      embeds: [embed],
      allowedMentions: { parse: [], roles: [ROLE_POLICIAS_ID, ROLE_DELINCUENTES_ID].filter(Boolean) }
    });

    await interaction.reply({ content: `✅ Publicado: **${zona.title}**`, flags: 64 }).catch(() => {});
    return;
  }
});

// =============================== LOGIN =============================
client.login(TOKEN).catch(err => {
  console.error('❌ Error al conectar el bot. Verifica DISCORD_BOT_TOKEN.', err);
});
