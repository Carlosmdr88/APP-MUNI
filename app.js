
function createPhotoSlots() {
    const container = document.getElementById("photo-slots-container");
    if (!container) return;

    container.innerHTML = "";

    for (let i = 0; i < 5; i++) {
        const slot = document.createElement("div");
        slot.id = `slot-${i}`;
              const isCameraSlot = i < 3;
        const slotColorClass = isCameraSlot
            ? "bg-emerald-950/40 border-emerald-500/40 hover:border-emerald-400"
            : "bg-amber-950/40 border-amber-500/40 hover:border-amber-400";
        const iconColorClass = isCameraSlot ? "text-emerald-300" : "text-amber-300";
        slot.className = `aspect-square rounded-2xl bg-slate-800/80 border-2 border-dashed border-slate-700 flex flex-col items-center justify-center cursor-pointer overflow-hidden relative group transition-all hover:border-sky-500 shadow-inner ${slotColorClass}`;

        slot.innerHTML = `
            <span id="slot-empty-${i}" class="text-slate-500 text-base group-hover:text-sky-400">
                <i class="fa-solid fa-camera"></i>
            </span>
            <img id="slot-preview-${i}" class="hidden absolute inset-0 w-full h-full object-cover z-20" src="" alt="Foto ${i+1}" />
            <button id="slot-remove-${i}" class="hidden absolute top-1 right-1 bg-red-600/90 text-white w-5 h-5 rounded-lg flex items-center justify-center z-30">
                <i class="fa-solid fa-xmark text-[10px]"></i>
            </button>
        `;

        slot.addEventListener("click", () => triggerPhotoSlot(i));

        container.appendChild(slot);

        slot.querySelector("button").addEventListener("click", (e) => {
            removePhotoSlot(e, i);
        });
    }
}

document.addEventListener("DOMContentLoaded", createPhotoSlots);


      let photosArray = [null, null, null, null, null];
      //let webhookUrl = localStorage.getItem("pa_webhook_url") || "";
      const webhookUrl =
        "https://default6cf2221cc6bd484781777f57b05330.6b.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/758af806a6fc432aae55cddad7947437/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=EOAZbzDEi-JEdRYBZegenftRJliSSjqk60c8-_3Wl78";
      let currentRecordId = null;
      let pendingPayloadData = null;
      let pollingInterval = null;
      let queuePollingInterval = null;

      let subjectsQueue =
        JSON.parse(localStorage.getItem("subjects_queue")) || [];

      document.getElementById("setting-webhook-url").value = webhookUrl;
      updateBadge();
      renderQueue();

      // --- CAMERAS AND BASE64 ENGINE ---
      function triggerPhotoSlot(index) {
        document.getElementById(`input-file-${index}`).click();
      }

      function handlePhotoSlotChange(index) {
        const input = document.getElementById(`input-file-${index}`);
        const file = input.files[0];
        if (file) {
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

              const max_size = 1200;
              if (width > height) {
                if (width > max_size) {
                  height *= max_size / width;
                  width = max_size;
                }
              } else {
                if (height > max_size) {
                  width *= max_size / height;
                  height = max_size;
                }
              }

              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext("2d");
              ctx.drawImage(img, 0, 0, width, height);

              const compressedBase64 = canvas.toDataURL("image/jpeg", 0.92);
              photosArray[index] = compressedBase64;

              const preview = document.getElementById(`slot-preview-${index}`);
              const emptyState = document.getElementById(`slot-empty-${index}`);
              const removeBtn = document.getElementById(`slot-remove-${index}`);

              preview.src = compressedBase64;
              preview.classList.remove("hidden");
              emptyState.classList.add("hidden");
              removeBtn.classList.remove("hidden");

              showToast("Foto Lista", "Imagen optimizada con éxito.", false);
            };
          };
          reader.readAsDataURL(file);
        }
      }

      function removePhotoSlot(event, index) {
        event.stopPropagation();
        photosArray[index] = null;
        document.getElementById(`input-file-${index}`).value = "";

        document
          .getElementById(`slot-preview-${index}`)
          .classList.add("hidden");
        document
          .getElementById(`slot-empty-${index}`)
          .classList.remove("hidden");
        document.getElementById(`slot-remove-${index}`).classList.add("hidden");
      }

      function resetAllPhotoSlots() {
        photosArray = [null, null, null, null, null];
        for (let i = 0; i < 5; i++) {
          document.getElementById("input-file-" + i).value = "";
          document.getElementById(`slot-preview-${i}`).classList.add("hidden");
          document.getElementById(`slot-empty-${i}`).classList.remove("hidden");
          document.getElementById(`slot-remove-${i}`).classList.add("hidden");
        }
      }

      // --- SCREEN CONTROLLER ---
      function goToScreen(screenId) {
        document.getElementById("screen-capture").classList.add("hidden");
        document.getElementById("screen-queue").classList.add("hidden");
        document.getElementById("screen-status").classList.add("hidden");
        document.getElementById("modal-success").classList.add("hidden");
        document
          .getElementById("modal-warning-confirm")
          .classList.add("hidden");

        document.getElementById(screenId).classList.remove("hidden");

        if (screenId === "screen-queue") {
          startQueuePolling();
          renderQueue();
        } else {
          stopQueuePolling();
        }

        if (screenId !== "screen-status") {
          stopPolling();
        }
      }

      function updateBadge() {
        const pendingAndAlerts = subjectsQueue.filter(
          (s) => s.Estado === "Pendiente" || s.Estado === "Volver a confirmar",
        ).length;
        document.getElementById("queue-count-badge").innerText =
          pendingAndAlerts;
      }

      // --- ALERTS SYSTEM (TOAST) ---
      function showToast(title, msg, isError = true) {
        const toast = document.getElementById("toast-notification");
        const tIcon = document.getElementById("toast-icon");
        const tTitle = document.getElementById("toast-title");
        const tMessage = document.getElementById("toast-message");

        tTitle.innerText = title;
        tMessage.innerText = msg;

        if (isError) {
          toast.classList.remove("bg-emerald-500/95");
          toast.classList.add("bg-red-500/95");
          tIcon.className = "fa-solid fa-circle-exclamation";
        } else {
          toast.classList.remove("bg-red-500/95");
          toast.classList.add("bg-emerald-500/95");
          tIcon.className = "fa-solid fa-circle-check";
        }

        toast.classList.remove("-translate-y-24", "opacity-0");
        setTimeout(() => {
          toast.classList.add("-translate-y-24", "opacity-0");
        }, 4000);
      }

      // --- CORE DATA SUBMISSION & INTERACTION ---
      function checkFormBeforeSubmit() {
        const name = document.getElementById("input-name").value.trim();
        const docId = document.getElementById("input-id").value.trim();
        const dob = document.getElementById("input-dob").value.trim();
        const nationality = document
          .getElementById("input-nationality")
          .value.trim();
        const location = document.getElementById("input-location").value.trim();
        const activePhotos = photosArray.filter((photo) => photo !== null);

        let emptyFields = [];
        if (!name) emptyFields.push("• Nombre Completo");
        if (!docId) emptyFields.push("• Documento / ID");
        if (!dob) emptyFields.push("• Fecha de Nacimiento");
        if (!nationality) emptyFields.push("• Nacionalidad");
        if (!location) emptyFields.push("• Lugar de Consulta");
        if (activePhotos.length === 0) emptyFields.push("• Sin Fotografías");

        const recordId = "REC_" + Date.now();
        const now = new Date();
        const isoTimestamp = now.toISOString();

        pendingPayloadData = {
          RecordId: recordId,
          Nombre: name || "Sin especificar",
          Documento: docId || "S/D",
          FechaNacimiento: dob || "No especificada",
          Nacionalidad: nationality || "Desconocida",
          LugarConsulta: location || "Puesto General",
          Fotos:
            activePhotos.length > 0
              ? activePhotos
              : ["https://placehold.co/150x150/0f172a/334155?text=Sin+Foto"],
          FechaCreacion: isoTimestamp,
          Estado: "Pendiente",
          Comentario: "",
        };

        if (emptyFields.length > 0) {
          const listContainer = document.getElementById("warning-fields-list");
          listContainer.innerHTML = "";
          emptyFields.forEach((field) => {
            const div = document.createElement("p");
            div.innerText = field;
            listContainer.appendChild(div);
          });
          document
            .getElementById("modal-warning-confirm")
            .classList.remove("hidden");
        } else {
          proceedWithSubmit();
        }
      }

      function closeWarningModal() {
        document
          .getElementById("modal-warning-confirm")
          .classList.add("hidden");
        pendingPayloadData = null;
      }

      function proceedWithSubmit() {
        if (!pendingPayloadData) return;
        const finalSubject = { ...pendingPayloadData };

        document
          .getElementById("modal-warning-confirm")
          .classList.add("hidden");
        subjectsQueue.unshift(finalSubject);
        localStorage.setItem("subjects_queue", JSON.stringify(subjectsQueue));
        updateBadge();

        document.getElementById("screen-capture").classList.add("hidden");
        document.getElementById("modal-success").classList.remove("hidden");

        if (webhookUrl) {
          sendDataToCloud(finalSubject);
        } else {
          showToast(
            "Guardado Local",
            "Asigne un Webhook en ajustes para subirlo a SharePoint.",
            true,
          );
        }
        pendingPayloadData = null;
      }

      function sendDataToCloud(subject) {
        fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
              );
            }
          })
          .catch((error) => {
            showToast(
              "Modo Offline",
              "Guardado local. Se subirá al recuperar conexión.",
            );
          });
      }

      function prepareNextCapture() {
        document.getElementById("input-name").value = "";
        document.getElementById("input-id").value = "";
        document.getElementById("input-dob").value = "";
        document.getElementById("input-nationality").value = "";
        document.getElementById("input-location").value = "";
        resetAllPhotoSlots();
        goToScreen("screen-capture");
      }

      // --- QUEUE RENDER ENGINE ---
      function renderQueue() {
        const container = document.getElementById("queue-list-container");
        const emptyState = document.getElementById("queue-empty-state");

        const cards = container.querySelectorAll(".subject-card");
        cards.forEach((card) => card.remove());

        if (subjectsQueue.length === 0) {
          emptyState.classList.remove("hidden");
          return;
        }

        emptyState.classList.add("hidden");

        subjectsQueue.forEach((subject) => {
          const card = document.createElement("div");
          card.className =
            "subject-card bg-slate-800/80 hover:bg-slate-800 p-3.5 rounded-2xl border border-slate-700/60 flex items-center justify-between gap-3 cursor-pointer transition-all active:scale-[0.98]";
          card.onclick = () => openSubjectDetail(subject.RecordId);

          let statusBadgeClass =
            "bg-slate-700/50 text-slate-400 border-slate-600/50";
          let statusIcon = "fa-clock animate-pulse";
          let statusText = "Espera";

          if (subject.Estado === "Aprobado") {
            statusBadgeClass =
              "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
            statusIcon = "fa-circle-check";
            statusText = "Aprobado";
          } else if (subject.Estado === "Rechazado") {
            statusBadgeClass = "bg-red-500/10 text-red-400 border-red-500/20";
            statusIcon = "fa-circle-xmark";
            statusText = "Rechazado";
          } else if (subject.Estado === "Volver a confirmar") {
            statusBadgeClass =
              "bg-amber-500/10 text-amber-400 border-amber-500/20";
            statusIcon = "fa-triangle-exclamation";
            statusText = "Reconfirmar";
          }

          const coverPhoto =
            subject.Fotos && subject.Fotos.length > 0
              ? subject.Fotos[0]
              : "https://placehold.co/150x150/0f172a/334155?text=Sin+Foto";

          card.innerHTML = `
            <div class="flex items-center gap-3 min-w-0 flex-grow">
                <div class="w-12 h-12 rounded-xl overflow-hidden bg-slate-700/50 border border-slate-600/50 flex-shrink-0 relative">
                    <img class="w-full h-full object-cover" src="${coverPhoto}" alt="Sujeto">
                    ${subject.Fotos && subject.Fotos.length > 1 ? `<span class="absolute bottom-0 right-0 bg-slate-900/90 text-white text-[8px] font-bold px-1 rounded-tl">${subject.Fotos.length}F</span>` : ""}
                </div>
                <div class="min-w-0 text-left">
                    <p class="font-bold text-white text-xs truncate">${subject.Nombre}</p>
                    <p class="text-[10px] text-slate-400 mt-0.5 truncate">ID: ${subject.Documento} • ${subject.Nacionalidad}</p>
                    <p class="text-[9px] text-sky-400/90 truncate"><i class="fa-solid fa-map-pin text-[8px] mr-1"></i>${subject.LugarConsulta || "Puesto General"}</p>
                </div>
            </div>
            <div class="flex-shrink-0">
                <span class="text-[10px] font-bold px-2.5 py-1 rounded-full border ${statusBadgeClass} flex items-center gap-1">
                    <i class="fa-solid ${statusIcon}"></i>
                    ${statusText}
                </span>
            </div>
          `;
          container.appendChild(card);

          const imageElement = card.querySelector("img");
          if (imageElement) {
            imageElement.addEventListener("click", (event) => {
              event.stopPropagation();
              openImagePreview(coverPhoto, `${subject.Nombre}`);
            });
          }
        });
      }

      // --- DETAIL VIEWER & LIVE POLLING LOGIC ---
      function openSubjectDetail(recordId) {
        currentRecordId = recordId;
        let subject = subjectsQueue.find((s) => s.RecordId === recordId);
        if (!subject) return;

        const galleryContainer = document.getElementById("summary-photos-grid");
        galleryContainer.innerHTML = "";
        const activeFotos = subject.Fotos || [];

        activeFotos.forEach((foto, i) => {
          const imgContainer = document.createElement("div");
          imgContainer.className =
            "aspect-square rounded-lg overflow-hidden bg-slate-800 border border-white/10 relative";
          imgContainer.innerHTML = `<img class="w-full h-full object-cover" src="${foto}" alt="Foto ${i + 1}">`;
          galleryContainer.appendChild(imgContainer);
          const imgEl = imgContainer.querySelector("img");
          if (imgEl) {
            imgEl.addEventListener("click", () => {
              openImagePreview(foto, `Foto ${i + 1} - ${subject.Nombre}`);
            });
          }
        });

        for (let i = activeFotos.length; i < 5; i++) {
          const emptySlot = document.createElement("div");
          emptySlot.className =
            "aspect-square rounded-lg bg-slate-900/50 border border-dashed border-slate-800 flex items-center justify-center text-slate-700 text-[10px]";
          emptySlot.innerHTML = `<i class="fa-solid fa-camera"></i>`;
          galleryContainer.appendChild(emptySlot);
        }

        document.getElementById("summary-name").innerText = subject.Nombre;
        document.getElementById("summary-id").innerText = subject.Documento;
        document.getElementById("summary-nationality").innerText =
          subject.Nacionalidad;
        document.getElementById("summary-dob").innerText =
          subject.FechaNacimiento || "No digitada";
        document.getElementById("summary-location").innerText =
          subject.LugarConsulta || "Puesto General";

        let timestampDisplay = "-";
        if (subject.FechaCreacion) {
          try {
            const d = new Date(subject.FechaCreacion);
            if (!isNaN(d.getTime())) {
              timestampDisplay = d.toLocaleString("es-ES", {
                dateStyle: "short",
                timeStyle: "medium",
              });
            } else {
              timestampDisplay = subject.FechaCreacion;
            }
          } catch (e) {
            timestampDisplay = subject.FechaCreacion;
          }
        }
        document.getElementById("summary-timestamp").innerText =
          timestampDisplay;

        updateStatusVisuals(subject.Estado, subject.Comentario);
        goToScreen("screen-status");

        // Activar verificación en tiempo real si está pendiente
        if (subject.Estado === "Pendiente") {
          startPolling(subject.RecordId);
        }
      }

      function updateStatusVisuals(status, comment = "") {
        const screen = document.getElementById("screen-status");
        const iconContainer = document.getElementById("status-icon-container");
        const icon = document.getElementById("status-icon");
        const title = document.getElementById("status-title");
        const message = document.getElementById("status-message");
        const waitIndicator = document.getElementById("wait-indicator");

        screen.className =
          "flex-grow flex flex-col p-6 justify-between text-center transition-colors duration-500 ";

        if (status === "Pendiente") {
          screen.classList.add("bg-slate-900");
          iconContainer.className =
            "w-24 h-24 rounded-full bg-slate-800/50 mx-auto flex items-center justify-center text-4xl shadow-lg border border-white/10";
          icon.className = "fa-solid fa-arrows-spin animate-spin text-sky-400";
          title.innerText = "Verificando Datos...";
          message.innerText =
            "La oficina de control está revisando el perfil en tiempo real. Manténgase a la espera.";
          waitIndicator.classList.remove("hidden");
        } else if (status === "Aprobado") {
          screen.classList.add("bg-emerald-950/95");
          iconContainer.className =
            "w-24 h-24 rounded-full bg-emerald-50 mx-auto flex items-center justify-center text-4xl shadow-lg border-2 border-emerald-400 animate-bounce";
          icon.className = "fa-solid fa-circle-check text-slate-950";
          title.innerText = "¡SIN EXPEDIENTE!";
          message.innerText = comment || "LA PERSONA NO PRESENTA EXPEDIENTE.";
          waitIndicator.classList.add("hidden");
        } else if (status === "Rechazado") {
          screen.classList.add("bg-red-950/95");
          iconContainer.className =
            "w-24 h-24 rounded-full bg-red-600 mx-auto flex items-center justify-center text-4xl shadow-lg border-2 border-red-400";
          icon.className = "fa-solid fa-circle-xmark text-white";
          title.innerText = "CON PENDIENTES";
          message.innerText = `Atención: Persona con pendientes. Motivo: "${comment || "Fallo en la validación de credenciales."}"`;
          waitIndicator.classList.add("hidden");
        } else if (status === "Volver a confirmar") {
          screen.classList.add("bg-amber-950/95");
          iconContainer.className =
            "w-24 h-24 rounded-full bg-amber-500 mx-auto flex items-center justify-center text-4xl shadow-lg border-2 border-amber-400";
          icon.className = "fa-solid fa-triangle-exclamation text-slate-950";
          title.innerText = "RECONFIRMAR DATOS";
          message.innerText = `Se requiere volver a verificar o tomar la foto. Motivo: "${comment || "Revisar datos enviados."}"`;
          waitIndicator.classList.add("hidden");
        }
      }

      // --- POLLING ENGINE (Comprobación síncrona en base al RecordId) ---
      const statusUrl =
        "https://default6cf2221cc6bd484781777f57b05330.6b.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/a4165f55850d496ea752fc8f53f91475/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=PQoTgyWRjHkQX8xrEkoAeVo3vIin4W8OKZEYSDvkxJ4";

      function updateSubjectStatus(recordId, estado, comentario) {
        let changed = false;
        subjectsQueue = subjectsQueue.map((s) => {
          if (s.RecordId === recordId && s.Estado !== estado) {
            changed = true;
            return {
              ...s,
              Estado: estado,
              Comentario: comentario || "",
            };
          }
          return s;
        });

        if (!changed) return false;

        localStorage.setItem("subjects_queue", JSON.stringify(subjectsQueue));
        updateBadge();
        renderQueue();

        if (currentRecordId === recordId) {
          updateStatusVisuals(estado, comentario || "");
          showToast(
            "Estado Actualizado",
            `El registro ha sido: ${estado}`,
            false,
          );
        }
        return true;
      }

      function fetchStatusForRecord(recordId) {
        if (!webhookUrl) return;

        fetch(statusUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ RecordId: recordId }),
        })
          .then((res) => {
            if (res.ok) return res.json();
          })
          .then((data) => {
            if (data && data.Estado && data.Estado !== "Pendiente") {
              updateSubjectStatus(recordId, data.Estado, data.Comentario || "");
            }
          })
          .catch(() => console.log("Esperando actualización central..."));
      }

      function startQueuePolling() {
        stopQueuePolling();
        if (!webhookUrl) return;

        queuePollingInterval = setInterval(() => {
          const pendingRecords = subjectsQueue.filter(
            (s) => s.Estado === "Pendiente" || s.Estado === "Volver a confirmar",
          );
          pendingRecords.forEach((record) => {
            fetchStatusForRecord(record.RecordId);
          });
        }, 5000);
      }

      function stopQueuePolling() {
        if (queuePollingInterval) {
          clearInterval(queuePollingInterval);
          queuePollingInterval = null;
        }
      }

      function startPolling(recordId) {
        stopPolling();
        if (!webhookUrl) return;

        pollingInterval = setInterval(() => {
          fetchStatusForRecord(recordId);
          const subject = subjectsQueue.find((s) => s.RecordId === recordId);
          if (!subject || subject.Estado !== "Pendiente") {
            stopPolling();
          }
        }, 1000); // Consulta cada 1 segundo
      }

      function stopPolling() {
        if (pollingInterval) {
          clearInterval(pollingInterval);
          pollingInterval = null;
        }
      }

      function clearQueueHistory() {
        if (
          confirm(
            "¿Limpiar todo el historial de capturas de hoy en este dispositivo?",
          )
        ) {
          stopPolling();
          subjectsQueue = [];
          localStorage.removeItem("subjects_queue");
          updateBadge();
          renderQueue();
          showToast(
            "Historial Limpio",
            "Se borró la cola local de este teléfono.",
            false,
          );
        }
      }

      // --- CONFIGURATION SYSTEM ---
      function openSettings() {
        document.getElementById("settings-modal").classList.remove("hidden");
      }
      function closeSettings() {
        document.getElementById("settings-modal").classList.add("hidden");
      }

      function openImagePreview(src, caption = "Imagen ampliada") {
        const preview = document.getElementById("image-preview-large");
        const captionEl = document.getElementById("image-preview-caption");
        preview.src = src;
        preview.alt = caption;
        captionEl.innerText = caption;
        document.getElementById("image-preview-modal").classList.remove("hidden");
      }

      function closeImagePreview() {
        document.getElementById("image-preview-modal").classList.add("hidden");
      }

      function saveSettings() {
        const urlInput = document
          .getElementById("setting-webhook-url")
          .value.trim();
        webhookUrl = urlInput;
        localStorage.setItem("pa_webhook_url", urlInput);
        showToast("Ajustes Guardados", "Webhook enlazado con éxito.", false);
        closeSettings();
      }

      // --- LIVE NATIVE CLOCK ---
      setInterval(() => {
        const now = new Date();
        document.getElementById("live-clock").innerText =
          String(now.getHours()).padStart(2, "0") +
          ":" +
          String(now.getMinutes()).padStart(2, "0");
      }, 1000);
    