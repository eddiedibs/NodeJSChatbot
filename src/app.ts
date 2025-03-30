import { join } from 'path'
import { createBot, createProvider, createFlow, addKeyword, utils, EVENTS } from '@builderbot/bot'
import { MemoryDB as Database } from '@builderbot/bot'
import { BaileysProvider as Provider } from '@builderbot/provider-baileys'
import { Blob } from 'buffer'; // Required in Node.js
import fs from 'fs/promises';

import dotenv from 'dotenv';
dotenv.config();  // This will load the environment variables from the .env file


const PORT = process.env.PORT ?? 3008



const thankYouFlow = addKeyword<Provider, Database>(EVENTS.WELCOME)
    .addAnswer([
        '¡Perfecto!',
        '¡Gracias por participar!',
    ].join('\n'))

// const getDataFlow = addKeyword<Provider, Database>(utils.setEvent('GET_DATA_FLOW'))
const getDataFlow = addKeyword<Provider, Database>(EVENTS.WELCOME)
    .addAnswer([
        "¡🍷🎉 Bienvenid@ a nuestro Chatbot 🎉🍾!",
    ].join('\n'))
    .addAnswer([
        'Vamos a registrar tus datos.',
        'Por favor, escribe tu nombre:',
    ].join('\n'), { capture: true }, async (ctx, { state }) => {

        await state.update({ first_name: ctx.body })
    })
    .addAnswer([
        '¡Gracias! Ahora, tu apellido:',
    ].join('\n'), { capture: true }, async (ctx, { state }) => {

        await state.update({ last_name: ctx.body })
    })
    .addAnswer([
        'Escribe tu cédula:',
    ].join('\n'), { capture: true }, async (ctx, { state, fallBack }) => {

        const message = ctx.body;
        
        // Expresión regular para validar una cédula venezolana
        const cedulaRegex = /^\d+$/;
    
        // Validación de la cédula
        if (message && cedulaRegex.test(message)) {
            await state.update({ id_number: message });
        } else {
            return fallBack(
                [
                    'Debes ingresar una *cédula válida*',
                    'Ejemplo: 11929348123'
                ].join('\n')
            );
        }
    })
    .addAnswer([
        'Escribe tu número de teléfono:',
    ].join('\n'), { capture: true }, async (ctx, { state, fallBack }) => {

        const message = ctx.body;
        
        // Expresión regular para validar un número de teléfono venezolano
        const phoneRegex = /^(?:\+\d{1,3}\s?)?\d{1,4}[-.\s]?\d{3}[-.\s]?\d{4}$/;
    
        // Validación del número de teléfono
        if (message && phoneRegex.test(message)) {
            await state.update({ phone_number: message });
        } else {
            return fallBack(
                [
                    'Debes ingresar un *número de teléfono* válido',
                    'Ejemplo: 7871234567'
                ].join('\n')
            );
        }
    })
    .addAnswer([
        'Escribe tu correo electr\u00f3nico:',
    ].join('\n'), { capture: true }, async (ctx, { state, fallBack }) => {

        const message = ctx.body
        // Expresión regular para validar un correo electrónico
        const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

        // Validación del correo electrónico
        if (message && emailRegex.test(message)) {
            await state.update({ email: message });
        } else {
            return fallBack(
                [
                    'Debes ingresar un *email* válido',
                    'ejemplo: miemail@gmail.com'
                ].join('\n')
            );
        }
        
    })
    .addAnswer(`Ingresa una imagen:`, { capture: true }, async (ctx, { provider, state, fallBack }) => {

        const message = ctx.message;

        if (message && (message.imageMessage)) {
            try {
                const localPath = await provider.saveFile(ctx, {path:'./'})

                const fileBuffer = await fs.readFile(localPath);

                // Set the file details in state
                const fileName = localPath;
                // await state.update({ file_name_string: fileName });
                await state.update({ fileBuffer, fileName });

            } catch (error) {
                console.error('Error al descargar el archivo:', error);
            }
        } else{
            return fallBack('Debes ingresar una *imagen* válida')
        }
    })
    .addAction(async (_, { flowDynamic, state }) => {
        await flowDynamic(
            [
                'Verifica la informaci\u00f3n registrada:',
                `- Nombre: ${state.get('first_name')}`,
                `- Apellido: ${state.get('last_name')}`,
                `- C\u00e9dula: ${state.get('id_number')}`,
                `- Tel\u00e9fono: ${state.get('phone_number')}`,
                `- Email: ${state.get('email')}`,
                // `- Factura: ${state.get('file_name_string')}`,
            ].join('\n')
        )
    })
    .addAnswer([
            'Envía *S* para confirmar o *N* para editar los campos:',
            '\n',
            '(Autorizo que mis datos personales sean utilizados para recibir información promocional)',
        ].join('\n'), { capture: true }, async (ctx, { state, fallBack, gotoFlow }) => {
        const message = ctx.body.toLocaleLowerCase();
        const blob = new Blob([state.get('fileBuffer')], { type: "image/jpeg" }); // Convert Buffer to Blob
        const file = new File([blob], state.get('fileName'), { type: "image/jpeg" }); // Convert Blob to File

        // Create FormData and append values
        const formData = new FormData();
        formData.append("first_name", state.get('first_name'));
        formData.append("last_name", state.get('last_name'));
        formData.append("id_number", state.get('id_number'));
        formData.append("phone_number", state.get('phone_number'));
        formData.append("email", state.get('email'));
        formData.append("invoice_image", file); // Append buffer as a file

        if (message && (message == "s" || message == "n")) {
            if (message == "s"){
                const apiResponse = await fetch(process.env.API_URL + "/api/save_client", {
                    method: "POST",
                    body: formData,
                    headers: {
                        // Important: Do NOT set Content-Type manually, FormData does it automatically
                    },
                  });
                console.log(apiResponse);
                // If request was successful, delete the file
                if (apiResponse.ok) {
                    await fs.unlink(`${state.get('fileName')}`);
                    return gotoFlow(thankYouFlow);
                } else {
                    console.error("Failed to send file, not deleting.");
                }
            } else if (message == "n"){
                return gotoFlow(getDataFlow);

            }
        } else{
            return fallBack('Debes ingresar una *opción* válida')
        }
    })




const main = async () => {
    const adapterFlow = createFlow([getDataFlow])
    
    const adapterProvider = createProvider(Provider)
    const adapterDB = new Database()

    const { handleCtx, httpServer } = await createBot({
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB,
    })


    httpServer(+PORT)
}

main()
