package handler

import (
	"net"
	"net/http"
	"net/netip"
	"strings"
)

// The single edge proxy overwrites X-Forwarded-For. Chains are rejected.
func proxyClientIP(r *http.Request, trusted []netip.Prefix) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return ""
	}
	peer, err := netip.ParseAddr(host)
	if err != nil {
		return ""
	}
	for _, prefix := range trusted {
		if prefix.Contains(peer.Unmap()) {
			value := strings.TrimSpace(r.Header.Get("X-Forwarded-For"))
			ip, err := netip.ParseAddr(value)
			if err != nil {
				return ""
			}
			return ip.Unmap().String()
		}
	}
	return ""
}
