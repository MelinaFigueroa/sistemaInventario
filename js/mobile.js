// js/mobile.js - Funcionalidades específicas para móviles

// ==========================================
// DETECCIÓN DE DISPOSITIVO MÓVIL
// ==========================================
const isMobile = {
    Android: function () {
        return navigator.userAgent.match(/Android/i);
    },
    iOS: function () {
        return navigator.userAgent.match(/iPhone|iPad|iPod/i);
    },
    any: function () {
        return (isMobile.Android() || isMobile.iOS());
    }
};

// ==========================================
// SCANNER DE CÓDIGOS DE BARRAS MÓVIL
// ==========================================
let scannerInstance = null;
let scannerCallback = null;

function abrirScannerMobile(onScanCallback) {
    scannerCallback = onScanCallback;

    // Crear overlay del scanner
    const overlay = document.createElement('div');
    overlay.id = 'mobile-scanner-overlay';
    overlay.className = 'scanner-overlay active';
    overlay.innerHTML = `
        <div id="scanner-reader" style="width: 100%; height: 100%;"></div>
        <div class="scanner-frame"></div>
        <div class="scanner-controls">
            <button class="scanner-btn close" onclick="cerrarScannerMobile()">
                <i class="fas fa-times"></i>
            </button>
            <button class="scanner-btn flash" onclick="toggleFlash()">
                <i class="fas fa-bolt"></i>
            </button>
        </div>
        <div style="position: absolute; top: 40px; left: 50%; transform: translateX(-50%); background: white; padding: 12px 24px; border-radius: 16px; font-weight: bold; text-align: center;">
            <i class="fas fa-barcode text-indigo-600 text-2xl mb-2"></i>
            <p class="text-sm text-slate-800">Enfocá el código de barras</p>
        </div>
    `;

    document.body.appendChild(overlay);

    // Iniciar html5-qrcode
    if (typeof Html5Qrcode !== 'undefined') {
        scannerInstance = new Html5Qrcode("scanner-reader");

        const config = {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
            formatsToSupport: [
                Html5QrcodeSupportedFormats.QR_CODE,
                Html5QrcodeSupportedFormats.EAN_13,
                Html5QrcodeSupportedFormats.EAN_8,
                Html5QrcodeSupportedFormats.CODE_128,
                Html5QrcodeSupportedFormats.CODE_39
            ]
        };

        scannerInstance.start(
            { facingMode: "environment" },
            config,
            (decodedText, decodedResult) => {
                // Vibración de feedback
                if (navigator.vibrate) {
                    navigator.vibrate(200);
                }

                // Llamar al callback
                if (scannerCallback) {
                    scannerCallback(decodedText);
                }

                cerrarScannerMobile();
                Notificar.toast(`Código escaneado: ${decodedText}`, "success");
            },
            (errorMessage) => {
                // Errores silenciosos durante el escaneo
            }
        ).catch(err => {
            console.error("Error iniciando scanner:", err);
            cerrarScannerMobile();
            Notificar.error("CÁMARA NO DISPONIBLE", "No se pudo acceder a la cámara del dispositivo.");
        });
    } else {
        Notificar.error("SCANNER NO DISPONIBLE", "La biblioteca de escaneo no está cargada.");
        cerrarScannerMobile();
    }
}

function cerrarScannerMobile() {
    if (scannerInstance) {
        scannerInstance.stop().then(() => {
            scannerInstance.clear();
            scannerInstance = null;
        }).catch(err => {
            console.error("Error deteniendo scanner:", err);
        });
    }

    const overlay = document.getElementById('mobile-scanner-overlay');
    if (overlay) {
        overlay.remove();
    }
}

function toggleFlash() {
    // Funcionalidad de flash (depende del dispositivo)
    Notificar.toast("Flash toggle (función experimental)", "info");
}

// ==========================================
// BOTONES DE ACCIÓN FLOTANTES (FAB)
// ==========================================
function inicializarFABs() {
    if (!isMobile.any()) return;

    // Evitar duplicados
    if (document.querySelector('.fab-container')) return;

    const fabContainer = document.createElement('div');
    fabContainer.className = 'fab-container';
    // Ocultos por defecto con style="display: none;"
    fabContainer.innerHTML = `
        <button id="fab-scan" class="fab-button fab-scan" style="display: none;" onclick="accionRapidaScan()" title="Escanear Código">
            <i class="fas fa-barcode"></i>
        </button>
        <button id="fab-add" class="fab-button fab-add" style="display: none;" onclick="accionRapidaAgregar()" title="Agregar Rápido">
            <i class="fas fa-plus"></i>
        </button>
    `;

    document.body.appendChild(fabContainer);
}

function actualizarVisibilidadFABs(vista) {
    const btnScan = document.getElementById('fab-scan');
    const btnAdd = document.getElementById('fab-add');
    if (!btnScan || !btnAdd) return;

    // Resetear a oculto
    btnScan.style.display = 'none';
    btnAdd.style.display = 'none';

    // Mostrar según vista
    if (vista.includes('recepcion') || vista.includes('inventario') || vista.includes('posiciones')) {
        btnScan.style.display = 'flex';
    }

    if (vista.includes('pedidos')) {
        btnAdd.style.display = 'flex';
    }
}

function accionRapidaScan() {
    abrirScannerMobile((codigoEscaneado) => {
        // Buscar en qué vista estamos
        const vistActual = detectarVistaActual();

        if (vistActual === 'recepcion') {
            // Llenar campo de SKU
            const inputSku = document.getElementById('rec-producto');
            if (inputSku) {
                inputSku.value = codigoEscaneado;
            }
        } else if (vistActual === 'pedidos') {
            // Buscar producto por SKU
            buscarProductoPorSKU(codigoEscaneado);
        } else {
            // Vista genérica - mostrar código
            Notificar.toast(`Código: ${codigoEscaneado}`, "info");
        }
    });
}

function accionRapidaAgregar() {
    const vistaActual = detectarVistaActual();

    if (vistaActual === 'pedidos') {
        abrirModalPedido();
    } else if (vistaActual === 'inventario') {
        abrirModalProducto();
    } else if (vistaActual === 'posiciones') {
        abrirModalPosicion();
    } else {
        // Menú de acciones rápidas
        mostrarMenuAccionesRapidas();
    }
}

function detectarVistaActual() {
    const container = document.getElementById('view-container');
    if (!container) return null;

    const html = container.innerHTML.toLowerCase();

    if (html.includes('recepción') || html.includes('rec-producto')) return 'recepcion';
    if (html.includes('pedido') || html.includes('ped-cliente')) return 'pedidos';
    if (html.includes('inventario') || html.includes('lista-productos')) return 'inventario';
    if (html.includes('posiciones') || html.includes('mapa-posiciones')) return 'posiciones';

    return null;
}

function mostrarMenuAccionesRapidas() {
    Swal.fire({
        title: 'Acción Rápida',
        html: `
            <div class="grid grid-cols-2 gap-4 p-4">
                <button onclick="loadPage('pedidos.html'); Swal.close();" 
                    class="flex flex-col items-center p-6 bg-indigo-50 rounded-2xl hover:bg-indigo-100 transition-all">
                    <i class="fas fa-clipboard-list text-3xl text-indigo-600 mb-2"></i>
                    <span class="text-sm font-bold text-slate-800">Nuevo Pedido</span>
                </button>
                <button onclick="loadPage('recepcion.html'); Swal.close();" 
                    class="flex flex-col items-center p-6 bg-emerald-50 rounded-2xl hover:bg-emerald-100 transition-all">
                    <i class="fas fa-truck-ramp-box text-3xl text-emerald-600 mb-2"></i>
                    <span class="text-sm font-bold text-slate-800">Recepción</span>
                </button>
                <button onclick="loadPage('inventario.html'); Swal.close();" 
                    class="flex flex-col items-center p-6 bg-amber-50 rounded-2xl hover:bg-amber-100 transition-all">
                    <i class="fas fa-box text-3xl text-amber-600 mb-2"></i>
                    <span class="text-sm font-bold text-slate-800">Producto</span>
                </button>
                <button onclick="loadPage('movimientos.html'); Swal.close();" 
                    class="flex flex-col items-center p-6 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-all">
                    <i class="fas fa-exchange-alt text-3xl text-slate-600 mb-2"></i>
                    <span class="text-sm font-bold text-slate-800">Movimientos</span>
                </button>
            </div>
        `,
        showConfirmButton: false,
        showCloseButton: true,
        width: '90%'
    });
}

async function buscarProductoPorSKU(sku) {
    try {
        const { data, error } = await _supabase
            .from('productos')
            .select('*')
            .eq('sku', sku)
            .single();

        if (error || !data) {
            Notificar.error("PRODUCTO NO ENCONTRADO", `No se encontró un producto con SKU: ${sku}`);
            return;
        }

        Notificar.toast(`Producto encontrado: ${data.nombre}`, "success");

        // Si estamos en pedidos, agregarlo automáticamente
        const selectProducto = document.getElementById('ped-producto-select');
        if (selectProducto) {
            selectProducto.value = data.id;
        }
    } catch (e) {
        console.error("Error buscando producto:", e);
        Notificar.error("ERROR", "No se pudo buscar el producto.");
    }
}

// ==========================================
// VIBRACIÓN HÁPTICA (Feedback)
// ==========================================
function vibrarFeedback(tipo = 'ligero') {
    if (!navigator.vibrate) return;

    const patrones = {
        ligero: [10],
        medio: [50],
        fuerte: [100],
        exito: [50, 30, 50],
        error: [100, 50, 100, 50, 100]
    };

    navigator.vibrate(patrones[tipo] || patrones.ligero);
}

// ==========================================
// TECLADO NUMÉRICO MÓVIL
// ==========================================
function crearTecladoNumerico(inputId) {
    if (!isMobile.any()) return;

    const input = document.getElementById(inputId);
    if (!input) return;

    const teclado = document.createElement('div');
    teclado.className = 'mobile-numpad';

    const numeros = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'];

    numeros.forEach(num => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = num;
        btn.onclick = () => {
            vibrarFeedback('ligero');

            if (num === 'C') {
                input.value = '';
            } else if (num === '⌫') {
                input.value = input.value.slice(0, -1);
            } else {
                input.value += num;
            }

            input.dispatchEvent(new Event('input', { bubbles: true }));
        };
        teclado.appendChild(btn);
    });

    input.parentElement.appendChild(teclado);
}

// ==========================================
// AUTO-HIDE SIDEBAR EN SCROLL (Móvil)
// ==========================================
let lastScrollTop = 0;
let isScrolling;

function inicializarAutoHideSidebar() {
    if (!isMobile.any()) return;

    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    mainContent.addEventListener('scroll', function () {
        const st = this.scrollTop;

        // Cerrar sidebar si se hace scroll
        if (st > lastScrollTop && st > 50) {
            const sidebar = document.getElementById('sidebar');
            if (sidebar && !sidebar.classList.contains('-translate-x-full')) {
                sidebar.classList.add('-translate-x-full');
            }
        }

        lastScrollTop = st <= 0 ? 0 : st;
    }, false);
}

// ==========================================
// INSTALACIÓN COMO PWA
// ==========================================
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;

    // Mostrar botón de instalación personalizado
    mostrarBotonInstalarApp();
});

function mostrarBotonInstalarApp() {
    const botonInstalar = document.createElement('button');
    botonInstalar.className = 'fab-button';
    botonInstalar.style.cssText = 'position: fixed; bottom: 160px; right: 20px; background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);';
    botonInstalar.innerHTML = '<i class="fas fa-download"></i>';
    botonInstalar.onclick = instalarApp;

    document.body.appendChild(botonInstalar);
}

async function instalarApp() {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
        Notificar.toast('¡App instalada correctamente!', 'success');
    }

    deferredPrompt = null;
}

// ==========================================
// INICIALIZACIÓN EN MÓVIL
// ==========================================
document.addEventListener('DOMContentLoaded', function () {
    if (isMobile.any()) {
        console.log('📱 Modo móvil activado');

        // Inicializar funcionalidades móviles
        setTimeout(() => {
            inicializarFABs();
            inicializarAutoHideSidebar();
        }, 500);

        // Prevenir zoom en doble tap
        let lastTouchEnd = 0;
        document.addEventListener('touchend', function (event) {
            const now = (new Date()).getTime();
            if (now - lastTouchEnd <= 300) {
                event.preventDefault();
            }
            lastTouchEnd = now;
        }, false);
    }
});
