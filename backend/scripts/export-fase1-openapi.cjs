// Regenerate the Markdown contract: node backend/scripts/export-fase1-openapi.cjs
const fs=require('node:fs'),path=require('node:path');
const str={type:'string'},uuid={type:'string',format:'uuid'},date={type:'string',format:'date'};
const ref=name=>({'$ref':'#/components/schemas/'+name});
const arr=items=>({type:'array',items});
const obj=(properties,required=Object.keys(properties),strict=true)=>({type:'object',properties,required,additionalProperties:!strict});
const schemas={
 Error:obj({error:obj({code:str,message:str,details:{}},['code','message'])}),
 Authenticated:obj({authenticated:{type:'boolean'}}),
 Login:obj({email:{type:'string',format:'email'},password:str,clinicId:uuid},['email','password']),
 Recovery:obj({email:{type:'string',format:'email'}}),
 Reset:obj({token:str,password:{type:'string',description:'12–72 bytes UTF-8'}}),
 ClinicSwitch:obj({clinicId:uuid}),
 Message:obj({message:str}),
 Me:obj({user:obj({id:uuid,name:str,email:str,status:str,role:str,lastAccess:{type:['string','null'],format:'date-time'}}),clinic:obj({id:uuid,name:str,groupId:uuid}),permissions:arr(str),memberships:arr(obj({clinicId:uuid,name:str,role:str}))}),
 ProfileInput:obj({legalName:str,rut:str,address:str,sector:str,phone:str,email:str}),
 Profile:obj({clinicId:uuid,name:str,legalName:{type:['string','null']},rut:{type:['string','null']},address:str,sector:str,phone:str,email:str}),
 Hours:obj({weekday:{type:'integer',minimum:0,maximum:6},start:{type:'string',pattern:'^\\d{2}:\\d{2}$'},end:{type:'string',pattern:'^\\d{2}:\\d{2}$'},slotMinutes:{type:'integer',minimum:5,maximum:240}}),
 DoctorHours:obj({weekday:{type:'integer',minimum:0,maximum:6},start:str,end:str}),
 ScheduleInput:obj({hours:arr(ref('Hours')),holidays:arr(obj({date,name:str}))}),
 DoctorScheduleInput:obj({hours:arr(ref('DoctorHours'))}),
 Schedule:obj({timezone:str,hours:arr(ref('Hours')),holidays:arr(obj({date,name:str}))}),
 DoctorSchedule:obj({doctorId:uuid,inheritsClinicHours:{type:'boolean'},hours:arr(ref('DoctorHours'))}),
 Availability:obj({date,doctorId:uuid,timezone:str,slots:arr(obj({startsAt:{type:'string',format:'date-time'},endsAt:{type:'string',format:'date-time'}}))}),
 OwnerInput:obj({rut:str,firstName:str,lastName:str,email:str,phone:str,address:str,sector:str,region:str,birthDate:date,preferredContact:{type:'string',enum:['Email','WhatsApp','Teléfono']}},['rut','firstName','lastName','email','birthDate','preferredContact']),
 Owner:obj({id:uuid,rut:str,firstName:str,lastName:str,email:str},['id','rut','firstName','lastName','email'],false),
 PatientInput:obj({ownerId:uuid,name:str,species:{type:'string',enum:['Perro','Gato','Ave','Conejo']},breed:str,sex:{type:'string',enum:['Macho','Hembra']},birthDate:date,color:str,sterilized:{type:'boolean'},weightKg:{type:'number',minimum:0},chip:str,allergies:arr(str),conditions:arr(str)},['ownerId','name','species','sex','birthDate']),
 Patient:obj({id:uuid,name:str,species:str,breed:str,clinicId:uuid,accessLevel:str,scope:str,status:{type:'null'},statusPending:{type:'boolean',const:true}},['id','name','species','clinicId','accessLevel','scope','status','statusPending'],false),
 Doctor:obj({id:uuid,name:str,specialty:str,initials:str,userId:{type:['string','null'],format:'uuid'}}),
 AppointmentInput:obj({patientId:uuid,doctorId:uuid,date,time:str,reason:str,emergency:{type:'boolean'}},['patientId','doctorId','date','time','reason']),
 Appointment:obj({id:uuid,patientId:uuid,doctorId:uuid,date,time:str,startsAt:{type:'string',format:'date-time'},endsAt:{type:'string',format:'date-time'},status:str,reason:str,emergency:{type:'boolean'},roomId:{type:['string','null'],format:'uuid'}}),
 Money:obj({net:{type:'integer',minimum:0},vat:{type:'integer',minimum:0},total:{type:'integer',minimum:0},ivaIncluded:{type:'integer',minimum:0}}),
 Health:obj({status:str},['status'],false)
};
const content=schema=>({'application/json':{schema}});
const params={
 Origin:{name:'Origin',in:'header',required:true,schema:str,description:'Exact PUBLIC_WEB_URL origin'},
 Idempotency:{name:'Idempotency-Key',in:'header',required:true,schema:{type:'string',minLength:8,maxLength:128}},
 Limit:{name:'limit',in:'query',schema:{type:'integer',minimum:1,maximum:200,default:50}},
 Offset:{name:'offset',in:'query',schema:{type:'integer',minimum:0,maximum:100000,default:0}},
 Q:{name:'q',in:'query',schema:str}
};
const paths={};
function route(url,method,summary,response,input,options={}){
 const op={summary,responses:{},parameters:[]};const status=options.status||200;
 op.responses[status]=response?{description:'Success',content:content(response)}:{description:'No content'};
 for(const code of [400,401,403,404,409,415,422,429,500,503])op.responses[code]={description:'Structured error; applicable per operation',content:content(ref('Error'))};
 if(method!=='get')op.parameters.push({'$ref':'#/components/parameters/Origin'});
 if(options.idem)op.parameters.push({'$ref':'#/components/parameters/Idempotency'});
 if(options.public)op.security=[];if(options.refresh)op.security=[{refreshCookie:[]}];
 if(input)op.requestBody={required:true,content:content(input)};
 if(options.list)op.parameters.push(...['Limit','Offset'].map(p=>({'$ref':'#/components/parameters/'+p})));
 if(options.q)op.parameters.push({'$ref':'#/components/parameters/Q'});
 for(const name of [...url.matchAll(/\{(.*?)\}/g)].map(m=>m[1]))op.parameters.push({name,in:'path',required:true,schema:name==='rut'?str:uuid});
 for(const p of options.query||[])op.parameters.push(p);
 (paths[url]??={})[method]=op;
}
route('/healthz','get','DB readiness',ref('Health'),null,{public:true});
route('/api/v1/health','get','Process liveness',ref('Health'),null,{public:true});
route('/api/v1/auth/login','post','Login active membership',ref('Authenticated'),ref('Login'),{public:true});
route('/api/v1/auth/refresh','post','Rotate refresh; replay revokes session',ref('Authenticated'),null,{refresh:true});
route('/api/v1/auth/logout','post','Revoke session; safe if already logged out',null,null,{status:204,public:true});
route('/api/v1/auth/recovery','post','Generic response; enqueue recovery email',ref('Message'),ref('Recovery'),{public:true,status:202});
route('/api/v1/auth/reset','post','Consume recovery token; revoke sessions',null,ref('Reset'),{public:true,status:204});
route('/api/v1/auth/clinic','post','Switch to active membership; rotate cookies',ref('ClinicSwitch'),ref('ClinicSwitch'));
route('/api/v1/me','get','Current session and permissions',ref('Me'));
route('/api/v1/settings/clinic-profile','get','Own clinic profile',ref('Profile'));
route('/api/v1/settings/clinic-profile','put','Replace own clinic profile; usuarios.administrar',ref('Profile'),ref('ProfileInput'),{idem:true});
route('/api/v1/settings/schedule','get','Own clinic structured schedule; agenda.gestionar',ref('Schedule'));
route('/api/v1/settings/schedule','put','Replace schedule; usuarios.administrar',ref('Schedule'),ref('ScheduleInput'),{idem:true});
route('/api/v1/doctors/{id}/schedule','get','Doctor schedule; agenda.gestionar',ref('DoctorSchedule'));
route('/api/v1/doctors/{id}/schedule','put','Replace doctor schedule; usuarios.administrar',ref('DoctorSchedule'),ref('DoctorScheduleInput'),{idem:true});
route('/api/v1/doctors','get','Active professionals in session clinic',arr(ref('Doctor')));
route('/api/v1/owners','get','Owners linked to session clinic',arr(ref('Owner')),null,{list:true,q:true});
route('/api/v1/owners','post','Create owner and clinic link; ficha.editar',ref('Owner'),ref('OwnerInput'),{idem:true,status:201});
route('/api/v1/owners/{rut}','get','Owner by normalized RUT in session clinic',ref('Owner'));
route('/api/v1/patients','get','Authorized patient projections',arr(ref('Patient')),null,{list:true,q:true,query:[{name:'species',in:'query',schema:str}]});
route('/api/v1/patients','post','Create patient; ficha.editar',ref('Patient'),ref('PatientInput'),{idem:true,status:201});
route('/api/v1/patients/{id}','get','Authorized patient projection',ref('Patient'));
route('/api/v1/owners/{rut}/patients','get','Authorized patients for owner',arr(ref('Patient')),null,{list:true,q:true});
route('/api/v1/appointments/availability','get','Real slots; agenda.gestionar',ref('Availability'),null,{query:[{name:'date',in:'query',required:true,schema:date},{name:'doctorId',in:'query',required:true,schema:uuid}]});
route('/api/v1/appointments','get','Own clinic appointments; agenda.gestionar',arr(ref('Appointment')),null,{list:true});
route('/api/v1/appointments','post','Book slot or explicit emergency; agenda.gestionar',ref('Appointment'),ref('AppointmentInput'),{status:201,idem:true});
const spec={openapi:'3.1.0',info:{title:'VetData — fundaciones Fase 1',version:'1.0.0',description:'API validation scope. Sharing and operational workflows remain later phases. Money is a reusable calculation schema, not a DTE endpoint.'},servers:[{url:'http://localhost:4000'}],security:[{accessCookie:[]}],paths,components:{securitySchemes:{accessCookie:{type:'apiKey',in:'cookie',name:'vetdata_access'},refreshCookie:{type:'apiKey',in:'cookie',name:'vetdata_refresh'}},parameters:params,schemas}};
const text='# OpenAPI — Fase 1\n\nContrato OpenAPI 3.1 en Markdown por solicitud del usuario. Extraer el bloque JSON para importar en herramientas OpenAPI. Regenerar con `node backend/scripts/export-fase1-openapi.cjs`.\n\nSesión: access 15 minutos; duración absoluta de sesión/refresh 30 días; recovery 30 minutos de un uso. Cookies httpOnly y SameSite=Lax; Secure con APP_ENV=production. Las expiraciones las valida la base; el reloj de negocio es inyectable. Rate limits por IP y cuenta; respuestas de recuperación iguales para cuenta existente e inexistente.\n\nListas: arrays, orden estable por ID salvo agenda (startsAt, ID), limit 50 por defecto / máximo 200, offset máximo 100000. Doctores es catálogo de profesionales activos de la clínica. Filtros q usan coincidencia literal sin comodines SQL; status/role de usuarios y species de pacientes usan coincidencia exacta. Filtros clínicos dependientes de PatientStatus quedan pendientes del desarrollador.\n\nMutaciones de negocio: Idempotency-Key obligatoria, aislada por actor/clínica/método/ruta y cuerpo normalizado; un reintento recupera respuesta canónica. No caducan automáticamente hasta definir retención. JSON desconocido se rechaza. No aceptar clinicId de cliente en recursos de negocio; solo login/cambio de contexto verifican membresía.\n\nMontos: enteros CLP netos; IVA centralizado al 19%, redondeado una vez sobre neto total. MoneyFromNet devuelve net/vat/total/ivaIncluded para presentación bruta. Emisión de factura interna, descuentos conectados a catálogo y DTE corresponden a fases posteriores.\n\nPaciente sin regla de estado aprobada: status null y statusPending true. Respuestas completas/resumidas se amplían en contrato de red Fase 2; este esquema permite esos campos. Errores: error.code/error.message y details opcional; X-Request-ID permite correlación sin registrar secretos.\n\n```json\n'+JSON.stringify(spec,null,2)+'\n```\n';
fs.writeFileSync(path.resolve(__dirname,'../../docs/backend/openapi-fase1.md'),text);
