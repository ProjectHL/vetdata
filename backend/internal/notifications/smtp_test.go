package notifications

import (
	"bufio"
	"context"
	"fmt"
	"net"
	"strings"
	"testing"
	"time"
)

// Exercises the SMTP wire protocol on loopback, never an external mailbox.
func TestSMTPDeliveryAndTLSRequirement(t *testing.T) {
	for _, plain := range []bool{true, false} {
		t.Run(fmt.Sprint(plain), func(t *testing.T) {
			listener, e := net.Listen("tcp", "127.0.0.1:0")
			if e != nil {
				t.Fatal(e)
			}
			defer listener.Close()
			result := make(chan string, 1)
			go func() {
				conn, e := listener.Accept()
				if e != nil {
					result <- ""
					return
				}
				defer conn.Close()
				_ = conn.SetDeadline(time.Now().Add(5 * time.Second))
				fmt.Fprint(conn, "220 localhost SMTP\r\n")
				reader := bufio.NewReader(conn)
				var body strings.Builder
				for {
					line, e := reader.ReadString('\n')
					if e != nil {
						result <- body.String()
						return
					}
					switch {
					case strings.HasPrefix(line, "EHLO"), strings.HasPrefix(line, "HELO"):
						fmt.Fprint(conn, "250 localhost\r\n")
					case strings.HasPrefix(line, "MAIL FROM:"), strings.HasPrefix(line, "RCPT TO:"):
						fmt.Fprint(conn, "250 OK\r\n")
					case strings.HasPrefix(line, "DATA"):
						fmt.Fprint(conn, "354 End with dot\r\n")
						for {
							line, e = reader.ReadString('\n')
							if e != nil {
								result <- ""
								return
							}
							if line == ".\r\n" {
								break
							}
							body.WriteString(line)
						}
						fmt.Fprint(conn, "250 accepted\r\n")
					case strings.HasPrefix(line, "QUIT"):
						fmt.Fprint(conn, "221 bye\r\n")
						result <- body.String()
						return
					default:
						fmt.Fprint(conn, "500 unsupported\r\n")
					}
				}
			}()
			sender := SMTP{Addr: listener.Addr().String(), From: "VetData <no-reply@example.test>", AllowPlain: plain}
			e = sender.Send(context.Background(), Message{To: "owner@example.test", Subject: "Recovery", Body: "local-test-token"})
			if plain && e != nil {
				t.Fatal(e)
			}
			if !plain && e == nil {
				t.Fatal("plaintext accepted without development opt-in")
			}
			select {
			case body := <-result:
				if plain && !strings.Contains(body, "local-test-token") {
					t.Fatal("message missing")
				}
				if !plain && body != "" {
					t.Fatal("secret sent without TLS")
				}
			case <-time.After(6 * time.Second):
				t.Fatal("SMTP timeout")
			}
		})
	}
}
