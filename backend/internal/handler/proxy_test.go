package handler

import (
	"net/http/httptest"
	"net/netip"
	"testing"
)

func TestProxyTrust(t *testing.T) {
	trusted := []netip.Prefix{netip.MustParsePrefix("172.30.77.2/32")}
	for _, tc := range []struct{ peer, header, want string }{
		{"172.30.77.2:123", "203.0.113.4", "203.0.113.4"},
		{"172.30.77.3:123", "203.0.113.4", ""},
		{"172.30.77.2:123", "203.0.113.4, 127.0.0.1", ""},
		{"172.30.77.2:123", "invalid", ""},
	} {
		r := httptest.NewRequest("GET", "/", nil)
		r.RemoteAddr = tc.peer
		r.Header.Set("X-Forwarded-For", tc.header)
		if got := proxyClientIP(r, trusted); got != tc.want {
			t.Fatal(tc, got)
		}
	}
}
