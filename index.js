const { 
    Client, GatewayIntentBits, ModalBuilder, TextInputBuilder, TextInputStyle, 
    ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, UserSelectMenuBuilder, 
    REST, Routes, userMention
} = require('discord.js');

// === CONFIGURACIÓN GLOBAL ===
// ID del rol de Mecánico Encargado para la restricción del botón.
const ROL_ENCARGADO_ID = '1428870031051067452'; 

// === INICIO: CÓDIGO KEEP-ALIVE (Hosting 24/7) ===
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

function keepAlive() {
    app.get('/', (req, res) => {
        res.send('Bot is ALIVE! Running on Render');
    });

    app.listen(port, () => {
        console.log(`\n🌐 Servidor web Keep-Alive corriendo en el puerto: ${port}`);
    });
}
// === FIN: CÓDIGO KEEP-ALIVE ===


const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        // **IMPORTANTE:** Necesario para buscar los nombres de los miembros (usuarios)
        GatewayIntentBits.GuildMembers, 
    ]
});

// Variables de Entorno
const TOKEN = process.env.DISCORD_BOT_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;

if (!TOKEN || !CLIENT_ID) {
    console.error('❌ Error: DISCORD_BOT_TOKEN y DISCORD_CLIENT_ID deben estar configurados en las variables de entorno');
    throw new Error('Variables de entorno faltantes');
}

// Almacenamiento temporal de datos del formulario (se borra al reiniciar)
const formData = new Map();


// === FUNCIÓN PARA MODALS PAGINADOS (MECÁNICO ENCARGADO) ===
/**
 * Crea y muestra un Modal con hasta 5 campos para la entrada de cantidades.
 * @param {import('discord.js').Interaction} interaction La interacción actual.
 * @param {Object} data Los datos de la sesión almacenados en formData.
 */
async function createAndShowModal(interaction, data) {
    const guildId = interaction.guildId || interaction.message.guildId;
    
    const start = data.currentModalIndex * 5;
    const mecanicosSlice = data.mecanicosPendientes.slice(start, start + 5);

    if (mecanicosSlice.length === 0) {
        if (interaction.deferred || interaction.replied) {
             await interaction.editReply({ content: '❌ Error interno: No hay más mecánicos que procesar.', components: [] });
        } else {
             await interaction.reply({ content: '❌ Error interno: No hay más mecánicos que procesar.', ephemeral: true, components: [] });
        }
        return; 
    }

    const totalMecanicos = data.mecanicosPendientes.length;
    const totalModals = Math.ceil(totalMecanicos / 5);
    const modalTitle = `📦 Entregas (${data.currentModalIndex + 1}/${totalModals})`;

    const cantidadModal = new ModalBuilder()
        .setCustomId('cantidadEntregaModal')
        .setTitle(modalTitle.substring(0, 45)); 

    const rows = [];
    
    // Necesario para buscar los nombres de los usuarios (requiere el intent GuildMembers)
    const guild = await interaction.client.guilds.fetch(guildId); 

    for (const userId of mecanicosSlice) {
        const member = await guild.members.fetch(userId).catch(() => null); 
        const name = member ? (member.nickname || member.user.username) : `Usuario Desconocido (${userId})`; 

        const cantidadInput = new TextInputBuilder()
            .setCustomId(`cantidad_${userId}`)
            .setLabel(`Cantidad a ${name.substring(0, 45)}:`)
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder(`Coleccionables para ${name}`);

        rows.push(new ActionRowBuilder().addComponents(cantidadInput));
    }
    
    if (rows.length > 0) {
        cantidadModal.addComponents(...rows);
        
        // showModal DEBE ser la primera respuesta.
        await interaction.showModal(cantidadModal); 
    } else {
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: '❌ Error al generar formulario de cantidades.', components: [] });
        } else {
            await interaction.reply({ content: '❌ Error al generar formulario de cantidades.', ephemeral: true, components: [] });
        }
        formData.delete(interaction.user.id);
    }
}
// =========================================================================


client.once('ready', async () => {
    console.log(`✅ Bot conectado como ${client.user.tag}`);

    // 1. Definición del comando slash
    const commands = [{ name: 'inventario', description: 'Abre el formulario de inventario' }];

    // 2. Registro de comandos slash (Global)
    const rest = new REST({ version: '10' }).setToken(TOKEN);

    try {
        console.log('📝 Registrando comandos slash globalmente...');
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('🎉 Comandos registrados globalmente y listos para usar');
    } catch (error) {
        console.error('❌ Error al registrar comandos:', error);
    }
});

client.on('interactionCreate', async interaction => {
    
    // --- LÓGICA DE COMANDO /INVENTARIO (Botones de Rol Inicial) ---
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'inventario') {
            
            // Botón de MECÁNICO (siempre visible)
            const buttonMecanico = new ButtonBuilder()
                .setCustomId('rol_mecanico')
                .setLabel('🧑‍🔧 Soy mecánico')
                .setStyle(ButtonStyle.Success);

            // Botón de ENCARGADO (siempre visible para que todos puedan pulsarlo)
            const buttonEncargado = new ButtonBuilder()
                .setCustomId('rol_encargado')
                .setLabel('🎴 Soy mecánico encargado')
                .setStyle(ButtonStyle.Primary);

            // Crear la fila de botones con ambos.
            const buttonRow = new ActionRowBuilder().addComponents(buttonMecanico, buttonEncargado);

            await interaction.reply({
                content: '👋 ¡Hola! Por favor, selecciona tu rol para comenzar el reporte de inventario:',
                components: [buttonRow],
                ephemeral: true
            });
        }
    }

    // --- LÓGICA DE MODAL SUBMIT (Manejo de Formularios) ---
    if (interaction.isModalSubmit()) {
        
        // 1. Lógica del MECÁNICO NORMAL
        if (interaction.customId === 'inventarioModal') {
            // ... (Guarda datos y muestra selección de Jefe)
            const cantidad = interaction.fields.getTextInputValue('cantidad');
            const recibidos = interaction.fields.getTextInputValue('recibidos');
            const sobrante = interaction.fields.getTextInputValue('sobrante');

            formData.set(interaction.user.id, {
                cantidad, recibidos, sobrante,
                rol: 'mecanico', 
                userId: interaction.user.id,
                userTag: interaction.user.tag
            });

            const jefeSelect = new UserSelectMenuBuilder().setCustomId('select_jefe').setPlaceholder('👩‍💼 Selecciona el Jefe que entregó').setMinValues(1).setMaxValues(1);
            const noEntregoButton = new ButtonBuilder().setCustomId('jefe_no_entrego').setLabel('❌ No entregó').setStyle(ButtonStyle.Secondary);

            const row1 = new ActionRowBuilder().addComponents(jefeSelect);
            const row2 = new ActionRowBuilder().addComponents(noEntregoButton);

            await interaction.reply({
                content: '📝 Ahora selecciona al **Jefe que entregó** los coleccionables:',
                components: [row1, row2],
                ephemeral: true
            });
        }
        
        // 2. Lógica del MECÁNICO ENCARGADO (Primer Modal)
        else if (interaction.customId === 'inventarioEncargadoModal') {
            // ... (Guarda datos y muestra selección de Jefe)
            const entregadosJefe = interaction.fields.getTextInputValue('entregados_jefe');
            const ventaPropia = interaction.fields.getTextInputValue('venta_propia');
            const sobraron = interaction.fields.getTextInputValue('sobraron');

            formData.set(interaction.user.id, {
                entregadosJefe, ventaPropia, sobraron,
                rol: 'encargado', 
                userId: interaction.user.id,
                userTag: interaction.user.tag
            });

            const jefeSelect = new UserSelectMenuBuilder().setCustomId('select_jefe').setPlaceholder('👩‍💼 Selecciona el Jefe que entregó').setMinValues(1).setMaxValues(1);
            const noEntregoButton = new ButtonBuilder().setCustomId('jefe_no_entrego').setLabel('❌ No entregó').setStyle(ButtonStyle.Secondary);

            const row1 = new ActionRowBuilder().addComponents(jefeSelect);
            const row2 = new ActionRowBuilder().addComponents(noEntregoButton);

            await interaction.reply({
                content: '📝 Ahora selecciona al **Jefe que entregó** los coleccionables:',
                components: [row1, row2],
                ephemeral: true
            });
        }

        // 3. Lógica del MECÁNICO ENCARGADO (Segundo Modal de Cantidades Múltiples)
        else if (interaction.customId === 'cantidadEntregaModal') { 
            
            await interaction.deferUpdate(); // Aplazar para tener tiempo de procesar

            const data = formData.get(interaction.user.id);
            
            if (data && data.rol === 'encargado' && data.mecanicosPendientes) {
                
                // 1. Recoger las cantidades del Modal actual
                const start = data.currentModalIndex * 5;
                const mecanicosSlice = data.mecanicosPendientes.slice(start, start + 5);
                
                for (const userId of mecanicosSlice) {
                    const cantidad = interaction.fields.getTextInputValue(`cantidad_${userId}`);
                    if (cantidad) {
                        data.entregasMecanicos[userId] = cantidad; 
                    }
                }
                
                // 2. Preparar el siguiente paso
                data.currentModalIndex++;
                formData.set(interaction.user.id, data);
                
                const totalMecanicos = data.mecanicosPendientes.length;
                const totalModals = Math.ceil(totalMecanicos / 5);

                // 3. Revisar si hay más modales pendientes 
                if (data.currentModalIndex < totalModals) {
                    
                    const continueButton = new ButtonBuilder()
                        .setCustomId('continue_modal_encargado')
                        .setLabel(`Continuar Formulario (${data.currentModalIndex + 1}/${totalModals})`)
                        .setStyle(ButtonStyle.Primary);

                    const row = new ActionRowBuilder().addComponents(continueButton);
                    
                    await interaction.editReply({ 
                        content: `✅ Cantidades guardadas. Por favor, presiona **Continuar Formulario** para el siguiente grupo de mecánicos.`, 
                        components: [row] 
                    });
                    
                } else {
                    // 4. Si es el último modal, generar el reporte final
                    
                    const jefeDisplay = data.jefe === 'no_entrego' ? 'No entregó' : userMention(data.jefe);
                    const totalEntregadoFinal = Object.values(data.entregasMecanicos).reduce((sum, current) => sum + (parseInt(current) || 0), 0);
                    
                    let detalleEntregas = Object.keys(data.entregasMecanicos).map(userId => 
                        `- ${userMention(userId)}: ${data.entregasMecanicos[userId]}`
                    ).join('\n');
                    
                    if (detalleEntregas.length === 0) detalleEntregas = 'N/A';
                    
                    const description = 
                        `🛠️ **Rol de Reporte:** Mecánico Encargado\n\n` +
                        `👩‍💼 **Coleccionables Jefe:**\n${data.entregadosJefe}\n\n` +
                        `💰 **Venta Propia:**\n${data.ventaPropia}\n\n` +
                        `📦 **Sobrante Total:**\n${data.sobraron}\n\n` +
                        `**Total Entregado a Mecánicos:**\n${totalEntregadoFinal}\n\n` +
                        `**Detalle de Entregas:**\n${detalleEntregas}\n\n` +
                        `👩‍💼 **Nombre del Jefe que entregó:**\n${jefeDisplay}`;
                        
                    const embed = new EmbedBuilder()
                        .setColor('#FA6625') 
                        .setTitle('📋 Reporte de Inventario (Encargado)') 
                        .setDescription(description)
                        .setTimestamp()
                        .setFooter({ text: `Enviado por ${data.userTag}` });

                    const buttonSi = new ButtonBuilder().setCustomId('confirmar_si').setLabel('✅ Sí, devolví').setStyle(ButtonStyle.Success);
                    const buttonNo = new ButtonBuilder().setCustomId('confirmar_no').setLabel('❌ No he devuelto').setStyle(ButtonStyle.Danger);
                    const buttonRow = new ActionRowBuilder().addComponents(buttonSi, buttonNo);

                    await interaction.editReply({
                        content: '⚠️ **Última confirmación:** ¿Devolviste lo que te sobró de coleccionables?',
                        embeds: [embed],
                        components: [buttonRow]
                    });
                }

            } else {
                await interaction.editReply({ content: '❌ Error: Los datos de la sesión han expirado o faltan.', components: [] });
                formData.delete(interaction.user.id);
            }
        }
    }

    // --- LÓGICA DE SELECT MENUS ---
    if (interaction.isUserSelectMenu()) {
        
        // 1. SELECCIÓN DE JEFE (Común a ambos roles)
        if (interaction.customId === 'select_jefe') {
            
            await interaction.deferUpdate(); 

            const jefeSeleccionado = interaction.values[0];
            const data = formData.get(interaction.user.id);

            if (data) {
                data.jefe = jefeSeleccionado;
                formData.set(interaction.user.id, data);
                
                if (data.rol === 'encargado') {
                    // Flujo ENCARGADO: Sigue con Selección Múltiple
                    const mecanicosSelect = new UserSelectMenuBuilder().setCustomId('select_mecanicos_multi').setPlaceholder('👥 Selecciona a los Mecánicos a los que entregaste (Múltiple)').setMinValues(1).setMaxValues(25); 
                    const noEntregoMecanicosButton = new ButtonBuilder().setCustomId('mecanicos_no_entregue').setLabel('❌ No entregué a ningún Mecánico').setStyle(ButtonStyle.Secondary);
                    
                    const row1 = new ActionRowBuilder().addComponents(mecanicosSelect);
                    const row2 = new ActionRowBuilder().addComponents(noEntregoMecanicosButton); 

                    await interaction.editReply({ 
                        content: '📝 Ahora selecciona a **todas las personas** a las que entregaste coleccionables:',
                        components: [row1, row2]
                    });
                
                } else {
                    // Flujo MECÁNICO NORMAL: Sigue con Selección Única 
                    const mecanicoSelect = new UserSelectMenuBuilder().setCustomId('select_mecanico').setPlaceholder('👨‍🔧 Selecciona el Mecánico Encargado').setMinValues(1).setMaxValues(1);
                    const noEntregoMecanicoButton = new ButtonBuilder().setCustomId('mecanico_no_entrego').setLabel('❌ No entregó').setStyle(ButtonStyle.Secondary);

                    const row1 = new ActionRowBuilder().addComponents(mecanicoSelect);
                    const row2 = new ActionRowBuilder().addComponents(noEntregoMecanicoButton);

                    await interaction.editReply({
                        content: '📝 Ahora selecciona al **Mecánico Encargado**:',
                        components: [row1, row2]
                    });
                }
            }
        // 2. SELECCIÓN MÚLTIPLE DE MECÁNICOS (Solo Encargado)
        } else if (interaction.customId === 'select_mecanicos_multi') {
            
            // showModal es la respuesta, no debe haber deferral previo.
            
            const mecanicosSeleccionados = interaction.values;
            const data = formData.get(interaction.user.id);

            if (data) {
                data.mecanicosPendientes = mecanicosSeleccionados;
                data.entregasMecanicos = {};
                data.currentModalIndex = 0;
                
                formData.set(interaction.user.id, data);

                await createAndShowModal(interaction, data); 
            }
        
        // 3. SELECCIÓN DE MECÁNICO ÚNICA (Solo Mecánico Normal)
        } else if (interaction.customId === 'select_mecanico') {
            
            await interaction.deferUpdate(); 

            const mecanicoSeleccionado = interaction.values[0];
            const data = formData.get(interaction.user.id);

            if (data) {
                data.mecanico = mecanicoSeleccionado;

                const jefeDisplay = data.jefe === 'no_entrego' ? 'No entregó' : userMention(data.jefe);
                const mecanicoDisplay = data.mecanico === 'no_entrego' ? 'No entregó' : userMention(data.mecanico);

                const embed = new EmbedBuilder()
                    .setColor('#F57DCF') 
                    .setTitle('📋 Reporte de Inventario') 
                    .setDescription(
                        `👷 **Rol de Reporte:** Mecánico\n\n` +
                        `💰 **Cantidad vendida:**\n${data.cantidad}\n\n` +
                        `🧸 **Coleccionables recibidos:**\n${data.recibidos}\n\n` +
                        `📦 **Sobrante:**\n${data.sobrante}\n\n` +
                        `👩‍💼 **Nombre del Jefe que entregó:**\n${jefeDisplay}\n\n` +
                        `👨‍🔧 **Nombre del Mecanico Encargado:**\n${mecanicoDisplay}`
                    )
                    .setTimestamp()
                    .setFooter({ text: `Enviado por ${data.userTag}` });

                const buttonSi = new ButtonBuilder().setCustomId('confirmar_si').setLabel('✅ Sí, devolví').setStyle(ButtonStyle.Success);
                const buttonNo = new ButtonBuilder().setCustomId('confirmar_no').setLabel('❌ No he devuelto').setStyle(ButtonStyle.Danger);
                const buttonRow = new ActionRowBuilder().addComponents(buttonSi, buttonNo);

                await interaction.editReply({
                    content: '⚠️ **Última confirmación:** ¿Devolviste lo que te sobró de coleccionables?',
                    embeds: [embed],
                    components: [buttonRow]
                });
            }
        }
    }

    // --- LÓGICA DE BOTONES ---
    if (interaction.isButton()) {
        
        // === BOTÓN INICIO: SOY MECÁNICO / ENCARGADO (Abren Modal) ===
        if (interaction.customId === 'rol_mecanico') {
            const modal = new ModalBuilder().setCustomId('inventarioModal').setTitle('📋 Formulario de Inventario');

            const cantidadInput = new TextInputBuilder().setCustomId('cantidad').setLabel('💰 Cantidad vendida:').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('Indica la cantidad de coleccionables que vendiste (ej: 3, 5, 10, 11)');
            const recibidosInput = new TextInputBuilder().setCustomId('recibidos').setLabel('🧸 Coleccionables recibidos:').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('¿Cuántos coleccionables te pasaron para la venta?');
            const sobranteInput = new TextInputBuilder().setCustomId('sobrante').setLabel('📦 Sobrante:').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('¿Cuántos coleccionables te sobraron?');

            const row1 = new ActionRowBuilder().addComponents(cantidadInput);
            const row2 = new ActionRowBuilder().addComponents(recibidosInput);
            const row3 = new ActionRowBuilder().addComponents(sobranteInput);

            modal.addComponents(row1, row2, row3);
            await interaction.showModal(modal);
        }
        
        else if (interaction.customId === 'rol_encargado') {
            
            // **RESTRICCIÓN DE ROL:** Verifica si el usuario tiene el rol de Encargado
            const isEncargado = interaction.member.roles.cache.has(ROL_ENCARGADO_ID);
            
            if (!isEncargado) {
                return interaction.reply({
                    content: '❌ **ACCESO DENEGADO.** No tienes el rol de "Mecánico Encargado". Solo los usuarios con el rol específico pueden abrir este formulario.',
                    ephemeral: true
                });
            }
            
            // Si SÍ tiene el rol, abre el modal de Encargado
            const modalEncargado = new ModalBuilder().setCustomId('inventarioEncargadoModal').setTitle('🛠️ Reporte Encargado');

            const entregadosInput = new TextInputBuilder().setCustomId('entregados_jefe').setLabel('👩‍💼 Coleccionables entregados por Jefe:').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('Cantidad que te pasó el Jefe');
            const ventaPropiaInput = new TextInputBuilder().setCustomId('venta_propia').setLabel('💰 Cantidad de venta propia:').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('Indica tu venta personal (ej: 1, 2, 3)');
            const sobraronInput = new TextInputBuilder().setCustomId('sobraron').setLabel('📦 Coleccionables sobrantes:').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('¿Cuántos coleccionables te sobraron en total?');

            const row1 = new ActionRowBuilder().addComponents(entregadosInput);
            const row2 = new ActionRowBuilder().addComponents(ventaPropiaInput);
            const row3 = new ActionRowBuilder().addComponents(sobraronInput);

            modalEncargado.addComponents(row1, row2, row3);
            await interaction.showModal(modalEncargado);
        }
        
        // === BOTÓN CONTINUAR FORMULARIO ENCARGADO (Paginación) ===
        else if (interaction.customId === 'continue_modal_encargado') {
            const data = formData.get(interaction.user.id);

            if (data && data.rol === 'encargado' && data.mecanicosPendientes) {
                await createAndShowModal(interaction, data); 
            } else {
                await interaction.reply({ content: '❌ La sesión ha expirado. Por favor, inicia de nuevo con /inventario.', ephemeral: true });
                formData.delete(interaction.user.id);
            }
        }
        
        // === LÓGICA: BOTÓN DE "NO ENTREGUÉ A NINGÚN MECÁNICO" (Encargado) ===
        else if (interaction.customId === 'mecanicos_no_entregue') {
            
            await interaction.deferUpdate(); 

            const data = formData.get(interaction.user.id);

            if (data && data.rol === 'encargado') {
                data.entregasMecanicos = {};
                data.mecanicosPendientes = [];
                
                const jefeDisplay = data.jefe === 'no_entrego' ? 'No entregó' : userMention(data.jefe);
                const totalEntregadoFinal = 0;
                const detalleEntregas = 'Ningún coleccionable fue entregado a Mecánicos.';
                
                const description = 
                    `🛠️ **Rol de Reporte:** Mecánico Encargado\n\n` +
                    `👩‍💼 **Coleccionables Jefe:**\n${data.entregadosJefe}\n\n` +
                    `💰 **Venta Propia:**\n${data.ventaPropia}\n\n` +
                    `📦 **Sobrante Total:**\n${data.sobraron}\n\n` +
                    `**Total Entregado a Mecánicos:**\n${totalEntregadoFinal}\n\n` +
                    `**Detalle de Entregas:**\n${detalleEntregas}\n\n` + 
                    `👩‍💼 **Nombre del Jefe que entregó:**\n${jefeDisplay}`;
                    
                const embed = new EmbedBuilder().setColor('#FA6625').setTitle('📋 Reporte de Inventario (Encargado)').setDescription(description).setTimestamp().setFooter({ text: `Enviado por ${data.userTag}` });

                const buttonSi = new ButtonBuilder().setCustomId('confirmar_si').setLabel('✅ Sí, devolví').setStyle(ButtonStyle.Success);
                const buttonNo = new ButtonBuilder().setCustomId('confirmar_no').setLabel('❌ No he devuelto').setStyle(ButtonStyle.Danger);
                const buttonRow = new ActionRowBuilder().addComponents(buttonSi, buttonNo);

                await interaction.editReply({
                    content: '⚠️ **Última confirmación:** ¿Devolviste lo que te sobró de coleccionables?',
                    embeds: [embed],
                    components: [buttonRow]
                });

            } else {
                await interaction.editReply({ content: '❌ La sesión ha expirado. Por favor, inicia de nuevo con /inventario.', components: [] });
                formData.delete(interaction.user.id);
            }
        }
        
        // --- BOTÓN JEFE: NO ENTREGÓ (Común a ambos) ---
        else if (interaction.customId === 'jefe_no_entrego') {
            
            await interaction.deferUpdate(); 

            const data = formData.get(interaction.user.id);

            if (data) {
                data.jefe = 'no_entrego';
                formData.set(interaction.user.id, data);
                
                if (data.rol === 'encargado') {
                    const mecanicosSelect = new UserSelectMenuBuilder().setCustomId('select_mecanicos_multi').setPlaceholder('👥 Selecciona a los Mecánicos a los que entregaste (Múltiple)').setMinValues(1).setMaxValues(25); 
                    const noEntregoMecanicosButton = new ButtonBuilder().setCustomId('mecanicos_no_entregue').setLabel('❌ No entregué a ningún Mecánico').setStyle(ButtonStyle.Secondary);

                    const row1 = new ActionRowBuilder().addComponents(mecanicosSelect);
                    const row2 = new ActionRowBuilder().addComponents(noEntregoMecanicosButton); 

                    await interaction.editReply({ 
                        content: '📝 Ahora selecciona a **todas las personas** a las que entregaste coleccionables:',
                        components: [row1, row2]
                    });
                } else {
                    const mecanicoSelect = new UserSelectMenuBuilder().setCustomId('select_mecanico').setPlaceholder('👨‍🔧 Selecciona el Mecánico Encargado').setMinValues(1).setMaxValues(1);
                    const noEntregoMecanicoButton = new ButtonBuilder().setCustomId('mecanico_no_entrego').setLabel('❌ No entregó').setStyle(ButtonStyle.Secondary);

                    const row1 = new ActionRowBuilder().addComponents(mecanicoSelect);
                    const row2 = new ActionRowBuilder().addComponents(noEntregoMecanicoButton);

                    await interaction.editReply({
                        content: '📝 Ahora selecciona al **Mecánico Encargado**:',
                        components: [row1, row2]
                    });
                }
            }
        // --- BOTÓN MECÁNICO: NO ENTREGÓ (Solo Mecánico Normal) ---
        } else if (interaction.customId === 'mecanico_no_entrego') {
            
            await interaction.deferUpdate(); 

            const data = formData.get(interaction.user.id);

            if (data && data.rol === 'mecanico') { 
                data.mecanico = 'no_entrego';

                const jefeDisplay = data.jefe === 'no_entrego' ? 'No entregó' : userMention(data.jefe);
                const mecanicoDisplay = 'No entregó';

                const embed = new EmbedBuilder()
                    .setColor('#F57DCF') 
                    .setTitle('📋 Reporte de Inventario') 
                    .setDescription(
                        `👷 **Rol de Reporte:** Mecánico\n\n` +
                        `💰 **Cantidad vendida:**\n${data.cantidad}\n\n` +
                        `🧸 **Coleccionables recibidos:**\n${data.recibidos}\n\n` +
                        `📦 **Sobrante:**\n${data.sobrante}\n\n` +
                        `👩‍💼 **Nombre del Jefe que entregó:**\n${jefeDisplay}\n\n` +
                        `👨‍🔧 **Nombre del Mecanico Encargado:**\n${mecanicoDisplay}`
                    )
                    .setTimestamp()
                    .setFooter({ text: `Enviado por ${data.userTag}` });

                const buttonSi = new ButtonBuilder().setCustomId('confirmar_si').setLabel('✅ Sí, devolví').setStyle(ButtonStyle.Success);
                const buttonNo = new ButtonBuilder().setCustomId('confirmar_no').setLabel('❌ No he devuelto').setStyle(ButtonStyle.Danger);
                const buttonRow = new ActionRowBuilder().addComponents(buttonSi, buttonNo);

                await interaction.editReply({
                    content: '⚠️ **Última confirmación:** ¿Devolviste lo que te sobró de coleccionables?',
                    embeds: [embed],
                    components: [buttonRow]
                });
            }
        // --- BOTÓN CONFIRMAR: SÍ/NO DEVOLVÍ (Publicación final) ---
        } else if (interaction.customId === 'confirmar_si' || interaction.customId === 'confirmar_no') {
            
            const reporteEmbed = interaction.message.embeds[0];

            const contenidoFinal = (interaction.customId === 'confirmar_si') ? 
                `✅ **REPORTE PUBLICADO** (Devuelto)\n**Finalizado por** <@${interaction.user.id}>. ¡Gracias por tu responsabilidad y compromiso! 💗` :
                `⚠️ **REPORTE PUBLICADO** (NO Devuelto)\n**Finalizado por** <@${interaction.user.id}>. ⚠️ Por favor, contáctate con un jefe para devolver los coleccionables.`;
            
            const mensajeFinal = (interaction.customId === 'confirmar_si') ? 
                `✅ **¡Reporte publicado y finalizado!** Puedes cerrar este mensaje.` :
                '⚠️ **¡Reporte publicado con advertencia!** Por favor, devuélvelos pronto. Puedes cerrar este mensaje.';


            // 1. Enviar el reporte como un MENSAJE PÚBLICO y permanente
            await interaction.channel.send({
                content: contenidoFinal,
                embeds: [reporteEmbed],
                components: []
            });

            // 2. Editar el mensaje temporal para dar la confirmación final al usuario
            await interaction.update({
                content: mensajeFinal,
                embeds: [],
                components: []
            });

            formData.delete(interaction.user.id);
        }
    }
});

// === INICIO DEL BOT ===
keepAlive(); 
client.login(TOKEN);
