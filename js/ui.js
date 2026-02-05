// js/ui.js - Funciones de interfaz de usuario (Modales, Drawers, Sidebar)

// ==========================================
// FUNCIONES DE SIDEBAR Y NAVEGACIÓN
// ==========================================
function toggleSidebar() {
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebar-overlay");
    const hamburgerBtn = document.getElementById("hamburger-btn");

    const isOpen = !sidebar.classList.contains("-translate-x-full");

    if (isOpen) {
        closeSidebar();
    } else {
        openSidebar();
    }
}

function openSidebar() {
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebar-overlay");
    const hamburgerBtn = document.getElementById("hamburger-btn");

    sidebar.classList.remove("-translate-x-full");
    if (overlay) overlay.classList.remove("hidden");
    if (hamburgerBtn) hamburgerBtn.classList.add("opacity-0", "pointer-events-none");

    // Prevenir scroll del body cuando sidebar está abierto
    document.body.style.overflow = 'hidden';
}

function closeSidebar() {
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebar-overlay");
    const hamburgerBtn = document.getElementById("hamburger-btn");

    sidebar.classList.add("-translate-x-full");
    if (overlay) overlay.classList.add("hidden");
    if (hamburgerBtn) hamburgerBtn.classList.remove("opacity-0", "pointer-events-none");

    // Restaurar scroll del body
    document.body.style.overflow = '';
}

// ==========================================
// DRAWER (Panel lateral derecho)
// ==========================================
function openDrawer(posId, prodName, qty, desc) {
    document.getElementById("drawer-pos-id").innerText = "Rack " + posId;
    document.getElementById("drawer-prod-name").innerText = prodName;
    document.getElementById("drawer-prod-qty").innerText = qty;
    document.getElementById("drawer-prod-desc").innerText = desc;
    document.getElementById("drawer").classList.remove("translate-x-full");
    document.getElementById("drawer-overlay").classList.remove("hidden");
}

function closeDrawer() {
    document.getElementById("drawer").classList.add("translate-x-full");
    document.getElementById("drawer-overlay").classList.add("hidden");
}

function goToStep1() {
    document.getElementById("step-2").classList.add("hidden");
    document.getElementById("step-1").classList.remove("hidden");
}

function goToStep2() {
    document.getElementById("step-1").classList.add("hidden");
    document.getElementById("step-2").classList.remove("hidden");
}

async function confirmMove() {
    const qty = document.getElementById("move-qty").value;
    const dest = document.getElementById("move-dest").value;

    if (!qty || !dest) {
        Notificar.error("DATOS INCOMPLETOS", "Completá cantidad y destino.");
        return;
    }

    Notificar.toast("Movimiento registrado correctamente");
    closeDrawer();
    goToStep1();
}

// ==========================================
// MODALES DE CREACIÓN
// ==========================================
async function abrirModalPosicion() {
    const { value: nombreRack } = await Swal.fire({
        title: 'CREAR NUEVO RACK',
        input: 'text',
        inputLabel: 'Identificador (Ej: A-12, PASILLO-1)',
        inputPlaceholder: 'Escribí el nombre del rack...',
        showCancelButton: true,
        confirmButtonColor: '#4f46e5',
        confirmButtonText: 'CREAR AHORA',
        cancelButtonText: 'CANCELAR',
        inputValidator: (value) => { if (!value) return '¡El nombre es obligatorio!'; }
    });

    if (nombreRack) {
        const { error } = await _supabase.from('posiciones').insert([{
            id: nombreRack.toUpperCase(),
            estado: 'vacio',
            cantidad: 0
        }]);

        if (error) {
            Notificar.error('ERROR', 'Ese nombre de rack ya existe o hubo un problema de conexión.');
        } else {
            Notificar.toast(`Rack ${nombreRack.toUpperCase()} creado`);
            renderPosiciones();
        }
    }
}

async function abrirModalProducto() {
    const { value: formValues } = await Swal.fire({
        title: '<div class="pt-2"><span class="text-lg font-bold uppercase tracking-tight text-slate-700">Nuevo Producto</span></div>',
        html: `
            <div class="text-left space-y-5 px-1 pt-4">
                <div>
                    <label class="block text-[9px] font-bold text-slate-400 uppercase mb-1.5 tracking-wider">Nombre del Producto</label>
                    <input id="swal-nombre" class="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-semibold text-slate-700 text-sm transition-all" placeholder="Ej: Balanced Adulto 15kg">
                </div>
                
                <div>
                    <label class="block text-[9px] font-bold text-slate-400 uppercase mb-1.5 tracking-wider">SKU / Código EAN</label>
                    <div class="flex gap-2">
                        <input id="swal-sku" class="flex-1 p-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-mono text-slate-700 text-sm transition-all" placeholder="Escanear...">
                        <button type="button" onclick="activarEscanerNuevoProducto()" class="bg-indigo-600 text-white w-12 h-12 rounded-xl flex items-center justify-center hover:bg-indigo-700 active:scale-95 transition-all shadow-sm">
                            <i class="fas fa-barcode text-lg"></i>
                        </button>
                    </div>
                </div>
                
                <div>
                    <label class="block text-[9px] font-bold text-slate-400 uppercase mb-1.5 tracking-wider">Stock Mínimo</label>
                    <input id="swal-minimo" type="number" class="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-semibold text-slate-700 text-sm" placeholder="Cantidad mínima">
                </div>
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Confirmar Alta',
        cancelButtonText: 'Volver',
        customClass: {
            confirmButton: 'bg-indigo-600 px-8 py-3.5 rounded-xl font-bold uppercase text-xs text-white tracking-widest hover:bg-indigo-700 transition-all shadow-md',
            cancelButton: 'bg-slate-100 text-slate-500 px-8 py-3.5 rounded-xl font-bold uppercase text-xs tracking-widest ml-3 hover:bg-slate-200 transition-all'
        },
        buttonsStyling: false,
        didOpen: () => {
            document.getElementById('swal-nombre').focus();
        },
        preConfirm: () => {
            const nombre = document.getElementById('swal-nombre').value;
            const sku = document.getElementById('swal-sku').value;
            const minimo = document.getElementById('swal-minimo').value;

            if (!nombre || !sku) {
                Swal.showValidationMessage('Completá nombre y SKU por favor');
                return false;
            }
            return { nombre, sku, stock_minimo: minimo };
        }
    });

    if (formValues) {
        try {
            const { error } = await _supabase.from('productos').insert([
                {
                    nombre: formValues.nombre.toUpperCase(),
                    sku: formValues.sku.toLocaleUpperCase(),
                    stock_minimo: parseInt(formValues.stock_minimo) || 5
                }
            ]);

            if (error) throw error;

            Notificar.toast("Producto agregado al catálogo", "success");
            if (typeof renderInventario === 'function') renderInventario();
            if (typeof prepararRecepcion === 'function') prepararRecepcion();
        } catch (err) {
            Notificar.error("Error", "El SKU ya existe o hay un problema de red.");
        }
    }
}

// Función auxiliar para escanear desde el modal de nuevo producto
function activarEscanerNuevoProducto() {
    if (typeof abrirScannerMobile === 'function') {
        abrirScannerMobile((codigo) => {
            const inputSku = document.getElementById('swal-sku');
            if (inputSku) {
                inputSku.value = codigo;
                inputSku.classList.add("ring-4", "ring-indigo-500");
                setTimeout(() => inputSku.classList.remove("ring-4", "ring-indigo-500"), 1000);
            }
        });
    }
}

// ==========================================
// FUNCIONES DE EXPORTACIÓN
// ==========================================
function exportarTablaAExcel(idTabla, nombreArchivo = 'reporte-vitalcan') {
    const tabla = document.getElementById(idTabla);
    const filas = Array.from(tabla.querySelectorAll('tr'));

    if (filas.length <= 1) {
        return Notificar.error("SIN DATOS", "No hay movimientos para exportar en este momento.");
    }

    const BOM = "\uFEFF";
    const contenidoCsv = filas.map(fila => {
        const celdas = Array.from(fila.querySelectorAll('th, td'));
        return celdas.map(celda => {
            let texto = celda.innerText.replace(/\n/g, ' ').replace(/"/g, '""').trim();
            return `"${texto}"`;
        }).join(';');
    }).join('\n');

    const blob = new Blob([BOM + contenidoCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.setAttribute("href", url);
    link.setAttribute("download", `${nombreArchivo}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    Notificar.toast("Descargando reporte de trazabilidad...", "success");
}

function filtrarMovimientos() {
    const term = document.getElementById('buscar-movimiento').value.toLowerCase();
    const filas = document.querySelectorAll('#tabla-movimientos tr');

    filas.forEach(fila => {
        const texto = fila.innerText.toLowerCase();
        fila.style.display = texto.includes(term) ? '' : 'none';
    });
}
