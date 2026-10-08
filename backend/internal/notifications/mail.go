// Package notifications persists encrypted mail in an outbox before delivery.
package notifications

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/tls"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/mail"
	"net/smtp"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Message struct {
	To      string
	Subject string
	Body    string
}
type Sender interface {
	Send(context.Context, Message) error
}
type Outbox struct {
	pool   *pgxpool.Pool
	aead   cipher.AEAD
	sender Sender
}

func New(pool *pgxpool.Pool, key string, sender Sender) (*Outbox, error) {
	if key == "" {
		return &Outbox{pool: pool}, nil
	}
	raw, err := base64.StdEncoding.DecodeString(key)
	if err != nil || len(raw) != 32 {
		return nil, errors.New("OUTBOX_KEY must be base64 of 32 random bytes")
	}
	block, err := aes.NewCipher(raw)
	if err != nil {
		return nil, err
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	return &Outbox{pool: pool, aead: aead, sender: sender}, nil
}
func (o *Outbox) Enabled() bool { return o != nil && o.aead != nil && o.sender != nil }
func (o *Outbox) Enqueue(ctx context.Context, tx pgx.Tx, key string, m Message) error {
	if !o.Enabled() {
		return errors.New("mail unavailable")
	}
	if _, err := mail.ParseAddress(m.To); err != nil {
		return errors.New("invalid recipient")
	}
	raw, err := json.Marshal(m)
	if err != nil {
		return err
	}
	nonce := make([]byte, o.aead.NonceSize())
	if _, err = rand.Read(nonce); err != nil {
		return err
	}
	ciphertext := o.aead.Seal(nonce, nonce, raw, nil)
	_, err = tx.Exec(ctx, "INSERT INTO notification_outbox(dedup_key,encrypted_message) VALUES($1,$2) ON CONFLICT(dedup_key) DO NOTHING", key, ciphertext)
	return err
}

// DeliverOne claims a row atomically; SMTP runs without holding a database lock.
// SMTP is at-least-once after a crash; business operations remain idempotent.
func (o *Outbox) DeliverOne(ctx context.Context) (bool, error) {
	if !o.Enabled() {
		return false, nil
	}
	var id string
	var raw []byte
	err := o.pool.QueryRow(ctx, `UPDATE notification_outbox SET locked_until=now()+interval '2 minutes',attempts=attempts+1
 WHERE id=(SELECT id FROM notification_outbox WHERE sent_at IS NULL AND available_at<=now()
 AND (locked_until IS NULL OR locked_until<now()) ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED)
 RETURNING id,encrypted_message`).Scan(&id, &raw)
	if err == pgx.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	var m Message
	n := o.aead.NonceSize()
	if len(raw) < n {
		err = errors.New("invalid outbox payload")
	} else {
		var plain []byte
		plain, err = o.aead.Open(nil, raw[:n], raw[n:], nil)
		if err == nil {
			err = json.Unmarshal(plain, &m)
		}
	}
	if err == nil {
		sendCtx, cancel := context.WithTimeout(ctx, 20*time.Second)
		err = o.sender.Send(sendCtx, m)
		cancel()
	}
	if err != nil {
		_, e := o.pool.Exec(ctx, "UPDATE notification_outbox SET locked_until=NULL,available_at=now()+interval '5 minutes',last_error='delivery failed' WHERE id=$1", id)
		if e != nil {
			return true, e
		}
		return true, errors.New("mail delivery failed")
	}
	_, err = o.pool.Exec(ctx, "UPDATE notification_outbox SET sent_at=now(),locked_until=NULL,encrypted_message=NULL,last_error=NULL WHERE id=$1", id)
	return true, err
}

type SMTP struct {
	Addr, From, User, Password string
	AllowPlain                 bool
}

func (s SMTP) Send(ctx context.Context, m Message) error {
	if strings.ContainsAny(m.Subject, "\r\n") {
		return errors.New("invalid subject")
	}
	from, err := mail.ParseAddress(s.From)
	if err != nil {
		return err
	}
	to, err := mail.ParseAddress(m.To)
	if err != nil {
		return err
	}
	host, _, err := net.SplitHostPort(s.Addr)
	if err != nil {
		return err
	}
	conn, err := (&net.Dialer{Timeout: 10 * time.Second}).DialContext(ctx, "tcp", s.Addr)
	if err != nil {
		return err
	}
	defer conn.Close()
	deadline := time.Now().Add(20 * time.Second)
	if d, ok := ctx.Deadline(); ok {
		deadline = d
	}
	_ = conn.SetDeadline(deadline)
	c, err := smtp.NewClient(conn, host)
	if err != nil {
		return err
	}
	defer c.Close()
	if ok, _ := c.Extension("STARTTLS"); ok {
		if err = c.StartTLS(&tls.Config{ServerName: host, MinVersion: tls.VersionTLS12}); err != nil {
			return err
		}
	} else if !s.AllowPlain {
		return errors.New("SMTP TLS required")
	}
	if s.User != "" {
		if err = c.Auth(smtp.PlainAuth("", s.User, s.Password, host)); err != nil {
			return err
		}
	}
	if err = c.Mail(from.Address); err != nil {
		return err
	}
	if err = c.Rcpt(to.Address); err != nil {
		return err
	}
	w, err := c.Data()
	if err != nil {
		return err
	}
	_, err = fmt.Fprintf(w, "From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n%s", from.String(), to.String(), m.Subject, m.Body)
	if err != nil {
		return err
	}
	if err = w.Close(); err != nil {
		return err
	}
	return c.Quit()
}
