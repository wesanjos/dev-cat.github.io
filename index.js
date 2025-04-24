const video = document.getElementById("webcam");
const statusEl = document.getElementById("status");

let model = null;
let isModelLoaded = false;
let detectionInterval = null;
let isDetectionActive = false;
let stream = null;

function showDebugLog(message, isError = false, code) {
  const debugEl = document.getElementById("debug-log");
  const logItem = document.createElement("div");
  logItem.textContent = `${new Date().toLocaleTimeString()}: ${message}`;
  logItem.style.color = isError ? "red" : "blue";
  debugEl.insertBefore(logItem, debugEl.firstChild);
  if (code) {
    logItem.innerHTML += ` <pre>${code}</pre>`;
  }
}

async function init() {
  showDebugLog("Iniciando aplicação...");

  await tf.setBackend("webgl");
  await tf.ready();

  showDebugLog("TensorFlow.js carregado");

  model = await cocoSsd.load();
  isModelLoaded = true;
  statusEl.textContent = "Modelo carregado. Iniciando câmera...";

  showDebugLog("Modelo carregado com sucesso");

  await setupCamera();
  
  runDetectionLoop();
}

async function setupCamera() {
  try {
    showDebugLog("Verificando suporte à câmera...");
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Seu navegador não suporta acesso à câmera');
    }

    showDebugLog("Verificando permissão da câmera...");
    statusEl.textContent = "Solicitando permissão para acessar a câmera...";

    const constraints = {
      video: {
        facingMode: "user",
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    };

    showDebugLog("Tentando acessar a câmera...");


    stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = stream;

    showDebugLog("Câmera configurada com sucesso");

    return new Promise((resolve) => {
      video.onloadedmetadata = () => {
        showDebugLog("Metadados do vídeo carregados");

        video.play();

        statusEl.textContent = "Câmera iniciada com sucesso!";

        resolve();
      };
    });
  } catch (error) {
    console.error("Erro ao acessar a câmera:", error);
    statusEl.textContent =
      "Erro ao acessar a câmera. Por favor, permita o acesso.";

      showDebugLog(`Erro na câmera: ${error.name} - ${error.message}`, true);


    // Tenta novamente com a câmera frontal se a traseira falhar
    if (error.name === "NotFoundError" || error.name === "NotAllowedError") {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false
        });
        video.srcObject = stream;
        return new Promise((resolve) => {
          video.onloadedmetadata = () => {
            showDebugLog("Metadados do vídeo carregados");
            video.play();
            statusEl.textContent = "Câmera iniciada com sucesso!";
            resolve();
          };
        });
      } catch (frontError) {
        console.error("Erro ao acessar câmera frontal:", frontError);
        statusEl.textContent = "Não foi possível acessar nenhuma câmera.";
        throw frontError;
      }
    }
    throw error;
  }
}

function toggleDetection() {
  isDetectionActive = !isDetectionActive;
  if (isDetectionActive) {
    showDebugLog("Iniciando ciclo de detecção");
    statusEl.textContent = "🔍 Iniciando detecção...";
    detectionInterval = setInterval(async () => {
      if (video.readyState === 4) {
        const predictions = await model.detect(video);
        showDebugLog(`Previsões: `, null, JSON.stringify(predictions));
        const foundCat = predictions.some(
          (p) => p.class === "cat" && p.score > 0.6
        );
        showDebugLog(`Encontrado gato: ${foundCat}`, null, JSON.stringify(foundCat));

        if (foundCat) {
          statusEl.textContent = "😺 Gato detectado!";
        } else {
          statusEl.textContent = "🔍 Nenhum gato detectado.";
        }
      }
    }, 1000 / 2);
  } else {
    showDebugLog("Pausando ciclo de detecção");
    statusEl.textContent = "⏸️ Detecção em pausa";
    if (detectionInterval) {
      clearInterval(detectionInterval);
      detectionInterval = null;
    }
  }
}

function runDetectionLoop() {
  // Inicia o primeiro ciclo
  toggleDetection();
  
  // Configura o ciclo de 1 minuto
  setInterval(() => {
    toggleDetection();
  }, 60000); // 60000ms = 1 minuto
}

function pararCamera() {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    video.srcObject = null;
    stream = null;
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    pararCamera(); // Aba perdeu o foco
  } else if (document.visibilityState === 'visible') {
    setupCamera(); // Aba voltou ao foco
  }
});

init();
