/** UI → API → SQL efímero → segundo contexto. Nunca toca Neon ni proveedores. */
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {randomBytes,randomUUID}=require('node:crypto');
const fs=require('node:fs/promises');const path=require('node:path');const os=require('node:os');
const {chromium}=require(require.resolve('playwright',{paths:[process.env.SGMO_PLAYWRIGHT_MODULES||process.cwd()]}));
const port=Number(process.env.SGMO_BROWSER_CONFIGURATION_PORT||3105),origin=`http://127.0.0.1:${port}`;
const password=randomBytes(12).toString('hex'),bootstrap=randomBytes(32).toString('hex'),legacySecret=randomBytes(16).toString('hex');
const secrets=[password,bootstrap,legacySecret];const redact=value=>secrets.reduce((result,secret)=>result.replaceAll(secret,'[REDACTED]'),String(value));
let server,browser,output='';const checks=[];const pageErrors=[];
const directory=process.env.SGMO_BROWSER_QA_DIR||path.join(os.tmpdir(),`sgmo-config-${Date.now()}`);
async function eventually(action){let last;for(let attempt=0;attempt<160;attempt++){try{return await action();}catch(error){last=error;await new Promise(resolve=>setTimeout(resolve,100));}}throw last;}
async function write(context,endpoint,body,method='POST'){
 const csrf=await context.request.get(origin+'/api/auth/csrf');assert.equal(csrf.status(),200);
 return context.request.fetch(origin+endpoint,{method,data:body,headers:{Origin:origin,'X-CSRF-Token':(await csrf.json()).csrfToken}});
}
async function snapshot(context){const response=await context.request.get(origin+'/api/bootstrap');assert.equal(response.status(),200);return(await response.json()).state;}
async function login(page,identifier){await page.goto(origin);await page.getByLabel('Código de usuario o correo').fill(identifier);await page.getByLabel('Contraseña',{exact:true}).fill(password);await page.getByRole('button',{name:'Ingresar',exact:true}).click();await page.getByTitle('Abrir menú de navegación').waitFor();}
async function configure(page){await page.getByTitle('Abrir menú de navegación').click();await page.getByRole('button',{name:'Configuración',exact:true}).click();}
async function main(){
 assert.ok(process.env.SGMO_PGLITE_ROOT);await fs.mkdir(directory,{recursive:true});
 try{await fetch(origin,{signal:AbortSignal.timeout(500)});throw new Error('Puerto ocupado');}catch(error){if(error.message.includes('ocupado'))throw error;}
 server=spawn(process.execPath,['--import','tsx','scripts/tests/fixtures/browser-central-server.ts'],{cwd:path.resolve(__dirname,'../..'),env:{...process.env,NODE_ENV:'test',SGMO_BROWSER_CENTRAL_FIXTURE:'true',BOOTSTRAP_SECRET:bootstrap,SGMO_PUBLIC_ORIGIN:origin,PORT:String(port)},stdio:['ignore','pipe','pipe']});
 server.stdout.on('data',chunk=>output+=chunk);server.stderr.on('data',chunk=>output+=chunk);
 await eventually(()=>{assert.equal(server.exitCode,null,redact(output));assert.ok(output.includes('SGMO_BROWSER_CENTRAL_READY'));});
 browser=await chromium.launch({headless:true});const owner=await browser.newContext({viewport:{width:1280,height:1000}}),worker=await browser.newContext({viewport:{width:390,height:844}});
 const page=await owner.newPage(),seller=await worker.newPage();for(const target of [page,seller])target.on('pageerror',error=>pageErrors.push(redact(error.message)));
 await owner.addInitScript(secret=>{if(!localStorage.getItem('QA_SOURCE_INSTALLED')){localStorage.setItem('QA_SOURCE_INSTALLED','true');localStorage.setItem('SGMO_TEQUENOS_COSTA_V2',JSON.stringify({users:[{id:'LEGACY-USER',userCode:'LEGACY-CODE',name:'Persona anterior QA',role:'seller',isActive:true,commissionRate:0.15,password:secret,pin:'12345678'}],houses:[],carts:[],shifts:[{id:'LEGACY-SHIFT'}],sales:[{id:'LEGACY-SALE',validationStatus:'validada',voucherImage:'imagen QA',totalAmount:10}],auditLogs:[]}));}},legacySecret);
 assert.equal((await write(owner,'/api/auth/bootstrap-admin',{identifier:'ADM-01',newPassword:password,bootstrapSecret:bootstrap})).status(),200);
 await login(page,'ADM-01');await configure(page);
 const backup=await page.evaluate(()=>JSON.parse(localStorage.getItem('SGMO_LEGACY_BACKUP_V1')));
 assert.equal(backup.state.sales[0].id,'LEGACY-SALE');assert.ok(!JSON.stringify(backup).includes(legacySecret));
 checks.push('La actualización conserva el respaldo del navegador antes de hidratar y retira las claves antiguas');
 await page.getByRole('button',{name:'Recuperar datos anteriores',exact:true}).click();
 const savedArchive=page.waitForResponse(response=>response.url()===origin+'/api/legacy-imports'&&response.request().method()==='POST');
 await page.getByRole('button',{name:'Guardar respaldo en Neon',exact:true}).click();assert.equal((await savedArchive).status(),200);
 const duplicate=await write(owner,'/api/legacy-imports',backup);assert.equal(duplicate.status(),200);
 const receipts=(await(await owner.request.get(origin+'/api/legacy-imports')).json()).receipts;assert.equal(receipts.length,1);
 assert.equal((await(await owner.request.get(origin+'/api/legacy-imports/'+receipts[0].id)).json()).state.sales[0].id,'LEGACY-SALE');
 assert.equal((await write(owner,'/api/legacy-imports',{...backup,state:{sales:[]}})).status(),409);
 page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Incorporar catálogo y configuración',exact:true}).click();
 await page.getByText('Catálogo incorporado. Asigná contraseñas',{exact:false}).waitFor();
 let central=await snapshot(owner);assert.ok(central.users.some(user=>user.id==='LEGACY-USER'&&!user.isProvisioned));assert.ok(!central.sales.some(sale=>sale.id==='LEGACY-SALE'));
 checks.push('Respaldo SQL descargable e idempotente; incorpora perfiles sin contraseñas y conserva historial sin aprobar pagos');
 await page.getByRole('button',{name:/^Bases Operativas \(/}).click();await page.getByRole('button',{name:'Nueva Base Operativa',exact:true}).click();
 const houseForm=page.locator('form').filter({has:page.getByPlaceholder('Ej: Base Operativa Centro — Calle 30')});
 await houseForm.getByPlaceholder('Ej: Base Operativa Centro — Calle 30').fill('Casa QA entrega');await houseForm.getByPlaceholder('Av. Costanera & Calle 30').fill('Dirección QA');
 await houseForm.locator('input[type=number]').nth(0).fill('300');await houseForm.locator('input[type=number]').nth(1).fill('125');
 const houseSaved=page.waitForResponse(response=>response.url()===origin+'/api/houses'&&response.request().method()==='POST');await houseForm.getByRole('button',{name:'Guardar Base',exact:true}).click();assert.equal((await houseSaved).status(),200);
 const house=(await snapshot(owner)).houses.find(entry=>entry.name==='Casa QA entrega');assert.ok(house);
 await page.getByRole('button',{name:/^Carritos \(/}).click();await page.getByRole('button',{name:'Nuevo Carrito',exact:true}).click();
 const cartForm=page.locator('form').filter({has:page.getByPlaceholder('Ej: Carrito C-05 (Norte Gamma)')});await cartForm.getByPlaceholder('Ej: Carrito C-05 (Norte Gamma)').fill('Carrito QA entrega');await cartForm.locator('select').nth(0).selectOption(house.id);
 const cartSaved=page.waitForResponse(response=>response.url()===origin+'/api/carts'&&response.request().method()==='POST');await cartForm.getByRole('button',{name:'Guardar Carrito',exact:true}).click();assert.equal((await cartSaved).status(),200);
 await page.reload({waitUntil:'networkidle'});central=await snapshot(owner);assert.ok(central.carts.some(cart=>cart.code==='Carrito QA entrega'&&cart.houseId===house.id));assert.equal(central.houses.find(entry=>entry.id===house.id).fixedCostDaily,125);
 checks.push('Casa y carrito creados desde formularios reales permanecen en SQL después de recargar');
 await configure(page);await page.getByRole('button',{name:/Parámetros & Vivienda/}).click();await page.getByLabel('Comisión base de respaldo (%)').fill('17.5');
 const settingsSaved=page.waitForResponse(response=>response.url()===origin+'/api/settings'&&response.request().method()==='PUT');await page.getByRole('button',{name:/Guardar.*Parámetros/}).click();assert.equal((await settingsSaved).status(),200);assert.equal((await snapshot(owner)).systemConfig.defaultCommissionRate,0.175);
 await page.getByRole('button',{name:/Usuarios & Roles/}).click();await page.getByRole('button',{name:'Nuevo Usuario',exact:true}).click();
 const form=page.locator('form').filter({has:page.getByPlaceholder('Ej: VEND-05')});assert.equal(await form.getByLabel('Comisión de ventas (%)').inputValue(),'17.5');
 await form.getByPlaceholder('Ej: Marcos Benavídez').fill('Vendedor QA entrega');await form.getByPlaceholder('Ej: VEND-05').fill('QA-ENTREGA');await form.getByLabel('Contraseña inicial',{exact:true}).fill(password);await form.getByLabel('Repetir contraseña',{exact:true}).fill(password);await form.locator('select').nth(1).selectOption(house.id);
 const userSaved=page.waitForResponse(response=>response.url()===origin+'/api/users'&&response.request().method()==='POST');await form.getByRole('button',{name:'Guardar Usuario',exact:true}).click();const userResult=await userSaved;assert.equal(userResult.status(),201);const user=(await userResult.json()).user;assert.equal(user.commissionRate,0.175);
 const settings=(await snapshot(owner)).systemConfig;assert.equal((await write(owner,'/api/settings',{...settings,housingCostPerPersonDaily:321,commissionTiers:[{id:'TIER-QA-ENTREGA',name:'Tramo QA',minSales:0,maxSales:null,rate:0.33,isActive:true}]},'PUT')).status(),200);
 await login(seller,'QA-ENTREGA');const workerState=await snapshot(worker);assert.equal(workerState.systemConfig.housingCostPerPersonDaily,321);assert.equal(workerState.systemConfig.commissionTiers.find(tier=>tier.id==='TIER-QA-ENTREGA').rate,0.33);assert.ok(workerState.houses.some(entry=>entry.id===house.id));assert.ok(workerState.carts.some(cart=>cart.code==='Carrito QA entrega'));assert.equal((await write(worker,'/api/settings',settings,'PUT')).status(),403);
 checks.push('Porcentaje 17,5 se guarda como 0,175, se usa al crear perfiles y la segunda sesión recibe vivienda/tramo/casa/carrito centrales');
 const card=page.locator('div.border.rounded-xl.p-5').filter({has:page.getByText('Vendedor QA entrega',{exact:true})});await card.getByRole('button',{name:'Desactivar',exact:true}).click();await eventually(async()=>assert.equal(await card.count(),0));
 assert.equal((await worker.request.get(origin+'/api/auth/me')).status(),401);await page.getByLabel('Mostrar usuarios archivados').check();assert.equal(await card.count(),1);assert.equal((await snapshot(owner)).users.find(entry=>entry.id===user.id).isActive,false);
 assert.equal((await worker.request.get(origin+'/api/legacy-imports')).status(),401);
 checks.push('Archivar oculta al vendedor, conserva el perfil y revoca el acceso del segundo dispositivo');
 for(const target of [page,seller]){const cache=await target.evaluate(()=>JSON.stringify({...localStorage}));for(const secret of secrets)assert.ok(!cache.includes(secret));}
 assert.deepEqual(pageErrors,[]);await fs.writeFile(path.join(directory,'configuration-summary.json'),JSON.stringify({passed:checks.length,checks,scope:'Chromium + API real + SQL WASM efímero; no proveedores remotos'},null,2));console.log(`RESULTADO: ${checks.length}/${checks.length} escenarios de configuración y recuperación aprobados.`);for(const check of checks)console.log('PASS '+check);
}
main().catch(error=>{console.error(redact(error.stack||error));process.exitCode=1;}).finally(async()=>{await browser?.close();if(server&&server.exitCode===null){const exited=new Promise(resolve=>server.once('exit',resolve));server.kill('SIGTERM');await Promise.race([exited,new Promise(resolve=>setTimeout(resolve,3000))]);if(server.exitCode===null)server.kill('SIGKILL');}});
