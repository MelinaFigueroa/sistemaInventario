// js/recepcion.js - Módulo de recepción de mercadería

// ==========================================
// RECEPCIÓN DE MERCADERÍA
// ==========================================

async function procesarRecepcion() {
    const productoId = document.getElementById("rec-producto")?.value;
    const destino = document.getElementById("rec-destino")?.value;
    const cantidad = parseInt(document.getElementById("rec-cantidad")?.value);

    if (!productoId || !destino || !cantidad || cantidad <= 0) {
        Notificar.error("DATOS INCOMPLETOS", "Completá todos los campos con valores válidos.");
        return;
    }

    try {
        // 1. Actualizar posición
        const { data: posActual } = await _supabase
            .from("posiciones")
            .select("cantidad, producto_id")
            .eq("id", destino)
            .single();

        const nuevaCantidad = (posActual?.cantidad || 0) + cantidad;

        await _supabase.from("posiciones").update({
            cantidad: nuevaCantidad,
            producto_id: productoId,
            estado: "ocupado"
        }).eq("id", destino);

        // 2. Registrar movimiento
        await _supabase.from("movimientos").insert([{
            producto_id: productoId,
            tipo: "ENTRADA",
            origen: "PROVEEDOR",
            destino: destino,
            cantidad: cantidad,
            usuario: USUARIO_ACTUAL
        }]);

        Notificar.toast("Recepción procesada correctamente", "success");

        // Limpiar formulario
        document.getElementById("rec-cantidad").value = "";

        // Actualizar dashboard si existe
        if (typeof actualizarDashboard === 'function') actualizarDashboard();

    } catch (error) {
        console.error("Error en recepción:", error);
        Notificar.error("ERROR", "No se pudo procesar la recepción.");
    }
}

// ==========================================
// ESCANEO OCR DE REMITOS (Tesseract.js)
// ==========================================

async function procesarRemitoPDF() {
    const fileInput = document.getElementById("rec-pdf");
    const file = fileInput?.files[0];

    if (!file) {
        Notificar.error("SIN ARCHIVO", "Seleccioná un remito para escanear.");
        return;
    }

    Swal.fire({
        title: 'Escaneando remito...',
        text: 'Extrayendo información con OCR...',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    try {
        // Aquí iría la lógica de OCR con Tesseract.js
        // Por ahora simulamos el proceso
        await new Promise(resolve => setTimeout(resolve, 2000));

        Swal.close();
        Notificar.toast("Remito procesado (función en desarrollo)", "info");

    } catch (error) {
        console.error("Error en OCR:", error);
        Swal.close();
        Notificar.error("ERROR DE OCR", "No se pudo procesar el remito.");
    }
}

// ==========================================
// ESCANEO DE CÓDIGOS DE BARRAS (html5-qrcode)
// ==========================================

let escanerActivo = null;

async function iniciarEscanerCodigoBarras() {
    const elementoVideo = document.getElementById("lector-qr");
    if (!elementoVideo) {
        Notificar.error("ERROR", "Elemento de cámara no encontrado.");
        return;
    }

    try {
        escanerActivo = new Html5Qrcode("lector-qr");

        await escanerActivo.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 250, height: 250 } },
            (decodedText) => {
                // Código escaneado exitosamente
                document.getElementById("rec-producto").value = decodedText;
                detenerEscaner();
                Notificar.toast("Código escaneado", "success");
            }
        );

    } catch (error) {
        console.error("Error al iniciar escáner:", error);
        Notificar.error("ERROR DE CÁMARA", "No se pudo acceder a la cámara.");
    }
}

function detenerEscaner() {
    if (escanerActivo) {
        escanerActivo.stop().then(() => {
            escanerActivo = null;
        });
    }
}
