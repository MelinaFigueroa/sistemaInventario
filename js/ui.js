// js/ui.js - Funciones de interfaz de usuario (Modales, Drawers, Sidebar)

// ==========================================
// FUNCIONES DE SIDEBAR Y NAVEGACIÓN
// ==========================================
function toggleSidebar() {
    document.getElementById("sidebar").classList.toggle("-translate-x-full");
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
        title: 'NUEVO PRODUCTO VITAL CAN',
        html: `
            <div class="text-left">
                <label class="text-[10px] font-black text-slate-400 uppercase ml-2">Nombre Comercial</label>
                <input id="swal-nombre" class="swal2-input !mt-1 !mb-4" placeholder="Ej: Vital Can Adulto 15kg">
                
                <label class="text-[10px] font-black text-slate-400 uppercase ml-2">SKU / Código de Barras</label>
                <input id="swal-sku" class="swal2-input !mt-1 !mb-4" placeholder="Escaneá con el celu...">
                
                <label class="text-[10px] font-black text-slate-400 uppercase ml-2">Stock Mínimo (Alerta)</label>
                <input id="swal-minimo" type="number" class="swal2-input !mt-1" placeholder="Ej: 10">
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonColor: '#4f46e5',
        confirmButtonText: 'GUARDAR PRODUCTO',
        cancelButtonText: 'CANCELAR',
        background: '#ffffff',
        didOpen: () => {
            document.getElementById('swal-sku').focus();
        },
        preConfirm: () => {
            const nombre = document.getElementById('swal-nombre').value;
            const sku = document.getElementById('swal-sku').value;
            const minimo = document.getElementById('swal-minimo').value;

            if (!nombre || !sku) {
                Swal.showValidationMessage('¡Nombre y SKU son obligatorios!');
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
                    sku: formValues.sku.toUpperCase(),
                    stock_minimo: parseInt(formValues.stock_minimo) || 5
                }
            ]);

            if (error) throw error;

            Notificar.toast("Producto guardado correctamente");
            if (typeof renderInventario === 'function') renderInventario();
        } catch (err) {
            Notificar.error("ERROR AL GUARDAR", "Es posible que el SKU ya exista en la base de datos.");
        }
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
