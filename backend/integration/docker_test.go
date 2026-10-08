package integration

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/cookiejar"
	"os"
	"strings"
	"testing"
	"time"
)

func TestDockerInstallationAndSMTPRecovery(t *testing.T) {
	base, mailURL := os.Getenv("VERIFY_API_URL"), os.Getenv("VERIFY_MAIL_URL")
	if base == "" {
		t.Skip("run docker-compose.verify.yml for the built-image gate")
	}
	jar, e := cookiejar.New(nil)
	if e != nil {
		t.Fatal(e)
	}
	client := &http.Client{Jar: jar, Timeout: 10 * time.Second}
	call := func(method, path string, input any, status int) []byte {
		t.Helper()
		var body []byte
		if input != nil {
			body, e = json.Marshal(input)
			if e != nil {
				t.Fatal(e)
			}
		}
		req, e := http.NewRequest(method, base+path, bytes.NewReader(body))
		if e != nil {
			t.Fatal(e)
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Origin", "http://localhost:3000")
		resp, e := client.Do(req)
		if e != nil {
			t.Fatal(e)
		}
		defer resp.Body.Close()
		raw, e := io.ReadAll(resp.Body)
		if e != nil {
			t.Fatal(e)
		}
		if resp.StatusCode != status {
			t.Fatalf("%s %s: got %d want %d", method, path, resp.StatusCode, status)
		}
		return raw
	}
	call("GET", "/healthz", nil, 200)
	login := func(password string) {
		call("POST", "/api/v1/auth/login", map[string]string{"email": "admin@example.test", "password": password}, 200)
	}
	login("Verify-only-password-123")
	raw := call("GET", "/api/v1/me", nil, 200)
	if !bytes.Contains(raw, []byte("usuarios.administrar")) {
		t.Fatal("admin permissions absent")
	}
	raw = call("GET", "/api/v1/patients", nil, 200)
	if !bytes.Contains(raw, []byte("Luna")) {
		t.Fatal("patients missing")
	}
	call("POST", "/api/v1/auth/recovery", map[string]string{"email": "admin@example.test"}, 202)
	get := func(path string) []byte {
		t.Helper()
		res, e := client.Get(mailURL + path)
		if e != nil {
			t.Fatal(e)
		}
		defer res.Body.Close()
		if res.StatusCode != 200 {
			t.Fatal("mail capture HTTP", res.StatusCode)
		}
		b, e := io.ReadAll(res.Body)
		if e != nil {
			t.Fatal(e)
		}
		return b
	}
	var token string
	deadline := time.Now().Add(20 * time.Second)
	for time.Now().Before(deadline) {
		var messages struct{ Messages []struct{ ID string } }
		if e = json.Unmarshal(get("/api/v1/messages"), &messages); e != nil {
			t.Fatal(e)
		}
		if len(messages.Messages) > 0 {
			var message struct{ Text string }
			if e = json.Unmarshal(get("/api/v1/message/"+messages.Messages[0].ID), &message); e != nil {
				t.Fatal(e)
			}
			if _, tail, found := strings.Cut(message.Text, "#token="); found {
				token = strings.TrimSpace(tail)
				break
			}
		}
		time.Sleep(200 * time.Millisecond)
	}
	if token == "" {
		t.Fatal("recovery email not delivered to local mailbox")
	}
	call("POST", "/api/v1/auth/reset", map[string]string{"token": token, "password": "Verify-changed-password-123"}, 204)
	call("GET", "/api/v1/me", nil, 401)
	call("POST", "/api/v1/auth/reset", map[string]string{"token": token, "password": "Verify-changed-password-456"}, 400)
	login("Verify-changed-password-123")
	call("POST", "/api/v1/auth/logout", nil, 204)
	call("GET", "/api/v1/me", nil, 401)
}
