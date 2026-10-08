// Package domain contains server-side invariants independent of HTTP or SQL.
package domain

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"
	_ "time/tzdata"
)

var Santiago = func() *time.Location {
	loc, err := time.LoadLocation("America/Santiago")
	if err != nil {
		panic(err)
	}
	return loc
}()

func UUID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	b[6] = (b[6] & 15) | 64
	b[8] = (b[8] & 63) | 128
	h := hex.EncodeToString(b)
	return h[:8] + "-" + h[8:12] + "-" + h[12:16] + "-" + h[16:20] + "-" + h[20:]
}
func ValidID(id string) bool {
	if len(id) != 36 {
		return false
	}
	for i, c := range id {
		if i == 8 || i == 13 || i == 18 || i == 23 {
			if c != '-' {
				return false
			}
		} else if !strings.ContainsRune("0123456789abcdefABCDEF", c) {
			return false
		}
	}
	return true
}
func NormalizeRUT(input string) (string, error) {
	s := strings.ToUpper(strings.NewReplacer(".", "", " ", "", "-", "").Replace(strings.TrimSpace(input)))
	if len(s) < 8 || len(s) > 9 {
		return "", errors.New("RUT inválido")
	}
	body, dv := s[:len(s)-1], s[len(s)-1:]
	sum, mul := 0, 2
	for i := len(body) - 1; i >= 0; i-- {
		if body[i] < '0' || body[i] > '9' {
			return "", errors.New("RUT inválido")
		}
		sum += int(body[i]-'0') * mul
		mul++
		if mul == 8 {
			mul = 2
		}
	}
	if body[0] == '0' {
		return "", errors.New("RUT inválido")
	}
	v := 11 - sum%11
	expected := strconv.Itoa(v)
	if v == 11 {
		expected = "0"
	} else if v == 10 {
		expected = "K"
	}
	if dv != expected {
		return "", errors.New("Dígito verificador inválido")
	}
	return body + "-" + dv, nil
}

// Amounts are CLP integers. Bounds keep integer arithmetic exact and safe.
const VATPercent int64 = 19

func Totals(net int64) (vat, total int64, err error) {
	if net < 0 || net > (math.MaxInt64-50)/(100+VATPercent) {
		return 0, 0, errors.New("Monto fuera de rango")
	}
	vat = (net*VATPercent + 50) / 100
	return vat, net + vat, nil
}

type Money struct {
	Net         int64 `json:"net"`
	VAT         int64 `json:"vat"`
	Total       int64 `json:"total"`
	IVAIncluded int64 `json:"ivaIncluded"`
}

// MoneyFromNet provides the same breakdown for internal invoices and gross
// receipt display. It does not issue a fiscal document or accept client totals.
func MoneyFromNet(net int64) (Money, error) {
	vat, total, e := Totals(net)
	if e != nil {
		return Money{}, e
	}
	return Money{net, vat, total, vat}, nil
}
func DiscountedLine(price, qty, discountPercent int64) (int64, error) {
	if price < 0 || qty <= 0 || discountPercent < 0 || discountPercent > 100 || price > (math.MaxInt64-50)/100/qty {
		return 0, errors.New("Línea inválida")
	}
	return (price*qty*(100-discountPercent) + 50) / 100, nil
}
func CivilDate(s string) (time.Time, error) {
	// A civil date has no time zone. Santiago can skip midnight when DST
	// starts, so parsing date-only values there can normalize to yesterday.
	return time.Parse("2006-01-02", s)
}
func LocalDate(t time.Time) string { return t.In(Santiago).Format("2006-01-02") }
func AddDays(s string, days int) (string, error) {
	d, err := CivilDate(s)
	if err != nil {
		return "", fmt.Errorf("Fecha inválida: %w", err)
	}
	return d.AddDate(0, 0, days).Format("2006-01-02"), nil
}
