#!/bin/sh
set -eu
ca=/caddy/caddy/pki/authorities/local/root.crt
attempt=0
while [ ! -f "$ca" ]; do
  attempt=$((attempt+1)); test "$attempt" -le 30; sleep 1
done
curl --retry 10 --retry-connrefused --retry-delay 1 --fail --cacert "$ca" --connect-to localhost:443:proxy:443 https://localhost/api/v1/health
curl --fail --location --cacert "$ca" --connect-to localhost:443:proxy:443 https://localhost/ | grep -q 'Iniciar sesión'
curl --fail --cacert "$ca" --connect-to localhost:443:proxy:443 -D /tmp/headers -c /tmp/cookies -H 'Origin: https://localhost' -H 'Content-Type: application/json' --data '{"email":"recovery@example.test","password":"Fixture-password-123"}' https://localhost/api/v1/auth/login
grep -i 'set-cookie:.*HttpOnly.*Secure' /tmp/headers >/dev/null
curl --fail --cacert "$ca" --connect-to localhost:443:proxy:443 -b /tmp/cookies https://localhost/api/v1/me
echo 'PASS: restored API login and HTTPS proxy routing (Next.js HTTP mode, internal CA)'
