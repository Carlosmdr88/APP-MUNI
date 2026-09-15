/*
=========================================================
 APP.JS - REGISTRO DE CONTROL
 FASE 01 - CÓDIGO ORDENADO

 ESTRUCTURA:

 01. Variables y configuración
 02. Inicialización
 03. Fotografías
 04. Navegación
 05. Notificaciones
 06. Formulario y registro
 07. Cola de espera
 08. Detalle del registro
 09. Estados visuales
 10. Comunicación con Power Automate
 11. Polling
 12. Historial
 13. Vista de imágenes
 14. Configuración
 15. Reloj
=========================================================
*/

// =====================================================
// 01. VARIABLES Y CONFIGURACIÓN GENERAL
// =====================================================

// =====================================================
// CONVERTIR TEXTO A MAYÚSCULA
// =====================================================

function convertToUppercase(input) {
  input.value = input.value.toUpperCase();
}

// ----- Fotografías -----

let photosArray = [null, null, null, null, null];

// ----- Registro actualmente seleccionado -----

let currentRecordId = null;

// ----- Datos preparados antes de enviar -----

let pendingPayloadData = null;

// ----- Temporizadores de consulta -----

let pollingInterval = null;

let queuePollingInterval = null;

// ----- Cola almacenada en el dispositivo -----

let subjectsQueue = JSON.parse(localStorage.getItem("subjects_queue")) || [];

// =====================================================
// URL PARA ENVIAR REGISTROS
// =====================================================
//
// IMPORTANTE:
// Pega aquí la URL que YA tienes en tu app.js original.
//
// Primero busca si existe una URL guardada.
// Si no existe, utiliza la URL predeterminada.
//
// =====================================================

const DEFAULT_WEBHOOK_URL =
  "https://default6cf2221cc6bd484781777f57b05330.6b.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/758af806a6fc432aae55cddad7947437/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=EOAZbzDEi-JEdRYBZegenftRJliSSjqk60c8-_3Wl78";

let webhookUrl = localStorage.getItem("pa_webhook_url") || DEFAULT_WEBHOOK_URL;

// =====================================================
// URL PARA CONSULTAR EL ESTADO
// =====================================================
//
// Pega aquí la segunda URL que tenías como statusUrl.
//
// =====================================================

const statusUrl =
  "https://default6cf2221cc6bd484781777f57b05330.6b.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/a4165f55850d496ea752fc8f53f91475/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=PQoTgyWRjHkQX8xrEkoAeVo3vIin4W8OKZEYSDvkxJ4";

// =====================================================
// 02. INICIALIZACIÓN DE LA APLICACIÓN
// =====================================================

document.addEventListener("DOMContentLoaded", () => {
  // Crear los 5 espacios para fotografías
  createPhotoSlots();

  // Actualizar contador de la cola
  updateBadge();

  // Mostrar registros guardados
  renderQueue();

  // Mostrar hora inmediatamente
  updateClock();

  // ---------------------------------------------------
  // CONFIGURACIÓN
  // ---------------------------------------------------
  //
  // Aunque quitamos el engranaje del index,
  // comprobamos si el campo todavía existe.
  //
  // Así evitamos errores si posteriormente
  // eliminamos el modal de configuración.
  // ---------------------------------------------------

  const webhookInput = document.getElementById("setting-webhook-url");

  if (webhookInput) {
    webhookInput.value = webhookUrl;
  }
});

// =====================================================
// 03. SISTEMA DE FOTOGRAFÍAS
// =====================================================

// -----------------------------------------------------
// Crear los 5 espacios de fotografías
// -----------------------------------------------------

function createPhotoSlots() {
  const container = document.getElementById("photo-slots-container");

  if (!container) {
    return;
  }

  container.innerHTML = "";

  for (let i = 0; i < 5; i++) {
    const slot = document.createElement("div");

    slot.id = `slot-${i}`;

    // Las primeras 3 fotografías se toman
    // principalmente con cámara.
    //
    // Las últimas 2 pueden utilizarse como apoyo.

    const isCameraSlot = i < 3;

    const slotColorClass = isCameraSlot
      ? "bg-emerald-950/40 border-emerald-500/40 hover:border-emerald-400"
      : "bg-amber-950/40 border-amber-500/40 hover:border-amber-400";

    const iconColorClass = isCameraSlot ? "text-emerald-300" : "text-amber-300";

    slot.className = `
      aspect-square
      rounded-2xl
      border-2
      border-dashed
      flex
      flex-col
      items-center
      justify-center
      cursor-pointer
      overflow-hidden
      relative
      group
      transition-all
      shadow-inner
      ${slotColorClass}
    `;

    slot.innerHTML = `

      <span
        id="slot-empty-${i}"
        class="${iconColorClass} text-base group-hover:text-sky-400"
      >

        <i class="fa-solid fa-camera"></i>

      </span>


      <img
        id="slot-preview-${i}"
        class="
          hidden
          absolute
          inset-0
          w-full
          h-full
          object-cover
          z-20
        "
        src=""
        alt="Foto ${i + 1}"
      />


      <button
        id="slot-remove-${i}"
        class="
          hidden
          absolute
          top-1
          right-1
          bg-red-600/90
          text-white
          w-5
          h-5
          rounded-lg
          flex
          items-center
          justify-center
          z-30
        "
      >

        <i
          class="fa-solid fa-xmark text-[10px]"
        ></i>

      </button>

    `;

    // Abrir cámara / selector de archivo
    if (i < 3) {
      slot.addEventListener("click", () => {
        triggerPhotoSlot(i);
      });
    }

    container.appendChild(slot);

    // Botón para eliminar fotografía

    const removeButton = slot.querySelector("button");

    removeButton.addEventListener("click", (event) => {
      removePhotoSlot(event, i);
    });
  }
}

// -----------------------------------------------------
// Activar input de fotografía
// -----------------------------------------------------

function triggerPhotoSlot(index) {
  const input = document.getElementById(`input-file-${index}`);

  if (!input) {
    return;
  }

  input.click();
}

// -----------------------------------------------------
// Procesar fotografía seleccionada
// -----------------------------------------------------

function handlePhotoSlotChange(index) {
  const input = document.getElementById(`input-file-${index}`);

  if (!input) {
    return;
  }

  const file = input.files[0];

  if (!file) {
    return;
  }

  showToast(
    "Procesando",

    "Ajustando fotografía en alta calidad para el envío...",

    false,
  );

  const reader = new FileReader();

  reader.onload = function (event) {
    const img = new Image();

    img.src = event.target.result;

    img.onload = function () {
      const canvas = document.createElement("canvas");

      let width = img.width;

      let height = img.height;

      // Tamaño máximo de imagen

      const MAX_SIZE = 1200;

      // -------------------------------------------------
      // Reducir tamaño manteniendo proporciones
      // -------------------------------------------------

      if (width > height) {
        if (width > MAX_SIZE) {
          height *= MAX_SIZE / width;

          width = MAX_SIZE;
        }
      } else {
        if (height > MAX_SIZE) {
          width *= MAX_SIZE / height;

          height = MAX_SIZE;
        }
      }

      canvas.width = width;

      canvas.height = height;

      const ctx = canvas.getContext("2d");

      ctx.drawImage(
        img,

        0,

        0,

        width,

        height,
      );

      // Comprimir imagen en JPEG

      const compressedBase64 = canvas.toDataURL("image/jpeg", 0.92);

      photosArray[index] = compressedBase64;

      // -------------------------------------------------
      // Mostrar vista previa
      // -------------------------------------------------

      const preview = document.getElementById(`slot-preview-${index}`);

      const emptyState = document.getElementById(`slot-empty-${index}`);

      const removeBtn = document.getElementById(`slot-remove-${index}`);

      if (preview) {
        preview.src = compressedBase64;

        preview.classList.remove("hidden");
      }

      if (emptyState) {
        emptyState.classList.add("hidden");
      }

      if (removeBtn) {
        removeBtn.classList.remove("hidden");
      }

      showToast(
        "Foto Lista",

        "Imagen optimizada con éxito.",

        false,
      );
    };
  };

  reader.readAsDataURL(file);
}

// -----------------------------------------------------
// Eliminar una fotografía
// -----------------------------------------------------

function removePhotoSlot(event, index) {
  event.stopPropagation();

  photosArray[index] = null;

  const input = document.getElementById(`input-file-${index}`);

  if (input) {
    input.value = "";
  }

  const preview = document.getElementById(`slot-preview-${index}`);

  const emptyState = document.getElementById(`slot-empty-${index}`);

  const removeBtn = document.getElementById(`slot-remove-${index}`);

  if (preview) {
    preview.classList.add("hidden");
  }

  if (emptyState) {
    emptyState.classList.remove("hidden");
  }

  if (removeBtn) {
    removeBtn.classList.add("hidden");
  }
}

// -----------------------------------------------------
// Limpiar las 5 fotografías
// -----------------------------------------------------

function resetAllPhotoSlots() {
  photosArray = [null, null, null, null, null];

  for (let i = 0; i < 5; i++) {
    const input = document.getElementById(`input-file-${i}`);

    const preview = document.getElementById(`slot-preview-${i}`);

    const emptyState = document.getElementById(`slot-empty-${i}`);

    const removeBtn = document.getElementById(`slot-remove-${i}`);

    if (input) {
      input.value = "";
    }

    if (preview) {
      preview.classList.add("hidden");
    }

    if (emptyState) {
      emptyState.classList.remove("hidden");
    }

    if (removeBtn) {
      removeBtn.classList.add("hidden");
    }
  }
}

// =====================================================
// 04. NAVEGACIÓN ENTRE PANTALLAS
// =====================================================

function goToScreen(screenId) {
  const screens = ["screen-capture", "screen-queue", "screen-status"];

  // Ocultar todas las pantallas

  screens.forEach((id) => {
    const screen = document.getElementById(id);

    if (screen) {
      screen.classList.add("hidden");
    }
  });

  // Ocultar modales principales

  const successModal = document.getElementById("modal-success");

  if (successModal) {
    successModal.classList.add("hidden");
  }

  const warningModal = document.getElementById("modal-warning-confirm");

  if (warningModal) {
    warningModal.classList.add("hidden");
  }

  // Mostrar pantalla solicitada

  const destination = document.getElementById(screenId);

  if (destination) {
    destination.classList.remove("hidden");
  }

  // ---------------------------------------------------
  // Si estamos en la cola,
  // iniciar consulta automática
  // ---------------------------------------------------

  if (screenId === "screen-queue") {
    startQueuePolling();

    renderQueue();
  } else {
    stopQueuePolling();
  }

  // ---------------------------------------------------
  // Si salimos del detalle,
  // detener consulta individual
  // ---------------------------------------------------

  if (screenId !== "screen-status") {
    stopPolling();
  }
}

// =====================================================
// CONTADOR DE COLA
// =====================================================

function updateBadge() {
  const pendingAndAlerts = subjectsQueue.filter(
    (subject) =>
      subject.Estado === "Pendiente" || subject.Estado === "Volver a confirmar",
  ).length;

  const badge = document.getElementById("queue-count-badge");

  if (badge) {
    badge.innerText = pendingAndAlerts;
  }
}

// =====================================================
// 05. SISTEMA DE NOTIFICACIONES
// =====================================================

function showToast(title, message, isError = true) {
  const toast = document.getElementById("toast-notification");

  if (!toast) {
    return;
  }

  const icon = document.getElementById("toast-icon");

  const titleElement = document.getElementById("toast-title");

  const messageElement = document.getElementById("toast-message");

  if (titleElement) {
    titleElement.innerText = title;
  }

  if (messageElement) {
    messageElement.innerText = message;
  }

  // ---------------------------------------------------
  // Error
  // ---------------------------------------------------

  if (isError) {
    toast.classList.remove("bg-emerald-500/95");

    toast.classList.add("bg-red-500/95");

    if (icon) {
      icon.className = "fa-solid fa-circle-exclamation";
    }
  } else {
    // -------------------------------------------------
    // Mensaje correcto
    // -------------------------------------------------

    toast.classList.remove("bg-red-500/95");

    toast.classList.add("bg-emerald-500/95");

    if (icon) {
      icon.className = "fa-solid fa-circle-check";
    }
  }

  // Mostrar

  toast.classList.remove(
    "-translate-y-24",

    "opacity-0",
  );

  // Ocultar después de 4 segundos

  setTimeout(() => {
    toast.classList.add(
      "-translate-y-24",

      "opacity-0",
    );
  }, 4000);
}

// =====================================================
// 06. FORMULARIO Y CREACIÓN DEL REGISTRO
// =====================================================

function checkFormBeforeSubmit() {
  const name = document.getElementById("input-name").value.trim();

  const docId = document.getElementById("input-id").value.trim();

  const dob = document.getElementById("input-dob").value.trim();

  const nationality = document.getElementById("input-nationality").value.trim();

  const district = document.getElementById("input-district").value.trim();

  const location = document.getElementById("input-location").value.trim();

  const activePhotos = photosArray.filter((photo) => photo !== null);

  // ---------------------------------------------------
  // Comprobar campos vacíos
  // ---------------------------------------------------

  const emptyFields = [];

  if (!name) {
    emptyFields.push("• Nombre Completo");
  }

  if (!docId) {
    emptyFields.push("• Documento / ID");
  }

  if (!dob) {
    emptyFields.push("• Fecha de Nacimiento");
  }

  if (!nationality) {
    emptyFields.push("• Nacionalidad");
  }
  if (!district) {
    emptyFields.push("• Distrito");
  }

  if (!location) {
    emptyFields.push("• Lugar de Consulta");
  }

  if (activePhotos.length === 0) {
    emptyFields.push("• Sin Fotografías");
  }

  // ---------------------------------------------------
  // Crear ID único del registro
  // ---------------------------------------------------

  const recordId = "REC_" + Date.now();

  const now = new Date();

  const isoTimestamp = now.toISOString();

  // ---------------------------------------------------
  // Preparar información
  // ---------------------------------------------------

  pendingPayloadData = {
    RecordId: recordId,

    Nombre: name || "Sin especificar",

    Documento: docId || "S/D",

    FechaNacimiento: dob || "No especificada",

    Nacionalidad: nationality || "Desconocida",

    Distrito: district || "NO ESPECIFICADO",

    LugarConsulta: location || "Puesto General",

    Fotos:
      activePhotos.length > 0
        ? activePhotos
        : ["https://placehold.co/150x150/0f172a/334155?text=Sin+Foto"],

    FechaCreacion: isoTimestamp,

    Estado: "Pendiente",

    Comentario: "",
  };

  // ---------------------------------------------------
  // Si faltan datos mostrar advertencia
  // ---------------------------------------------------

  if (emptyFields.length > 0) {
    const listContainer = document.getElementById("warning-fields-list");

    if (listContainer) {
      listContainer.innerHTML = "";

      emptyFields.forEach((field) => {
        const item = document.createElement("p");

        item.innerText = field;

        listContainer.appendChild(item);
      });
    }

    const modal = document.getElementById("modal-warning-confirm");

    if (modal) {
      modal.classList.remove("hidden");
    }

    return;
  }

  // ---------------------------------------------------
  // Si todo está correcto enviar
  // ---------------------------------------------------

  proceedWithSubmit();
}

// -----------------------------------------------------
// Cerrar advertencia
// -----------------------------------------------------

function closeWarningModal() {
  const modal = document.getElementById("modal-warning-confirm");

  if (modal) {
    modal.classList.add("hidden");
  }

  pendingPayloadData = null;
}

// -----------------------------------------------------
// Confirmar envío
// -----------------------------------------------------

function proceedWithSubmit() {
  if (!pendingPayloadData) {
    return;
  }

  const finalSubject = {
    ...pendingPayloadData,
  };

  // Cerrar advertencia

  const warningModal = document.getElementById("modal-warning-confirm");

  if (warningModal) {
    warningModal.classList.add("hidden");
  }

  // Agregar a la cola local

  subjectsQueue.unshift(finalSubject);

  // Guardar localmente

  localStorage.setItem(
    "subjects_queue",

    JSON.stringify(subjectsQueue),
  );

  updateBadge();

  // Ocultar formulario

  const captureScreen = document.getElementById("screen-capture");

  if (captureScreen) {
    captureScreen.classList.add("hidden");
  }

  // Mostrar confirmación

  const successModal = document.getElementById("modal-success");

  if (successModal) {
    successModal.classList.remove("hidden");
  }

  // Enviar al servidor

  if (webhookUrl) {
    sendDataToCloud(finalSubject);
  } else {
    showToast(
      "Guardado Local",

      "No se ha configurado la conexión con Power Automate.",

      true,
    );
  }

  pendingPayloadData = null;
}

// -----------------------------------------------------
// Preparar nuevo registro
// -----------------------------------------------------

function prepareNextCapture() {
  document.getElementById("input-name").value = "";

  document.getElementById("input-id").value = "";

  document.getElementById("input-dob").value = "";

  document.getElementById("input-nationality").value = "";

  document.getElementById("input-location").value = "";

  document.getElementById("input-district").value = "";

  resetAllPhotoSlots();

  goToScreen("screen-capture");
}

// =====================================================
// 07. ENVÍO A POWER AUTOMATE / SHAREPOINT
// =====================================================

function sendDataToCloud(subject) {
  fetch(webhookUrl, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify(subject),
  })
    .then((response) => {
      if (response.ok) {
        showToast(
          "Sincronizado",

          "Registro enviado a SharePoint.",

          false,
        );
      } else {
        showToast(
          "Fallo de Servidor",

          `Código HTTP ${response.status}: El flujo rechazó el envío.`,

          true,
        );
      }
    })

    .catch(() => {
      showToast(
        "Modo Offline",

        "El registro permanece guardado localmente.",

        true,
      );
    });
}

// =====================================================
// 08. COLA DE ESPERA
// =====================================================

function renderQueue() {
  const container = document.getElementById("queue-list-container");

  const emptyState = document.getElementById("queue-empty-state");

  if (!container) {
    return;
  }

  // ---------------------------------------------------
  // Borrar tarjetas anteriores
  // ---------------------------------------------------

  const cards = container.querySelectorAll(".subject-card");

  cards.forEach((card) => card.remove());

  // ---------------------------------------------------
  // Cola vacía
  // ---------------------------------------------------

  if (subjectsQueue.length === 0) {
    if (emptyState) {
      emptyState.classList.remove("hidden");
    }

    return;
  }

  if (emptyState) {
    emptyState.classList.add("hidden");
  }

  // ---------------------------------------------------
  // Crear tarjetas
  // ---------------------------------------------------

  subjectsQueue.forEach((subject) => {
    const card = document.createElement("div");

    card.className = `
        subject-card
        bg-slate-800/80
        hover:bg-slate-800
        p-3.5
        rounded-2xl
        border
        border-slate-700/60
        flex
        items-center
        justify-between
        gap-3
        cursor-pointer
        transition-all
        active:scale-[0.98]
      `;

    card.onclick = () => {
      openSubjectDetail(subject.RecordId);
    };

    // -------------------------------------------------
    // Estado por defecto
    // -------------------------------------------------

    let statusBadgeClass = "bg-slate-700/50 text-slate-400 border-slate-600/50";

    let statusIcon = "fa-clock animate-pulse";

    let statusText = "Espera";

    // -------------------------------------------------
    // Aprobado
    // -------------------------------------------------

    if (subject.Estado === "Aprobado") {
      statusBadgeClass =
        "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";

      statusIcon = "fa-circle-check";

      statusText = "Aprobado";

      // -------------------------------------------------
      // Rechazado
      // -------------------------------------------------
    } else if (subject.Estado === "Rechazado") {
      statusBadgeClass = "bg-red-500/10 text-red-400 border-red-500/20";

      statusIcon = "fa-circle-xmark";

      statusText = "Rechazado";

      // -------------------------------------------------
      // Volver a confirmar
      // -------------------------------------------------
    } else if (subject.Estado === "Volver a confirmar") {
      statusBadgeClass = "bg-amber-500/10 text-amber-400 border-amber-500/20";

      statusIcon = "fa-triangle-exclamation";

      statusText = "Reconfirmar";
    }

    // -------------------------------------------------
    // Fotografía principal
    // -------------------------------------------------

    const coverPhoto =
      subject.Fotos && subject.Fotos.length > 0
        ? subject.Fotos[0]
        : "https://placehold.co/150x150/0f172a/334155?text=Sin+Foto";

    // -------------------------------------------------
    // Contenido tarjeta
    // -------------------------------------------------

    card.innerHTML = `

        <div
          class="
            flex
            items-center
            gap-3
            min-w-0
            flex-grow
          "
        >

          <div
            class="
              w-12
              h-12
              rounded-xl
              overflow-hidden
              bg-slate-700/50
              border
              border-slate-600/50
              flex-shrink-0
              relative
            "
          >

            <img
              class="
                w-full
                h-full
                object-cover
              "
              src="${coverPhoto}"
              alt="Sujeto"
            >


            ${
              subject.Fotos && subject.Fotos.length > 1
                ? `

                  <span
                    class="
                      absolute
                      bottom-0
                      right-0
                      bg-slate-900/90
                      text-white
                      text-[8px]
                      font-bold
                      px-1
                      rounded-tl
                    "
                  >
                    ${subject.Fotos.length}F
                  </span>

                `
                : ""
            }

          </div>


          <div
            class="
              min-w-0
              text-left
            "
          >

            <p
              class="
                font-bold
                text-white
                text-xs
                truncate
              "
            >

              ${subject.Nombre}

            </p>


            <p
              class="
                text-[10px]
                text-slate-400
                mt-0.5
                truncate
              "
            >

              ID:
              ${subject.Documento}
              •
              ${subject.Nacionalidad}

            </p>


            <p
              class="
                text-[9px]
                text-sky-400/90
                truncate
              "
            >

              <i
                class="
                  fa-solid
                  fa-map-pin
                  text-[8px]
                  mr-1
                "
              ></i>

              ${subject.LugarConsulta || "Puesto General"}

            </p>

          </div>

        </div>


        <div
          class="flex-shrink-0"
        >

          <span
            class="
              text-[10px]
              font-bold
              px-2.5
              py-1
              rounded-full
              border
              ${statusBadgeClass}
              flex
              items-center
              gap-1
            "
          >

            <i
              class="
                fa-solid
                ${statusIcon}
              "
            ></i>

            ${statusText}

          </span>

        </div>

      `;

    container.appendChild(card);

    // -------------------------------------------------
    // Abrir fotografía al tocarla
    // -------------------------------------------------

    const imageElement = card.querySelector("img");

    if (imageElement) {
      imageElement.addEventListener("click", (event) => {
        event.stopPropagation();

        openImagePreview(
          coverPhoto,

          subject.Nombre,
        );
      });
    }
  });
}

// =====================================================
// 09. DETALLE DEL REGISTRO
// =====================================================

function openSubjectDetail(recordId) {
  currentRecordId = recordId;

  const subject = subjectsQueue.find((item) => item.RecordId === recordId);

  if (!subject) {
    return;
  }

  // ---------------------------------------------------
  // Fotografías
  // ---------------------------------------------------
  const galleryContainer = document.getElementById("summary-photos-grid");

  if (galleryContainer) {
    galleryContainer.innerHTML = "";

    // ==================================================
    // FOTOS ENVIADAS POR EL CAPTURADOR
    // Solo utilizamos las primeras 3
    // ==================================================

    const fotosCaptura = (subject.Fotos || []).slice(0, 3);

    // ==================================================
    // FOTOS QUE REGRESAN DESDE SHAREPOINT
    // Máximo 2
    // ==================================================

    const fotosRespuesta = (subject.FotosRespuesta || []).slice(0, 2);

    // ==================================================
    // CREAR LOS 5 ESPACIOS
    // ==================================================

    for (let i = 0; i < 5; i++) {
      const imgContainer = document.createElement("div");

      imgContainer.className = `
      aspect-square
      rounded-lg
      overflow-hidden
      bg-slate-800
      border
      border-white/10
      relative
      flex
      items-center
      justify-center
    `;

      // ------------------------------------------------
      // ESPACIOS 1, 2 Y 3
      // Fotos tomadas por el capturador
      // ------------------------------------------------

      if (i < 3 && fotosCaptura[i]) {
        const foto = fotosCaptura[i];

        imgContainer.innerHTML = `

        <img
          class="w-full h-full object-cover"
          src="${foto}"
          alt="Foto ${i + 1}"
        >

      `;

        const img = imgContainer.querySelector("img");

        img.addEventListener("click", () => {
          openImagePreview(foto, `Foto ${i + 1} - ${subject.Nombre}`);
        });

        // ------------------------------------------------
        // ESPACIOS 4 Y 5
        // Fotos recibidas desde SharePoint
        // ------------------------------------------------
      } else if (i >= 3 && fotosRespuesta[i - 3]) {
        const foto = fotosRespuesta[i - 3];

        imgContainer.innerHTML = `

        <img
          class="w-full h-full object-cover"
          src="${foto}"
          alt="Respuesta ${i - 2}"
        >

        <span
          class="
            absolute
            bottom-0
            left-0
            right-0
            bg-amber-500/90
            text-slate-950
            text-[7px]
            font-bold
            py-0.5
            text-center
          "
        >
          RESPUESTA
        </span>

      `;

        const img = imgContainer.querySelector("img");

        img.addEventListener("click", () => {
          openImagePreview(foto, `Respuesta ${i - 2} - ${subject.Nombre}`);
        });

        // ------------------------------------------------
        // ESPACIO VACÍO
        // ------------------------------------------------
      } else {
        const isResponseSlot = i >= 3;

        imgContainer.className += " border-dashed border-slate-700";

        imgContainer.innerHTML = `

        <div
          class="
            text-center
            text-slate-600
          "
        >

          <i
            class="
              fa-solid
              ${isResponseSlot ? "fa-cloud-arrow-down" : "fa-camera"}
              text-sm
            "
          ></i>

          ${isResponseSlot ? `<p class="text-[6px] mt-1">RESPUESTA</p>` : ""}

        </div>

      `;
      }

      galleryContainer.appendChild(imgContainer);
    }
  }

  // ---------------------------------------------------
  // Datos
  // ---------------------------------------------------

  document.getElementById("summary-name").innerText = subject.Nombre;

  document.getElementById("summary-id").innerText = subject.Documento;

  document.getElementById("summary-nationality").innerText =
    subject.Nacionalidad;

  document.getElementById("summary-dob").innerText =
    subject.FechaNacimiento || "No digitada";

  document.getElementById("summary-location").innerText =
    subject.LugarConsulta || "Puesto General";

  // ---------------------------------------------------
  // Fecha y hora
  // ---------------------------------------------------

  let timestampDisplay = "-";

  if (subject.FechaCreacion) {
    try {
      const date = new Date(subject.FechaCreacion);

      if (!isNaN(date.getTime())) {
        timestampDisplay = date.toLocaleString("es-CR", {
          dateStyle: "short",

          timeStyle: "medium",
        });
      } else {
        timestampDisplay = subject.FechaCreacion;
      }
    } catch (error) {
      timestampDisplay = subject.FechaCreacion;
    }
  }

  document.getElementById("summary-timestamp").innerText = timestampDisplay;

  // Mostrar estado

  updateStatusVisuals(
    subject.Estado,

    subject.Comentario,
  );

  goToScreen("screen-status");

  // ---------------------------------------------------
  // Si está pendiente consultar automáticamente
  // ---------------------------------------------------

  if (subject.Estado === "Pendiente") {
    startPolling(subject.RecordId);
  }
}

// =====================================================
// 10. ESTADOS VISUALES
// =====================================================

function updateStatusVisuals(status, comment = "") {
  const screen = document.getElementById("screen-status");

  const iconContainer = document.getElementById("status-icon-container");

  const icon = document.getElementById("status-icon");

  const title = document.getElementById("status-title");

  const message = document.getElementById("status-message");

  const waitIndicator = document.getElementById("wait-indicator");

  if (
    !screen ||
    !iconContainer ||
    !icon ||
    !title ||
    !message ||
    !waitIndicator
  ) {
    return;
  }

  // Clase base

  screen.className = `
    flex-grow
    flex
    flex-col
    p-6
    justify-between
    text-center
    transition-colors
    duration-500
  `;

  // ---------------------------------------------------
  // PENDIENTE
  // ---------------------------------------------------

  if (status === "Pendiente") {
    screen.classList.add("bg-slate-900");

    iconContainer.className = `
      w-24
      h-24
      rounded-full
      bg-slate-800/50
      mx-auto
      flex
      items-center
      justify-center
      text-4xl
      shadow-lg
      border
      border-white/10
    `;

    icon.className = "fa-solid fa-arrows-spin animate-spin text-sky-400";

    title.innerText = "Verificando Datos...";

    message.innerText =
      "La oficina de control está revisando el perfil en tiempo real. Manténgase a la espera.";

    waitIndicator.classList.remove("hidden");

    // ---------------------------------------------------
    // APROBADO
    // ---------------------------------------------------
  } else if (status === "Aprobado") {
    screen.classList.add("bg-emerald-950/95");

    iconContainer.className = `
      w-24
      h-24
      rounded-full
      bg-emerald-50
      mx-auto
      flex
      items-center
      justify-center
      text-4xl
      shadow-lg
      border-2
      border-emerald-400
      animate-bounce
    `;

    icon.className = "fa-solid fa-circle-check text-slate-950";

    title.innerText = "¡SIN EXPEDIENTE!";

    message.innerText = comment || "LA PERSONA NO PRESENTA EXPEDIENTE.";

    waitIndicator.classList.add("hidden");

    // ---------------------------------------------------
    // RECHAZADO
    // ---------------------------------------------------
  } else if (status === "Rechazado") {
    screen.classList.add("bg-red-950/95");

    iconContainer.className = `
      w-24
      h-24
      rounded-full
      bg-red-600
      mx-auto
      flex
      items-center
      justify-center
      text-4xl
      shadow-lg
      border-2
      border-red-400
    `;

    icon.className = "fa-solid fa-circle-xmark text-white";

    title.innerText = "CON PENDIENTES";

    message.innerText = `Atención: Persona con pendientes. Motivo: "${
      comment || "Fallo en la validación de credenciales."
    }"`;

    waitIndicator.classList.add("hidden");

    // ---------------------------------------------------
    // VOLVER A CONFIRMAR
    // ---------------------------------------------------
  } else if (status === "Volver a confirmar") {
    screen.classList.add("bg-amber-950/95");

    iconContainer.className = `
      w-24
      h-24
      rounded-full
      bg-amber-500
      mx-auto
      flex
      items-center
      justify-center
      text-4xl
      shadow-lg
      border-2
      border-amber-400
    `;

    icon.className = "fa-solid fa-triangle-exclamation text-slate-950";

    title.innerText = "RECONFIRMAR DATOS";

    message.innerText = `Se requiere volver a verificar o tomar la foto. Motivo: "${
      comment || "Revisar datos enviados."
    }"`;

    waitIndicator.classList.add("hidden");
  }
}

// =====================================================
// 11. ACTUALIZAR ESTADO DEL REGISTRO
// =====================================================

function updateSubjectStatus(recordId, estado, comentario) {
  let changed = false;

  subjectsQueue = subjectsQueue.map((subject) => {
    if (subject.RecordId === recordId && subject.Estado !== estado) {
      changed = true;

      return {
        ...subject,

        Estado: estado,

        Comentario: comentario || "",
      };
    }

    return subject;
  });

  if (!changed) {
    return false;
  }

  // Guardar actualización

  localStorage.setItem(
    "subjects_queue",

    JSON.stringify(subjectsQueue),
  );

  updateBadge();

  renderQueue();

  // ---------------------------------------------------
  // Si el usuario está viendo este registro,
  // actualizar la pantalla inmediatamente
  // ---------------------------------------------------

  if (currentRecordId === recordId) {
    updateStatusVisuals(
      estado,

      comentario || "",
    );

    showToast(
      "Estado Actualizado",

      `El registro ha sido: ${estado}`,

      false,
    );
  }

  return true;
}

// =====================================================
// 12. CONSULTAR ESTADO EN POWER AUTOMATE
// =====================================================

function fetchStatusForRecord(recordId) {
  if (!statusUrl) {
    return;
  }

  fetch(statusUrl, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",

      Accept: "application/json",
    },

    body: JSON.stringify({
      RecordId: recordId,
    }),
  })
    .then((response) => {
      if (response.ok) {
        return response.json();
      }

      return null;
    })

    .then((data) => {
      if (data && data.Estado) {
        updateSubjectStatus(
          recordId,

          data.Estado,

          data.Comentario || "",
        );
      }
      if (Array.isArray(data.FotosRespuesta)) {
        updateResponsePhotos(recordId, data.FotosRespuesta);
      }
    })

    .catch(() => {
      console.log("Esperando actualización central...");
    });
}

function updateResponsePhotos(recordId, fotos) {
  subjectsQueue = subjectsQueue.map((subject) => {
    if (subject.RecordId === recordId) {
      return {
        ...subject,
        FotosRespuesta: fotos.slice(0, 2),
      };
    }

    return subject;
  });

  localStorage.setItem("subjects_queue", JSON.stringify(subjectsQueue));

  if (currentRecordId === recordId) {
    showResponsePhotos(fotos);
  }
}

function showResponsePhotos(fotos) {
  for (let i = 3; i < 5; i++) {
    const preview = document.getElementById(`slot-preview-${i}`);

    const empty = document.getElementById(`slot-empty-${i}`);

    if (preview) {
      preview.src = "";

      preview.classList.add("hidden");
    }

    if (empty) {
      empty.classList.remove("hidden");
    }
  }

  fotos.slice(0, 2).forEach((foto, index) => {
    const slotIndex = index + 3;

    const preview = document.getElementById(`slot-preview-${slotIndex}`);

    const empty = document.getElementById(`slot-empty-${slotIndex}`);

    if (preview) {
      preview.src = foto;

      preview.classList.remove("hidden");
    }

    if (empty) {
      empty.classList.add("hidden");
    }
  });
}

// =====================================================
// 13. POLLING DE LA COLA
// =====================================================

function startQueuePolling() {
  stopQueuePolling();

  if (!statusUrl) {
    return;
  }

  queuePollingInterval = setInterval(() => {
    const pendingRecords = subjectsQueue.filter(
      (subject) =>
        subject.Estado === "Pendiente" ||
        subject.Estado === "Volver a confirmar" ||
        subject.Estado === "Rechazado" ||
        subject.Estado === "Aprobado",
    );

    pendingRecords.forEach((record) => {
      fetchStatusForRecord(record.RecordId);
    });
  }, 5000);
}

// -----------------------------------------------------
// Detener polling de cola
// -----------------------------------------------------

function stopQueuePolling() {
  if (queuePollingInterval) {
    clearInterval(queuePollingInterval);

    queuePollingInterval = null;
  }
}

// =====================================================
// 14. POLLING DE UN REGISTRO INDIVIDUAL
// =====================================================

function startPolling(recordId) {
  stopPolling();

  if (!statusUrl) {
    return;
  }

  pollingInterval = setInterval(() => {
    fetchStatusForRecord(recordId);

    const subject = subjectsQueue.find((item) => item.RecordId === recordId);

    // Detener cuando ya no esté pendiente

    if (!subject || subject.Estado !== "Pendiente") {
      stopPolling();
    }
  }, 1000);
}

// -----------------------------------------------------
// Detener polling individual
// -----------------------------------------------------

function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);

    pollingInterval = null;
  }
}

// =====================================================
// 15. LIMPIAR HISTORIAL LOCAL
// =====================================================

function clearQueueHistory() {
  const confirmed = confirm(
    "¿Limpiar todo el historial de capturas de hoy en este dispositivo?",
  );

  if (!confirmed) {
    return;
  }

  stopPolling();

  stopQueuePolling();

  subjectsQueue = [];

  localStorage.removeItem("subjects_queue");

  updateBadge();

  renderQueue();

  showToast(
    "Historial Limpio",

    "Se borró la cola local de este dispositivo.",

    false,
  );
}

// =====================================================
// 16. VISTA AMPLIADA DE FOTOGRAFÍAS
// =====================================================

function openImagePreview(src, caption = "Imagen ampliada") {
  const preview = document.getElementById("image-preview-large");

  const captionElement = document.getElementById("image-preview-caption");

  const modal = document.getElementById("image-preview-modal");

  if (!preview || !captionElement || !modal) {
    return;
  }

  preview.src = src;

  preview.alt = caption;

  captionElement.innerText = caption;

  modal.classList.remove("hidden");
}

// -----------------------------------------------------
// Cerrar fotografía ampliada
// -----------------------------------------------------

function closeImagePreview() {
  const modal = document.getElementById("image-preview-modal");

  if (modal) {
    modal.classList.add("hidden");
  }
}

// =====================================================
// 18. RELOJ
// =====================================================

function updateClock() {
  const clock = document.getElementById("live-clock");
  if (!clock) {
    return;
  }
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  clock.innerText = `${hours}:${minutes}`;
}

// Actualizar reloj cada segundo
setInterval(updateClock, 1000);
