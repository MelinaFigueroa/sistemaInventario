// js/router.js
async function loadPage(pageUrl) {
    const container = document.getElementById("view-container");
    if (!container) return;
    container.innerHTML = '<div class="flex justify-center py-20"><i class="fas fa-paw animate-bounce text-4xl text-indigo-500"></i></div>';

    try {
        // Si pageUrl no incluye una ruta completa (ej: 'inicio.html'), 
        // asumimos que está en la misma carpeta que dashboard.html
        const fullUrl = pageUrl.includes('/') ? pageUrl : `./${pageUrl}`;

        const response = await fetch(fullUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const content = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, "text/html");
        container.innerHTML = doc.querySelector("main") ? doc.querySelector("main").innerHTML : content;

        // Inicializadores de módulos
        // Disparar renders según página
        if (pageUrl.includes("posiciones")) renderPosiciones();
        if (pageUrl.includes("pedidos")) renderPedidos();
        if (pageUrl.includes("facturacion")) renderFacturacion();
        if (pageUrl.includes("inicio")) actualizarDashboard();
        if (pageUrl.includes("movimientos")) renderMovimientos();
        if (pageUrl.includes("inventario")) renderInventario();
        if (pageUrl.includes("recepcion")) prepararRecepcion();

    } catch (error) {
        console.error(error);
        Notificar.error("ERROR", "No se pudo cargar la página.");
    }
}