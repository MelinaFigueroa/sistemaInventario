# HaruwenWMS - Sistema de Gestión de Inventario
## Documentación de Arquitectura y Estructura del Proyecto

---

## 📁 Estructura Actual del Proyecto

```
SistemaInventario/
│
├── index.html                 # Página de login
│
├── pages/                     # Vistas del sistema (SPA)
│   ├── dashboard.html         # Panel principal
│   ├── inicio.html            # Vista de inicio/KPIs
│   ├── pedidos.html           # Gestión de pedidos
│   ├── facturacion.html       # Facturación y ventas
│   ├── posiciones.html        # Mapa de racks
│   ├── inventario.html        # Catálogo de productos
│   ├── movimientos.html       # Trazabilidad
│   └── recepcion.html         # Recepción de mercadería
│
├── js/                        # Módulos JavaScript (MODULARIZADO)
│   ├── config.js              # ⚙️ Configuración global
│   ├── router.js              # 🧭 Sistema de navegación SPA
│   ├── renders.js             # 📊 Renderizado de datos
│   ├── ui.js                  # 🎨 Interfaz y modales
│   ├── pedidos.js             # 📦 Lógica de pedidos
│   ├── recepcion.js           # 📥 Recepción y OCR
│   ├── movimientos.js         # 🔄 Trazabilidad
│   └── app.js                 # 🚀 Inicialización principal
│
├── supabase/                  # Edge Functions (Backend)
│   └── functions/
│       └── afip-invoice/      # Integración con AFIP
│
└── README.md                  # Esta documentación
```

---

## 🏗️ Arquitectura Modular Implementada

### **Módulos y sus Responsabilidades**

#### 1️⃣ **config.js** - Configuración Global
- Cliente de Supabase (`_supabase`)
- Variables globales (`USUARIO_ACTUAL`, `itemsPedidoTemporal`)
- Sistema de notificaciones (`Notificar`)
- **Dependencias:** Ninguna
- **Es requerido por:** Todos los demás módulos

#### 2️⃣ **router.js** - Sistema de Navegación
- Función `loadPage()` para SPA (Single Page Application)
- Carga dinámica de vistas HTML
- Dispara renderizado según la página cargada
- **Dependencias:** `config.js`
- **Es usado por:** Todos los botones de navegación

#### 3️⃣ **renders.js** - Renderizado de Datos
- `actualizarDashboard()` - KPIs y alertas
- `renderPosiciones()` - Mapa de racks
- `renderPedidos()` - Lista de pedidos
- `renderFacturacion()` - Facturas y ventas
- `renderInventario()` - Catálogo de productos
- `renderMovimientos()` - Trazabilidad
- `prepararRecepcion()` - Formularios de recepción
- **Dependencias:** `config.js`
- **Es usado por:** `router.js`, eventos de UI

#### 4️⃣ **ui.js** - Interfaz de Usuario
- Modales: `abrirModalPosicion()`, `abrirModalProducto()`
- Drawers: `openDrawer()`, `closeDrawer()`
- Sidebar: `toggleSidebar()`
- Exportación: `exportarTablaAExcel()`
- Filtros: `filtrarMovimientos()`
- **Dependencias:** `config.js`, `renders.js` (indirectamente)
- **Es usado por:** Botones y eventos del DOM

#### 5️⃣ **pedidos.js** - Gestión de Pedidos
- `abrirModalPedido()` - Crear pedidos
- `agregarItemTemporal()` - Items del pedido
- `guardarPedidoSupabase()` - Persistir pedido
- `procesarPicking()` - Picking + Facturación AFIP
- **Dependencias:** `config.js`, `renders.js`
- **Es usado por:** Vista de pedidos

#### 6️⃣ **recepcion.js** - Recepción de Mercadería
- `procesarRecepcion()` - Entrada de stock
- `procesarRemitoPDF()` - OCR con Tesseract.js
- `iniciarEscanerCodigoBarras()` - Lector QR/Barras
- **Dependencias:** `config.js`, Tesseract.js, html5-qrcode
- **Es usado por:** Vista de recepción

#### 7️⃣ **movimientos.js** - Trazabilidad
- `registrarMovimientoManual()` - Log de movimientos
- `ajustarInventario()` - Ajustes de stock
- `transferirEntreRacks()` - Transferencias internas
- **Dependencias:** `config.js`, `renders.js`
- **Es usado por:** Varias vistas

#### 8️⃣ **app.js** - Inicialización
- `checkUser()` - Verificación de sesión
- Helpers globales: `formatearFecha()`, `formatearMoneda()`
- DOMContentLoaded listener
- **Dependencias:** Todos los módulos anteriores
- **Debe cargarse ÚLTIMO**

---

## 🔧 Orden de Carga de Scripts (IMPORTANTE)

En `dashboard.html`, los scripts DEBEN cargarse en este orden:

```html
<!-- 1. Bibliotecas externas -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
<script src="https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js"></script>
<script src="https://unpkg.com/html5-qrcode"></script>

<!-- 2. Configuración (PRIMERO) -->
<script src="../js/config.js"></script>

<!-- 3. Router -->
<script src="../js/router.js"></script>

<!-- 4. Módulos de funcionalidad (sin dependencias entre sí) -->
<script src="../js/renders.js"></script>
<script src="../js/ui.js"></script>
<script src="../js/pedidos.js"></script>
<script src="../js/recepcion.js"></script>
<script src="../js/movimientos.js"></script>

<!-- 5. Inicializador (ÚLTIMO) -->
<script src="../js/app.js"></script>
```

---

## ✅ Ventajas de la Estructura Actual

1. **Modularidad:** Cada archivo tiene una responsabilidad clara
2. **Mantenibilidad:** Fácil encontrar y modificar funciones
3. **Escalabilidad:** Agregar nuevos módulos es simple
4. **Debugging:** Errores más fáciles de rastrear
5. **Colaboración:** Múltiples personas pueden trabajar en paralelo
6. **Reutilización:** Funciones organizadas y documentadas

---

## 🚀 Recomendaciones para Escalar el Proyecto

### 📌 **CORTO PLAZO (Próximos 1-2 meses)**

#### 1. **Agregar Control de Versiones Git**
```bash
git init
git add .
git commit -m "Estructura modularizada WMS"
```
- Crear `.gitignore` para no subir archivos sensibles
- Hacer commits frecuentes con mensajes descriptivos

#### 2. **Separar Configuración Sensible**
- Crear `js/config.local.js` (no subir a Git) para keys de Supabase
- Usar variables de entorno en producción

#### 3. **Agregar Validación de Datos**
- Crear `js/validators.js` para validar inputs
- Prevenir errores antes de enviar a Supabase

#### 4. **Implementar Manejo de Errores Centralizado**
```javascript
// js/errors.js
window.addEventListener('error', (event) => {
    console.error('Error global:', event.error);
    // Enviar a servicio de logging
});
```

---

### 📌 **MEDIANO PLAZO (3-6 meses)**

#### 1. **Migrar a un Framework Moderno**
Si el proyecto sigue creciendo, considera:
- **Vite + Vanilla JS** (más ligero)
- **React** (más documentación y comunidad)
- **Vue.js** (curva de aprendizaje suave)

**Ventajas:**
- Build system profesional
- Hot reload en desarrollo
- Minificación y optimización automática
- Gestión de dependencias con npm/pnpm

#### 2. **Implementar Sistema de Roles y Permisos**
```javascript
// js/auth.js
const ROLES = {
    ADMIN: ['pedidos', 'facturacion', 'inventario', 'usuarios'],
    OPERADOR: ['recepcion', 'movimientos', 'posiciones'],
    VENDEDOR: ['pedidos', 'facturacion']
};
```

#### 3. **Agregar Tests Automatizados**
- Unit tests para funciones críticas (Vitest o Jest)
- Tests de integración para flujos completos
- Tests E2E con Playwright

#### 4. **Crear API Documentation**
- Documentar cada función con JSDoc
- Generar documentación automática

---

### 📌 **LARGO PLAZO (6+ meses)**

#### 1. **Arquitectura de Microservicios**
```
Backend separado:
- API REST en Node.js + Express
- Supabase solo para DB y Auth
- Redis para cache
- RabbitMQ para colas (ej: procesamiento de PDFs)
```

#### 2. **Aplicación Móvil**
- React Native o Flutter
- Compartir lógica de negocio con la web

#### 3. **Dashboard de Analytics**
- Integrar Google Analytics o Mixpanel
- Dashboard de BI con Metabase o Superset

#### 4. **Integración con ERPs Externos**
- APIs para conectar con sistemas de contabilidad
- Sincronización automática de inventarios

---

## 🎯 Estructura Recomendada para ESCALAR (Futura)

```
sistemaInventario/
│
├── frontend/                  # Aplicación web
│   ├── public/
│   ├── src/
│   │   ├── components/        # Componentes reutilizables
│   │   ├── pages/             # Vistas/páginas
│   │   ├── services/          # Lógica de negocio
│   │   ├── utils/             # Helpers
│   │   ├── hooks/             # Custom hooks (si usas React)
│   │   └── config/            # Configuración
│   ├── tests/                 # Tests automatizados
│   └── package.json
│
├── backend/                   # API Node.js (Opcional)
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   └── middleware/
│
├── mobile/                    # App móvil (Futuro)
│
├── docs/                      # Documentación
│   ├── API.md
│   ├── SETUP.md
│   └── ARCHITECTURE.md
│
└── .github/                   # CI/CD
    └── workflows/
        └── deploy.yml
```

---

## 🛠️ Herramientas Recomendadas

### **Desarrollo**
- **VS Code** con extensiones:
  - ESLint (calidad de código)
  - Prettier (formateo automático)
  - GitLens (visualización de Git)
  - Thunder Client (testing de APIs)

### **Testing**
- **Vitest** - Tests unitarios
- **Playwright** - Tests E2E
- **Mock Service Worker** - Mocking de APIs

### **Deployment**
- **Vercel** o **Netlify** (frontend)
- **Supabase Edge Functions** (backend serverless)
- **GitHub Actions** (CI/CD)

### **Monitoring**
- **Sentry** - Error tracking
- **Google Analytics** - Métricas de uso
- **LogRocket** - Session replay

---

## 📚 Próximos Pasos Inmediatos

1. ✅ **Probar que todo funcione** (las rutas ahora están correctas)
2. 📝 **Documentar funciones** con comentarios JSDoc
3. 🔐 **Mover credenciales** a archivo separado
4. 📦 **Inicializar Git** y hacer primer commit
5. 🧪 **Testear flujos críticos** (pedidos, facturación)
6. 📱 **Testear responsividad** en móviles

---

## 💡 Consejos Profesionales

1. **No sobre-ingenierizar:** La estructura actual es perfecta para un WMS de este tamaño
2. **Refactoriza cuando duela:** Si una función tiene >100 líneas, divídela
3. **Documenta decisiones:** Crea un `CHANGELOG.md` para trackear cambios
4. **Backup automático:** Configura backups diarios de Supabase
5. **Monitorea performance:** Usa Chrome DevTools para detectar cuellos de botella

---

## 🤝 Trabajando Sola pero con Estándares Profesionales

Aunque trabajes sola, seguí estas prácticas:

- **Commits descriptivos:** "feat: agregar validación de stock en pedidos"
- **Branches:** `feature/nueva-vista`, `fix/bug-facturacion`
- **Code reviews:** Revisar tu propio código al día siguiente
- **Testing manual:** Checklist antes de cada deploy
- **Backups regulares:** Exportar DB semanalmente

---

## 📞 Recursos de Apoyo

- **Documentación Supabase:** https://supabase.com/docs
- **MDN Web Docs:** https://developer.mozilla.org
- **Stack Overflow:** Para debugging específico
- **GitHub Copilot:** Asistente de código IA

---

**Última actualización:** 05/02/2026
**Versión del WMS:** 1.0.0 (Modularizado)
**Mantenida por:** Melina Figueroa (HaruwenTech)
