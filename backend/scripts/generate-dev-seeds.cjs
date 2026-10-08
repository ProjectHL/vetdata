// Run from repository root: node backend/scripts/generate-dev-seeds.cjs
// Reads trusted, checked-in TS demo fixtures. No frontend source is modified.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const ts = require(path.join(root, 'frontend/node_modules/typescript'));
const cache = {};
function fixture(name) {
  if (cache[name]) return cache[name];
  const source = fs.readFileSync(path.join(root, 'frontend/src/mocks', name + '.ts'), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  vm.runInNewContext(output, { exports, require: (id) => {
    if (id !== './network') throw new Error('Unexpected dependency: ' + id);
    return fixture('network');
  } });
  return cache[name] = exports;
}
const { owners } = fixture('owners');
const { patients } = fixture('patients');
const { clinics, networkClinics } = fixture('network');
const quote = (s) => "'" + String(s ?? '').replaceAll("'", "''") + "'";
const id = (prefix, n) => prefix + '-e29b-41d4-a716-' + String(446655440000 + n);
function rut(value) {
  const body = value.replaceAll('.', '').split('-')[0];
  let sum = 0, factor = 2;
  for (const c of [...body].reverse()) { sum += Number(c) * factor; factor = factor === 7 ? 2 : factor + 1; }
  const dv = 11 - sum % 11;
  return body + '-' + (dv === 11 ? '0' : dv === 10 ? 'K' : dv);
}
let sql = '-- Generated DEVELOPMENT fixtures from frontend/src/mocks.\n-- Corrected synthetic RUT check digits; emails redirected to example.test.\n-- No demo balances, status triage, consent or sharing grants are imported.\n';
for (let i = 0; i < networkClinics.length; i++) {
  const cid = id('660e8400', i+2), gid = id('550e8400', i+1);
  sql += `INSERT INTO groups(id,name) VALUES(${quote(gid)},${quote('Demo '+networkClinics[i].sector)}) ON CONFLICT DO NOTHING;\n`;
  sql += `UPDATE clinics SET group_id=${quote(gid)},email=${quote('clinic'+(i+1)+'@example.test')} WHERE id=${quote(cid)};\n`;
  sql += `INSERT INTO clinic_hours(clinic_id,weekday,starts_at,ends_at,slot_minutes) SELECT ${quote(cid)},d,'09:00','20:00',30 FROM generate_series(1,6) d ON CONFLICT DO NOTHING;\n`;
}
for (let i=0;i<owners.length;i++) {
  const o=owners[i], oid=id('990e8400',i+1), corrected=rut(o.rut);
  sql+=`INSERT INTO owners(id,rut,first_name,last_name,email,phone,address,sector,region,birth_date,registered_at,preferred_contact) VALUES(${[oid,corrected,o.firstName,o.lastName,'owner'+(i+1)+'@example.test',o.phone,o.address,o.sector,o.region,o.birthDate,o.registeredAt,o.preferredContact].map(quote).join(',')}) ON CONFLICT DO NOTHING;\n`;
  sql+=`UPDATE owners SET rut=${quote(corrected)},email=${quote('owner'+(i+1)+'@example.test')} WHERE id=${quote(oid)};\n`;
}
for(let i=0;i<patients.length;i++) {
  const p=patients[i], oi=owners.findIndex(o=>o.rut===p.ownerRut), ci=clinics.indexOf(p.clinic);
  if(oi<0||ci<0) throw new Error('Missing owner or clinic for '+p.id);
  const oid=id('990e8400',oi+1), cid=id('660e8400',ci+2);
  sql+=`INSERT INTO clinic_owners(clinic_id,owner_id) VALUES(${quote(cid)},${quote(oid)}) ON CONFLICT DO NOTHING;\n`;
  const array=a=>'ARRAY['+a.map(quote).join(',')+']::text[]';
  sql+=`INSERT INTO patients(id,owner_id,origin_clinic_id,name,species,breed,sex,birth_date,color,sterilized,weight_kg,chip,allergies,conditions) VALUES(${[id('aa0e8400',i+1),oid,cid,p.name,p.species,p.breed,p.sex,p.birthDate,p.color].map(quote).join(',')},${!!p.sterilized},${Number(p.weightKg)},${quote(p.chip)},${array(p.allergies)},${array(p.conditions)}) ON CONFLICT DO NOTHING;\n`;
}
sql+=`UPDATE clinic_profiles SET rut=${quote(rut('76543210-3'))} WHERE clinic_id=${quote(id('660e8400',2))};\n`;
sql+="UPDATE memberships m SET status=u.status FROM users u WHERE m.user_id=u.id AND u.id::text LIKE '770e8400-%';\n";
fs.writeFileSync(path.join(root,'backend/seeds/003_demo_patients.sql'),sql);
console.log(`Generated ${owners.length} owners, ${patients.length} patients and ${networkClinics.length} clinic groups.`);
