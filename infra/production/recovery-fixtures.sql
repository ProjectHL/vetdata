-- Synthetic recovery evidence: populate domains that development seeds omit.
INSERT INTO catalog_items(id,clinic_id,kind,name,price_net)
VALUES('dd000000-0000-4000-8000-000000000001','660e8400-e29b-41d4-a716-446655440002','medication','Recovery fixture',1000);
INSERT INTO stock_lots(clinic_id,item_id,location,lot,qty,unit_cost)
VALUES('660e8400-e29b-41d4-a716-446655440002','dd000000-0000-4000-8000-000000000001','pharmacy','fixture-lot',7,400);
INSERT INTO invoices(id,clinic_id,owner_id,number,net,vat,total,paid,items,actor_id)
SELECT 'dd000000-0000-4000-8000-000000000002','660e8400-e29b-41d4-a716-446655440002','990e8400-e29b-41d4-a716-446655440001',9999,1000,190,1190,500,'[]',id
FROM users WHERE email='recovery@example.test';
INSERT INTO payments(clinic_id,invoice_id,amount,method,actor_id)
SELECT '660e8400-e29b-41d4-a716-446655440002','dd000000-0000-4000-8000-000000000002',500,'Efectivo',id FROM users WHERE email='recovery@example.test';
INSERT INTO sharing_requests(id,patient_id,requesting_clinic_id,origin_clinic_id,requested_by,reason,scope,duration,status,token_hash)
SELECT 'dd000000-0000-4000-8000-000000000003',p.id,'660e8400-e29b-41d4-a716-446655440003',p.origin_clinic_id,u.id,'Recovery fixture','Resumen clínico',30,'Aprobada','recovery-fixture-not-a-real-token'
FROM patients p CROSS JOIN users u WHERE p.owner_id='990e8400-e29b-41d4-a716-446655440001' AND p.origin_clinic_id='660e8400-e29b-41d4-a716-446655440002' AND u.email='recovery@example.test' LIMIT 1;
INSERT INTO sharing_grants(request_id,patient_id,origin_clinic_id,granted_to,owner_id,scope,since,until,consent_ip)
SELECT r.id,r.patient_id,r.origin_clinic_id,r.requesting_clinic_id,p.owner_id,r.scope,CURRENT_DATE,CURRENT_DATE+30,'127.0.0.1'
FROM sharing_requests r JOIN patients p ON p.id=r.patient_id WHERE r.id='dd000000-0000-4000-8000-000000000003';
