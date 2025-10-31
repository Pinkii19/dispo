// === DEPENDENCIAS ===
const {
  Client, GatewayIntentBits,
  ActionRowBuilder, EmbedBuilder,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
  REST, Routes
} = require('discord.js');
const express = require('express');

// ====================================================================
// === CONFIGURACIÓN CRÍTICA (VARIABLES DE ENTORNO) ===
// ====================================================================
const TOKEN = process.env.DISCORD_BOT_TOKEN || process.env.BOT_TOKEN; // tu token del bot
const CLIENT_ID = process.env.DISCORD_CLIENT_ID || process.env.CLIENT_ID; // application id
const GUILD_ID = process.env.GUILD_ID || null; // opcional: para registrar por guild en pruebas

// Roles opcionales para pingear cuando se publique la dispo
const ROLE_POLICIAS_ID = process.env.ROLE_POLICIAS_ID || null;
const ROLE_DELINCUENTES_ID = process.env.ROLE_DELINCUENTES_ID || null;

// Puerto para el keep-alive (Render)
const PORT = process.env.PORT || 10000;

// Validaciones mínimas
if (!TOKEN || !CLIENT_ID) {
  console.error('❌ Faltan variables: DISCORD_BOT_TOKEN y DISCORD_CLIENT_ID.');
  process.exit(1);
}

// ====================================================================
// === KEEP-ALIVE (Render / Uptime) ===
// ====================================================================
const app = express();
app.get('/', (_req, res) => res.send('Bot is ALIVE! /dispo listo ✅'));
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Keep-Alive web en puerto ${PORT}`);
});

// ====================================================================
// === ZONAS / CONFIG (EDITA A TU GUSTO) ===
// ====================================================================
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

// ====================================================================
// === CLIENTE DISCORD ===
// ====================================================================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ]
});

// ====================================================================
// === REGISTRO DE COMANDOS (GLOBAL o GUILD) ===
// ====================================================================
async function registerCommands() {
  const commands = [
    { name: 'dispo', description: 'Muestra menú para publicar disponibilidad/objetivo RP.' }
  ];
  const rest = new REST({ version: '10' }).setToken(TOKEN);

  try {
    if (GUILD_ID) {
      console.log('📝 Registrando /dispo en GUILD (rápido para pruebas)…');
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    } else {
      console.log('📝 Registrando /dispo GLOBAL (puede tardar unos minutos)…');
      await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    }
    console.log('✅ Comando(s) registrado(s).');
  } catch (err) {
    console.error('❌ Error registrando comandos:', err);
  }
}

// ====================================================================
// === HELPERS ===
// ====================================================================
const trunca = (s = '', max = 90) => (s.length <= max ? s : s.slice(0, max - 1) + '…');

// ====================================================================
// === EVENTOS ===
// ====================================================================
client.once('ready', async () => {
  console.log(`✅ Bot conectado como ${client.user.tag}`);
  await registerCommands();
});

// Interacciones
client.on('interactionCreate', async (interaction) => {
  try {
    // ------------------ /dispo ------------------
    if (interaction.isChatInputCommand() && interaction.commandName === 'dispo') {
      // Construimos el select con todas las zonas
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

      // Respuesta PÚBLICA (visible para todos)
      await interaction.reply({
        content: 'Selecciona la disponibilidad / objetivo para publicarla:',
        components: [row],
        // estilo que usas: flags: 0 => público; flags: 64 => efímero
        flags: 0
      });
      return;
    }

    // ---------- SELECT MENU: publicar embed ----------
    if (interaction.isStringSelectMenu() && interaction.customId === 'dispo_select') {
      const choice = interaction.values?.[0];
      const zona = ZONAS_DISPO[choice];

      if (!zona) {
        await interaction.reply({ content: '❌ Opción desconocida.', flags: 64 });
        return;
      }

      const embed = new EmbedBuilder()
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
        .setFooter({ text: `Solicitado por ${interaction.user.tag}` })
        .setTimestamp(new Date());

      // Mensaje opcional con ping a roles si configuraste IDs
      const prefixPing =
        (ROLE_POLICIAS_ID || ROLE_DELINCUENTES_ID)
          ? `${ROLE_POLICIAS_ID ? `<@&${ROLE_POLICIAS_ID}> ` : ''}${ROLE_DELINCUENTES_ID ? `<@&${ROLE_DELINCUENTES_ID}> ` : ''}`
          : '';

      // Publicar embed PÚBLICO en el canal
      await interaction.channel.send({
        content: prefixPing || undefined,
        embeds: [embed],
        allowedMentions: {
          parse: [], // evita @everyone/@here
          roles: [ROLE_POLICIAS_ID, ROLE_DELINCUENTES_ID].filter(Boolean)
        }
      });

      // Confirmación efímera para quien seleccionó
      await interaction.reply({ content: `✅ Publicado: **${zona.title}**`, flags: 64 }).catch(() => {});
      return;
    }

  } catch (err) {
    console.error('⚠️ Error en interactionCreate:', err);
    if (interaction && !interaction.replied) {
      try {
        await interaction.reply({ content: '❌ Error al procesar la interacción.', flags: 64 });
      } catch (_) {}
    }
  }
});

// Login
client.login(TOKEN).catch(err => {
  console.error('❌ Error al conectar el bot. Verifica DISCORD_BOT_TOKEN.', err);
});
