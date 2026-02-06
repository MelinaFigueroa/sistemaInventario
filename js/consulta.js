// js/consulta.js - Lógica de Consulta de Producto Avanzada

async function consultarProducto(skuDirecto = null) {
    const input = document.getElementById("input-consulta");
    const sku = skuDirecto || input?.value?.trim().toUpperCase();

    if (!sku) {
        Notificar.error("ERROR", "Ingresá un SKU o escaneá un código.");
        return;
    }

    try {
        // Mostrar cargando
        Swal.fire({
            title: 'Buscando Producto...',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });

        // 1. Consultar Producto, sus posiciones y sus LOTES
        const { data, error } = await _supabase
            .from("productos")
            .select(`
                id, nombre, sku, stock_minimo,
                posiciones (id, cantidad, estado),
                lotes (numero_lote, vencimiento, cantidad_actual, posicion_id)
            `)
            .eq("sku", sku)
            .single();

        Swal.close();

        if (error || !data) {
            Notificar.error("NO ENCONTRADO", `No se halló el producto: ${sku}`);
            return;
        }

        // 2. Renderizar Resultados
        mostrarResultadosConsulta(data);

    } catch (err) {
        console.error("Error en consulta:", err);
        Swal.close();
        Notificar.error("ERROR", "Problema al conectar con la base de datos.");
    }
}

function mostrarResultadosConsulta(prod) {
    const resDiv = document.getElementById("resultado-consulta");
    const emptyDiv = document.getElementById("consulta-vacia");

    if (!resDiv || !emptyDiv) return;

    // Llenar datos básicos
    document.getElementById("consulta-nombre").innerText = prod.nombre;
    document.getElementById("consulta-sku").innerText = `#${prod.sku}`;

    // Calcular Stock Total
    const stockTotal = prod.posiciones?.reduce((acc, curr) => acc + (curr.cantidad || 0), 0) || 0;
    document.getElementById("consulta-stock-total").innerText = stockTotal;

    // Lotes y Vencimiento Próximo
    const lotesActivos = prod.lotes?.filter(l => l.cantidad_actual > 0).sort((a, b) => new Date(a.vencimiento) - new Date(b.vencimiento)) || [];
    const proximoVto = lotesActivos.length > 0 ? lotesActivos[0].vencimiento : null;

    const vtoDisplay = document.querySelector(".bg-slate-900 p.text-lg");
    if (vtoDisplay) {
        vtoDisplay.innerText = proximoVto ? new Date(proximoVto).toLocaleDateString() : "-- / -- / --";
        vtoDisplay.classList.toggle("text-rose-500", proximoVto && new Date(proximoVto) < new Date());
    }

    // Status de Stock
    const statusElem = document.getElementById("status-stock");
    if (stockTotal <= 0) {
        statusElem.className = "mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black uppercase italic bg-rose-100 text-rose-600";
        statusElem.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Sin Stock';
    } else if (stockTotal < (prod.stock_minimo || 5)) {
        statusElem.className = "mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black uppercase italic bg-amber-100 text-amber-600";
        statusElem.innerHTML = '<i class="fas fa-exclamation-circle"></i> Stock Crítico';
    } else {
        statusElem.className = "mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black uppercase italic bg-emerald-100 text-emerald-600";
        statusElem.innerHTML = '<i class="fas fa-check-circle"></i> Stock Saludable';
    }

    // Ubicaciones Detalladas por Lote
    const posContainer = document.getElementById("consulta-posiciones");
    const containerUbicaciones = document.getElementById("container-ubicaciones");

    if (window.currentUserRole === 'ventas') {
        if (containerUbicaciones) containerUbicaciones.classList.add("hidden");
    } else {
        if (containerUbicaciones) containerUbicaciones.classList.remove("hidden");

        if (lotesActivos.length === 0) {
            posContainer.innerHTML = '<p class="text-xs text-slate-400 italic text-center py-4">Sin lotes activos registrados.</p>';
        } else {
            posContainer.innerHTML = lotesActivos.map(l => `
                <div class="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-200 transition-colors">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg font-black text-xs italic">
                            ${l.posicion_id || '--'}
                        </div>
                        <div>
                            <p class="font-black text-slate-800 uppercase italic text-sm">Lote: ${l.numero_lote}</p>
                            <p class="text-[9px] font-bold text-slate-400 uppercase">Vence: ${new Date(l.vencimiento).toLocaleDateString()}</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="font-black text-indigo-600">${l.cantidad_actual} u.</p>
                        <p class="text-[9px] font-bold text-slate-500 uppercase italic">Stock Lote</p>
                    </div>
                </div>
            `).join("");
        }
    }

    // Alternar visibilidad
    emptyDiv.classList.add("hidden");
    resDiv.classList.remove("hidden");
}

function activarEscanerConsulta() {
    if (typeof abrirScannerMobile === 'function') {
        abrirScannerMobile((codigo) => {
            document.getElementById("input-consulta").value = codigo;
            consultarProducto(codigo);
        });
    } else {
        Notificar.error("ERROR", "El escáner no está disponible.");
    }
}
