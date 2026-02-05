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
// ESCANEO DE CÓDIGOS DE BARRAS (Integrado con Mobile Scanner)
// ==========================================

function activarEscanerRecepcion() {
    if (typeof abrirScannerMobile !== 'function') {
        Notificar.error("ERROR", "El escáner no está disponible.");
        return;
    }

    abrirScannerMobile((codigo) => {
        // Buscar el producto por SKU en el select
        const selectProd = document.getElementById("rec-producto");
        if (!selectProd) return;

        let encontrado = false;
        for (let i = 0; i < selectProd.options.length; i++) {
            const opt = selectProd.options[i];
            if (opt.getAttribute("data-sku") === codigo) {
                selectProd.selectedIndex = i;
                encontrado = true;
                break;
            }
        }

        if (encontrado) {
            Notificar.toast("Producto identificado!", "success");
            // Dar feedback visual
            selectProd.classList.add("ring-4", "ring-emerald-500");
            setTimeout(() => selectProd.classList.remove("ring-4", "ring-emerald-500"), 1500);
        } else {
            Notificar.error("CÓDIGO NO RECONOCIDO", `No se encontró un producto con SKU: ${codigo}`);
        }
    });
}

// Estos se mantienen por compatibilidad o se pueden remover si se unifica todo en mobile.js
async function iniciarEscanerCodigoBarras() {
    activarEscanerRecepcion();
}

function detenerEscaner() {
    if (typeof cerrarScannerMobile === 'function') cerrarScannerMobile();
}
