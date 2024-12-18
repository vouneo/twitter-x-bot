import { TwitterApi } from "twitter-api-v2";
import fs from "fs/promises";
import cron from "node-cron";
import dotenv from "dotenv";

dotenv.config();

console.log("Verificando credenciales...");
console.log("API Key existe:", !!process.env.TWITTER_API_KEY);
console.log("API Secret existe:", !!process.env.TWITTER_API_SECRET);
console.log("Access Token existe:", !!process.env.TWITTER_ACCESS_TOKEN);
console.log("Access Secret existe:", !!process.env.TWITTER_ACCESS_TOKEN_SECRET);

// Configuración del cliente de Twitter
const client = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
});

// Variable para mantener el índice actual
let currentVideoIndex = 0;

// Función para verificar la autenticación
async function verifyCredentials() {
  try {
    console.log("Intentando verificar credenciales...");
    console.log(
      "Usando API Key que termina en:",
      process.env.TWITTER_API_KEY.slice(-4),
    );
    const result = await client.v2.me();
    console.log("Autenticación exitosa! Usuario:", result.data.username);
    return true;
  } catch (error) {
    console.error("Error de autenticación detallado:", {
      message: error.message,
      code: error.code,
      data: error.data,
      status: error.status,
      rateLimitLimit: error?.rateLimit?.limit,
      rateLimitRemaining: error?.rateLimit?.remaining,
    });
    return false;
  }
}

// Función para leer la lista de videos
async function getVideoList() {
  try {
    const data = await fs.readFile("videos.json", "utf8");
    return JSON.parse(data).videos;
  } catch (error) {
    console.error("Error al leer el archivo de videos:", error);
    return [];
  }
}

// Función para obtener el siguiente video
async function getNextVideo(videos) {
  // Si llegamos al final de la lista, volvemos al principio
  if (currentVideoIndex >= videos.length) {
    currentVideoIndex = 0;
  }

  // Guardamos el índice actual en un archivo para persistencia
  try {
    await fs.writeFile("currentIndex.txt", currentVideoIndex.toString());
  } catch (error) {
    console.error("Error al guardar el índice actual:", error);
  }

  // Obtenemos el video actual y aumentamos el índice para la próxima vez
  const video = videos[currentVideoIndex];
  currentVideoIndex++;

  return video;
}

// Función para cargar el último índice usado
async function loadLastIndex() {
  try {
    const data = await fs.readFile("currentIndex.txt", "utf8");
    currentVideoIndex = parseInt(data) || 0;
  } catch (error) {
    // Si el archivo no existe, empezamos desde 0
    currentVideoIndex = 0;
  }
}

// Función principal para postear
async function postVideo() {
  try {
    const videos = await getVideoList();
    if (videos.length === 0) {
      console.error("No hay videos disponibles");
      return;
    }

    const video = await getNextVideo(videos);
    const tweet = await client.v2.tweet(`${video.title} ${video.url}`);
    console.log("Tweet publicado exitosamente:", video.url);
    console.log("Índice actual:", currentVideoIndex);
    return tweet;
  } catch (error) {
    console.error("Error al publicar el tweet:", error);
  }
}

// Inicialización del bot
async function initBot() {
  await loadLastIndex();
  console.log("Índice inicial cargado:", currentVideoIndex);

  // Verificar autenticación antes de iniciar el cron
  const isAuthenticated = await verifyCredentials();
  if (isAuthenticated) {
    
    cron.schedule("0 8,16,22 * * *", () => {
      postVideo();
    }, {
      scheduled: true,
      timezone: "America/Santiago"
    });
    console.log(
      "Bot programado para publicar dos veces al día (10:00 y 18:00)...",
    );
  } else {
    console.log(
      "No se puede ejecutar el bot debido a problemas de autenticación",
    );
  }
}

// Iniciar el bot
initBot().catch((error) => {
  console.error("Error al iniciar el bot:", error);
});
