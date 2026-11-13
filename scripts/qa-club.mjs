import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, stat, mkdir, writeFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import assert from "node:assert/strict";
// UI fixtures only. MySQL persistence and permissions are tested separately in CI.
const root=resolve("dist");
const server=createServer(async(req,res)=>{let file=resolve(root,`.${new URL(req.url,"http://local").pathname}`);if(!file.startsWith(root+sep)){res.writeHead(403).end();return;}try{if(!(await stat(file)).isFile())throw Error();}catch{file=resolve(root,"index.html");}res.writeHead(200,{"content-type":({".html":"text/html",".js":"text/javascript",".css":"text/css",".woff2":"font/woff2",".svg":"image/svg+xml"})[extname(file)]??"application/octet-stream"});res.end(await readFile(file));});
await new Promise(done=>server.listen(4189,"127.0.0.1",done));
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH??"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"});
await mkdir("test-results/club",{recursive:true});const checks=[],pageErrors=[];
const id="e264ab6a-6416-4fef-89e6-ea74157ddcc0",appId="f264ab6a-6416-4fef-89e6-ea74157ddcc0",batch="c264ab6a-6416-4fef-89e6-ea74157ddcc0";
const halls=[{id:"chelnokova",name:"Зал на Челнокова",address:"Калининград"},{id:"city",name:"Сити",address:"Калининград"},{id:"school10",name:"Школа №10",address:"Калининград"}];
const base="http://127.0.0.1:4189";
try{
for(const width of [390,1440])for(const theme of ["dark","light"]){
 const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:"reduce"});
 await context.addInitScript(theme=>{sessionStorage.setItem("mft39:intro-seen","1");localStorage.setItem("mft39.theme",theme);window.__writes=[];const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){window.__writes.push(String(v));return set.call(this,k,v);};for(const method of ["put","add"]){const original=IDBObjectStore.prototype[method];IDBObjectStore.prototype[method]=function(v,...args){window.__writes.push(JSON.stringify(v));return original.call(this,v,...args);};}},theme);
 const page=await context.newPage();page.on("pageerror",e=>pageErrors.push(String(e)));
 let role="user",available=true,offlineBootstrap=false,month="2026-11",serverTime="2026-11-15T12:00:00Z",saved=false,firstLost=true,conflict=true,revoked=false;
 let student={id,locationId:"chelnokova",lastName:"Проверкин",firstName:"Пример",middleName:"",age:30,ageRecordedOn:"2026-11-15",status:"trial",admitted:false,createdAt:"2026-11-15T12:00:00Z",version:1,payment:{month,status:"unpaid",version:0}};
 let application={id:appId,studentId:id,locationId:"chelnokova",lastName:student.lastName,firstName:student.firstName,middleName:"",age:30,requestedDate:"2026-11-30",comment:"Синтетическая заявка",guardian:null,status:"pending",version:1,createdAt:student.createdAt};
 let device=null,paginate=false;const keys=[],mutations=[];
 await page.route("https://api.mft39.ru/**",async route=>{
  const req=route.request(),url=new URL(req.url());const headers={"Access-Control-Allow-Origin":base,"Access-Control-Allow-Credentials":"true"};
  const reply=(value,status=200)=>route.fulfill({status,headers,contentType:"application/json",body:JSON.stringify(value)});
  if(req.method()==="OPTIONS")return route.fulfill({status:204,headers:{...headers,"Access-Control-Allow-Methods":"GET, POST","Access-Control-Allow-Headers":"content-type,x-csrf-token,idempotency-key"}});
  if(url.pathname.includes("/me"))return reply({authenticated:true,user:{id:1,role},csrfToken:"x".repeat(43)});
  const resource=url.searchParams.get("resource");if(resource==="bootstrap"){
   if(offlineBootstrap)return route.abort();if(!available)return reply({error:"not_found"},404);
   return reply({schemaVersion:2,actor:{id:1,role},staff:role!=="user",halls:role==="trainer"?halls.slice(0,1):halls,scopeVersion:role,currentMonth:month,serverTime,cursor:1});
  }
  if(req.method()==="GET"){
   if(resource==="students"){const extra=paginate&&url.searchParams.get("cursor");return reply({items:saved&&(role==="user"||student.admitted)?[{...student,id:extra?batch:student.id,lastName:extra?"Страничный":student.lastName,payment:{...student.payment,month}}]:[],nextCursor:paginate&&!extra?id:null});}
   if(resource==="student")return reply({...student,payment:{...student.payment,month}});
   if(resource==="applications")return reply({items:saved&&(url.searchParams.get("status")!=="pending"||application.status==="pending")?[application]:[],nextCursor:null});
   if(resource==="payments")return reply({items:[{...student.payment,month,confirmedBy:student.payment.status==="paid"?2:null,confirmedAt:student.payment.status==="paid"?serverTime:null,updatedBy:null,updatedAt:null}],nextCursor:null,currentMonth:month});
   if(resource==="changes")return reply({items:[{id:1,studentId:id,actorId:1,action:"student.created",entityId:id,details:{status:"trial"},createdAt:student.createdAt}],cursor:1,hasMore:false});
   if(resource==="devices")return reply({items:device?[{...device,revoked_at:revoked?1:null}]:[]});
  }
  const body=req.postDataJSON();mutations.push({resource,body});assert.equal(req.headers()["x-csrf-token"],"x".repeat(43));
  if(resource==="applications"){keys.push(req.headers()["idempotency-key"]);saved=true;if(firstLost){firstLost=false;return route.abort();}return reply({batchId:batch,applicationIds:[appId],replayed:true});}
  if(resource==="application-decision"){assert.equal(body.expectedVersion,application.version);application={...application,status:body.status,version:application.version+1};if(body.status==="accepted")student={...student,admitted:true,version:student.version+1};return reply({id:appId,status:body.status,version:application.version});}
  if(resource==="student-status"){assert.equal(body.expectedVersion,student.version);student={...student,status:body.status,version:student.version+1};return reply({id,status:student.status,version:student.version});}
  if(resource==="payment"){assert.equal(body.expectedCurrentMonth,month);if(conflict){conflict=false;student={...student,payment:{month,status:"paid",version:1}};return reply({error:"version_conflict"},409);}assert.equal(body.expectedVersion,student.payment.version);student={...student,payment:{month,status:body.status,version:student.payment.version+1}};return reply({studentId:id,...student.payment});}
  if(resource==="device-create"){device={id:batch,label:body.label,created_at:1794744000,expires_at:1999999999};return reply({id:batch,token:"t".repeat(43),expiresAt:1999999999});}
  if(resource==="device-revoke"){revoked=true;return reply({id:batch,revoked:true});}
  return reply({error:"not_found"},404);
 });
 const fit=async()=>assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Overflow ${width}/${theme}`);
 const check=name=>checks.push({width,theme,name,passed:true});
 await page.goto(base+"/account/book");await page.getByRole("button",{name:"Отправить заявку",exact:true}).waitFor();
 assert(await page.locator('meta[http-equiv="Content-Security-Policy"]').count());
 await page.evaluate(()=>{window.__cspViolations=[];document.addEventListener("securitypolicyviolation",event=>window.__cspViolations.push(event.effectiveDirective));const script=document.createElement("script");script.textContent="window.__unexpectedInline = true";document.head.append(script);void fetch("https://blocked.example.invalid/csp-check").catch(()=>{});});
 await page.waitForFunction(()=>window.__cspViolations.includes("script-src-elem")&&window.__cspViolations.includes("connect-src"));assert.equal(await page.evaluate(()=>window.__unexpectedInline),undefined);check("HTML CSP blocks inline scripts and external connections without server headers");
 await page.getByLabel("Фамилия ученика",{exact:true}).fill("Проверкин");await page.getByLabel("Имя ученика",{exact:true}).fill("Пример");await page.getByLabel("Возраст, полных лет",{exact:true}).fill("30");await page.getByLabel("Спортивный зал",{exact:true}).selectOption("chelnokova");await page.getByLabel("Желаемая дата тренировки",{exact:true}).fill("2026-11-30");await page.getByLabel("Комментарий (необязательно)").fill("Синтетический комментарий");
 await page.getByRole("button",{name:"Отправить заявку",exact:true}).click();await page.getByText("Перед отправкой необходимо согласие на обработку данных",{exact:true}).waitFor();assert.equal(keys.length,0);check("no personal submission without consent");await page.getByLabel("Согласие на обработку данных",{exact:true}).check();await page.getByRole("button",{name:"Отправить заявку",exact:true}).click();await page.getByRole("alert").filter({hasText:"Подтверждения сохранения нет"}).waitFor();assert.equal(await page.getByText("Заявка сохранена и ожидает решения тренера.",{exact:true}).count(),0);check("lost response has no fake confirmation");
 await page.getByRole("button",{name:"Отправить заявку",exact:true}).click();await page.getByText("Заявка сохранена и ожидает решения тренера.",{exact:true}).waitFor();assert.equal(keys.length,2);assert.equal(keys[0],keys[1]);assert.equal(await page.getByLabel("Фамилия ученика",{exact:true}).inputValue(),"");check("retry preserves idempotency key and success clears draft");
 await page.goto(base+"/account/bookings");await page.locator(".club-list").first().waitFor();await page.getByText("Ожидает решения",{exact:true}).waitFor();await page.getByRole("button",{name:"История оплат и статусов"}).click();await page.getByText("Ученик добавлен",{exact:true}).waitFor();await fit();check("parent pending student and history");
 await page.goto(base+"/account/trainer");await page.getByRole("heading",{name:"Раздел для тренеров",exact:true}).waitFor();check("parent cannot use trainer UI");
 role="trainer";await page.goto(base+"/account/trainer");await page.getByRole("button",{name:"Принять заявку",exact:true}).waitFor();assert.equal(await page.getByRole("button",{name:"Открыть карточку",exact:true}).count(),0);
 await page.getByRole("button",{name:"Принять заявку",exact:true}).click();await page.getByRole("button",{name:"Открыть карточку",exact:true}).click();await page.locator(".club-details").waitFor({timeout:5000}).catch(async error=>{await page.screenshot({path:"test-results/club/failure.png",fullPage:true});console.log(JSON.stringify({pageErrors,text:await page.locator("main").innerText()}));throw error;});await page.getByLabel("Статус обучения",{exact:true}).selectOption("permanent");await page.getByRole("button",{name:"Изменить статус",exact:true}).click();await page.getByText("Статус: Постоянный",{exact:true}).waitFor();assert.equal(student.payment.status,"unpaid");check("admission and learning status do not mark payment");
 await page.getByRole("button",{name:"Отметить оплату",exact:true}).click();await page.getByRole("alert").filter({hasText:"Данные уже изменились"}).waitFor();assert.equal(mutations.filter(x=>x.resource==="payment").length,1);check("409 requires explicit refresh and is not retried");
 await page.getByRole("button",{name:"Обновить карточку",exact:true}).click();await page.waitForFunction(()=>document.querySelector(".club-details .button")?.disabled===true);
 await page.getByLabel("Причина изменения",{exact:true}).fill("Исправление синтетической отметки");await page.getByRole("button",{name:"Снять отметку оплаты",exact:true}).click();await page.getByRole("button",{name:"Отметить оплату",exact:true}).waitFor({state:"visible"});await page.waitForFunction(()=>!document.querySelector(".club-details .button")?.disabled);assert.equal(student.payment.status,"unpaid");await fit();await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo({top:0,behavior:"instant"});});await page.screenshot({path:`test-results/club/trainer-${width}-${theme}.png`,fullPage:true});check("payment correction uses refreshed version and reason");
 const beforeSync=mutations.length;student={...student,status:"trial",version:student.version+1,payment:{month,status:"paid",version:student.payment.version+1}};serverTime="2026-11-15T12:01:00Z";await page.evaluate(()=>window.dispatchEvent(new Event("focus")));await page.getByText("Статус: Пробный",{exact:true}).waitFor();await page.locator(".club-history").getByText("Оплачено",{exact:true}).waitFor();assert.equal(mutations.length,beforeSync);check("foreground sync refreshes an open card and history without a mutation");await page.goto(base+"/account/devices");await page.getByLabel("Название устройства",{exact:true}).fill("Тестовый телефон");await page.getByRole("button",{name:"Создать доступ",exact:true}).click();await page.getByLabel("Ключ доступа",{exact:true}).waitFor();assert.equal(await page.getByLabel("Ключ доступа",{exact:true}).inputValue(),"t".repeat(43));await page.getByRole("button",{name:"Скрыть ключ",exact:true}).click();await page.getByRole("button",{name:"Отозвать доступ",exact:true}).click();await page.getByText("Доступ отозван",{exact:true}).waitFor();check("one-time device key and revocation");
 for(role of ["head_trainer","admin"]){await page.goto(base+"/account/profile");await page.getByText(role==="admin"?"Администратор":"Главный тренер",{exact:true}).waitFor();check(`${role} profile and trainer navigation`);}
 available=false;await page.goto(base+"/account/book");await page.getByRole("heading",{name:"Онлайн-запись пока недоступна",exact:true}).waitFor();assert(await page.getByRole("button",{name:"Отправка недоступна",exact:true}).isDisabled());await fit();check("missing backend keeps real submission disabled");
 available=true;role="user";paginate=true;await page.goto(base+"/account/bookings");await page.getByRole("button",{name:"Показать ещё учеников",exact:true}).click();await page.getByRole("heading",{name:"Страничный Пример",exact:true}).waitFor();assert.equal(await page.getByRole("button",{name:"История оплат и статусов",exact:true}).count(),2);check("student pagination appends the next page");paginate=false;const writes=await page.evaluate(()=>window.__writes);for(const sensitive of ["Проверкин","Синтетический комментарий","Исправление синтетической отметки","t".repeat(43)])assert(!writes.some(value=>value.includes(sensitive)),`Sensitive storage write: ${sensitive}`);check("no form data or device secrets in browser storage");
 if(width===390&&theme==="dark"){
  available=true;role="trainer";month="2026-12";serverTime="2026-12-31T21:59:59Z";student.payment={month,status:"paid",version:1};
  await page.clock.install();await page.goto(base+"/account/trainer");await page.locator(".club-badge.is-paid").waitFor();offlineBootstrap=true;await page.clock.runFor(2200);await page.getByRole("heading",{name:"Сервис учёта недоступен",exact:true}).waitFor();assert.equal(await page.locator(".club-badge.is-paid").count(),0);check("offline Kaliningrad year rollover removes stale paid display");
 }
 await context.close();
}
assert.deepEqual(pageErrors,[]);await writeFile("test-results/club/results.json",JSON.stringify({fixtureOnly:true,checks,pageErrors},null,2));console.log(`Club browser: ${checks.length} checks passed; 0 page errors; UI fixtures only`);
}finally{await browser.close();await new Promise(done=>server.close(done));}
