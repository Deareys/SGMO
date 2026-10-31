/** UI → API → SQL efímero → segundo contexto. Nunca toca Neon ni proveedores. */
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { randomBytes, randomUUID } = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { chromium } = require(
  require.resolve("playwright", {
    paths: [process.env.SGMO_PLAYWRIGHT_MODULES || process.cwd()],
  }),
);
const port = Number(process.env.SGMO_BROWSER_INVENTORY_PORT || 3106),
  origin = `http://127.0.0.1:${port}`;
const password = randomBytes(12).toString("hex"),
  bootstrap = randomBytes(32).toString("hex"),
  legacySecret = randomBytes(16).toString("hex");
const secrets = [password, bootstrap, legacySecret];
const redact = (value) =>
  secrets.reduce(
    (result, secret) => result.replaceAll(secret, "[REDACTED]"),
    String(value),
  );
let server,
  browser,
  output = "";
const checks = [];
const pageErrors = [];
const directory =
  process.env.SGMO_BROWSER_QA_DIR ||
  path.join(os.tmpdir(), `sgmo-config-${Date.now()}`);
async function eventually(action) {
  let last;
  for (let attempt = 0; attempt < 160; attempt++) {
    try {
      return await action();
    } catch (error) {
      last = error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw last;
}
async function write(context, endpoint, body, method = "POST") {
  const csrf = await context.request.get(origin + "/api/auth/csrf");
  assert.equal(csrf.status(), 200);
  return context.request.fetch(origin + endpoint, {
    method,
    data: body,
    headers: { Origin: origin, "X-CSRF-Token": (await csrf.json()).csrfToken },
  });
}
async function snapshot(context) {
  const response = await context.request.get(origin + "/api/bootstrap");
  assert.equal(response.status(), 200);
  return (await response.json()).state;
}
async function login(page, identifier) {
  await page.goto(origin);
  await page.getByLabel("Código de usuario o correo").fill(identifier);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await page.getByTitle("Abrir menú de navegación").waitFor();
}
async function configure(page) {
  await page.getByTitle("Abrir menú de navegación").click();
  await page
    .getByRole("button", { name: "Configuración", exact: true })
    .click();
}
async function main() {
  assert.ok(process.env.SGMO_PGLITE_ROOT);
  await fs.mkdir(directory, { recursive: true });
  try {
    await fetch(origin, { signal: AbortSignal.timeout(500) });
    throw new Error("Puerto ocupado");
  } catch (error) {
    if (error.message.includes("ocupado")) throw error;
  }
  server = spawn(
    process.execPath,
    ["--import", "tsx", "scripts/tests/fixtures/browser-central-server.ts"],
    {
      cwd: path.resolve(__dirname, "../.."),
      env: {
        ...process.env,
        NODE_ENV: "test",
        SGMO_BROWSER_CENTRAL_FIXTURE: "true",
        BOOTSTRAP_SECRET: bootstrap,
        SGMO_PUBLIC_ORIGIN: origin,
        PORT: String(port),
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  server.stdout.on("data", (chunk) => (output += chunk));
  server.stderr.on("data", (chunk) => (output += chunk));
  await eventually(() => {
    assert.equal(server.exitCode, null, redact(output));
    assert.ok(output.includes("SGMO_BROWSER_CENTRAL_READY"));
  });
  browser = await chromium.launch({ headless: true });
  const owner = await browser.newContext({
      viewport: { width: 1280, height: 1000 },
    }),
    worker = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
  const page = await owner.newPage(),
    seller = await worker.newPage();
  for (const target of [page, seller])
    target.on("pageerror", (error) => pageErrors.push(redact(error.message)));
  assert.equal(
    (
      await write(owner, "/api/auth/bootstrap-admin", {
        identifier: "ADM-01",
        newPassword: password,
        bootstrapSecret: bootstrap,
      })
    ).status(),
    200,
  );
  await login(page, "ADM-01");
  await login(seller, "ADM-01");
  for (const id of ["QA-HOUSE-A", "QA-HOUSE-B"])
    assert.equal(
      (
        await write(owner, "/api/houses", {
          id,
          attributes: {
            name: id,
            address: "Ensayo aislado",
            freezerCapacityUnits: 1000,
            fixedCostDaily: 0,
          },
        })
      ).status(),
      200,
    );
  assert.equal(
    (
      await write(owner, "/api/varieties", {
        id: "QA-VARIETY",
        attributes: {
          name: "Producto propio QA",
          basePriceIndividual: 10,
          comboPrices: { combo3: 25, combo6: 45, combo12: 85 },
        },
      })
    ).status(),
    200,
  );
  await page.reload({ waitUntil: "networkidle" });
  await configure(page);
  assert.equal(
    await page.getByText("Laboratorio de Pruebas MP", { exact: true }).count(),
    0,
  );
  assert.equal(
    await page
      .getByText("Seguridad de Credenciales de Mercado Pago:", { exact: true })
      .count(),
    0,
  );
  assert.equal(
    await page
      .getByRole("button", { name: "Recuperar datos anteriores", exact: true })
      .count(),
    0,
  );
  checks.push(
    "Configuración sin laboratorio, explicaciones técnicas ni recuperación en navegación habitual",
  );
  await page.getByRole("button", { name: /^Carritos \(/ }).click();
  await page
    .getByRole("button", { name: "Nuevo Carrito", exact: true })
    .click();
  const cartForm = page
    .locator("form")
    .filter({ has: page.getByPlaceholder("Ej: Carrito C-05 (Norte Gamma)") });
  await cartForm
    .getByPlaceholder("Ej: Carrito C-05 (Norte Gamma)")
    .fill("la Tota 👓");
  await cartForm.locator("input").nth(1).fill("Modelo QA");
  assert.equal(await cartForm.locator("select").nth(0).inputValue(), "");
  const cartSaved = page.waitForResponse(
    (response) =>
      response.url() === origin + "/api/carts" &&
      response.request().method() === "POST",
  );
  await cartForm
    .getByRole("button", { name: "Guardar Carrito", exact: true })
    .click();
  assert.equal((await cartSaved).status(), 200);
  await cartForm.waitFor({ state: "hidden" });
  let central = await snapshot(owner);
  assert.ok(
    central.carts.some((cart) => cart.code === "la Tota 👓" && !cart.houseId),
  );
  checks.push("Carrito con nombre libre y sin base guarda en SQL");

  await page.getByRole("button", { name: /^Proveedores \(/ }).click();
  await page
    .getByRole("button", { name: "Nuevo Proveedor", exact: true })
    .click();
  const supplierForm = page
    .locator("form")
    .filter({ has: page.getByPlaceholder("Ej: Molinos del Plata SA") });
  await supplierForm
    .getByPlaceholder("Ej: Molinos del Plata SA")
    .fill("Proveedor QA");
  let catalogSaved = page.waitForResponse(
    (response) => response.url() === origin + "/api/production/commands",
  );
  await supplierForm
    .getByRole("button", { name: "Guardar Proveedor", exact: true })
    .click();
  assert.equal((await catalogSaved).status(), 200);
  await supplierForm.waitFor({ state: "hidden" });
  await page.getByRole("button", { name: /^Insumos & Stock \(/ }).click();
  await page.getByRole("button", { name: "Nuevo Insumo", exact: true }).click();
  const materialForm = page
    .locator("form")
    .filter({ has: page.getByPlaceholder("Ej: Harina 0000 Especial") });
  await materialForm
    .getByPlaceholder("Ej: Harina 0000 Especial")
    .fill("Insumo QA");
  await materialForm.locator("input[type=number]").nth(0).fill("10");
  await materialForm.locator("input[type=number]").nth(1).fill("0");
  await materialForm.locator("input[type=number]").nth(2).fill("3");
  catalogSaved = page.waitForResponse(
    (response) => response.url() === origin + "/api/production/commands",
  );
  await materialForm
    .getByRole("button", { name: "Guardar Insumo", exact: true })
    .click();
  assert.equal((await catalogSaved).status(), 200);
  await materialForm.waitFor({ state: "hidden" });
  await page.getByRole("button", { name: /^Recetas Maestras \(/ }).click();
  await page.getByRole("button", { name: "Nueva Receta", exact: true }).click();
  const recipeForm = page
    .locator("form")
    .filter({
      has: page.getByPlaceholder("Ej: Mayonesa de Zanahoria Artesanal (20 kg)"),
    });
  await recipeForm
    .getByPlaceholder("Ej: Mayonesa de Zanahoria Artesanal (20 kg)")
    .fill("Receta QA");
  await recipeForm.getByLabel("Producto elaborado").selectOption("QA-VARIETY");
  await recipeForm.locator("input[type=number]").nth(0).fill("100");
  await recipeForm.locator("input[type=number]").nth(1).fill("0");
  await recipeForm.locator("input[type=number]").nth(2).fill("0");
  await recipeForm.getByLabel("Receta Insumo QA", { exact: true }).fill("2");
  catalogSaved = page.waitForResponse(
    (response) => response.url() === origin + "/api/production/commands",
  );
  await recipeForm
    .getByRole("button", { name: "Guardar Receta", exact: true })
    .click();
  assert.equal((await catalogSaved).status(), 200);
  await recipeForm.waitFor({ state: "hidden" });
  checks.push(
    "Proveedor, insumo y receta se guardan desde formularios; receta elige producto e ingredientes reales",
  );
  async function inventory(target) {
    await target.getByTitle("Abrir menú de navegación").click();
    await target
      .getByRole("button", { name: "Stock & Producción", exact: true })
      .click();
  }
  await inventory(page);
  await page
    .getByRole("button", { name: "Registrar Lote Fabricado", exact: true })
    .click();
  const batchForm = page.locator("form").filter({
    has: page.getByRole("button", {
      name: "Crear y Almacenar Lote",
      exact: true,
    }),
  });
  await batchForm.locator("select").selectOption("QA-VARIETY");
  await batchForm.locator("input[type=number]").nth(0).fill("100");
  const batchSaved = page.waitForResponse(
    (response) => response.url() === origin + "/api/production/commands",
  );
  await batchForm
    .getByRole("button", { name: "Crear y Almacenar Lote", exact: true })
    .click();
  assert.equal((await batchSaved).status(), 200);
  await batchForm.waitFor({ state: "hidden" });
  central = await snapshot(owner);
  assert.equal(
    central.productionBatches.find((batch) => batch.varietyId === "QA-VARIETY")
      .remainingUnitsInCentral,
    100,
  );
  assert.equal(
    central.productionBatches.find((batch) => batch.varietyId === "QA-VARIETY")
      .totalBatchCost,
    6,
  );
  assert.equal(
    central.rawMaterials.find((material) => material.name === "Insumo QA")
      .currentStock,
    8,
  );
  await page.reload({ waitUntil: "networkidle" });
  await inventory(page);
  const batchRow = page.getByRole("row").filter({
    has: page.getByRole("cell", { name: "Producto propio QA", exact: true }),
  });
  assert.ok((await batchRow.count()) > 0);
  await seller.reload({ waitUntil: "networkidle" });
  await inventory(seller);
  assert.equal(
    (await snapshot(worker)).productionBatches.find(
      (batch) => batch.varietyId === "QA-VARIETY",
    ).remainingUnitsInCentral,
    100,
  );
  checks.push(
    "Lote visible en cámara después de recargar y desde segunda sesión móvil",
  );
  await page
    .getByRole("button", { name: "Trasladar a Casas", exact: true })
    .click();
  const transferForm = page.locator("form").filter({
    has: page.getByRole("button", {
      name: "Confirmar Traslado",
      exact: true,
    }),
  });
  await transferForm.locator("select").nth(0).selectOption("QA-HOUSE-A");
  await transferForm
    .getByLabel("Trasladar Producto propio QA", { exact: true })
    .fill("40");
  const transferSaved = page.waitForResponse(
    (response) => response.url() === origin + "/api/production/commands",
  );
  await transferForm
    .getByRole("button", { name: "Confirmar Traslado", exact: true })
    .click();
  assert.equal((await transferSaved).status(), 200);
  await transferForm.waitFor({ state: "hidden" });
  central = await snapshot(owner);
  assert.equal(
    central.productionBatches.find((batch) => batch.varietyId === "QA-VARIETY")
      .remainingUnitsInCentral,
    60,
  );
  assert.equal(
    central.houses
      .find((house) => house.id === "QA-HOUSE-A")
      .currentStock.find((stock) => stock.varietyId === "QA-VARIETY").quantity,
    40,
  );
  await page
    .getByRole("button", { name: "Trasladar a Casas", exact: true })
    .click();
  await transferForm.locator("select").nth(0).selectOption("QA-HOUSE-B");
  await transferForm
    .getByLabel("Origen del traslado")
    .selectOption("QA-HOUSE-A");
  await transferForm
    .getByLabel("Trasladar Producto propio QA", { exact: true })
    .fill("15");
  const secondTransfer = page.waitForResponse(
    (response) => response.url() === origin + "/api/production/commands",
  );
  await transferForm
    .getByRole("button", { name: "Confirmar Traslado", exact: true })
    .click();
  assert.equal((await secondTransfer).status(), 200);
  await transferForm.waitFor({ state: "hidden" });
  await seller.reload({ waitUntil: "networkidle" });
  central = await snapshot(worker);
  assert.equal(
    central.houses
      .find((house) => house.id === "QA-HOUSE-A")
      .currentStock.find((stock) => stock.varietyId === "QA-VARIETY").quantity,
    25,
  );
  assert.equal(
    central.houses
      .find((house) => house.id === "QA-HOUSE-B")
      .currentStock.find((stock) => stock.varietyId === "QA-VARIETY").quantity,
    15,
  );
  checks.push(
    "Traslados cámara→casa y casa→casa se restan y acreditan; segundo dispositivo recibe saldos",
  );
  // UI retains form and quantities when the server rejects insufficient inventory.
  await page
    .getByRole("button", { name: "Trasladar a Casas", exact: true })
    .click();
  await transferForm
    .getByLabel("Trasladar Producto propio QA", { exact: true })
    .fill("99");
  const rejected = page.waitForResponse(
    (response) => response.url() === origin + "/api/production/commands",
  );
  await transferForm
    .getByRole("button", { name: "Confirmar Traslado", exact: true })
    .click();
  assert.equal((await rejected).status(), 409);
  await page
    .getByRole("alert")
    .filter({ hasText: "Stock insuficiente" })
    .waitFor();
  assert.equal(
    await transferForm
      .getByLabel("Trasladar Producto propio QA", { exact: true })
      .inputValue(),
    "99",
  );
  assert.equal(
    (await snapshot(owner)).productionBatches.find(
      (batch) => batch.varietyId === "QA-VARIETY",
    ).remainingUnitsInCentral,
    60,
  );
  await transferForm
    .getByRole("button", { name: "Cancelar", exact: true })
    .click();
  checks.push(
    "Rechazo de traslado conserva formulario y no modifica ningún saldo",
  );
  const palette = await page.evaluate(() => {
    const card = document.querySelector("main .bg-slate-900");
    return {
      root: !!document.querySelector(".sgmo-light"),
      background: card && getComputedStyle(card).backgroundColor,
      text: card && getComputedStyle(card.querySelector("h1") || card).color,
    };
  });
  assert.equal(palette.root, true);
  assert.equal(palette.background, "rgb(255, 255, 255)");
  assert.notEqual(palette.text, "rgb(255, 255, 255)");
  await page.screenshot({
    path: path.join(directory, "inventory-desktop.png"),
    fullPage: true,
  });
  await inventory(seller);
  await seller.screenshot({
    path: path.join(directory, "inventory-mobile.png"),
    fullPage: true,
  });
  checks.push(
    "Paleta clara y texto oscuro verificados en inventario; capturas desktop y móvil",
  );

  assert.equal(
    (
      await write(
        owner,
        "/api/zones",
        [
          {
            id: "ZONE-INVENTORY",
            name: "Playa ensayo",
            description: "",
            touristAffluence: "baja",
            avgDailySalesUnits: 0,
            recommendedStartUnits: 0,
          },
        ],
        "PUT",
      )
    ).status(),
    200,
  );
  await page.reload({ waitUntil: "networkidle" });
  await page
    .locator("header select:visible")
    .first()
    .selectOption("QA-HOUSE-A");
  await page.getByTitle("Abrir menú de navegación").click();
  await page
    .getByRole("button", { name: "Despacho & Asesor IA", exact: true })
    .click();
  const dispatchForm = page
    .locator("form")
    .filter({
      has: page.getByRole("button", {
        name: "Confirmar Salida & Despachar Carrito a la Playa",
        exact: true,
      }),
    });
  await dispatchForm.locator("select").nth(0).selectOption("USR-VEND-01");
  const cart = (await snapshot(owner)).carts.find(
    (cart) => cart.code === "la Tota 👓",
  );
  await dispatchForm.locator("select").nth(1).selectOption(cart.id);
  await dispatchForm.locator("select").nth(2).selectOption("ZONE-INVENTORY");
  await dispatchForm
    .getByLabel("Despachar Producto propio QA", { exact: true })
    .fill("10");
  page.once("dialog", (dialog) => dialog.accept());
  const dispatched = page.waitForResponse(
    (response) =>
      response.url() === origin + "/api/shifts" &&
      response.request().method() === "POST",
  );
  await dispatchForm
    .getByRole("button", {
      name: "Confirmar Salida & Despachar Carrito a la Playa",
      exact: true,
    })
    .click();
  assert.equal((await dispatched).status(), 201);
  await page.getByTitle("Abrir menú de navegación").click();
  await page
    .getByRole("button", { name: "Cierres & Arqueo", exact: true })
    .click();
  await page
    .getByLabel("Casa de regreso", { exact: true })
    .selectOption("QA-HOUSE-B");
  const closed = page.waitForResponse(
    (response) =>
      response.url().endsWith("/close") &&
      response.request().method() === "PUT",
  );
  await page
    .getByRole("button", {
      name: "Realizar Cierre de Jornada & Calcular Liquidación",
      exact: true,
    })
    .click();
  assert.equal((await closed).status(), 200);
  const completed = (await snapshot(owner)).shifts.find(
    (shift) => shift.cartId === cart.id,
  );
  assert.equal(completed.houseId, "QA-HOUSE-A");
  assert.equal(completed.returnHouseId, "QA-HOUSE-B");
  assert.equal(completed.totalUnitsReturned, 10);
  const completedState = await snapshot(owner);
  assert.equal(
    completedState.houses
      .find((house) => house.id === "QA-HOUSE-A")
      .currentStock.find((stock) => stock.varietyId === "QA-VARIETY").quantity,
    15,
  );
  assert.equal(
    completedState.houses
      .find((house) => house.id === "QA-HOUSE-B")
      .currentStock.find((stock) => stock.varietyId === "QA-VARIETY").quantity,
    25,
  );
  checks.push(
    "Despacho con producto propio y carrito sin base; formulario de cierre devuelve a casa diferente conservando origen",
  );
  assert.deepEqual(pageErrors, []);
  await fs.writeFile(
    path.join(directory, "inventory-summary.json"),
    JSON.stringify(
      {
        passed: checks.length,
        checks,
        scope: "Chromium + HTTP real + SQL WASM efímero",
      },
      null,
      2,
    ),
  );
  console.log(
    `RESULTADO: ${checks.length}/${checks.length} escenarios inventario aprobados.`,
  );
  for (const check of checks) console.log("PASS " + check);
}
main()
  .catch((error) => {
    console.error(redact(error.stack || error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser?.close();
    if (server && server.exitCode === null) {
      const exited = new Promise((resolve) => server.once("exit", resolve));
      server.kill("SIGTERM");
      await Promise.race([
        exited,
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]);
      if (server.exitCode === null) server.kill("SIGKILL");
    }
  });
